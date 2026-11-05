import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import { config } from '../config.js';
import { pool } from '../db.js';
import { redis } from '../redis.js';
import { signSession, verifySession } from '../auth.js';
import { asyncRoute, hashPassword, randomId, setSessionCookie } from '../util.js';

const router = express.Router();

const NS_SAML = 'urn:oasis:names:tc:SAML:2.0:assertion';
const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';

function idpCertificate() {
  try {
    return fs.readFileSync(process.env.SAML_CERT_PATH || '/run/saml/idp.crt', 'utf8');
  } catch {
    return null;
  }
}

function verifySignature(xml, signatureNode) {
  const cert = idpCertificate();
  if (!cert || !signatureNode) return false;
  const verifier = new SignedXml({ publicCert: cert });
  verifier.loadSignature(signatureNode);
  try {
    return verifier.checkSignature(xml) === true;
  } catch {
    return false;
  }
}

function extractNameId(assertion) {
  const nameIds = assertion.getElementsByTagNameNS(NS_SAML, 'NameID');
  if (!nameIds.length) return null;
  return String(nameIds[0].textContent || '').trim().slice(0, 200);
}

async function upsertUser(email, name = null) {
  const normalized = String(email || '').toLowerCase();
  if (!normalized) return null;
  const existing = await pool.query('SELECT * FROM users WHERE email = $1', [normalized]);
  if (existing.rows[0]) return existing.rows[0];

  const id = randomId('usr_');
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, loyalty_tier)
     VALUES ($1,$2,$3,$4,'traveler','Silver')`,
    [id, normalized, hashPassword(crypto.randomBytes(32).toString('base64url')), name || normalized.split('@')[0]],
  );
  const created = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return created.rows[0];
}

router.get('/saml/metadata', (_req, res) => {
  const cert = idpCertificate();
  const certBody = cert
    ? cert.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\s+/g, '')
    : '';
  res.type('application/xml').send(`<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${config.publicBase}/api/sso/saml/metadata">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${config.publicBase}/api/sso/saml/acs" index="0"/>
    <KeyDescriptor use="signing"><ds:KeyInfo xmlns:ds="${NS_DS}"><ds:X509Data><ds:X509Certificate>${certBody}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></KeyDescriptor>
  </SPSSODescriptor>
</EntityDescriptor>`);
});

router.get('/saml/login', (_req, res) => {
  res.redirect(`${config.idpPublicBase}/saml/login`);
});

router.post('/saml/acs', express.urlencoded({ extended: false, limit: '1mb' }), asyncRoute(async (req, res) => {
  const encoded = typeof req.body?.SAMLResponse === 'string' ? req.body.SAMLResponse : '';
  if (!encoded) {
    res.status(400).send('SAML response missing');
    return;
  }

  let xml;
  try {
    xml = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    res.status(400).send('SAML response is not valid base64');
    return;
  }

  let document;
  try {
    document = new DOMParser().parseFromString(xml, 'text/xml');
  } catch {
    res.status(400).send('SAML response is not valid XML');
    return;
  }

  const signatures = document.getElementsByTagNameNS(NS_DS, 'Signature');
  const assertions = document.getElementsByTagNameNS(NS_SAML, 'Assertion');

  if (!signatures.length || !assertions.length) {
    res.status(400).send('SAML response lacks a signed assertion');
    return;
  }

  if (!verifySignature(xml, signatures[0])) {
    res.status(401).send('SAML signature validation failed');
    return;
  }

  const assertion = assertions[assertions.length - 1];
  const email = extractNameId(assertion);
  if (!email) {
    res.status(400).send('SAML assertion has no subject');
    return;
  }

  const user = await upsertUser(email);
  if (!user) {
    res.status(401).send('SAML subject is not recognized');
    return;
  }

  const token = signSession(user, { amr: ['saml'] });
  const session = verifySession(token);
  if (session) {
    await redis.set(`saml-session:${session.jti}`, `${session.sub}:${session.role}`, 'EX', 24 * 60 * 60);
  }
  setSessionCookie(res, token);
  res.redirect(`${config.publicBase}/#/account`);
}));

router.get('/oidc/start', asyncRoute(async (_req, res) => {
  const state = crypto.randomBytes(20).toString('hex');
  await redis.set(`oidc:state:${state}`, '1', 'EX', 300);
  const callback = `${config.publicBase}/api/sso/oidc/callback`;
  const authorize = new URL(`${config.idpPublicBase}/authorize`);
  authorize.searchParams.set('client_id', config.idpClientId);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid profile email');
  authorize.searchParams.set('state', state);
  res.redirect(authorize.toString());
}));

router.get('/oidc/callback', asyncRoute(async (req, res) => {
  const state = String(req.query.state || '');
  const code = String(req.query.code || '');
  if (!state || !code) {
    res.status(400).send('OIDC callback is missing state or code');
    return;
  }

  const stored = await redis.get(`oidc:state:${state}`);
  if (!stored) {
    res.status(400).send('OIDC state is invalid or expired');
    return;
  }
  await redis.del(`oidc:state:${state}`);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.idpClientId,
    client_secret: config.idpClientSecret,
    redirect_uri: `${config.publicBase}/api/sso/oidc/callback`,
  });

  let exchanged;
  try {
    const response = await fetch(`${config.idpBase}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    exchanged = await response.json();
    if (!response.ok) throw new Error('token exchange rejected');
  } catch {
    res.status(502).send('OIDC token exchange failed');
    return;
  }

  const email = exchanged?.user?.email;
  const user = await upsertUser(email, exchanged?.user?.name);
  if (!user) {
    res.status(401).send('OIDC subject is not recognized');
    return;
  }

  const token = signSession(user, { amr: ['oidc'] });
  setSessionCookie(res, token);
  res.redirect(`${config.publicBase}/#/account`);
}));

export default router;
