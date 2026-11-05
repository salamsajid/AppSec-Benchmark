import http2 from 'node:http2';

const PORT = Number(process.env.PORT || 8084);
const CONNECT_FLAG = process.env.FLAG_CONNECT || 'ASTRA{connect_tunnel_mesh_a8f2}';
const GRPC_FLAG = process.env.FLAG_GRPC || 'ASTRA{grpc_trailer_status_b1f0}';

function sendJson(stream, status, payload, trailers) {
  stream.respond({ ':status': status, 'content-type': 'application/json' }, trailers ? { waitForTrailers: true } : undefined);
  if (trailers) stream.on('wantTrailers', () => stream.sendTrailers(trailers));
  stream.end(JSON.stringify(payload));
}

const server = http2.createServer();

server.on('stream', (stream, headers) => {
  const method = headers[':method'];
  const path = headers[':path'];

  if (method === 'CONNECT') {
    const authority = String(headers[':authority'] || '');
    if (authority !== 'host-gateway') {
      stream.respond({ ':status': 403, 'content-type': 'text/plain' });
      stream.end('unknown connect authority');
      return;
    }
    stream.respond({ ':status': 200, 'content-type': 'text/plain', 'x-astra-tunnel': 'host-gateway' });
    stream.end(CONNECT_FLAG);
    return;
  }

  if (method === 'POST' && path === '/protocol/grpc/echo') {
    const trailers = {};
    let bytes = 0;
    stream.on('trailers', (incoming) => {
      for (const [key, value] of Object.entries(incoming)) trailers[key.toLowerCase()] = value;
    });
    stream.on('data', (chunk) => {
      bytes += chunk.length;
    });
    stream.on('end', () => {
      const statusSpoof = trailers['grpc-status'] === '0';
      const authenticated = Boolean(headers.authorization || trailers.authorization);
      if (statusSpoof && !authenticated) {
        sendJson(stream, 200, { ok: true, bytes, flag: GRPC_FLAG }, {
          'grpc-status': '0',
          'x-astra-grpc': 'trailer-authorized',
        });
        return;
      }
      sendJson(stream, 200, { ok: false, error: 'unauthenticated' }, { 'grpc-status': '16' });
    });
    return;
  }

  if (method === 'GET' && (path === '/' || path === '/protocol')) {
    sendJson(stream, 200, {
      service: 'astralane-h2-targets',
      chains: ['connect-tunnel-smuggle', 'grpc-trailer-spoof'],
      connect: 'CONNECT with :authority host-gateway',
      grpc: 'POST /protocol/grpc/echo with a request grpc-status: 0 trailer',
    });
    return;
  }

  sendJson(stream, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`astralane h2 targets listening on ${PORT}`);
});
