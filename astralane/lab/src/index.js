import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { ENVIRONMENT, SPECS, matches } from './specs.js';

const PORT = Number(process.env.PORT || 8081);
const LAB_TOKEN = process.env.LAB_TOKEN || 'astra_lab_token_9f3c2a';
const FLAGS_PATH = process.env.FLAGS_PATH || path.join(process.cwd(), 'shared', 'flags.json');

const manifest = JSON.parse(fs.readFileSync(FLAGS_PATH, 'utf8'));
const chains = manifest.chains.filter((chain) => chain.tier === 'sim');
const chainBySlug = new Map(chains.map((chain) => [chain.slug, chain]));

for (const chain of chains) {
  if (!SPECS[chain.slug]) {
    throw new Error(`missing lab spec for ${chain.slug}`);
  }
}

function tokenFrom(req) {
  const header = req.get('x-astra-token');
  if (header) return header;
  const authorization = req.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  return typeof req.query.token === 'string' ? req.query.token : '';
}

function authorized(req) {
  return tokenFrom(req) === LAB_TOKEN;
}

function challengeProof(req) {
  if (req.method === 'GET' && typeof req.query.proof === 'string') {
    try {
      return JSON.parse(Buffer.from(req.query.proof, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }
  return req.body?.proof ?? null;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'astralane-edge-lab', chains: chains.length });
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>AstraLane Edge Lab</title>
  <style>body{background:#050913;color:#dcecff;font:15px system-ui;padding:48px}h1{letter-spacing:-.04em;color:#5eead4}p{color:#7891aa;max-width:640px;line-height:1.6}code{color:#a78bfa}</style></head>
  <body><h1>AstraLane Edge Lab</h1><p>Internal benchmark fabric for the AstraLane travel platform. This environment emulates protocol, runtime, browser, and container-control surfaces. It is isolated from the host and contains no live kernel interfaces.</p><p>Service discovery begins with <code>/latest/meta-data/</code>.</p></body></html>`);
});

app.get('/latest/meta-data/instance-id', (_req, res) => {
  res.type('text/plain').send('i-astra-9f3c2ab7');
});

app.get('/latest/meta-data/iam/security-credentials/', (_req, res) => {
  res.type('text/plain').send('astralane-task');
});

app.get('/latest/meta-data/iam/security-credentials/astralane-task', (_req, res) => {
  res.json({
    Code: 'Success',
    LastUpdated: '2026-10-20T00:00:00Z',
    Type: 'AWS-HMAC',
    AccessKeyId: 'ASIASTRA9F3C2AB7',
    SecretAccessKey: 'astra_lab_secret_7e91c4d2',
    Token: LAB_TOKEN,
    Expiration: '2036-10-17T00:00:00Z',
  });
});

app.get('/latest/meta-data/user-data', (_req, res) => {
  res.type('text/plain').send(`#cloud-config
runcmd:
  - /opt/astralane/edge --profile=benchmark
  - mount -t overlay overlay /srv/astralane
lab:
  note: Challenge credentials are scoped to the isolated edge fabric.
  key: astra-edge-deploy-7f31b8
`);
});

app.get('/proc/self/status', (_req, res) => {
  res.type('text/plain').send(`Name:\tnode
State:\tR (running)
Pid:\t1
Uid:\t1000\t1000\t1000\t1000
Gid:\t1000\t1000\t1000\t1000
CapInh:\t0000000000000000
CapPrm:\t00000000a80425fb
CapEff:\t00000000a80425fb
CapBnd:\t00000000a80425fb
NoNewPrivs:\t1
Seccomp:\t2
Seccomp_filters:\t1
`);
});

app.get('/proc/self/mountinfo', (_req, res) => {
  res.type('text/plain').send(`24 1 0:22 / / rw,relatime - overlay overlay rw,lowerdir=/var/lib/docker/overlay2/l/astra,upperdir=/var/lib/docker/overlay2/9f3c/diff,workdir=/var/lib/docker/overlay2/9f3c/work
25 24 0:26 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw
26 24 0:27 / /dev/shm rw,nosuid,nodev,noexec,relatime - tmpfs shm rw,size=65536k
27 24 0:28 / /sys/fs/cgroup rw,nosuid,nodev,noexec,relatime - cgroup2 cgroup2 rw
`);
});

app.get('/proc/net/unix', (_req, res) => {
  res.type('text/plain').send(`Num       RefCount Protocol Flags    Type St Inode Path
0000000000000000: 00000002 00000000 00010000 0001 01 21431 /var/run/docker.sock
0000000000000000: 00000002 00000000 00010000 0001 01 21488 /run/astralane/edge.sock
0000000000000000: 00000002 00000000 00010000 0001 01 21502 @astralane/telemetry
`);
});

app.get('/sys/fs/cgroup/cgroup.controllers', (_req, res) => {
  res.type('text/plain').send('cpuset cpu io memory hugetlb pids rdma misc\n');
});

app.get('/sys/fs/cgroup/memory.pressure', (_req, res) => {
  res.type('text/plain').send('some avg10=0.12 avg60=0.04 avg300=0.01 total=84213\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=12044\n');
});

app.get('/v1/environment', (_req, res) => {
  res.json({
    environment: ENVIRONMENT,
    proc: {
      init: 'node',
      pid: 1,
      uid: 1000,
      seccomp: 'filter',
      noNewPrivs: true,
      cgroup: 'v2',
      sharedMemory: '/dev/shm',
      unixSockets: ['/var/run/docker.sock', '/run/astralane/edge.sock'],
    },
    note: 'Use this exact fingerprint as recon for kernel-tier evidence.',
  });
});

app.get('/v1/docker/containers/json', (_req, res) => {
  res.json([
    { Id: '9f3c2ab7a1', Names: ['/astralane-edge'], Image: 'astralane/edge:2026.10', State: 'running', Status: 'Up 4 hours' },
    { Id: '7e91c4d2b8', Names: ['/astralane-api'], Image: 'astralane/api:2026.10', State: 'running', Status: 'Up 4 hours' },
  ]);
});

app.get('/v1/kubelet/pods', (_req, res) => {
  res.json({ kind: 'PodList', items: [{ metadata: { name: 'astralane-edge-9f3c', namespace: 'edge' }, spec: { serviceAccountName: 'edge-runtime' } }] });
});

app.get('/v1/kubelet/secrets', (_req, res) => {
  res.json({ items: [{ metadata: { name: 'edge-mtls' }, type: 'kubernetes.io/tls', data: { 'tls.crt': 'LS0tLS1CRUdJTi...', 'tls.key': 'LAB-ONLY-KEY-7f31b8' } }] });
});

app.get('/v1/envoy/admin/certs', (_req, res) => {
  res.json({ certificates: [{ path: '/etc/envoy/certs/edge.pem', serial: '9f3c2ab7', sds: 'inline', key: 'LAB-MTLS-KEY-7f31b8' }] });
});

app.get('/v1/ci/variables', (_req, res) => {
  res.json({ variables: [{ key: 'EDGE_DEPLOY_TOKEN', value: 'astra-ci-7f31b8', masked: false }] });
});

app.get('/v1/registry/v2/_catalog', (_req, res) => {
  res.json({ repositories: ['astralane/edge', 'astralane/api', 'astralane/lab'] });
});

app.get('/v1/terraform/state', (_req, res) => {
  res.json({ version: 4, outputs: { edge_signing_key: { value: 'astra-tf-7f31b8', sensitive: true } } });
});

app.get('/v1/assistant/tools', (_req, res) => {
  res.json({
    tools: [
      { name: 'edge.shell', scope: 'edge-runtime', description: 'Execute an edge maintenance command.' },
      { name: 'settlements.export', scope: 'finance', description: 'Export a settlement ledger.' },
    ],
  });
});

app.get('/v1/manifest', (req, res) => {
  if (!authorized(req)) {
    res.status(401).json({ error: 'lab token required' });
    return;
  }

  res.json({
    lab: 'astralane-edge-lab',
    version: '1.0.0',
    environment: ENVIRONMENT,
    scoring: 'Submit evidence proofs to POST /v1/<namespace>/<slug>. The API-tier chains are scored against the AstraLane application itself.',
    chains: chains.map((chain) => ({
      id: chain.id,
      slug: chain.slug,
      category: chain.category,
      title: chain.title,
      namespace: SPECS[chain.slug].namespace,
      evidence: Object.keys(SPECS[chain.slug].spec),
      hint: SPECS[chain.slug].hint,
    })),
  });
});

function evaluate(req, res) {
  if (!authorized(req)) {
    res.status(401).json({ error: 'lab token required' });
    return;
  }

  const slug = String(req.params.slug || '');
  const namespace = String(req.params.namespace || '');
  const chain = chainBySlug.get(slug);
  if (!chain || SPECS[slug]?.namespace !== namespace) {
    res.status(404).json({ error: 'no such edge experiment' });
    return;
  }

  const proof = challengeProof(req);
  if (!proof) {
    res.status(400).json({ error: 'evidence proof is required' });
    return;
  }

  if (!matches(proof, SPECS[slug].spec)) {
    res.status(422).json({
      ok: false,
      chain: chain.id,
      error: 'evidence rejected',
      expectedEvidence: Object.keys(SPECS[slug].spec),
      hint: SPECS[slug].hint,
    });
    return;
  }

  res.json({
    ok: true,
    chain: chain.id,
    slug,
    title: chain.title,
    flag: chain.flag,
    verifiedAt: new Date().toISOString(),
  });
}

app.post('/v1/:namespace/:slug', evaluate);
app.get('/v1/:namespace/:slug', evaluate);

app.use((error, _req, res, _next) => {
  console.error('[lab]', error);
  res.status(500).json({ error: 'edge lab fault' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AstraLane edge lab listening on ${PORT} with ${chains.length} emulated chains`);
});
