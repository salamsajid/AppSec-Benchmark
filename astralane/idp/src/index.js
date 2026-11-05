import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import pg from 'pg';
import { SignedXml } from 'xml-crypto';

const { Pool } = pg;

const PORT = Number(process.env.PORT || 4000);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://astralane:astralane_lab_db_password@db:5432/astralane';
const PUBLIC_BASE = process.env.IDP_PUBLIC_BASE || 'http://127.0.0.1:18080/idp';
const APP_BASE = process.env.APP_BASE || 'http://127.0.0.1:18080';
const CLIENT_ID = process.env.CLIENT_ID || 'astralane-web';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'astralane_web_client_secret_2026';
const ACS_URL = process.env.ACS_URL || `${APP_BASE}/api/sso/saml/acs`;
const CERT_PATH = process.env.SAML_CERT_PATH || '/run/saml/idp.crt';
const KEY_PATH = process.env.SAML_KEY_PATH || '/run/saml/idp.key';

const pool = new Pool({ connectionString: DATABASE_URL, max: 6 });
const codes = new Map();

const NS_SAML = 'urn:oasis:names:tc:SAML:2.0:assertion';
const NS_SAMLP = 'urn:oasis:names:tc:SAML:2.0:protocol';

function passwordOk(password, stored) {
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

function htmlPage(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} · AstraLane Identity</title>
  <style>
    :root { color-scheme: dark; --ink:#e8f4ff; --dim:#8aa3b8; --teal:#5eead4; --violet:#a78bfa; --panel:#0b1424; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(circle at 10% 10%, #13233d 0, #060a14 46%, #03060c 100%); color:var(--ink); font:15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { width:min(430px, calc(100vw - 32px)); padding:32px; border:1px solid rgba(148,190,255,.18); border-radius:24px; background:linear-gradient(160deg, rgba(18,32,55,.86), rgba(6,11,22,.92)); box-shadow:0 30px 90px rgba(0,0,0,.55); }
    .eyebrow { color:var(--teal); font-size:11px; letter-spacing:.24em; text-transform:uppercase; }
    h1 { margin:8px 0 4px; font-size:28px; letter-spacing:-.04em; }
    p { color:var(--dim); margin:0 0 22px; }
    label { display:block; font-size:12px; color:var(--dim); margin:14px 0 6px; letter-spacing:.08em; text-transform:uppercase; }
    input { width:100%; padding:13px 14px; border-radius:12px; border:1px solid rgba(148,190,255,.22); background:#060d19; color:var(--ink); font-size:15px; }
    input:focus { outline:2px solid rgba(94,234,212,.5); border-color:transparent; }
    button { width:100%; margin-top:20px; padding:14px; border:0; border-radius:12px; background:linear-gradient(120deg,var(--teal),#7dd3fc 55%,var(--violet)); color:#04121a; font-weight:800; font-size:15px; cursor:pointer; }
    .footer { margin-top:18px; font-size:12px; color:#607890; }
    .error { margin-top:16px; padding:12px; border-radius:10px; background:rgba(248,113,113,.12); color:#fecaca; font-size:13px; }
    .badge { display:inline-flex; gap:8px; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid rgba(94,234,212,.25); color:var(--teal); font-size:11px; letter-spacing:.1em; text-transform:uppercase; }
  </style>
</head>
<body><main><div class="badge">AstraLane Identity</div>${body}<p class="footer">This is a controlled security lab identity provider. Do not reuse real credentials.</p></main></body></html>`;
}

function loginForm(action, hidden, error = '') {
  return `<h1>Continue to AstraLane</h1>
<p>One identity for flights, stays, loyalty, and the operator console.</p>
${error ? `<div class="error">${error}</div>` : ''}
<form method="post" action="${action}">
  ${hidden}
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="username" required value="nova@astralane.travel"/>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required/>
  <button type="submit">Authenticate</button>
</form>`;
}

async function findUser(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [String(email || '').toLowerCase()]);
  return result.rows[0] || null;
}

function signAssertion(user) {
  const privateKey = fs.readFileSync(KEY_PATH, 'utf8');
  const publicCert = fs.readFileSync(CERT_PATH, 'utf8');
  const now = new Date().toISOString();
  const assertion = `<saml:Assertion xmlns:saml="${NS_SAML}" ID="assertion-${crypto.randomBytes(8).toString('hex')}" Version="2.0" IssueInstant="${now}">
    <saml:Issuer>astralane-idp</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${user.email}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${new Date(Date.now() + 300000).toISOString()}" Recipient="${ACS_URL}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${now}" NotOnOrAfter="${new Date(Date.now() + 300000).toISOString()}"/>
    <saml:AuthnStatement AuthnInstant="${now}" SessionIndex="session-${crypto.randomBytes(6).toString('hex')}">
      <saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email"><saml:AttributeValue>${user.email}</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="role"><saml:AttributeValue>${user.role}</saml:AttributeValue></saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>`;

  const signer = new SignedXml({
    privateKey,
    publicCert,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });
  signer.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  });
  signer.computeSignature(assertion);
  const signed = signer.getSignedXml();

  return `<samlp:Response xmlns:samlp="${NS_SAMLP}" xmlns:saml="${NS_SAML}" ID="response-${crypto.randomBytes(8).toString('hex')}" Version="2.0" IssueInstant="${now}" Destination="${ACS_URL}">
    <saml:Issuer>astralane-idp</saml:Issuer>
    <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
    ${signed}
  </samlp:Response>`;
}

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'astralane-idp' }));

app.get('/authorize', (req, res) => {
  const redirectUri = String(req.query.redirect_uri || '');
  const state = String(req.query.state || '');
  const clientId = String(req.query.client_id || '');
  if (!redirectUri || clientId !== CLIENT_ID) {
    res.status(400).send('invalid authorization request');
    return;
  }
  const hidden = `<input type="hidden" name="redirect_uri" value="${redirectUri}"/>
    <input type="hidden" name="state" value="${state}"/>
    <input type="hidden" name="client_id" value="${clientId}"/>`;
  res.send(htmlPage('Sign in', loginForm(`${PUBLIC_BASE}/authorize`, hidden)));
});

app.post('/authorize', async (req, res) => {
  const redirectUri = String(req.body.redirect_uri || '');
  const state = String(req.body.state || '');
  const clientId = String(req.body.client_id || '');
  if (!redirectUri || clientId !== CLIENT_ID) {
    res.status(400).send('invalid authorization request');
    return;
  }

  const user = await findUser(req.body.email);
  if (!user || !passwordOk(String(req.body.password || ''), user.password_hash)) {
    const hidden = `<input type="hidden" name="redirect_uri" value="${redirectUri}"/>
      <input type="hidden" name="state" value="${state}"/>
      <input type="hidden" name="client_id" value="${clientId}"/>`;
    res.status(401).send(htmlPage('Sign in', loginForm(`${PUBLIC_BASE}/authorize`, hidden, 'Those credentials did not match an AstraLane member.')));
    return;
  }

  const code = crypto.randomBytes(24).toString('hex');
  codes.set(code, { email: user.email, name: user.name, expires: Date.now() + 120000 });
  const target = new URL(redirectUri);
  target.searchParams.set('code', code);
  target.searchParams.set('state', state);
  res.redirect(target.toString());
});

app.post('/token', async (req, res) => {
  const clientId = String(req.body.client_id || '');
  const clientSecret = String(req.body.client_secret || '');
  const code = String(req.body.code || '');
  if (clientId !== CLIENT_ID || clientSecret !== CLIENT_SECRET) {
    res.status(401).json({ error: 'invalid_client' });
    return;
  }

  const entry = codes.get(code);
  if (!entry || entry.expires < Date.now()) {
    res.status(400).json({ error: 'invalid_grant' });
    return;
  }
  codes.delete(code);

  const idToken = Buffer.from(JSON.stringify({ iss: 'astralane-idp', sub: entry.email, aud: CLIENT_ID })).toString('base64url');
  res.json({
    access_token: `astra_${crypto.randomBytes(16).toString('hex')}`,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: 300,
    user: { email: entry.email, name: entry.name },
  });
});

app.get('/saml/login', (_req, res) => {
  const hidden = `<input type="hidden" name="acs" value="${ACS_URL}"/>`;
  res.send(htmlPage('SAML sign in', loginForm(`${PUBLIC_BASE}/saml/login`, hidden)));
});

app.post('/saml/login', async (req, res) => {
  const user = await findUser(req.body.email);
  if (!user || !passwordOk(String(req.body.password || ''), user.password_hash)) {
    const hidden = `<input type="hidden" name="acs" value="${ACS_URL}"/>`;
    res.status(401).send(htmlPage('SAML sign in', loginForm(`${PUBLIC_BASE}/saml/login`, hidden, 'Those credentials did not match an AstraLane member.')));
    return;
  }

  const xml = signAssertion(user);
  const encoded = Buffer.from(xml, 'utf8').toString('base64');
  res.send(`<!doctype html><html><body>
    <form id="saml" method="post" action="${ACS_URL}">
      <input type="hidden" name="SAMLResponse" value="${encoded}"/>
    </form>
    <script>document.getElementById('saml').submit()</script>
  </body></html>`);
});

app.get('/frontchannel_logout', (req, res) => {
  res.send(htmlPage('Signed out', '<h1>Session closed</h1><p>The AstraLane front-channel logout completed.</p>'));
});

app.get('/.well-known/openid-configuration', (_req, res) => {
  res.json({
    issuer: PUBLIC_BASE,
    authorization_endpoint: `${PUBLIC_BASE}/authorize`,
    token_endpoint: `${PUBLIC_BASE}/token`,
    end_session_endpoint: `${PUBLIC_BASE}/frontchannel_logout`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256'],
  });
});

app.use((err, _req, res, _next) => {
  console.error('[idp]', err);
  res.status(500).send('identity provider error');
});

app.listen(PORT, '0.0.0.0', () => console.log(`AstraLane IdP listening on ${PORT}`));
