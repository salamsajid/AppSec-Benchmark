import express from 'express';

const router = express.Router();
const CHUNKED_FLAG = process.env.FLAG_CHUNKED || 'ASTRA{chunked_trailer_smuggle_9a3e}';
const ESI_FLAG = process.env.FLAG_ESI || 'ASTRA{esi_range_cache_6d58}';
const CHUNKED_ADMIN_TOKEN = 'astra-chunked-admin-7f31';
const esiCache = new Map();

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-protocol-targets',
    chains: ['chunked-trailer-smuggle', 'esi-range-poison'],
    chunked: {
      endpoint: '/arena/protocol/chunked/upload',
      hint: 'The upload handler trusts an HTTP trailer as an authorization header.',
    },
    esi: {
      fragment: '/arena/protocol/esi/fragment',
      page: '/arena/protocol/esi/page',
      hint: 'The fragment cache ignores the query string and Range header before the ESI renderer resolves includes.',
    },
  });
});

router.post('/chunked/upload', (req, res) => {
  if (req.headers['x-auth-token']) {
    res.status(403).json({ error: 'authorization headers are not accepted on this route' });
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('error', () => {
    if (!res.headersSent) res.status(400).json({ error: 'invalid request body' });
  });
  req.on('end', () => {
    const trailer = req.trailers?.['x-auth-token'];
    if (trailer !== CHUNKED_ADMIN_TOKEN) {
      res.status(403).json({ error: 'operator trailer required' });
      return;
    }
    res.json({
      ok: true,
      bytes: Buffer.concat(chunks).length,
      trailerAccepted: true,
      flag: CHUNKED_FLAG,
    });
  });
});

router.get('/esi/fragment', (req, res) => {
  const body = typeof req.query.body === 'string' ? req.query.body : 'public-fragment';
  esiCache.set('/protocol/esi/fragment', {
    body,
    range: req.headers.range || null,
    cachedAt: Date.now(),
  });
  res.type('text/html').send(body);
});

router.get('/esi/admin', (req, res) => {
  if (req.headers['x-esi-internal'] !== '1') {
    res.status(403).type('text/plain').send('internal ESI include only');
    return;
  }
  res.type('text/plain').send(ESI_FLAG);
});

router.get('/esi/page', async (_req, res) => {
  const cached = esiCache.get('/protocol/esi/fragment');
  let html = `<main>${cached?.body || 'public-fragment'}</main>`;
  const includes = [...html.matchAll(/<!--\s*esi\s+include="([^"]+)"\s*-->/g)];
  for (const match of includes) {
    const target = match[1];
    if (!target.startsWith('/protocol/esi/admin')) continue;
    const included = await fetch(`http://127.0.0.1:8082${target}`, {
      headers: { 'x-esi-internal': '1' },
    });
    html = html.replace(match[0], await included.text());
  }

  if (html.includes(ESI_FLAG)) {
    res.json({ ok: true, flag: ESI_FLAG, html });
    return;
  }
  res.type('text/html').send(html);
});

export default router;
