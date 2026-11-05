'use strict';

const express = require('express');
const puppeteer = require('puppeteer-core');

const PORT = Number(process.env.PORT || 7000);
const APP_BASE = process.env.APP_BASE || 'http://aetherion.local:8080';
const BOT_TOKEN = process.env.BOT_TOKEN || 'aetherion_bot_internal_7d1a';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ops@aetherion.store';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ops!Aether#2026';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

let browser = null;
let queue = Promise.resolve();

function isAllowedTarget(raw) {
  try {
    const target = new URL(String(raw || ''));
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
    if (target.port === '18080') {
      target.hostname = 'aetherion.local';
      target.port = '8080';
    } else if (target.port === '18081') {
      target.hostname = 'attack.aetherion.local';
      target.port = '8081';
    }
    const host = target.hostname;
    const allowedHost = host === 'aetherion.local' || host.endsWith('.aetherion.local');
    const allowedPort = target.port === '8080' || target.port === '8081';
    if (!allowedHost || !allowedPort) return null;
    return target.toString();
  } catch {
    return null;
  }
}

async function ensureBrowser() {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--ignore-certificate-errors',
      '--disable-features=TrackingProtection3pcd,BlockThirdPartyCookies,ThirdPartyCookieBlocking',
    ],
  });
  return browser;
}

async function login(page) {
  await page.goto(`${APP_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(async (email, password) => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    await fetch('/idp/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }, ADMIN_EMAIL, ADMIN_PASSWORD);
}

async function review(target) {
  const instance = await ensureBrowser();
  const context = instance.createBrowserContext
    ? await instance.createBrowserContext()
    : await instance.createIncognitoBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('[browser]', message.text().slice(0, 240));
  });

  try {
    await login(page);
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const waitMs = target.includes('xsleaks') ? 105000 : target.includes('livechat') ? 22000 : 12000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return { ok: true, url: target };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'aetherion-bot' }));

app.post('/visit', (req, res) => {
  if (req.get('x-bot-token') !== BOT_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  const target = isAllowedTarget(req.body.url);
  if (!target) return res.status(400).json({ error: 'target outside review scope' });

  queue = queue
    .then(() => review(target))
    .then(() => {
      console.log('[bot] reviewed', target);
    })
    .catch((error) => {
      console.error('[bot] review failed', error.message);
    });
  res.status(202).json({ queued: true, url: target });
});

app.use((error, _req, res, _next) => {
  console.error('[bot]', error);
  res.status(500).json({ error: 'review failed' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aetherion review bot listening on ${PORT}`);
});
