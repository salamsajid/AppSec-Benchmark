import express from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const addon = require('./als_context.node');
const router = express.Router();
const FLAG = process.env.FLAG_ALS || 'ASTRA{async_local_storage_leak_b692}';
const context = new AsyncLocalStorage();
const results = new Map();

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-als-target',
    endpoint: '/arena/runtime/als/work',
    hint: 'A native callback runs outside the AsyncLocalStorage context; the fallback principal is the administrator.',
  });
});

router.post('/work', (req, res) => {
  const requested = req.get('x-tenant') === 'admin' ? 'admin' : 'member';
  const id = randomUUID();

  context.run({ tenant: requested }, () => {
    addon.start(() => {
      const current = context.getStore();
      const effective = current?.tenant || 'admin';
      const leaked = requested === 'member' && effective === 'admin';
      results.set(id, {
        requested,
        effective,
        ...(leaked ? { flag: FLAG } : { data: 'member-profile' }),
      });
      setTimeout(() => results.delete(id), 60_000).unref();
    });
  });

  res.status(202).json({ id, requested, callback: 'native-thread' });
});

router.get('/work/:id', (req, res) => {
  const result = results.get(String(req.params.id));
  if (!result) {
    res.status(404).json({ error: 'result not ready or expired' });
    return;
  }
  res.json(result);
});

export default router;
