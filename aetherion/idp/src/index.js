'use strict';

const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 4000);
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://aetherion:aetherion_lab_db_password@db:5432/aetherion';
const SSO_SECRET = process.env.SSO_SECRET || 'aetherion_sso_signing_key_4c81d2';
const CLIENT_ID = process.env.CLIENT_ID || 'aetherion-web';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'aetherion-web-public-9f3c';
const PUBLIC_PATH = process.env.PUBLIC_PATH || '/idp';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ops@aetherion.store';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ops!Aether#2026';

const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
const codes = new Map();

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const publicJwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
publicJwk.kid = 'aetherion-idp-2026';
publicJwk.use = 'sig';
publicJwk.alg = 'RS256';

const redirectPrefixes = [
  'http://localhost:8080/oauth/callback',
  'http://127.0.0.1:8080/oauth/callback',
  'http://aetherion.local:8080/oauth/callback',
  'http://app.aetherion.local:8080/oauth/callback',
  'http://localhost:18080/oauth/callback',
  'http://127.0.0.1:18080/oauth/callback',
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(String(password), salt, 32).toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, digest] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(digest, 'hex');
    const actual = crypto.scryptSync(String(password), salt, 32);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function initialize() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS idp_accounts (
      id uuid PRIMARY KEY,
      email text UNIQUE NOT NULL,
      name text NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'user',
      email_verified boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `INSERT INTO idp_accounts (id, email, name, password_hash, role, email_verified)
     VALUES ($1, $2, $3, $4, 'admin', true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'`,
    [crypto.randomUUID(), ADMIN_EMAIL, 'Operations Admin', hashPassword(ADMIN_PASSWORD)]
  );
}

function signSso(account) {
  return jwt.sign(
    { sub: account.id, email: account.email, name: account.name, role: account.role },
    SSO_SECRET,
    { expiresIn: '12h' }
  );
}

function readSso(req) {
  try {
    if (!req.cookies.aether_sso) return null;
    return jwt.verify(req.cookies.aether_sso, SSO_SECRET);
  } catch {
    return null;
  }
}

