'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { XMLParser } = require('fast-xml-parser');
const config = require('../config');
const { pool } = require('../db');
const { authenticate, requireAuth, requireAdmin } = require('../auth');
const { normalizeEmail, signSession, signWidgetToken, hmacSignature, safeEqual } = require('../util');

const router = express.Router();

router.get('/marketing/banner', (req, res) => {
  const headline = String(req.query.headline || 'Aetherion Days · No-cost EMI on every flagship');
  const eyebrow = String(req.query.eyebrow || 'THE NEXT HORIZON');
  res.type('html').send(
    `<div class="marketing-banner"><span class="eyebrow">${eyebrow}</span><strong>${headline}</strong><a href="#/shop">Explore the collection</a></div>`
  );
});

router.get('/support/notices', (_req, res) => {
  res.json({
    notices: [
      {
        id: 'status-1042',
        state: 'monitoring',
        title: 'One-time code delivery delays',
        body: 'Verification delivery is delayed for +91 99000 00042. The identity team is monitoring carrier routes and expects recovery after 18:00 IST.',
        updatedAt: '2026-10-20T06:10:00Z',
      },
      {
        id: 'status-1041',
        state: 'resolved',
        title: 'Wallet credits',
        body: 'Aetherion Days promotional credits are applying normally across all regions.',
        updatedAt: '2026-10-19T18:40:00Z',
      },
    ],
  });
});

router.use(authenticate);

router.get('/widget/token', requireAuth, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'no active session' });
  res.json({ token: signWidgetToken(req.user), expiresIn: 300 });
});

router.get('/fulfillment/status', (req, res) => {
  try {
    const auth = req.get('authorization') || '';
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'service token required' });
    }
    const token = auth.slice(7).trim();
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || decoded.header.alg !== 'HS256') {
      return res.status(401).json({ error: 'unsupported service token' });
    }
    const kid = String(decoded.header.kid || 'partner-2026.pem');
    const keyPath = path.join('/app/keys', kid);
    const key = fs.readFileSync(keyPath);
    const parts = token.split('.');
    if (parts.length !== 3) return res.status(401).json({ error: 'malformed token' });
    const expected = hmacSignature(`${parts[0]}.${parts[1]}`, key);
    if (!safeEqual(expected, parts[2])) return res.status(401).json({ error: 'signature rejected' });
    const claims = decoded.payload || {};
    if (claims.role !== 'admin' && claims.scope !== 'fulfillment') {
      return res.status(403).json({ error: 'service scope missing' });
    }
    return res.json({
      network: 'aetherion-fulfillment',
      region: 'ap-south-1',
      status: 'operational',
      vault: config.flags.kid,
    });
  } catch {
    return res.status(401).json({ error: 'service token rejected' });
  }
});

const reportWindow = new Map();
function reportRateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || 'local').split(',')[0].trim();
  const now = Date.now();
  const entry = reportWindow.get(ip) || { count: 0, reset: now + 60_000 };
  if (entry.reset < now) {
    entry.count = 0;
    entry.reset = now + 60_000;
  }
  entry.count += 1;
  reportWindow.set(ip, entry);
  if (entry.count > 25) return res.status(429).json({ error: 'too many review requests' });
  next();
}

function normalizeTargetUrl(raw) {
  const target = new URL(String(raw || '').trim());
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
  if (target.port === '18080') {
    target.hostname = 'aetherion.local';
    target.port = '8080';
  } else if (target.port === '18081') {
    target.hostname = 'attack.aetherion.local';
    target.port = '8081';
  } else if (target.hostname === 'localhost' || target.hostname === '127.0.0.1') {
    target.hostname = 'aetherion.local';
  }
  const allowedHost = target.hostname === 'aetherion.local' || target.hostname.endsWith('.aetherion.local');
  const allowedPort = target.port === '8080' || target.port === '8081';
  if (!allowedHost || !allowedPort) return null;
  if (target.toString().length > 3000) return null;
  return target.toString();
}

