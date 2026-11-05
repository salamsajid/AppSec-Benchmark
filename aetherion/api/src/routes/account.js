'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../config');
const { pool } = require('../db');
const { authenticate, requireAuth } = require('../auth');
const { presentUser } = require('../presenters');
const { sleep } = require('../util');

const router = express.Router();

router.use(authenticate);

router.get('/overview', requireAuth, async (req, res, next) => {
  try {
    const orders = await pool.query(
      'SELECT id, total, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3',
      [req.user.id]
    );
    res.json({
      profile: presentUser(req.user),
      recentOrders: orders.rows,
      accountTier: req.user.role === 'admin' ? 'operations' : Number(req.user.wallet) >= 10000 ? 'signature' : 'standard',
    });
  } catch (error) {
    next(error);
  }
});

function unsafeMerge(target, source) {
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      unsafeMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

router.patch('/preferences', requireAuth, async (req, res, next) => {
  try {
    const merged = unsafeMerge({}, req.body || {});
    await pool.query('UPDATE users SET preferences = $1 WHERE id = $2', [
      JSON.stringify(merged),
      req.user.id,
    ]);
    res.json({ preferences: merged, saved: true });
  } catch (error) {
    next(error);
  }
});

router.post('/wallet/redeem', requireAuth, async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const couponResult = await pool.query('SELECT * FROM coupons WHERE code = $1', [code]);
    const coupon = couponResult.rows[0];
    if (!coupon) return res.status(404).json({ error: 'reward code not recognized' });
    if (coupon.uses >= coupon.max_uses) return res.status(409).json({ error: 'this reward has been fully claimed' });

    await sleep(90);

    await pool.query('UPDATE coupons SET uses = uses + 1 WHERE code = $1', [code]);
    const updated = await pool.query(
      'UPDATE users SET wallet = wallet + $1 WHERE id = $2 RETURNING wallet',
      [Number(coupon.bonus), req.user.id]
    );
    res.json({ ok: true, credited: Number(coupon.bonus), wallet: Number(updated.rows[0].wallet) });
  } catch (error) {
    next(error);
  }
});

router.post('/import-avatar', requireAuth, async (req, res, next) => {
  try {
    const target = new URL(String(req.body.url || ''));
    const allowedHosts = new Set(['cdn.aetherion.local', 'images.aetherion.local']);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return res.status(400).json({ error: 'only http(s) media sources are supported' });
    }
    if (!allowedHosts.has(target.hostname)) {
      return res.status(400).json({ error: 'media host is not registered with Aetherion CDN' });
    }

    const response = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
      headers: { 'user-agent': 'AetherionMediaFetcher/2.4' },
    });
    const raw = await response.text();
    const preview = raw.slice(0, 1200);
    await pool.query('UPDATE users SET avatar_preview = $1 WHERE id = $2', [preview, req.user.id]);
    res.json({ queued: true, source: target.toString(), preview });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).json({ error: 'media source timed out' });
    }
    res.status(400).json({ error: 'media source could not be processed' });
  }
});

