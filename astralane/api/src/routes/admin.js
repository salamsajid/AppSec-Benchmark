import express from 'express';
import { config } from '../config.js';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { redis, walletBalance } from '../redis.js';
import { asyncRoute } from '../util.js';

const router = express.Router();

router.get('/vault', requireAdmin, asyncRoute(async (req, res) => {
  const samlMarker =
    Array.isArray(req.auth.amr) && req.auth.amr.includes('saml')
      ? await redis.get(`saml-session:${req.auth.jti}`)
      : null;
  const samlSession = samlMarker === `${req.auth.sub}:${req.auth.role}`;

  const [bookings, users, audit] = await Promise.all([
    pool.query("SELECT * FROM bookings WHERE status <> 'archived' ORDER BY created_at DESC"),
    pool.query('SELECT id, email, name, role, loyalty_tier, passport_no FROM users ORDER BY created_at ASC'),
    pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30'),
  ]);

  res.json({
    vault: samlSession ? null : config.flags.adminVault,
    samlVault: samlSession ? config.flags.saml : null,
    bookings: bookings.rows.map((row) => ({
      ref: row.ref,
      userId: row.user_id,
      status: row.status,
      amountCents: row.amount_cents,
      passengerName: row.passenger_name,
      passportNo: row.passport_no,
      notes: row.notes,
    })),
    users: users.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      loyaltyTier: row.loyalty_tier,
      passportNo: row.passport_no,
    })),
    audit: audit.rows,
  });
}));

router.get('/users', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT id, email, name, role, loyalty_tier, passport_no, created_at FROM users ORDER BY created_at ASC');
  res.json({ users: result.rows });
}));

router.get('/audit', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
  res.json({ audit: result.rows });
}));

router.post('/payout', requireAuth, asyncRoute(async (req, res) => {
  const amount = Math.min(Math.max(Number(req.body?.amount || 25000), 1), 25000);
  let allowed = false;
  let failOpen = false;

  try {
    const response = await fetch(`${config.authzUrl}/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: req.auth.role, action: 'payout', amount }),
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const decision = await response.json();
      allowed = decision.allow === true;
    }
  } catch {
    allowed = true;
    failOpen = true;
  }

  if (!allowed) {
    res.status(403).json({ error: 'operator approval required for settlement payout' });
    return;
  }

  await redis.hincrby(`wallet:${req.auth.sub}`, 'balance', amount);
  res.json({
    ok: true,
    payoutCents: amount,
    failOpen,
    balance: await walletBalance(req.auth.sub),
    vaultNote: failOpen ? config.flags.payout : null,
  });
}));

export default router;
