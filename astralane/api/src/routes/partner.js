import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { partnerSecret, pool } from '../db.js';
import { asyncRoute } from '../util.js';

const router = express.Router();

const timingSleeper = new Int32Array(new SharedArrayBuffer(4));

function burn(milliseconds) {
  Atomics.wait(timingSleeper, 0, 0, milliseconds);
}

function slowCompare(provided, expected) {
  const left = String(provided);
  const right = String(expected);
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (left.charCodeAt(index) !== right.charCodeAt(index)) return false;
    burn(config.partnerTimingDelayMs);
  }
  return true;
}

const handshakeSchema = z.object({
  partner: z.string().min(1).max(40),
  secret: z.string().min(1).max(200),
});

router.post('/handshake', asyncRoute(async (req, res) => {
  const parsed = handshakeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid handshake' });
    return;
  }

  const record = await partnerSecret(parsed.data.partner);
  if (!record || !slowCompare(parsed.data.secret, record.secret)) {
    res.status(401).json({ error: 'partner credentials rejected' });
    return;
  }

  res.json({ ok: true, partner: parsed.data.partner, capabilities: ['settlement.webhook'] });
}));

const eventSchema = z.object({
  bookingRef: z.string().min(3).max(40),
  status: z.literal('paid'),
  amountCents: z.number().int().positive(),
});

router.post('/webhook', asyncRoute(async (req, res) => {
  const partner = String(req.headers['x-partner'] || '');
  const provided = String(req.headers['x-signature'] || '');
  const record = await partnerSecret(partner);
  if (!record) {
    res.status(401).json({ error: 'unknown partner' });
    return;
  }

  const raw = req.rawBody || Buffer.from('');
  if (!raw.length) {
    res.status(400).json({ error: 'empty webhook body' });
    return;
  }

  const expected = crypto.createHmac('sha256', record.secret).update(raw).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  const signatureValid =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!signatureValid) {
    res.status(401).json({ error: 'invalid webhook signature' });
    return;
  }

  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'invalid webhook payload' });
    return;
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid settlement event' });
    return;
  }

  const booking = await pool.query('SELECT * FROM bookings WHERE ref = $1', [parsed.data.bookingRef]);
  if (!booking.rows[0] || booking.rows[0].amount_cents !== parsed.data.amountCents) {
    res.status(409).json({ error: 'settlement does not match an open itinerary' });
    return;
  }

  await pool.query("UPDATE bookings SET status = 'paid', meta = meta || $2::jsonb WHERE ref = $1", [
    parsed.data.bookingRef,
    JSON.stringify({ settledBy: partner, settledAt: new Date().toISOString() }),
  ]);

  await pool.query(
    'INSERT INTO audit_logs (actor, action, detail) VALUES ($1,$2,$3)',
    [`partner:${partner}`, 'settlement_webhook', JSON.stringify({ ref: parsed.data.bookingRef })],
  );

  res.json({
    ok: true,
    settled: true,
    bookingRef: parsed.data.bookingRef,
    settlement: 'orbit-pay-settlement-cleared',
    vaultNote: record.flag,
  });
}));

export default router;
