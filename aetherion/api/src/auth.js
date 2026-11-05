'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const config = require('./config');
const { pool } = require('./db');
const { verifySessionToken } = require('./util');

let publicKeyCache = { value: null, expires: 0 };

async function getIdpPublicPem() {
  if (publicKeyCache.value && publicKeyCache.expires > Date.now()) {
    return publicKeyCache.value;
  }
  const response = await fetch(`${config.idpBase}/public.pem`);
  if (!response.ok) throw new Error('identity provider key unavailable');
  const pem = await response.text();
  publicKeyCache = { value: pem, expires: Date.now() + 60_000 };
  return pem;
}

function decodeSegment(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function verifyHmacWithKey(token, key) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const expected = crypto.createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const actual = parts[2];
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function verifyBearerToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.payload) {
    throw new Error('malformed token');
  }
  const header = decoded.header;
  const payload = decoded.payload;

  if (payload.iss === 'aetherion-widget') {
    jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] });
    return { payload, mode: 'widget' };
  }

  if (payload.typ === 'session') {
    try {
      jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] });
      return { payload, mode: payload.via === 'saml' ? 'saml' : 'session' };
    } catch {}
  }

  if (header.alg === 'none') {
    return { payload, mode: 'none', vault: config.flags.jwtNone, warning: 'unsigned token accepted' };
  }

  if (payload.legacy === true) {
    if (header.alg === 'RS256') {
      const pem = await getIdpPublicPem();
      jwt.verify(token, pem, { algorithms: ['RS256'], ignoreExpiration: true });
    } else if (header.alg === 'HS256') {
      const pem = await getIdpPublicPem();
      if (!verifyHmacWithKey(token, pem)) throw new Error('signature mismatch');
    } else {
      throw new Error('unsupported legacy signing algorithm');
    }
    const expired = typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    return { payload, mode: 'legacy-clock', ...(expired ? { vault: config.flags.jwtExpired } : {}) };
  }

  if (header.jku) {
    if (typeof header.jku !== 'string' || !header.jku.startsWith(`${config.idpBase}/`)) {
      throw new Error('untrusted key set');
    }
    const response = await fetch(header.jku, { redirect: 'follow' });
    if (!response.ok) throw new Error('key set fetch failed');
    const jwks = await response.json();
    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) throw new Error('empty key set');
    const key = jwks.keys.find((candidate) => candidate.kid === header.kid) || jwks.keys[0];
    const pem = jwkToPem(key);
    jwt.verify(token, pem, { algorithms: ['RS256'] });
    return { payload, mode: 'jku' };
  }

  if (header.alg === 'HS256') {
    const pem = await getIdpPublicPem();
    if (!verifyHmacWithKey(token, pem)) throw new Error('signature mismatch');
    return { payload, mode: 'hs256' };
  }

  if (header.alg === 'RS256') {
    const pem = await getIdpPublicPem();
    jwt.verify(token, pem, { algorithms: ['RS256'] });
    return { payload, mode: 'federated' };
  }

  throw new Error('unsupported signing algorithm');
}

async function authenticate(req, _res, next) {
  try {
    let verified = null;
    const header = req.get('authorization') || '';
    if (header.toLowerCase().startsWith('bearer ')) {
      const token = header.slice(7).trim();
      const result = await verifyBearerToken(token);
      verified = { ...result.payload, mode: result.mode, vault: result.vault };
    } else if (req.cookies && req.cookies.aether_session) {
      const payload = verifySessionToken(req.cookies.aether_session);
      verified = { ...payload, mode: payload.via === 'saml' ? 'saml' : 'session' };
    }

    if (verified) {
      req.auth = {
        uid: verified.uid,
        email: verified.email,
        role: verified.role,
        mode: verified.mode,
        vault: verified.vault,
        payload: verified,
      };
      if (verified.uid) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [verified.uid]);
        req.user = result.rows[0] || null;
      }
    }
  } catch (error) {
    req.authError = error.message;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: 'authentication required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: 'authentication required' });
  if (req.auth.role !== 'admin') return res.status(403).json({ error: 'insufficient privileges' });
  next();
}

module.exports = {
  authenticate,
  requireAuth,
  requireAdmin,
  getIdpPublicPem,
  verifyBearerToken,
};
