import crypto from 'node:crypto';
import dgram from 'node:dgram';
import net from 'node:net';

const PORT = Number(process.env.PORT || 3478);
const ADMIN_PORT = Number(process.env.ADMIN_PORT || 9091);
const FLAG = process.env.FLAG_TURN || 'ASTRA{turn_loopback_pivot_c7a1}';
const COOKIE = Buffer.from([0x21, 0x12, 0xa4, 0x42]);

const ALLOCATE_REQUEST = 0x0003;
const ALLOCATE_SUCCESS = 0x0103;
const CREATE_PERMISSION_REQUEST = 0x0008;
const CREATE_PERMISSION_SUCCESS = 0x0108;
const SEND_INDICATION = 0x0016;
const DATA_INDICATION = 0x0017;
const XOR_PEER_ADDRESS = 0x0012;
const DATA = 0x0013;
const XOR_RELAYED_ADDRESS = 0x0016;
const XOR_MAPPED_ADDRESS = 0x0020;
const REQUESTED_TRANSPORT = 0x0019;
const LIFETIME = 0x000d;

const allocations = new Map();

function pad4(length) {
  return (4 - (length % 4)) % 4;
}

function attribute(type, value) {
  const header = Buffer.alloc(4);
  header.writeUInt16BE(type, 0);
  header.writeUInt16BE(value.length, 2);
  return Buffer.concat([header, value, Buffer.alloc(pad4(value.length))]);
}

function message(type, transactionId, attributes = []) {
  const body = Buffer.concat(attributes);
  const header = Buffer.alloc(20);
  header.writeUInt16BE(type, 0);
  header.writeUInt16BE(body.length, 2);
  COOKIE.copy(header, 4);
  transactionId.copy(header, 8);
  return Buffer.concat([header, body]);
}

function xorAddress(host, port) {
  const value = Buffer.alloc(8);
  value[0] = 0;
  value[1] = 1;
  value.writeUInt16BE(port ^ 0x2112, 2);
  const octets = host.split('.').map(Number);
  for (let i = 0; i < 4; i += 1) value[4 + i] = octets[i] ^ COOKIE[i];
  return value;
}

function parseAddress(value) {
  if (!value || value.length < 8 || value[1] !== 1) return null;
  const port = value.readUInt16BE(2) ^ 0x2112;
  const octets = [];
  for (let i = 0; i < 4; i += 1) octets.push(value[4 + i] ^ COOKIE[i]);
  return { host: octets.join('.'), port };
}

function parseAttributes(buffer) {
  const attributes = [];
  let offset = 20;
  while (offset + 4 <= buffer.length) {
    const type = buffer.readUInt16BE(offset);
    const length = buffer.readUInt16BE(offset + 2);
    const value = buffer.subarray(offset + 4, offset + 4 + length);
    attributes.push({ type, value });
    offset += 4 + length + pad4(length);
  }
  return attributes;
}

function getAttribute(attributes, type) {
  return attributes.find((entry) => entry.type === type)?.value;
}

function frame(packet) {
  const header = Buffer.alloc(2);
  header.writeUInt16BE(packet.length, 0);
  return Buffer.concat([header, packet]);
}

function handlePacket(packet, client, sendResponse) {
  if (packet.length < 20) return;
  const type = packet.readUInt16BE(0);
  const transactionId = packet.subarray(8, 20);
  const attributes = parseAttributes(packet);
  const allocationKey = `${client.host}:${client.port}`;

  if (type === ALLOCATE_REQUEST) {
    let allocation = allocations.get(allocationKey);
    if (!allocation) {
      const relay = dgram.createSocket('udp4');
      allocation = { relay, client, sendResponse };
      allocations.set(allocationKey, allocation);
      relay.on('message', (data, peer) => {
        const response = message(DATA_INDICATION, crypto.randomBytes(12), [
          attribute(XOR_PEER_ADDRESS, xorAddress(peer.address, peer.port)),
          attribute(DATA, data),
        ]);
        sendResponse(response);
      });
      relay.bind(0, '127.0.0.1', () => {
        const relayAddress = relay.address();
        sendResponse(message(ALLOCATE_SUCCESS, transactionId, [
          attribute(XOR_RELAYED_ADDRESS, xorAddress(relayAddress.address, relayAddress.port)),
          attribute(XOR_MAPPED_ADDRESS, xorAddress(client.host, client.port)),
          attribute(LIFETIME, Buffer.from([0x00, 0x00, 0x02, 0x58])),
        ]));
      });
      return;
    }
    const relayAddress = allocation.relay.address();
    allocation.sendResponse = sendResponse;
    sendResponse(message(ALLOCATE_SUCCESS, transactionId, [
      attribute(XOR_RELAYED_ADDRESS, xorAddress(relayAddress.address, relayAddress.port)),
      attribute(XOR_MAPPED_ADDRESS, xorAddress(client.host, client.port)),
      attribute(LIFETIME, Buffer.from([0x00, 0x00, 0x02, 0x58])),
    ]));
    return;
  }

  if (type === CREATE_PERMISSION_REQUEST) {
    sendResponse(message(CREATE_PERMISSION_SUCCESS, transactionId, []));
    return;
  }

  if (type === SEND_INDICATION) {
    const allocation = allocations.get(allocationKey);
    const peer = parseAddress(getAttribute(attributes, XOR_PEER_ADDRESS));
    const payload = getAttribute(attributes, DATA);
    if (allocation && peer && payload) allocation.relay.send(payload, peer.port, peer.host);
  }
}

const admin = dgram.createSocket('udp4');
admin.on('message', (data, rinfo) => {
  const reply = data.toString('utf8').includes('ASTRA-TURN-PROBE') ? FLAG : 'turn-admin-denied';
  admin.send(Buffer.from(reply, 'utf8'), rinfo.port, rinfo.address);
});
admin.bind(ADMIN_PORT, '127.0.0.1');

const udp = dgram.createSocket('udp4');
udp.on('message', (packet, rinfo) => {
  handlePacket(packet, { host: rinfo.address, port: rinfo.port }, (response) => {
    udp.send(response, rinfo.port, rinfo.address);
  });
});
udp.bind(PORT, '0.0.0.0');

const tcp = net.createServer((socket) => {
  let buffer = Buffer.alloc(0);
  const client = { host: socket.remoteAddress?.replace('::ffff:', '') || '127.0.0.1', port: socket.remotePort || 0 };
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const length = buffer.readUInt16BE(0);
      if (buffer.length < 2 + length) break;
      const packet = buffer.subarray(2, 2 + length);
      buffer = buffer.subarray(2 + length);
      handlePacket(packet, client, (response) => socket.write(frame(response)));
    }
  });
});
tcp.listen(PORT, '0.0.0.0', () => {
  console.log(`astralane turn target listening on tcp/udp ${PORT}`);
});
