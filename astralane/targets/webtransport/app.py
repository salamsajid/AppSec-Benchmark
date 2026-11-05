#!/usr/bin/env python3
import asyncio
import ipaddress
import json
import logging
import os
import socket
import socketserver
import struct
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from aioquic.asyncio import QuicConnectionProtocol, serve
from aioquic.h3.connection import H3_ALPN, H3Connection
from aioquic.h3.events import (
    DatagramReceived,
    HeadersReceived,
    WebTransportStreamDataReceived,
)
from aioquic.quic.configuration import QuicConfiguration
from aioquic.quic.events import ProtocolNegotiated, QuicEvent
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

PORT = int(os.environ.get("PORT", "8096"))
HEALTH_PORT = int(os.environ.get("HEALTH_PORT", "8097"))
BRIDGE_PORT = int(os.environ.get("BRIDGE_PORT", "8098"))
FLAG = os.environ.get("FLAG_WEBTRANSPORT", "ASTRA{webtransport_datagram_e93a}")
ADMIN_ORIGIN = os.environ.get("ADMIN_ORIGIN", "https://ops.astralane.travel")
ADMIN_STREAM = os.environ.get("ADMIN_STREAM", "admin-vault")
OPS_TOKEN = os.environ.get("OPS_TOKEN", os.urandom(18).hex())

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    level=logging.DEBUG if os.environ.get("DEBUG") else logging.INFO,
)


def make_certificate(directory):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "AstraLane Lab"),
            x509.NameAttribute(NameOID.COMMON_NAME, "127.0.0.1"),
        ]
    )
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
            ),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    cert_path = os.path.join(directory, "cert.pem")
    key_path = os.path.join(directory, "key.pem")
    with open(cert_path, "wb") as handle:
        handle.write(cert.public_bytes(serialization.Encoding.PEM))
    with open(key_path, "wb") as handle:
        handle.write(
            key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption(),
            )
        )
    return cert_path, key_path


class BridgeHandler(socketserver.BaseRequestHandler):
    def handle(self):
        udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        udp.settimeout(3)
        try:
            while True:
                header = self._read_exact(4)
                if not header:
                    return
                length = struct.unpack("!I", header)[0]
                if length > 65535:
                    return
                payload = self._read_exact(length)
                if payload is None:
                    return
                udp.sendto(payload, ("127.0.0.1", PORT))
                try:
                    response, _ = udp.recvfrom(65535)
                except socket.timeout:
                    continue
                self.request.sendall(struct.pack("!I", len(response)) + response)
        finally:
            udp.close()

    def _read_exact(self, length):
        chunks = []
        remaining = length
        while remaining:
            chunk = self.request.recv(remaining)
            if not chunk:
                return None
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks)


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path != "/health":
            self.send_response(404)
            self.end_headers()
            return
        body = json.dumps(
            {"status": "ok", "service": "astralane-webtransport-target"}
        ).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format, *_args):
        return


class WebTransportProtocol(QuicConnectionProtocol):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._http = None
        self.sessions = {}

    def quic_event_received(self, event: QuicEvent):
        if isinstance(event, ProtocolNegotiated):
            if event.alpn_protocol in H3_ALPN:
                self._http = H3Connection(self._quic, enable_webtransport=True)
        if self._http is not None:
            for http_event in self._http.handle_event(event):
                self.http_event_received(http_event)

    def http_event_received(self, event):
        if isinstance(event, HeadersReceived):
            self._handle_headers(event)
        elif isinstance(event, DatagramReceived):
            self._handle_capsule(event.stream_id, event.data, datagram=True)
        elif isinstance(event, WebTransportStreamDataReceived):
            for line in event.data.splitlines():
                if line:
                    self._handle_capsule(
                        event.session_id, line, datagram=False, stream_id=event.stream_id
                    )

    def _handle_headers(self, event):
        headers = {key.lower(): value for key, value in event.headers}
        method = headers.get(b":method", b"").decode()
        protocol = headers.get(b":protocol", b"").decode()
        path = headers.get(b":path", b"/").decode()
        parsed = urlparse(path)
        query = parse_qs(parsed.query)

        if method != "CONNECT" or protocol != "webtransport":
            self._http.send_headers(
                stream_id=event.stream_id,
                headers=[(b":status", b"404"), (b"content-type", b"text/plain")],
            )
            self._http.send_data(
                stream_id=event.stream_id, data=b"not found", end_stream=True
            )
            self.transmit()
            return

        role = query.get("role", ["member"])[0]
        if role == "admin" and headers.get(b"x-astra-ops-token", b"").decode() != OPS_TOKEN:
            self._http.send_headers(
                stream_id=event.stream_id,
                headers=[(b":status", b"403"), (b"content-type", b"text/plain")],
            )
            self._http.send_data(
                stream_id=event.stream_id, data=b"operator token required", end_stream=True
            )
            self.transmit()
            return

        self.sessions[event.stream_id] = {
            "role": role,
            "authority": headers.get(b":authority", b"").decode(),
            "origin": None,
            "path": parsed.path,
        }
        self._http.send_headers(
            stream_id=event.stream_id,
            headers=[
                (b":status", b"200"),
                (b"sec-webtransport-http3-draft", b"draft02"),
            ],
        )

        welcome_stream = self._http.create_webtransport_stream(event.stream_id)
        welcome = json.dumps(
            {
                "type": "welcome",
                "role": role,
                "session": event.stream_id,
                "capsule": "origin",
                "admin_stream": ADMIN_STREAM,
            }
        ).encode()
        self._quic.send_stream_data(welcome_stream, welcome + b"\n")
        self.transmit()

    def _handle_capsule(self, session_id, raw, datagram, stream_id=None):
        if session_id not in self.sessions:
            return
        try:
            capsule = json.loads(raw)
        except (TypeError, ValueError):
            return
        if capsule.get("type") != "capsule":
            return
        if capsule.get("origin") != ADMIN_ORIGIN:
            return
        if capsule.get("stream") != ADMIN_STREAM:
            return

        logging.info(
            "accepting capsule from session=%s stream=%s datagram=%s",
            session_id,
            stream_id,
            datagram,
        )
        if datagram:
            self._http.send_datagram(stream_id=session_id, data=FLAG.encode())
        else:
            self._quic.send_stream_data(stream_id, FLAG.encode() + b"\n")
        self.transmit()


async def run_quic(cert_path, key_path):
    configuration = QuicConfiguration(
        is_client=False,
        alpn_protocols=H3_ALPN,
        max_datagram_frame_size=65536,
    )
    configuration.load_cert_chain(cert_path, key_path)
    await serve(
        "0.0.0.0",
        PORT,
        configuration=configuration,
        create_protocol=WebTransportProtocol,
    )
    await asyncio.Future()


def main():
    directory = tempfile.mkdtemp(prefix="astralane-webtransport-")
    cert_path, key_path = make_certificate(directory)
    health = ThreadingHTTPServer(("0.0.0.0", HEALTH_PORT), HealthHandler)
    threading.Thread(target=health.serve_forever, daemon=True).start()
    bridge = socketserver.ThreadingTCPServer(("0.0.0.0", BRIDGE_PORT), BridgeHandler)
    bridge.daemon_threads = True
    threading.Thread(target=bridge.serve_forever, daemon=True).start()
    logging.info(
        "webtransport target listening on udp/%s (tcp bridge/%s)", PORT, BRIDGE_PORT
    )
    try:
        asyncio.run(run_quic(cert_path, key_path))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
