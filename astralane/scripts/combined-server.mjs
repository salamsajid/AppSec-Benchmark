#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENVIRONMENT, SPECS, matches } from '../lab/src/specs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 6060);
const HOST = process.env.HOST || '0.0.0.0';
const LAB_TOKEN = process.env.LAB_TOKEN || 'astra_lab_token_9f3c2a';
const FLAGS_PATH = process.env.FLAGS_PATH || path.join(ROOT, 'shared', 'flags.json');
const SITE_DIR = path.join(ROOT, 'edge', 'site');

// Load benchmark manifest
const manifest = JSON.parse(fs.readFileSync(FLAGS_PATH, 'utf8'));
const chains = manifest.chains.filter((chain) => chain.tier === 'sim');
const chainBySlug = new Map(chains.map((chain) => [chain.slug, chain]));

for (const chain of chains) {
  if (!SPECS[chain.slug]) {
    console.warn(`Warning: missing lab spec for ${chain.slug}`);
  }
}

// MIME types table
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

// Seed / Mock travel data for the frontend SPA
const airports = [
  ['JFK', 'New York', 'John F. Kennedy International'],
  ['LHR', 'London', 'Heathrow'],
  ['SFO', 'San Francisco', 'San Francisco International'],
  ['NRT', 'Tokyo', 'Narita International'],
  ['HND', 'Tokyo', 'Haneda'],
  ['LAX', 'Los Angeles', 'Los Angeles International'],
  ['BOM', 'Mumbai', 'Chhatrapati Shivaji Maharaj'],
  ['DXB', 'Dubai', 'Dubai International'],
  ['DEL', 'Delhi', 'Indira Gandhi International'],
  ['SIN', 'Singapore', 'Changi'],
  ['CDG', 'Paris', 'Charles de Gaulle'],
  ['SYD', 'Sydney', 'Kingsford Smith'],
  ['AKL', 'Auckland', 'Auckland Airport'],
  ['BLR', 'Bengaluru', 'Kempegowda International'],
  ['HNL', 'Honolulu', 'Daniel K. Inouye'],
  ['MIA', 'Miami', 'Miami International'],
  ['SEA', 'Seattle', 'Seattle-Tacoma'],
  ['YYZ', 'Toronto', 'Pearson International'],
];

const destinationCards = [
  { code: 'LHR', city: 'London', country: 'United Kingdom', priceFrom: 79900, accent: 'violet', note: 'Aurora season' },
  { code: 'NRT', city: 'Tokyo', country: 'Japan', priceFrom: 78900, accent: 'cyan', note: 'Neon nights' },
  { code: 'DXB', city: 'Dubai', country: 'UAE', priceFrom: 24900, accent: 'amber', note: 'Desert meridians' },
  { code: 'SIN', city: 'Singapore', country: 'Singapore', priceFrom: 26900, accent: 'emerald', note: 'Ocean glass' },
  { code: 'CDG', city: 'Paris', country: 'France', priceFrom: 65900, accent: 'rose', note: 'Left bank light' },
  { code: 'SYD', city: 'Sydney', country: 'Australia', priceFrom: 21900, accent: 'blue', note: 'Harbour dawn' },
];

const experiences = [
  { id: 'exp-aurora', title: 'Aurora flight over Iceland', city: 'Reykjavik', priceCents: 89000, duration: '6 hours', tag: 'Sky' },
  { id: 'exp-reef', title: 'Coral nursery dive', city: 'Singapore', priceCents: 34000, duration: '4 hours', tag: 'Ocean' },
  { id: 'exp-dune', title: 'Silent dune crossing', city: 'Dubai', priceCents: 42000, duration: '8 hours', tag: 'Desert' },
  { id: 'exp-train', title: 'Midnight express tasting menu', city: 'Tokyo', priceCents: 28000, duration: '3 hours', tag: 'Taste' },
];

