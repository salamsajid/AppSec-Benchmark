import cookieParser from 'cookie-parser';
import express from 'express';
import pinoHttp from 'pino-http';
import { attachAuth, loadSigningKey } from './auth.js';
import { config } from './config.js';
import { bootstrap, pool } from './db.js';
import { graphqlHandler } from './graphql.js';
import { redis, seedWallets } from './redis.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import conciergeRoutes from './routes/concierge.js';
import partnerRoutes from './routes/partner.js';
import ssoRoutes from './routes/sso.js';
import supportRoutes from './routes/support.js';
import travelRoutes from './routes/travel.js';
import walletRoutes from './routes/wallet.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(pinoHttp({
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  autoLogging: { ignore: (req) => req.url === '/api/health' },
}));

app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buffer) => {
    req.rawBody = buffer;
  },
}));
app.use(cookieParser());
app.use(attachAuth);

app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', service: 'astralane-api', version: '1.0.0', issuer: 'astralane' });
});

app.get('/api/docs', (_req, res) => {
  res.json({
    product: 'AstraLane',
    description: 'Travel, stays, loyalty, partner settlement, and identity APIs.',
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/refresh', 'GET /api/auth/jwks', 'GET /api/auth/me'],
      travel: ['GET /api/airports', 'GET /api/destinations', 'GET /api/flights', 'GET /api/hotels', 'GET /api/experiences'],
      booking: ['GET /api/bookings', 'POST /api/bookings', 'GET /api/bookings/:ref', 'POST /api/bookings/:ref/pay'],
      loyalty: ['GET /api/wallet', 'POST /api/wallet/transfer', 'POST /api/wallet/redeem'],
      partner: ['POST /api/partner/handshake', 'POST /api/partner/webhook'],
      identity: ['GET /api/sso/oidc/start', 'GET /api/sso/saml/metadata', 'GET /api/sso/saml/login', 'POST /api/sso/saml/acs'],
      graphql: ['POST /graphql'],
      concierge: ['POST /api/concierge/compare', 'POST /api/concierge/chat'],
      support: ['POST /api/support/promo'],
      operator: ['GET /api/admin/vault', 'GET /api/admin/users', 'GET /api/admin/audit', 'POST /api/admin/payout'],
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', travelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/concierge', conciergeRoutes);
app.use('/api/sso', ssoRoutes);
app.all('/graphql', graphqlHandler);
app.all('/api/graphql', graphqlHandler);

app.use((req, res) => {
  res.status(404).json({ error: 'route not found', path: req.path });
});

app.use((error, _req, res, _next) => {
  console.error('[api]', error);
  if (res.headersSent) return;
  res.status(500).json({ error: 'request could not be completed' });
});

let server;

async function start() {
  await bootstrap();
  await loadSigningKey();
  await seedWallets();
  server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`AstraLane API listening on ${config.port}`);
  });
}

async function shutdown(signal) {
  console.log(`AstraLane API received ${signal}, shutting down`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end().catch(() => {});
  redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  console.error('failed to start AstraLane API', error);
  process.exit(1);
});