function setSso(res, account) {
  res.cookie('aether_sso', signSso(account), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function renderLogin(returnTo, error) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aether ID</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 30% 10%,#192a5c 0,#080b15 42%,#04060c 100%);color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.card{width:min(92vw,410px);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:34px;background:rgba(10,15,30,.72);backdrop-filter:blur(24px);box-shadow:0 30px 80px rgba(0,0,0,.5)}
.brand{letter-spacing:.34em;font-size:12px;color:#9db4ff;margin-bottom:18px}.brand b{color:#fff}
h1{font-size:30px;margin:0 0 8px;font-weight:600;letter-spacing:-.03em}p{color:#93a0c4;font-size:14px;line-height:1.5}
label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#8e9dc1;margin:18px 0 7px}
input{width:100%;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0b1120;color:#fff;font-size:14px;outline:none}
input:focus{border-color:#6f8dff;box-shadow:0 0 0 3px rgba(111,141,255,.18)}
button{width:100%;margin-top:22px;padding:13px;border:0;border-radius:12px;background:linear-gradient(120deg,#7f9dff,#b388ff);color:#080b15;font-weight:700;cursor:pointer;font-size:14px}
.alt{margin-top:20px;text-align:center;font-size:13px;color:#8e9dc1}.alt a{color:#b8c8ff}
.err{margin-top:14px;padding:10px 12px;border:1px solid #71354a;background:#2a0d18;color:#ffb8c9;border-radius:10px;font-size:12px}
</style></head><body>
<form class="card" method="post" action="${PUBLIC_PATH}/login">
  <div class="brand">AETHER <b>ID</b></div>
  <h1>One identity. Infinite horizon.</h1>
  <p>Sign in to continue to Aetherion.</p>
  ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
  <input type="hidden" name="return" value="${escapeHtml(returnTo || '')}">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="username" required>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Continue</button>
  <div class="alt">New to Aether ID? <a href="${PUBLIC_PATH}/register?return=${encodeURIComponent(returnTo || '')}">Create an identity</a></div>
</form></body></html>`;
}

function renderRegister(returnTo, error) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Create Aether ID</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 70% 0,#2a1a52 0,#080b15 46%,#04060c 100%);color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.card{width:min(92vw,430px);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:34px;background:rgba(10,15,30,.72);backdrop-filter:blur(24px);box-shadow:0 30px 80px rgba(0,0,0,.5)}
.brand{letter-spacing:.34em;font-size:12px;color:#b8a4ff;margin-bottom:18px}.brand b{color:#fff}
h1{font-size:28px;margin:0 0 8px;font-weight:600;letter-spacing:-.03em}p{color:#93a0c4;font-size:14px;line-height:1.5}
label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#8e9dc1;margin:16px 0 7px}
input{width:100%;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0b1120;color:#fff;font-size:14px;outline:none}
input:focus{border-color:#8f7dff;box-shadow:0 0 0 3px rgba(143,125,255,.18)}
button{width:100%;margin-top:22px;padding:13px;border:0;border-radius:12px;background:linear-gradient(120deg,#8f7dff,#62e0ff);color:#080b15;font-weight:700;cursor:pointer;font-size:14px}
.alt{margin-top:20px;text-align:center;font-size:13px;color:#8e9dc1}.alt a{color:#b8c8ff}
.err{margin-top:14px;padding:10px 12px;border:1px solid #71354a;background:#2a0d18;color:#ffb8c9;border-radius:10px;font-size:12px}
</style></head><body>
<form class="card" method="post" action="${PUBLIC_PATH}/register">
  <div class="brand">AETHER <b>ID</b></div>
  <h1>Create your identity.</h1>
  <p>A single key for every Aetherion surface.</p>
  ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
  <input type="hidden" name="return" value="${escapeHtml(returnTo || '')}">
  <label for="name">Full name</label>
  <input id="name" name="name" required>
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="email" required>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" minlength="8" required>
  <button type="submit">Create Aether ID</button>
  <div class="alt">Already have one? <a href="${PUBLIC_PATH}/login?return=${encodeURIComponent(returnTo || '')}">Sign in</a></div>
</form></body></html>`;
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'aetherion-idp' }));

app.get('/public.pem', (_req, res) => {
  res.type('application/x-pem-file').send(publicKey);
});

app.get('/jwks.json', (_req, res) => {
  res.json({ keys: [publicJwk] });
});

app.get('/redirect', (req, res) => {
  const target = String(req.query.url || req.query.to || '');
  if (!/^https?:\/\//i.test(target)) return res.status(400).send('invalid redirect target');
  res.redirect(302, target);
});

app.get('/login', (req, res) => {
  const returnTo = String(req.query.return || '');
  res.type('html').send(renderLogin(returnTo));
});

app.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const returnTo = String(req.body.return || '');
    const result = await pool.query('SELECT * FROM idp_accounts WHERE email = $1', [email]);
    const account = result.rows[0];
    if (!account || !verifyPassword(password, account.password_hash)) {
      if (req.accepts(['html', 'json']) === 'json') {
        return res.status(401).json({ error: 'invalid credentials' });
      }
      return res.status(401).type('html').send(renderLogin(returnTo, 'The identity or password is incorrect.'));
    }
    setSso(res, account);
    if (req.accepts(['html', 'json']) === 'json') {
      return res.json({ authenticated: true, principal: account.email });
    }
    const destination = returnTo.startsWith(PUBLIC_PATH) ? returnTo : `${PUBLIC_PATH}/login`;
    res.redirect(302, destination);
  } catch (error) {
    next(error);
  }
});

app.get('/register', (req, res) => {
  res.type('html').send(renderRegister(String(req.query.return || '')));
});

app.post('/register', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim() || 'Aether Identity';
    const password = String(req.body.password || '');
    const returnTo = String(req.body.return || '');
    if (!email.includes('@') || password.length < 8) {
      if (req.accepts(['html', 'json']) === 'json') {
        return res.status(400).json({ error: 'valid email and 8+ character password required' });
      }
      return res.status(400).type('html').send(renderRegister(returnTo, 'Enter a valid email and a password of at least 8 characters.'));
    }
    const existing = await pool.query('SELECT * FROM idp_accounts WHERE email = $1', [email]);
    let account = existing.rows[0];
    if (account) {
      return res.status(409).json({ error: 'an Aether ID already exists for this email' });
    }
    const inserted = await pool.query(
      `INSERT INTO idp_accounts (id, email, name, password_hash, email_verified)
       VALUES ($1, $2, $3, $4, false) RETURNING *`,
      [crypto.randomUUID(), email, name, hashPassword(password)]
    );
    account = inserted.rows[0];
    setSso(res, account);
    if (req.accepts(['html', 'json']) === 'json') {
      return res.status(201).json({ created: true, principal: account.email });
    }
    const destination = returnTo.startsWith(PUBLIC_PATH) ? returnTo : `${PUBLIC_PATH}/login`;
    res.redirect(302, destination);
  } catch (error) {
    next(error);
  }
});

app.get('/authorize', async (req, res, next) => {
  try {
    const clientId = String(req.query.client_id || '');
    const responseType = String(req.query.response_type || '');
    const redirectUri = String(req.query.redirect_uri || '');
    const state = String(req.query.state || '');
    if (clientId !== CLIENT_ID || responseType !== 'code') {
      return res.status(400).send('unsupported authorization request');
    }
    if (!redirectPrefixes.some((prefix) => redirectUri.startsWith(prefix))) {
      return res.status(400).send('redirect_uri is not registered for this client');
    }
    const sso = readSso(req);
    if (!sso) {
      const relativeReturn = `${PUBLIC_PATH}${req.originalUrl}`;
      return res.redirect(302, `${PUBLIC_PATH}/login?return=${encodeURIComponent(relativeReturn)}`);
    }
    const code = crypto.randomBytes(24).toString('hex');
    codes.set(code, {
      email: sso.email,
      name: sso.name,
      role: sso.role,
      redirectUri,
      expires: Date.now() + 5 * 60 * 1000,
    });
    const target = new URL(redirectUri);
    target.searchParams.set('code', code);
    if (state) target.searchParams.set('state', state);
    res.redirect(302, target.toString());
  } catch (error) {
    next(error);
  }
});

app.post('/token', async (req, res, next) => {
  try {
    const grantType = String(req.body.grant_type || '');
    const code = String(req.body.code || '');
    const clientId = String(req.body.client_id || '');
    const clientSecret = String(req.body.client_secret || '');
    const redirectUri = String(req.body.redirect_uri || '');
    if (grantType !== 'authorization_code' || clientId !== CLIENT_ID || clientSecret !== CLIENT_SECRET) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    const entry = codes.get(code);
    if (!entry || entry.expires < Date.now() || entry.redirectUri !== redirectUri) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    codes.delete(code);
    const claims = {
      iss: 'aetherion-idp',
      aud: CLIENT_ID,
      sub: entry.email,
      email: entry.email,
      email_verified: true,
      name: entry.name,
      role: entry.role,
    };
    const accessToken = jwt.sign(claims, privateKey, { algorithm: 'RS256', expiresIn: '1h', keyid: publicJwk.kid });
    res.json({ access_token: accessToken, id_token: accessToken, token_type: 'Bearer', expires_in: 3600 });
  } catch (error) {
    next(error);
  }
});

app.get('/userinfo', (req, res) => {
  try {
    const auth = req.get('authorization') || '';
    if (!auth.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'bearer token required' });
    const claims = jwt.verify(auth.slice(7), publicKey, { algorithms: ['RS256'] });
    res.json({ sub: claims.sub, email: claims.email, email_verified: claims.email_verified, name: claims.name });
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
});

app.use((error, _req, res, _next) => {
  console.error('[idp]', error);
  res.status(500).json({ error: 'identity request failed' });
});

initialize()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`Aetherion IdP listening on ${PORT}`));
  })
  .catch((error) => {
    console.error('failed to start idp', error);
    process.exit(1);
  });
