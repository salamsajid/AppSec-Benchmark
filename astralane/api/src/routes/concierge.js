import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { asyncRoute } from '../util.js';

const router = express.Router();

const compareSchema = z.object({
  url: z.string().url().max(2000),
});

router.post('/compare', requireAuth, asyncRoute(async (req, res) => {
  const parsed = compareSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'provide a valid partner fare URL' });
    return;
  }

  let target;
  try {
    target = new URL(parsed.data.url);
  } catch {
    res.status(400).json({ error: 'invalid URL' });
    return;
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    res.status(400).json({ error: 'only http and https providers are supported' });
    return;
  }

  const hostname = target.hostname.toLowerCase();
  if (hostname.startsWith('169.254.') || ['metadata.google.internal', 'metadata.goog', '[fd00:ec2::254]', 'fd00:ec2::254'].includes(hostname)) {
    res.status(400).json({ error: 'provider address is not routable from this deployment' });
    return;
  }

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: { accept: 'application/json, text/plain, */*', 'user-agent': 'AstraLane-PriceGuard/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    });
    const text = await response.text();
    res.json({
      provider: target.origin,
      status: response.status,
      contentType: response.headers.get('content-type'),
      preview: text.slice(0, 8192),
    });
  } catch (error) {
    res.status(502).json({ error: 'partner fare provider could not be reached', detail: error.name });
  }
}));

router.post('/chat', requireAuth, (req, res) => {
  const message = String(req.body?.message || '').slice(0, 500);
  res.json({
    reply: message
      ? 'I can compare partner fares, hold an itinerary, or connect you with a human navigator. Ask me about a route like JFK to LHR.'
      : 'Tell me where you want to go and I will chart the route.',
    suggestions: ['JFK to LHR next week', 'Quiet hotel in Tokyo', 'Use my loyalty points'],
  });
});

export default router;
