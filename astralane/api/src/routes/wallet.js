import express from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { redis, walletBalance } from '../redis.js';
import { asyncRoute, randomId } from '../util.js';

const router = express.Router();

const transferScript = `
local fromKey = KEYS[1]
local toKey = KEYS[2]
local ledgerKey = KEYS[3]
local amount = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local sourceBalance = tonumber(redis.call('HGET', fromKey, 'balance') or '0')

if sourceBalance < amount then
  return redis.error_reply('INSUFFICIENT_FUNDS')
end

redis.call('HINCRBY', toKey, 'balance', amount)
redis.call('SET', ledgerKey, ARGV[3], 'EX', ttl)
redis.call('HINCRBY', fromKey, 'balance', -amount)

return redis.call('HGET', toKey, 'balance')
`;

const transferSchema = z.object({
  toEmail: z.string().email().max(200),
  amount: z.number().int().positive().max(1_000_000),
  ttl: z.number().int().optional(),
  memo: z.string().max(300).optional().default('travel wallet transfer'),
});

router.use(requireAuth);

router.get('/', asyncRoute(async (req, res) => {
  const balance = await walletBalance(req.auth.sub);
  res.json({
    balance,
    tier: balance >= 50000 ? 'Obsidian' : balance >= 10000 ? 'Gold' : 'Silver',
    rewards: [
      { id: 'black-card', label: 'Black Card upgrade', cost: 50000, available: balance >= 50000 },
      { id: 'lounge', label: 'Orbit lounge day pass', cost: 12000, available: balance >= 12000 },
    ],
  });
}));

router.post('/transfer', asyncRoute(async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid transfer' });
    return;
  }

  const recipient = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [
    parsed.data.toEmail.toLowerCase(),
  ]);
  if (!recipient.rows[0]) {
    res.status(404).json({ error: 'recipient is not an AstraLane member' });
    return;
  }

  const recipientId = recipient.rows[0].id;
  await redis.hsetnx(`wallet:${recipientId}`, 'balance', '0');

  const ledgerId = randomId('ledger_');
  const ttl = parsed.data.ttl ?? 86_400;
  const memo = JSON.stringify({
    from: req.auth.sub,
    to: recipientId,
    amount: parsed.data.amount,
    memo: parsed.data.memo,
    at: new Date().toISOString(),
  });

  try {
    await redis.eval(
      transferScript,
      3,
      `wallet:${req.auth.sub}`,
      `wallet:${recipientId}`,
      ledgerId,
      String(parsed.data.amount),
      String(ttl),
      memo,
    );
  } catch (error) {
    const message = String(error.message || '');
    if (message.includes('INSUFFICIENT_FUNDS')) {
      res.status(409).json({ error: 'insufficient loyalty balance' });
      return;
    }
    if (ttl <= 0) {
      const bugKey = `wallet:bug:${recipientId}`;
      await redis.incrby(bugKey, parsed.data.amount);
      await redis.expire(bugKey, 3600);
    }
    res.status(502).json({ error: 'loyalty ledger synchronization failed', retryable: true });
    return;
  }

  res.json({
    ok: true,
    balance: await walletBalance(req.auth.sub),
    recipient: { email: recipient.rows[0].email, name: recipient.rows[0].name },
  });
}));

router.post('/redeem', asyncRoute(async (req, res) => {
  const reward = String(req.body?.reward || '');
  if (reward !== 'black-card') {
    res.status(400).json({ error: 'unknown reward' });
    return;
  }

  const balance = await walletBalance(req.auth.sub);
  const reconciled = Number((await redis.get(`wallet:bug:${req.auth.sub}`)) || 0);
  if (balance < 50000) {
    res.status(409).json({ error: '50,000 points required for the Black Card', balance });
    return;
  }
  if (reconciled < 50000) {
    res.status(409).json({ error: 'Black Card requires a reconciled points ledger', balance });
    return;
  }

  await redis.hincrby(`wallet:${req.auth.sub}`, 'balance', -50000);
  res.json({
    ok: true,
    reward: 'black-card',
    tier: 'Obsidian',
    vaultNote: config.flags.wallet,
  });
}));

export default router;