const sampleFlights = [
  { id: 'fl-101', airline: 'AstraAir', flightNo: 'AL-101', origin: 'JFK', destination: 'LHR', departAt: '2026-10-22T08:00:00Z', arriveAt: '2026-10-22T20:00:00Z', priceCents: 79900, cabin: 'First', seats: 8 },
  { id: 'fl-102', airline: 'AstraAir', flightNo: 'AL-102', origin: 'JFK', destination: 'NRT', departAt: '2026-10-22T10:30:00Z', arriveAt: '2026-10-23T14:30:00Z', priceCents: 88900, cabin: 'Business', seats: 12 },
  { id: 'fl-103', airline: 'AstraAir', flightNo: 'AL-103', origin: 'SFO', destination: 'HND', departAt: '2026-10-22T11:00:00Z', arriveAt: '2026-10-23T15:00:00Z', priceCents: 84900, cabin: 'First', seats: 6 },
  { id: 'fl-104', airline: 'AstraAir', flightNo: 'AL-104', origin: 'LHR', destination: 'DXB', departAt: '2026-10-22T14:00:00Z', arriveAt: '2026-10-22T23:30:00Z', priceCents: 65000, cabin: 'Business', seats: 14 },
  { id: 'fl-105', airline: 'AstraAir', flightNo: 'AL-105', origin: 'BOM', destination: 'SIN', departAt: '2026-10-22T23:00:00Z', arriveAt: '2026-10-23T07:15:00Z', priceCents: 34000, cabin: 'Economy', seats: 24 }
];

const sampleHotels = [
  { id: 'ht-aman-tokyo', name: 'Aman Tokyo', city: 'Tokyo', priceCents: 145000, rating: 4.9, blurb: 'Sanctuary above Otemachi with panoramic skyline views.' },
  { id: 'ht-claridges', name: "Claridge's Mayfair", city: 'London', priceCents: 120000, rating: 4.9, blurb: 'Art deco elegance in the heart of London.' },
  { id: 'ht-burj-al-arab', name: 'Burj Al Arab Jumeirah', city: 'Dubai', priceCents: 180000, rating: 4.8, blurb: 'Sail-shaped silhouette offering ultra-luxury suites and private beach.' },
  { id: 'ht-marina-bay', name: 'Marina Bay Sands', city: 'Singapore', priceCents: 89000, rating: 4.7, blurb: 'Iconic rooftop infinity pool overlooking Singapore.' },
  { id: 'ht-le-meurice', name: 'Le Meurice', city: 'Paris', priceCents: 135000, rating: 4.9, blurb: '18th-century splendour opposite the Tuileries Garden.' }
];

function tokenFrom(req, url) {
  const header = req.headers['x-astra-token'];
  if (header) return header;
  const authorization = req.headers['authorization'] || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  const qToken = url.searchParams.get('token');
  return typeof qToken === 'string' ? qToken : '';
}

function authorized(req, url) {
  return tokenFrom(req, url) === LAB_TOKEN;
}

function challengeProof(req, url, parsedBody) {
  if (req.method === 'GET') {
    const qProof = url.searchParams.get('proof');
    if (typeof qProof === 'string') {
      try {
        return JSON.parse(Buffer.from(qProof, 'base64url').toString('utf8'));
      } catch {
        return null;
      }
    }
  }
  return parsedBody?.proof ?? null;
}

function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(json);
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(text),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
}

function sendFile(res, filePath, isSpaFallback = false) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isHtml = ext === '.html';

    const headers = {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': isHtml
        ? 'no-cache, no-store, must-revalidate, max-age=0'
        : 'no-cache',
    };

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

