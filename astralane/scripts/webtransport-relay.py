#!/usr/bin/env python3
import argparse
import asyncio
import struct


class Relay(asyncio.DatagramProtocol):
    def __init__(self, bridge_host, bridge_port):
        self.bridge_host = bridge_host
        self.bridge_port = bridge_port
        self.transport = None
        self.connections = {}

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        asyncio.create_task(self.forward(data, addr))

    async def forward(self, data, addr):
        connection = self.connections.get(addr)
        if connection is None:
            try:
                reader, writer = await asyncio.open_connection(
                    self.bridge_host, self.bridge_port
                )
            except OSError:
                return
            connection = {"reader": reader, "writer": writer, "lock": asyncio.Lock()}
            self.connections[addr] = connection
            asyncio.create_task(self.read_responses(addr, connection))

        try:
            async with connection["lock"]:
                connection["writer"].write(struct.pack("!I", len(data)) + data)
                await connection["writer"].drain()
        except (ConnectionError, OSError):
            self.connections.pop(addr, None)

    async def read_responses(self, addr, connection):
        reader = connection["reader"]
        try:
            while True:
                header = await reader.readexactly(4)
                length = struct.unpack("!I", header)[0]
                response = await reader.readexactly(length)
                self.transport.sendto(response, addr)
        except (asyncio.IncompleteReadError, ConnectionError, OSError):
            self.connections.pop(addr, None)


async def main():
    parser = argparse.ArgumentParser(description="Forward UDP QUIC datagrams to the target TCP bridge")
    parser.add_argument("--listen-host", default="127.0.0.1")
    parser.add_argument("--listen-port", type=int, default=18096)
    parser.add_argument("--bridge-host", default="127.0.0.1")
    parser.add_argument("--bridge-port", type=int, default=18098)
    args = parser.parse_args()

    loop = asyncio.get_running_loop()
    transport, _ = await loop.create_datagram_endpoint(
        lambda: Relay(args.bridge_host, args.bridge_port),
        local_addr=(args.listen_host, args.listen_port),
    )
    try:
        await asyncio.Future()
    finally:
        transport.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
