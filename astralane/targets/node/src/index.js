import express from 'express';
import dpopRouter from './dpop.js';
import webauthnRouter from './webauthn.js';
import jsonbRouter, { initJsonb } from './jsonb.js';
import protocolRouter from './protocol.js';
import multipartRouter from './multipart.js';
import grammarRouter, { initGrammar } from './grammar.js';
import alsRouter from './als.js';
import zkRouter from './zk.js';
import agentRouter from './agent.js';
import rscRouter from './rsc.js';

const PORT = Number(process.env.PORT || 8082);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'astralane-real-targets' });
});

app.get('/', (_req, res) => {
  res.json({
    service: 'astralane-real-targets',
    chains: [
      'dpop-jkt-replay',
      'webauthn-cbor-duplicate',
      'postgres-jsonb-collation',
      'chunked-trailer-smuggle',
      'esi-range-poison',
      'multipart-boundary-s3',
      'llm-grammar-sqli',
      'async-local-storage-leak',
      'zk-underconstrained',
      'ai-memory-poison',
      'rsc-flight-closure',
    ],
  });
});

app.use('/identity/dpop', dpopRouter);
app.use('/identity/webauthn', webauthnRouter);
app.use('/runtime/jsonb', jsonbRouter);
app.use('/protocol', protocolRouter);
app.use('/protocol', multipartRouter);
app.use('/runtime/grammar', grammarRouter);
app.use('/runtime/als', alsRouter);
app.use('/identity/zk', zkRouter);
app.use('/runtime/agent', agentRouter);
app.use('/browser/rsc', rscRouter);

app.use((error, _req, res, _next) => {
  console.error('[targets]', error);
  res.status(500).json({ error: 'target fault' });
});

async function start() {
  let ready = false;
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await initJsonb();
      await initGrammar();
      ready = true;
      break;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (!ready) throw lastError;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`astralane real targets listening on ${PORT}`);
  });
}

start().catch((error) => {
  console.error('[targets] startup failed', error);
  process.exit(1);
});
