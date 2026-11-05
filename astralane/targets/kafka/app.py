import base64
import json
import os
import pickle
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from kafka import KafkaConsumer, KafkaProducer

PORT = int(os.environ.get("PORT", "8091"))
FLAG = os.environ.get("FLAG_KAFKA", "ASTRA{kafka_dlq_deserialization_8c13}")
BROKER = os.environ.get("KAFKA_BROKER", "kafka:9092")
FLAG_PATH = "/flag"
RESULT_PATH = "/tmp/astralane-kafka-flag"
producer = None
producer_lock = threading.Lock()


def write_flag():
    with open(FLAG_PATH, "w", encoding="utf-8") as handle:
        handle.write(FLAG)


def get_producer():
    global producer
    with producer_lock:
        if producer is None:
            producer = KafkaProducer(
                bootstrap_servers=BROKER,
                acks="all",
                retries=10,
                linger_ms=10,
            )
        return producer


def event_worker():
    while True:
        consumer = None
        try:
            consumer = KafkaConsumer(
                "events",
                bootstrap_servers=BROKER,
                group_id="astralane-events",
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda value: value,
            )
            while True:
                records = consumer.poll(timeout_ms=1000)
                for messages in records.values():
                    for message in messages:
                        try:
                            json.loads(message.value.decode("utf-8"))
                        except Exception:
                            try:
                                get_producer().send(
                                    "events-dlq",
                                    base64.b64encode(message.value),
                                ).get(timeout=5)
                                print("forwarded malformed event to dlq", flush=True)
                            except Exception as error:
                                print("dlq forward failed", repr(error), flush=True)
        except Exception as error:
            print("event worker failed", repr(error), flush=True)
            time.sleep(2)
        finally:
            if consumer is not None:
                consumer.close()


def dlq_worker():
    while True:
        consumer = None
        try:
            consumer = KafkaConsumer(
                "events-dlq",
                bootstrap_servers=BROKER,
                group_id="astralane-dlq",
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda value: value,
            )
            while True:
                records = consumer.poll(timeout_ms=1000)
                for messages in records.values():
                    for message in messages:
                        try:
                            pickle.loads(base64.b64decode(message.value))
                            print("dlq payload deserialized", flush=True)
                        except Exception as error:
                            print("dlq payload rejected", repr(error), flush=True)
        except Exception as error:
            print("dlq worker failed", repr(error), flush=True)
            time.sleep(2)
        finally:
            if consumer is not None:
                consumer.close()


class Handler(BaseHTTPRequestHandler):
    server_version = "astralane-kafka-target/1.0"

    def log_message(self, *_args):
        return

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "service": "astralane-kafka-target"})
            return
        if self.path == "/":
            self.send_json(
                200,
                {
                    "service": "astralane-kafka-target",
                    "publish": "/arena/kafka/publish",
                    "result": "/arena/kafka/result",
                    "hint": "Malformed events are forwarded to a legacy DLQ sink that unpickles the payload.",
                },
            )
            return
        if self.path == "/result":
            if os.path.exists(RESULT_PATH):
                with open(RESULT_PATH, "r", encoding="utf-8") as handle:
                    flag = handle.read().strip()
                self.send_json(200, {"ok": True, "flag": flag})
                return
            self.send_json(404, {"error": "no DLQ result yet"})
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/publish":
            self.send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            data = base64.b64decode(payload.get("data", ""), validate=True)
        except Exception:
            self.send_json(400, {"error": "data must be base64"})
            return
        try:
            get_producer().send("events", data).get(timeout=5)
        except Exception:
            self.send_json(503, {"error": "kafka publish failed"})
            return
        self.send_json(202, {"ok": True, "bytes": len(data)})


def main():
    write_flag()
    threading.Thread(target=event_worker, daemon=True).start()
    threading.Thread(target=dlq_worker, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
