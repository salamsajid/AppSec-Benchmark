import crypto from 'node:crypto';

const env = (name, fallback) => process.env[name] ?? fallback;

const cursorKey = Buffer.from(
  env('CURSOR_KEY', '9f2c4e7a1b6d8f0a3c5e7b9d1f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a'),
  'hex',
);

if (cursorKey.length !== 32) {
  throw new Error('CURSOR_KEY must be a 64-character hex string');
}

export const config = {
  port: Number(env('PORT', 3000)),
  nodeEnv: env('NODE_ENV', 'development'),
  databaseUrl: env('DATABASE_URL', 'postgres://astralane:astralane_lab_db_password@db:5432/astralane'),
  redisUrl: env('REDIS_URL', 'redis://redis:6379'),
  publicBase: env('PUBLIC_BASE', 'http://127.0.0.1:18080'),
  idpBase: env('IDP_BASE', 'http://idp:4000'),
  idpPublicBase: env('IDP_PUBLIC_BASE', 'http://127.0.0.1:18080/idp'),
  idpClientId: env('IDP_CLIENT_ID', 'astralane-web'),
  idpClientSecret: env('IDP_CLIENT_SECRET', 'astralane_web_client_secret_2026'),
  subgraphUrl: env('SUBGRAPH_URL', 'http://subgraph:4001/graphql'),
  authzUrl: env('AUTHZ_URL', 'http://authz:4002'),
  labUrl: env('LAB_URL', 'http://lab:8081'),
  cursorKey,
  partnerTimingDelayMs: Number(env('PARTNER_TIMING_DELAY_MS', 26)),
  adminEmail: env('ADMIN_EMAIL', 'ops@astralane.travel'),
  demoEmail: env('DEMO_EMAIL', 'nova@astralane.travel'),
  demoPassword: env('DEMO_PASSWORD', 'Nova!Demo#2026'),
  adminPassword: env('ADMIN_PASSWORD', crypto.randomBytes(32).toString('base64url')),
  sessionCookie: 'astra_session',
  flags: {
    adminVault: env('FLAG_ADMIN_VAULT', 'ASTRA{ecdsa_biased_nonce_admin_6f2a}'),
    partner: env('FLAG_PARTNER', 'ASTRA{http2_timing_hmac_secret_9d41}'),
    saml: env('FLAG_SAML', 'ASTRA{saml_xsw_admin_3b7c}'),
    graphql: env('FLAG_GRAPHQL', 'ASTRA{graphql_cursor_padding_8e15}'),
    payout: env('FLAG_PAYOUT', 'ASTRA{redos_failopen_payout_2c90}'),
    wallet: env('FLAG_WALLET', 'ASTRA{redis_lua_partial_commit_5a74}'),
    federation: env('FLAG_FEDERATION', 'ASTRA{federation_entities_ssrf_c1e8}'),
  },
};
