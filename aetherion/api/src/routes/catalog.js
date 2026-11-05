'use strict';

const express = require('express');
const config = require('../config');
const { pool } = require('../db');
const { authenticate, requireAuth } = require('../auth');
const { sleep } = require('../util');

const router = express.Router();

router.get('/products', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, slug, name, tagline, description, price, category, image, specs, featured, stock FROM products ORDER BY id'
    );
    res.json({ products: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const result = await pool.query(
      `SELECT id, slug, name, tagline, description, price, category, image, specs, featured, stock
       FROM products
       WHERE name ILIKE '%${q}%' OR tagline ILIKE '%${q}%'
       ORDER BY featured DESC, id`
    );
    res.json({ query: q, results: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/items/:slug', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug]);
    if (!result.rows[0]) return res.status(404).json({ error: 'product not found' });
    res.json({ product: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/orders', authenticate, requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, total, items, address, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/orders', authenticate, requireAuth, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ error: 'cart is empty' });
    const normalized = [];
    let total = 0;
    let tampered = false;
    for (const item of items) {
      const qty = Math.max(1, Math.min(10, Number(item.qty) || 1));
      const result = await pool.query('SELECT * FROM products WHERE slug = $1', [String(item.slug || '')]);
      const product = result.rows[0];
      if (!product) return res.status(400).json({ error: `unknown product: ${item.slug}` });
      if (qty > Number(product.stock)) return res.status(409).json({ error: 'insufficient stock' });
      const suppliedPrice = Number(item.price);
      const price = Number.isFinite(suppliedPrice) ? suppliedPrice : Number(product.price);
      if (Number.isFinite(suppliedPrice) && suppliedPrice !== Number(product.price)) tampered = true;
      normalized.push({ slug: product.slug, name: product.name, price, qty });
      total += price * qty;
    }

    await sleep(60);

    let oversold = false;
    for (const item of normalized) {
      const stock = await pool.query(
        'UPDATE products SET stock = stock - $1 WHERE slug = $2 RETURNING stock',
        [item.qty, item.slug]
      );
      if (Number(stock.rows[0].stock) < 0) oversold = true;
    }

    const order = await pool.query(
      `INSERT INTO orders (user_id, total, items, address, status)
       VALUES ($1, $2, $3, $4, 'confirmed') RETURNING *`,
      [req.user.id, total, JSON.stringify(normalized), String(req.body.address || '')]
    );
    const integrity = [];
    if (tampered) integrity.push({ code: 'price_mismatch', vault: config.flags.priceTamper });
    if (oversold) integrity.push({ code: 'inventory_oversold', vault: config.flags.oversell });
    res.status(201).json({ order: order.rows[0], ...(integrity.length ? { integrity } : {}) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
