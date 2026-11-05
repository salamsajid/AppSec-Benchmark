'use strict';

const express = require('express');
const config = require('../config');
const { pool } = require('../db');
const { authenticate, requireAdmin, requireAuth } = require('../auth');
const { TRANSPARENT_PNG, normalizeEmail } = require('../util');

const router = express.Router();

router.use(authenticate);

router.get('/vault', requireAdmin, async (req, res) => {
  let vaultFlag = config.flags.adminSession;
  if (req.auth.mode === 'jku') vaultFlag = config.flags.jku;
  else if (req.auth.mode === 'hs256') vaultFlag = config.flags.alg;
  else if (req.auth.mode === 'widget') vaultFlag = config.flags.widget;
  else if (req.auth.mode === 'saml') vaultFlag = config.flags.saml;
  else if (req.user && req.user.admin_origin === 'cspt') vaultFlag = config.flags.cspt;

  res.json({
    vault: vaultFlag,
    mode: req.auth.mode,
    principal: req.auth.email || req.user?.email || 'token-principal',
    governance: {
      region: 'ap-south-1',
      tier: 'operations',
      keyRotation: '2026-09-30T00:00:00Z',
    },
  });
});

router.get('/users/promote', requireAdmin, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email) return res.status(400).json({ error: 'email required' });
    const result = await pool.query(
      "UPDATE users SET role = 'admin', admin_origin = 'cspt' WHERE email = $1 RETURNING id, email, role",
      [email]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'member not found' });
    res.json({ ok: true, member: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/coupons/check', requireAdmin, async (req, res, next) => {
  try {
    const prefix = String(req.query.prefix || '');
    if (!prefix) return res.status(400).json({ error: 'prefix required' });
    const result = await pool.query(
      'SELECT code FROM coupons WHERE left(code, length($1)) = $1 LIMIT 1',
      [prefix]
    );
    res.set('cache-control', 'no-store');
    if (result.rows[0]) {
      res.type('png').send(TRANSPARENT_PNG);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/diagnostics', requireAuth, (req, res) => {
  const polluted = ({}).serviceTier === 'internal';
  res.json({
    service: 'aetherion-commerce-api',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    runtime: process.version,
    tier: ({}).serviceTier || 'standard',
    seccomp: 2,
    capabilities: '00000000a80425fb',
    ...(polluted ? { vault: config.flags.proto, remediation: 'runtime configuration integrity failure' } : {}),
  });
});

module.exports = router;
