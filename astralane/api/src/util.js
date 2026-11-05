import crypto from 'node:crypto';

export function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

export function fromB64url(value) {
  return Buffer.from(value, 'base64url');
}

export function randomId(prefix = '') {
  return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
}

export function randomRef() {
  return `AL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function int(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function safeString(value, max = 512) {
  if (typeof value !== 'string') return '';
  return value.slice(0, max);
}

export function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function setSessionCookie(res, token) {
  res.cookie('astra_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
}
