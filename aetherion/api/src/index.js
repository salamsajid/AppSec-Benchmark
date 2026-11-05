'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { bootstrap } = require('./db');
const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const accountRoutes = require('./routes/account');
const adminRoutes = require('./routes/admin');
const miscRoutes = require('./routes/misc');
const graphqlRouter = require('./graphql');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(cookieParser());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use((req, _res, next) => {
  const [pathname, query] = req.url.split('?');
  req.url = pathname.replace(/;[^/]*/g, '') + (query ? `?${query}` : '');
  next();
});

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', service: 'aetherion-api', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', miscRoutes);
app.use('/graphql', graphqlRouter);
app.use('/api/graphql', graphqlRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'route not found', path: req.path });
});

app.use((error, _req, res, _next) => {
  console.error('[api]', error);
  res.status(500).json({ error: 'request could not be completed' });
});

async function start() {
  await bootstrap();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Aetherion API listening on ${config.port}`);
  });
}

start().catch((error) => {
  console.error('failed to start api', error);
  process.exit(1);
});
