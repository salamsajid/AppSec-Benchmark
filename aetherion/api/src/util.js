'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, digest] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !digest) return false;
    const derived = crypto.scryptSync(String(password), salt, 32);
    const expected = Buffer.from(digest, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function signSession(user, options = {}) {
  return jwt.sign(
    {
      uid: user.id,
      email: user.email,
      role: user.role,
      typ: 'session',
      via: options.via || 'password',
    },
    config.sessionSecret,
    { algorithm: 'HS256', expiresIn: options.expiresIn || '12h' }
  );
}

function signWidgetToken(user) {
  return jwt.sign(
    {
      uid: user.id,
      email: user.email,
      role: user.role,
      iss: 'aetherion-widget',
    },
    config.sessionSecret,
    { algorithm: 'HS256', expiresIn: '5m' }
  );
}

function verifySessionToken(token) {
  return jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] });
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function hmacSignature(input, key) {
  return crypto.createHmac('sha256', key).update(input).digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function issueServiceToken(payload, key, kid = 'partner-2026.pem') {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT', kid });
  const body = b64urlJson(payload);
  const input = `${header}.${body}`;
  return `${input}.${hmacSignature(input, key)}`;
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return '***';
  return `${name.slice(0, 2)}***@${domain}`;
}

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

module.exports = {
  sleep,
  normalizeEmail,
  hashPassword,
  verifyPassword,
  signSession,
  signWidgetToken,
  verifySessionToken,
  b64urlJson,
  hmacSignature,
  safeEqual,
  issueServiceToken,
  maskEmail,
  TRANSPARENT_PNG,
};
