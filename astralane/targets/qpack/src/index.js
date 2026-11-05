import http from 'node:http';

const PORT = Number(process.env.PORT || 8086);
const FLAG = process.env.FLAG_QPACK || 'ASTRA{qpack_desync_header_5e17}';
const MAX_TABLE = 16;
const table = [];

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://qpack');
  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { service: 'astralane-qpack-target', status: 'ok', table: table.length });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/protocol/qpack/encoder') {
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString('utf8'));
    } catch {
      json(res, 400, { error: 'invalid encoder instruction' });
      return;
    }
    if (typeof body.name !== 'string' || typeof body.value !== 'string') {
      json(res, 422, { error: 'name and value are required' });
      return;
    }
    table.unshift({ name: body.name, value: body.value });
    while (table.length > MAX_TABLE) table.pop();
    json(res, 200, { ok: true, inserted: table.length - 1, table: table.length });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/protocol/qpack/request') {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      json(res, 413, { error: error.message });
      return;
    }
    if (body.length < 9) {
      json(res, 400, { error: 'truncated header block' });
      return;
    }
    const requiredInsertCount = body.readUInt32BE(0);
    const base = body.readUInt32BE(4);
    const representations = body.subarray(8);
    const headers = [];
    for (const byte of representations) {
      if ((byte & 0x80) !== 0) {
        const index = byte & 0x7f;
        const entry = table[index];
        if (!entry) {
          json(res, 400, { error: 'dynamic index outside table' });
          return;
        }
        headers.push(entry);
      } else {
        json(res, 400, { error: 'unsupported representation' });
        return;
      }
    }

    if (requiredInsertCount === 0 && representations.length > 0) {
      const authority = headers.find((header) => header.name === ':authority');
      if (authority?.value === 'internal-admin') {
        json(res, 200, { ok: true, headers, flag: FLAG, requiredInsertCount, base });
        return;
      }
    }

    json(res, 403, { ok: false, headers, requiredInsertCount, base });
    return;
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`astralane qpack target listening on ${PORT}`);
});