router.post('/reports', reportRateLimit, async (req, res, next) => {
  try {
    const target = normalizeTargetUrl(req.body.url);
    if (!target) return res.status(400).json({ error: 'report URL must be an Aetherion property' });
    const inserted = await pool.query(
      'INSERT INTO reports (url, user_id, status) VALUES ($1, $2, $3) RETURNING id',
      [target, req.user ? req.user.id : null, 'queued']
    );
    const reportId = inserted.rows[0].id;

    fetch(`${config.botUrl}/visit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bot-token': config.botToken },
      body: JSON.stringify({ url: target, reportId }),
    })
      .then((response) => {
        const status = response.ok ? 'reviewed' : 'failed';
        return pool.query('UPDATE reports SET status = $1 WHERE id = $2', [status, reportId]);
      })
      .catch(() => pool.query('UPDATE reports SET status = $1 WHERE id = $2', ['failed', reportId]));

    res.status(202).json({ queued: true, id: reportId });
  } catch (error) {
    next(error);
  }
});

router.post('/support/tickets', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email || (req.user && req.user.email));
    const subject = String(req.body.subject || '').slice(0, 180);
    const body = String(req.body.body || '').slice(0, 5000);
    if (!email || !subject || !body) return res.status(400).json({ error: 'email, subject and message required' });
    const inserted = await pool.query(
      'INSERT INTO support_tickets (user_id, email, subject, body) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
      [req.user ? req.user.id : null, email, subject, body]
    );
    res.status(201).json({ ticket: inserted.rows[0], status: 'open' });
  } catch (error) {
    next(error);
  }
});

router.get('/support/tickets', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, subject, body, status, created_at FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ tickets: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/support/tickets/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid ticket id' });
    const result = await pool.query(
      'SELECT id, user_id, email, subject, body, status, created_at FROM support_tickets WHERE id = $1',
      [id]
    );
    const ticket = result.rows[0];
    if (!ticket) return res.status(404).json({ error: 'ticket not found' });
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/support/tickets', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, email, subject, status, created_at FROM support_tickets ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ tickets: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/support/tickets/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [Number(req.params.id)]);
    const ticket = result.rows[0];
    if (!ticket) return res.status(404).type('html').send('<h1>Ticket not found</h1>');
    res.set('Cache-Control', 'no-store');
    res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ticket #${ticket.id}</title></head>
<body data-vault="${config.flags.supportXss}">
  <main>
    <p>Support operations · private queue</p>
    <h1>#${ticket.id} ${ticket.subject}</h1>
    <p>From: ${ticket.email}</p>
    <article>${ticket.body}</article>
  </main>
</body></html>`);
  } catch (error) {
    next(error);
  }
});

router.post('/integrations/webhook/test', requireAuth, async (req, res) => {
  try {
    let target;
    try {
      target = new URL(String(req.body.url || ''));
    } catch {
      return res.status(400).json({ error: 'a valid webhook endpoint is required' });
    }
    const allowedHosts = new Set([
      'cdn.aetherion.local',
      'hooks.aetherion.local',
      'attack.aetherion.local',
    ]);
    if (!['http:', 'https:'].includes(target.protocol) || !allowedHosts.has(target.hostname)) {
      return res.status(400).json({ error: 'webhook endpoint is outside the Aetherion integration mesh' });
    }

    const payload = req.body.payload === undefined ? {} : req.body.payload;
    const headers = {
      'content-type': 'application/json',
      'user-agent': 'AetherionWebhookProbe/1.6',
      'x-aetherion-event': 'integration.test',
    };
    if (req.body.authorization) {
      headers.authorization = String(req.body.authorization).slice(0, 4096);
    }

    const response = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    });
    const text = (await response.text()).slice(0, 5000);
    res.json({ delivered: response.ok, status: response.status, response: text });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).json({ error: 'webhook endpoint timed out' });
    }
    res.status(502).json({ error: 'webhook delivery failed' });
  }
});

const DEMO_SIGNATURE = 'AETHERION-DEMO-SIGNATURE-2026';
const DEMO_SAML = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <saml:Assertion ID="partner-assertion">
    <saml:Issuer>Aetherion Partner SSO</saml:Issuer>
    <ds:Signature>
      <ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:SignedInfo>
      <ds:SignatureValue>${DEMO_SIGNATURE}</ds:SignatureValue>
    </ds:Signature>
    <saml:Subject><saml:NameID>demo.analyst@aetherion.store</saml:NameID></saml:Subject>
  </saml:Assertion>
</samlp:Response>`;

router.get('/sso/saml/demo', (req, res) => {
  res.type('application/xml').send(DEMO_SAML);
});

function collectTags(node, tag, output) {
  if (!node || typeof node !== 'object') return output;
  for (const [key, value] of Object.entries(node)) {
    if (key === tag) {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          output.push(typeof item === 'string' ? item : item && item['#text']);
        });
      } else if (typeof value === 'string') {
        output.push(value);
      } else if (value && typeof value === 'object' && value['#text'] !== undefined) {
        output.push(value['#text']);
      }
    }
    collectTags(value, tag, output);
  }
  return output;
}

router.post('/sso/saml/acs', async (req, res, next) => {
  try {
    const encoded = req.body.SAMLResponse || req.body.samlResponse || req.body.assertion;
    if (!encoded) return res.status(400).json({ error: 'SAMLResponse required' });
    const xml = Buffer.from(String(encoded), 'base64').toString('utf8');
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const document = parser.parse(xml);
    const signatureValues = collectTags(document, 'SignatureValue', []);
    const identities = collectTags(document, 'NameID', []);
    if (signatureValues[0] !== DEMO_SIGNATURE) {
      return res.status(401).json({ error: 'assertion signature validation failed' });
    }
    const identity = normalizeEmail(identities[identities.length - 1]);
    if (!identity) return res.status(400).json({ error: 'assertion has no identity' });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [identity]);
    const user = result.rows[0];
    if (!user) return res.status(403).json({ error: 'identity not provisioned' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'identity is not authorized for operations' });
    res.cookie('aether_session', signSession(user, { via: 'saml', expiresIn: '1h' }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    res.json({ authenticated: true, principal: identity, protocol: 'SAML2' });
  } catch (error) {
    next(error);
  }
});

router.get('/ops/runtime', requireAuth, (req, res) => {
  res.json({
    node: process.version,
    pid: process.pid,
    memory: process.memoryUsage(),
    requestId: crypto.randomBytes(6).toString('hex'),
  });
});

module.exports = router;