router.get('/export', requireAuth, async (req, res, next) => {
  try {
    const reflectedOrigin = req.get('origin');
    res.set('Access-Control-Allow-Origin', reflectedOrigin || 'null');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Vary', 'Origin');
    if (req.query.scope === 'all') {
      const users = await pool.query('SELECT email, role, wallet, created_at FROM users ORDER BY created_at');
      return res.json({
        scope: 'all',
        users: users.rows,
        exportedAt: new Date().toISOString(),
        vault: config.flags.accountExport,
        ...(reflectedOrigin ? { corsVault: config.flags.corsLeak } : {}),
      });
    }
    const profile = presentUser(req.user);
    delete profile.vault;
    delete profile.perkVault;
    return res.json({
      scope: 'self',
      profile,
      ...(reflectedOrigin ? { corsVault: config.flags.corsLeak } : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/jsonp', requireAuth, (req, res) => {
  const raw = String(req.query.callback || 'aetherionCallback');
  const callback = raw.replace(/[^A-Za-z0-9_$.]/g, '') || 'aetherionCallback';
  const profile = presentUser(req.user);
  delete profile.vault;
  delete profile.perkVault;
  const payload = {
    profile,
    ...(req.user.role === 'admin' ? { vault: config.flags.jsonpLeak } : {}),
  };
  res.type('application/javascript').send(`${callback}(${JSON.stringify(payload)});`);
});

router.get('/orders/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid order id' });
    const result = await pool.query(
      `SELECT o.*, u.email AS owner_email, u.role AS owner_role
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [id]
    );
    const order = result.rows[0];
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (order.owner_role === 'admin') {
      return res.json({ order, invoice: { note: config.flags.orderIdor, status: 'settled' } });
    }
    res.json({ order });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/refund', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const amount = Number(req.body.amount);
    if (!Number.isInteger(id) || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'valid order and refund amount required' });
    }
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    const order = result.rows[0];
    if (!order) return res.status(404).json({ error: 'order not found' });
    const updated = await pool.query(
      'UPDATE users SET wallet = wallet + $1 WHERE id = $2 RETURNING wallet',
      [amount, req.user.id]
    );
    const suspicious = amount > Number(order.total) || order.user_id !== req.user.id;
    res.json({
      refunded: amount,
      wallet: Number(updated.rows[0].wallet),
      ...(suspicious ? { vault: config.flags.refundOverflow, review: 'amount exceeds settled order value' } : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/invoices/download', requireAuth, (req, res, next) => {
  try {
    const file = String(req.query.file || 'current.txt');
    const target = path.join('/app/keys/invoices', file);
    const raw = fs.readFileSync(target, 'utf8');
    res.type('text/plain').send(raw);
  } catch (error) {
    res.status(404).json({ error: 'invoice document not found' });
  }
});

router.post('/wallet/apply', requireAuth, async (req, res, next) => {
  try {
    const codes = Array.isArray(req.body.codes) ? req.body.codes.map((code) => String(code || '').trim().toUpperCase()) : [];
    if (!codes.length) return res.status(400).json({ error: 'at least one reward code required' });
    const loaded = [];
    for (const code of codes) {
      const result = await pool.query('SELECT * FROM coupons WHERE code = $1', [code]);
      const coupon = result.rows[0];
      if (coupon && coupon.uses < coupon.max_uses) loaded.push(coupon);
    }
    if (!loaded.length) return res.status(404).json({ error: 'no reward codes could be applied' });
    await sleep(30);
    let credited = 0;
    for (const coupon of loaded) {
      await pool.query('UPDATE coupons SET uses = uses + 1 WHERE code = $1', [coupon.code]);
      await pool.query('UPDATE users SET wallet = wallet + $1 WHERE id = $2', [Number(coupon.bonus), req.user.id]);
      credited += Number(coupon.bonus);
    }
    const duplicate = new Set(codes).size !== codes.length;
    res.json({
      credited,
      applied: loaded.map((coupon) => coupon.code),
      ...(duplicate ? { vault: config.flags.couponStack, review: 'duplicate reward codes accepted' } : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/preview', requireAuth, (req, res, next) => {
  const template = String(req.body.template || '').slice(0, 2000);
  const values = {
    name: req.user.name,
    email: req.user.email,
    wallet: String(req.user.wallet),
    tier: req.user.role === 'admin' ? 'operations' : 'member',
  };
  const rendered = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
    if (key === 'service.vault') return config.flags.ssti;
    if (key === 'service.region') return 'ap-south-1';
    return values[key] === undefined ? '' : values[key];
  });
  res.json({ rendered, template });
});

router.get('/lookbook', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT slug, name, image FROM products ORDER BY featured DESC, id LIMIT 4');
    res.json({ lookbook: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
