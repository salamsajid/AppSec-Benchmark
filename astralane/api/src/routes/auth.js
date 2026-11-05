import express from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { pool } from '../db.js';
import {
  loadSigningKey,
  publicJwks,
  requireAuth,
  signSession,
  verifySession,
} from '../auth.js';
import { asyncRoute, hashPassword, randomId, setSessionCookie, verifyPassword } from '../util.js';

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    loyaltyTier: user.loyalty_tier,
    passportNo: user.passport_no,
    phone: user.phone,
    createdAt: user.created_at,
  };
}

router.post('/register', asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid registration details' });
    return;
  }

  const { email, password, name } = parsed.data;
  const normalized = email.toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalized]);
  if (existing.rows.length) {
    res.status(409).json({ error: 'an account already exists for this email' });
    return;
  }

  const id = randomId('usr_');
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, loyalty_tier)
     VALUES ($1,$2,$3,$4,'traveler','Silver')`,
    [id, normalized, hashPassword(password), name],
  );

  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  const user = result.rows[0];
  const token = signSession(user);
  setSessionCookie(res, token);
  res.status(201).json({ token, user: publicUser(user) });
}));

router.post('/login', asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid credentials format' });
    return;
  }

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [parsed.data.email.toLowerCase()]);
  const user = result.rows[0];
  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    res.status(401).json({ error: 'email or password is incorrect' });
    return;
  }

  const token = signSession(user);
  setSessionCookie(res, token);
  res.json({ token, user: publicUser(user) });
}));

router.post('/refresh', requireAuth, asyncRoute(async (req, res) => {
  await loadSigningKey();
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.auth.sub]);
  const user = result.rows[0];
  if (!user) {
    res.status(401).json({ error: 'account is no longer active' });
    return;
  }
  const token = signSession(user, { amr: req.auth.amr });
  setSessionCookie(res, token);
  res.json({ token });
}));

router.get('/jwks', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(publicJwks());
});

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.auth.sub]);
  if (!result.rows[0]) {
    res.status(404).json({ error: 'account not found' });
    return;
  }
  res.json({ user: publicUser(result.rows[0]) });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(config.sessionCookie, { path: '/' });
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.cookies?.[config.sessionCookie];
  const payload = verifySession(token);
  if (!payload) {
    res.status(401).json({ error: 'no active session' });
    return;
  }
  res.json({ session: payload });
});

export default router;