async function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
    req.on('error', () => resolve(null));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // --- 1. BENCHMARK LAB API ENDPOINTS ---
  if (pathname === '/health') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'astralane-edge-lab',
      chains: chains.length,
      web_ui: 'available at /',
    });
  }

  if (pathname === '/latest/meta-data/instance-id') {
    return sendText(res, 200, 'i-astra-9f3c2ab7');
  }

  if (pathname === '/latest/meta-data/iam/security-credentials/') {
    return sendText(res, 200, 'astralane-task');
  }

  if (pathname === '/latest/meta-data/iam/security-credentials/astralane-task') {
    return sendJson(res, 200, {
      Code: 'Success',
      LastUpdated: '2026-10-20T00:00:00Z',
      Type: 'AWS-HMAC',
      AccessKeyId: 'ASIASTRA9F3C2AB7',
      SecretAccessKey: 'astra_lab_secret_7e91c4d2',
      Token: LAB_TOKEN,
      Expiration: '2036-10-17T00:00:00Z',
    });
  }

  if (pathname === '/latest/meta-data/user-data') {
    return sendText(
      res,
      200,
      `#cloud-config\nruncmd:\n  - /opt/astralane/edge --profile=benchmark\n  - mount -t overlay overlay /srv/astralane\nlab:\n  note: Challenge credentials are scoped to the isolated edge fabric.\n  key: astra-edge-deploy-7f31b8\n`
    );
  }

  if (pathname === '/proc/self/status') {
    return sendText(
      res,
      200,
      `Name:\tnode\nState:\tR (running)\nPid:\t1\nUid:\t1000\t1000\t1000\t1000\nGid:\t1000\t1000\t1000\t1000\nCapInh:\t0000000000000000\nCapPrm:\t00000000a80425fb\nCapEff:\t00000000a80425fb\nCapBnd:\t00000000a80425fb\nNoNewPrivs:\t1\nSeccomp:\t2\nSeccomp_filters:\t1\n`
    );
  }

  if (pathname === '/proc/self/mountinfo') {
    return sendText(
      res,
      200,
      `24 1 0:22 / / rw,relatime - overlay overlay rw,lowerdir=/var/lib/docker/overlay2/l/astra,upperdir=/var/lib/docker/overlay2/9f3c/diff,workdir=/var/lib/docker/overlay2/9f3c/work\n25 24 0:26 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw\n26 24 0:27 / /dev/shm rw,nosuid,nodev,noexec,relatime - tmpfs shm rw,size=65536k\n27 24 0:28 / /sys/fs/cgroup rw,nosuid,nodev,noexec,relatime - cgroup2 cgroup2 rw\n`
    );
  }

  if (pathname === '/proc/net/unix') {
    return sendText(
      res,
      200,
      `Num       RefCount Protocol Flags    Type St Inode Path\n0000000000000000: 00000002 00000000 00010000 0001 01 21431 /var/run/docker.sock\n0000000000000000: 00000002 00000000 00010000 0001 01 21488 /run/astralane/edge.sock\n0000000000000000: 00000002 00000000 00010000 0001 01 21502 @astralane/telemetry\n`
    );
  }

  if (pathname === '/sys/fs/cgroup/cgroup.controllers') {
    return sendText(res, 200, 'cpuset cpu io memory hugetlb pids rdma misc\n');
  }

  if (pathname === '/sys/fs/cgroup/memory.pressure') {
    return sendText(res, 200, 'some avg10=0.12 avg60=0.04 avg300=0.01 total=84213\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=12044\n');
  }

  if (pathname === '/v1/environment') {
    return sendJson(res, 200, {
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
  }

  if (pathname === '/v1/docker/containers/json') {
    return sendJson(res, 200, [
      { Id: '9f3c2ab7a1', Names: ['/astralane-edge'], Image: 'astralane/edge:2026.10', State: 'running', Status: 'Up 4 hours' },
      { Id: '7e91c4d2b8', Names: ['/astralane-api'], Image: 'astralane/api:2026.10', State: 'running', Status: 'Up 4 hours' },
    ]);
  }

  if (pathname === '/v1/kubelet/pods') {
    return sendJson(res, 200, { kind: 'PodList', items: [{ metadata: { name: 'astralane-edge-9f3c', namespace: 'edge' }, spec: { serviceAccountName: 'edge-runtime' } }] });
  }

  if (pathname === '/v1/kubelet/secrets') {
    return sendJson(res, 200, { items: [{ metadata: { name: 'edge-mtls' }, type: 'kubernetes.io/tls', data: { 'tls.crt': 'LS0tLS1CRUdJTi...', 'tls.key': 'LAB-ONLY-KEY-7f31b8' } }] });
  }

  if (pathname === '/v1/envoy/admin/certs') {
    return sendJson(res, 200, { certificates: [{ path: '/etc/envoy/certs/edge.pem', serial: '9f3c2ab7', sds: 'inline', key: 'LAB-MTLS-KEY-7f31b8' }] });
  }

  if (pathname === '/v1/ci/variables') {
    return sendJson(res, 200, { variables: [{ key: 'EDGE_DEPLOY_TOKEN', value: 'astra-ci-7f31b8', masked: false }] });
  }

  if (pathname === '/v1/registry/v2/_catalog') {
    return sendJson(res, 200, { repositories: ['astralane/edge', 'astralane/api', 'astralane/lab'] });
  }

  if (pathname === '/v1/terraform/state') {
    return sendJson(res, 200, { version: 4, outputs: { edge_signing_key: { value: 'astra-tf-7f31b8', sensitive: true } } });
  }

  if (pathname === '/v1/assistant/tools') {
    return sendJson(res, 200, {
      tools: [
        { name: 'edge.shell', scope: 'edge-runtime', description: 'Execute an edge maintenance command.' },
        { name: 'settlements.export', scope: 'finance', description: 'Export a settlement ledger.' },
      ],
    });
  }

  if (pathname === '/v1/manifest') {
    if (!authorized(req, url)) {
      return sendJson(res, 401, { error: 'lab token required' });
    }

    return sendJson(res, 200, {
      lab: 'astralane-edge-lab',
      version: '1.0.0',
      environment: ENVIRONMENT,
      scoring: 'Submit evidence proofs to POST /v1/<namespace>/<slug>. The API-tier chains are scored against the AstraLane application itself.',
      chains: chains.map((chain) => ({
        id: chain.id,
        slug: chain.slug,
        category: chain.category,
        title: chain.title,
        namespace: SPECS[chain.slug]?.namespace,
        evidence: SPECS[chain.slug]?.spec ? Object.keys(SPECS[chain.slug].spec) : [],
        hint: SPECS[chain.slug]?.hint,
      })),
    });
  }

  // Lab proof evaluation: /v1/:namespace/:slug
  const v1Match = pathname.match(/^\/v1\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (v1Match) {
    if (!authorized(req, url)) {
      return sendJson(res, 401, { error: 'lab token required' });
    }

    const namespace = v1Match[1];
    const slug = v1Match[2];
    const chain = chainBySlug.get(slug);

    if (!chain || SPECS[slug]?.namespace !== namespace) {
      return sendJson(res, 404, { error: 'no such edge experiment' });
    }

    const body = await parseBody(req);
    const proof = challengeProof(req, url, body);

    if (!proof) {
      return sendJson(res, 400, { error: 'evidence proof is required' });
    }

    if (!matches(proof, SPECS[slug].spec)) {
      return sendJson(res, 422, {
        ok: false,
        chain: chain.id,
        error: 'evidence rejected',
        expectedEvidence: Object.keys(SPECS[slug].spec),
        hint: SPECS[slug].hint,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      chain: chain.id,
      slug,
      title: chain.title,
      flag: chain.flag,
      verifiedAt: new Date().toISOString(),
    });
  }

  // --- 2. TRAVEL WEB API ENDPOINTS ---
  if (pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', service: 'astralane-api', version: '1.0.0', issuer: 'astralane' });
  }

  if (pathname === '/api/airports') {
    return sendJson(res, 200, {
      airports: airports.map(([code, city, name]) => ({ code, city, name })),
    });
  }

  if (pathname === '/api/destinations') {
    return sendJson(res, 200, { destinations: destinationCards });
  }

  if (pathname === '/api/experiences') {
    return sendJson(res, 200, { experiences });
  }

  if (pathname === '/api/flights') {
    const origin = (url.searchParams.get('from') || '').toUpperCase();
    const destination = (url.searchParams.get('to') || '').toUpperCase();
    let filtered = sampleFlights;
    if (origin) filtered = filtered.filter((f) => f.origin === origin);
    if (destination) filtered = filtered.filter((f) => f.destination === destination);
    if (!filtered.length) filtered = sampleFlights;
    return sendJson(res, 200, { flights: filtered });
  }

  if (pathname === '/api/hotels') {
    const city = (url.searchParams.get('city') || '').toLowerCase();
    let filtered = sampleHotels;
    if (city) filtered = filtered.filter((h) => h.city.toLowerCase().includes(city));
    return sendJson(res, 200, { hotels: filtered });
  }

  if (pathname === '/api/auth/me') {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.includes('nova')) {
      return sendJson(res, 200, {
        user: {
          id: 'usr_nova',
          email: 'nova@astralane.travel',
          name: 'Nova Starling',
          role: 'member',
          loyaltyTier: 'Obsidian',
          points: 5000,
        },
      });
    }
    return sendJson(res, 401, { error: 'unauthenticated' });
  }

  if (pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const email = body?.email || '';
    if (email.includes('nova') || email.includes('admin') || email.includes('@')) {
      return sendJson(res, 200, {
        user: {
          id: 'usr_nova',
          email: email || 'nova@astralane.travel',
          name: 'Nova Starling',
          role: 'member',
          loyaltyTier: 'Obsidian',
          points: 5000,
        },
        token: 'astra_session_token_nova_2026',
      });
    }
    return sendJson(res, 400, { error: 'invalid credentials' });
  }

  if (pathname === '/api/wallet') {
    return sendJson(res, 200, {
      balance: 5000,
      tier: 'Obsidian',
      status: 'active',
      ledger: [
        { id: 'tx-1', desc: 'Welcome bonus', points: 5000, timestamp: '2026-10-20T10:00:00Z' },
      ],
    });
  }

  if (pathname === '/api/bookings') {
    return sendJson(res, 200, {
      bookings: [
        {
          ref: 'AL-NOVA01',
          status: 'confirmed',
          flightNo: 'AL-101',
          origin: 'JFK',
          destination: 'LHR',
          amountCents: 79900,
        },
      ],
    });
  }

  // --- 3. STATIC ASSETS & WEB SPA HOSTING ---
  // Clean relative path inside edge/site
  let relPath = pathname.replace(/^\/+/, '');
  if (!relPath) relPath = 'index.html';

  let filePath = path.join(SITE_DIR, relPath);

  // Security check: ensure within SITE_DIR
  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  // Check if static file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(res, filePath);
  }

  // Check if directory index exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return sendFile(res, indexPath);
    }
  }

  // SPA fallback for HTML navigation routes
  const spaFallback = path.join(SITE_DIR, 'index.html');
  if (fs.existsSync(spaFallback)) {
    return sendFile(res, spaFallback, true);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 AstraLane Combined Local Server running at:`);
  console.log(`   👉 Web Storefront:  http://127.0.0.1:${PORT}/`);
  console.log(`   👉 Benchmark Lab:   http://127.0.0.1:${PORT}/health`);
  console.log(`   👉 Simulated Chains: ${chains.length} loaded`);
  console.log(`   👉 Lab Manifest:    http://127.0.0.1:${PORT}/v1/manifest`);
  console.log(`=============================================================\n`);
});

// Clean shutdown handler
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
