'use strict';

const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db');
const { authenticate, requireAuth, getIdpPublicPem } = require('../auth');
const {
  normalizeEmail,
  hashPassword,
  verifyPassword,
  signSession,
  verifySessionToken,
} = require('../util');
const { presentUser } = require('../presenters');

const router = express.Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000,
};

function setSession(res, user, via = 'password') {
  res.cookie('aether_session', signSession(user, { via }), cookieOptions);
}

router.post('/register', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim() || 'Aetherion Member';
    const password = String(req.body.password || '');
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'valid email required' });
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      if (existing.rows[0].email_verified) {
        return res.status(409).json({ error: 'an account with this email already exists' });
      }
      const updated = await pool.query(
        `UPDATE users SET password_hash = $1, name = $2
         WHERE id = $3 RETURNING *`,
        [hashPassword(password), name, existing.rows[0].id]
      );
      setSession(res, updated.rows[0]);
      return res.json({ user: presentUser(updated.rows[0]), resumed: true });
    }

    const created = await pool.query(
      `INSERT INTO users (id, email, name, password_hash, email_verified)
       VALUES ($1, $2, $3, $4, false) RETURNING *`,
      [crypto.randomUUID(), email, name, hashPassword(password)]
    );
    setSession(res, created.rows[0]);
    return res.status(201).json({ user: presentUser(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    setSession(res, user);
    return res.json({ user: presentUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('aether_session', { path: '/' });
  res.json({ ok: true });
});

router.get('/session', authenticate, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'no active session' });
  const user = presentUser(req.user);
  delete user.vault;
  delete user.perkVault;
  res.json({
    user,
    authMode: req.auth.mode,
    ...(req.auth.vault ? { vault: req.auth.vault } : {}),
  });
});

router.post('/oauth/exchange', async (req, res, next) => {
  try {
    const code = String(req.body.code || '');
    const redirectUri = String(req.body.redirectUri || '');
    if (!code || !redirectUri) return res.status(400).json({ error: 'code and redirectUri required' });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.idpClientId,
      client_secret: config.idpClientSecret,
      redirect_uri: redirectUri,
    });
    const tokenResponse = await fetch(`${config.idpBase}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenResponse.ok) return res.status(401).json({ error: 'identity exchange rejected' });
    const tokens = await tokenResponse.json();
    const publicKey = await getIdpPublicPem();
    const claims = jwt.verify(tokens.access_token, publicKey, { algorithms: ['RS256'] });
    const email = normalizeEmail(claims.email);
    if (!email) return res.status(401).json({ error: 'identity has no email claim' });

    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = result.rows[0];

    if (!user) {
      result = await pool.query(
        `INSERT INTO users (id, email, name, password_hash, email_verified)
         VALUES ($1, $2, $3, $4, true) RETURNING *`,
        [crypto.randomUUID(), email, claims.name || 'Aetherion Member', hashPassword(crypto.randomBytes(32).toString('hex'))]
      );
      user = result.rows[0];
    } else {
      result = await pool.query(
        'UPDATE users SET email_verified = true WHERE id = $1 RETURNING *',
        [user.id]
      );
      user = result.rows[0];
    }

    setSession(res, user, 'oidc');
    return res.json({ user: presentUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/token-session', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    if (!token) return res.status(400).json({ error: 'token required' });
    let payload;
    try {
      payload = verifySessionToken(token);
    } catch {
      return res.status(401).json({ error: 'token is invalid or expired' });
    }
    if (payload.typ !== 'session' || !payload.uid) {
      return res.status(401).json({ error: 'unsupported token type' });
    }
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.uid]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'identity no longer exists' });
    setSession(res, user, payload.via || 'otp');
    res.json({ user: presentUser(user), authMode: payload.via || 'otp' });
  } catch (error) {
    next(error);
  }
});

router.post('/password/change', authenticate, requireAuth, async (req, res, next) => {
  try {
    const current = String(req.body.currentPassword || '');
    const nextPassword = String(req.body.newPassword || '');
    if (nextPassword.length < 8) return res.status(400).json({ error: 'new password too short' });
    if (!req.user || !verifyPassword(current, req.user.password_hash)) {
      return res.status(401).json({ error: 'current password incorrect' });
    }
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      hashPassword(nextPassword),
      req.user.id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/password/forgot', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'email required' });
    const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user) {
      const token = Buffer.from(`${email}:aether-reset`).toString('base64url');
      await pool.query(
        `INSERT INTO reset_tokens (token, user_id, expires_at)
         VALUES ($1, $2, now() + interval '30 minutes')
         ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
        [token, user.id]
      );
      const host = String(req.get('host') || 'aetherion.local:8080');
      const link = `http://${host}/reset/password?token=${encodeURIComponent(token)}`;
      fetch(`${config.labUrl}/mail`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: email, subject: 'Reset your Aether ID', link, host }),
      }).catch(() => {});
    }
    res.json({ sent: true, delivery: 'email', expiresIn: 1800 });
  } catch (error) {
    next(error);
  }
});

router.post('/password/reset', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!token || password.length < 8) {
      return res.status(400).json({ error: 'valid token and 8+ character password required' });
    }
    const result = await pool.query(
      `SELECT rt.user_id, u.email, u.role
       FROM reset_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.expires_at > now()`,
      [token]
    );
    const entry = result.rows[0];
    if (!entry) return res.status(400).json({ error: 'reset token is invalid or expired' });
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), entry.user_id]);
    await pool.query('DELETE FROM reset_tokens WHERE token = $1', [token]);
    res.json({ reset: true, email: entry.email, vault: config.flags.resetToken });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const token = String(req.body.token || '');
    const expected = Buffer.from(`${email}:aether-verify`).toString('base64url');
    if (!email || token !== expected) return res.status(400).json({ error: 'verification token is invalid' });
    const result = await pool.query(
      'UPDATE users SET email_verified = true WHERE email = $1 RETURNING id, email, vault',
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'member not found' });
    res.json({
      verified: true,
      email: user.email,
      ...(user.vault === config.flags.emailVerify ? { vault: config.flags.emailVerify } : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/email/change', authenticate, requireAuth, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.query.email || req.body.email);
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'valid email required' });
    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, req.user.id]);
    const notice = encodeURIComponent(config.flags.csrfEmail);
    res.redirect(302, `http://attack.aetherion.local:8081/c?d=${notice}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
