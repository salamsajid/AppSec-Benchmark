import http from 'node:http';

const PORT = Number(process.env.PORT || 9000);
const objects = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('object too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://s3');
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: 'astralane-s3', status: 'ok', objects: objects.size }));
    return;
  }

  if (!url.pathname.startsWith('/uploads/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'bucket not found' }));
    return;
  }

  const key = decodeURIComponent(url.pathname.slice('/uploads/'.length));
  if (req.method === 'PUT') {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      res.writeHead(413, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    objects.set(key, {
      body,
      contentType: req.headers['content-type'] || 'application/octet-stream',
      storedAt: Date.now(),
    });
    res.writeHead(200, { etag: `"${Buffer.from(key).toString('hex')}"` });
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const object = objects.get(key);
    if (!object) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'no such key' }));
      return;
    }
    res.writeHead(200, { 'content-type': object.contentType });
    res.end(object.body);
    return;
  }

  res.writeHead(405, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'method not allowed' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`astralane s3 target listening on ${PORT}`);
});
