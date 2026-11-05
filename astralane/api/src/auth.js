import crypto from 'node:crypto';
import { config } from './config.js';
import { generateKeyPair, signEcdsa, verifyEcdsa } from './crypto/p256.js';
import { pool } from './db.js';
import { b64url, fromB64url } from './util.js';

let sessionKey = null;

export async function loadSigningKey() {
  const existing = await pool.query("SELECT private_jwk, public_jwk FROM app_keys WHERE purpose = 'session'");
  if (existing.rows[0]) {
    sessionKey = {
      privateJwk: existing.rows[0].private_jwk,
      publicJwk: existing.rows[0].public_jwk,
    };
    return sessionKey;
  }

  const generated = generateKeyPair();
  await pool.query(
    "INSERT INTO app_keys (purpose, private_jwk, public_jwk) VALUES ('session', $1, $2) ON CONFLICT (purpose) DO NOTHING",
    [generated.privateJwk, generated.publicJwk],
  );
  const stored = await pool.query("SELECT private_jwk, public_jwk FROM app_keys WHERE purpose = 'session'");
  if (!stored.rows[0]) throw new Error('could not initialize signing key');
  sessionKey = {
    privateJwk: stored.rows[0].private_jwk,
    publicJwk: stored.rows[0].public_jwk,
  };
  return sessionKey;
}

export function publicJwks() {
  if (!sessionKey) throw new Error('signing key not loaded');
  return { keys: [{ ...sessionKey.publicJwk, use: 'sig', alg: 'ES256', kid: 'astralane-2026' }] };
}

export function signSession(user, options = {}) {
  if (!sessionKey) throw new Error('signing key not loaded');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', typ: 'JWT', kid: 'astralane-2026' };
  const payload = {
    iss: 'astralane',
    aud: 'astralane-web',
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    amr: options.amr || ['pwd'],
    iat: now,
    exp: now + 24 * 60 * 60,
    jti: crypto.randomUUID(),
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = signEcdsa(signingInput, sessionKey.privateJwk);
  return `${signingInput}.${signature}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(fromB64url(parts[0]).toString('utf8'));
    if (header.alg !== 'ES256' || header.typ !== 'JWT') return null;

    const signingInput = `${parts[0]}.${parts[1]}`;
    if (!verifyEcdsa(signingInput, parts[2], sessionKey.publicJwk)) return null;

    const payload = JSON.parse(fromB64url(parts[1]).toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== 'astralane' || payload.aud !== 'astralane-web') return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= now) return null;
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export function tokenFromRequest(req) {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  if (req.cookies && typeof req.cookies[config.sessionCookie] === 'string') {
    return req.cookies[config.sessionCookie];
  }
  return null;
}

export function attachAuth(req, _res, next) {
  req.auth = verifySession(tokenFromRequest(req));
  next();
}

export function requireAuth(req, res, next) {
  if (!req.auth) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.auth) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }
  if (req.auth.role !== 'admin') {
    res.status(403).json({ error: 'operator authorization required' });
    return;
  }
  next();
}
