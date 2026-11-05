import express from 'express';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import { asyncRoute } from '../util.js';

const router = express.Router();

router.post('/promo', requireAuth, asyncRoute(async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';

  try {
    const response = await fetch(`${config.authzUrl}/regex`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: code }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json().catch(() => ({}));
    res.status(response.status).json(result);
  } catch {
    res.status(504).json({ error: 'promotion service did not respond' });
  }
}));

export default router;
