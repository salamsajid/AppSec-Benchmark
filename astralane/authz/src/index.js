import express from 'express';

const app = express();
const PORT = Number(process.env.PORT || 4002);
const PROMO_PATTERN = /^(a+)+$/;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'astralane-authz' });
});

app.post('/regex', (req, res) => {
  const input = typeof req.body?.input === 'string' ? req.body.input.slice(0, 4096) : '';
  const valid = PROMO_PATTERN.test(input);
  res.json({ ok: true, valid, pattern: 'promo-v3' });
});

app.post('/authorize', (req, res) => {
  const role = String(req.body?.role || '');
  const action = String(req.body?.action || '');
  const allow = role === 'admin' && action === 'payout';
  res.json({ allow, subject: role, action, decidedAt: new Date().toISOString() });
});

app.use((error, _req, res, _next) => {
  console.error('[authz]', error);
  res.status(500).json({ error: 'authorization service error' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`AstraLane authz listening on ${PORT}`));
