import express from 'express';

const router = express.Router();
const FLAG = process.env.FLAG_MULTIPART || 'ASTRA{multipart_boundary_s3_7c44}';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://minio:9000';
const S3_BUCKET = process.env.S3_BUCKET || 'uploads';

function parseParts(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(delimiter);

  while (cursor !== -1) {
    cursor += delimiter.length;
    if (buffer.subarray(cursor, cursor + 2).toString() === '--') break;
    if (buffer.subarray(cursor, cursor + 2).toString() === '\r\n') cursor += 2;

    const next = buffer.indexOf(delimiter, cursor);
    if (next === -1) break;

    let part = buffer.subarray(cursor, next);
    if (part.subarray(-2).toString() === '\r\n') part = part.subarray(0, -2);

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      cursor = next;
      continue;
    }

    const headerText = part.subarray(0, headerEnd).toString('latin1');
    const headers = {};
    for (const line of headerText.split('\r\n')) {
      const separator = line.indexOf(':');
      if (separator === -1) continue;
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }

    const disposition = headers['content-disposition'] || '';
    const filename = disposition.match(/filename="([^"]*)"/)?.[1] || null;
    parts.push({
      filename,
      contentType: headers['content-type'] || 'application/octet-stream',
      body: part.subarray(headerEnd + 4),
    });
    cursor = next;
  }

  return parts;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
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

router.post('/multipart/upload', async (req, res) => {
  const contentType = req.headers['content-type'] || '';
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) {
    res.status(400).json({ error: 'multipart boundary required' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    res.status(413).json({ error: error.message });
    return;
  }

  const parts = parseParts(body, boundary);
  if (parts.length === 0) {
    res.status(400).json({ error: 'no multipart parts' });
    return;
  }

  const validated = parts[0];
  if (!validated.filename || !validated.filename.endsWith('.png')) {
    res.status(422).json({ error: 'first part must be a png' });
    return;
  }

  const stored = parts[parts.length - 1];
  if (!stored.filename) {
    res.status(422).json({ error: 'stored part requires a filename' });
    return;
  }

  const key = `${Date.now()}-${stored.filename}`;
  let upload;
  try {
    upload = await fetch(`${S3_ENDPOINT}/${S3_BUCKET}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'content-type': stored.contentType },
      body: stored.body,
    });
  } catch (error) {
    res.status(502).json({ error: 'object store unavailable', detail: error.message });
    return;
  }

  if (!upload.ok) {
    res.status(502).json({ error: 'object store rejected upload', status: upload.status });
    return;
  }

  const payload = {
    ok: true,
    validated: validated.filename,
    stored: key,
    backend: 's3',
  };
  if (stored.filename.endsWith('.jsp')) {
    payload.flag = FLAG;
  }
  res.json(payload);
});

router.get('/multipart', (_req, res) => {
  res.json({
    service: 'astralane-multipart-target',
    chain: 'multipart-boundary-s3',
    endpoint: '/protocol/multipart/upload',
    hint: 'The validator inspects the first part, while the object store keeps the last part.',
  });
});

export default router;
