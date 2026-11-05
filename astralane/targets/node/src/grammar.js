import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const router = express.Router();
const FLAG = process.env.FLAG_GRAMMAR || 'ASTRA{llm_grammar_sqli_d0c4}';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://astralane:astralane_lab_db_password@db:5432/astralane';
const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

const PREFIX = '{"tenant":"';
const SUFFIX = '"}';

export async function initGrammar() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS target_tenant_secrets (
        tenant text PRIMARY KEY,
        secret text NOT NULL
      )
    `);
    await client.query(
      `INSERT INTO target_tenant_secrets (tenant, secret)
       VALUES ('admin', $1)
       ON CONFLICT (tenant) DO UPDATE SET secret = EXCLUDED.secret`,
      [FLAG],
    );
  } finally {
    client.release();
  }
}

function validateCompletion(completion) {
  if (!completion.startsWith(PREFIX) || !completion.endsWith(SUFFIX)) {
    return { ok: false, error: 'completion does not match the tenant schema' };
  }
  const body = completion.slice(PREFIX.length, -SUFFIX.length);
  if (/["'`;]|--|\/\*|\*\//.test(body)) {
    return { ok: false, error: 'completion contains a forbidden token' };
  }
  if (/[\u0000-\u001f]/.test(body)) {
    return { ok: false, error: 'completion contains a control character' };
  }
  return { ok: true };
}

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-grammar-target',
    endpoint: '/arena/runtime/grammar/complete',
    schema: '{"type":"object","properties":{"tenant":{"type":"string"}},"required":["tenant"]}',
    hint: 'The constrained decoder validates raw JSON escapes before decoding them, and the decoded tenant is concatenated into a SQL query.',
  });
});

router.post('/complete', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
  if (!prompt || prompt.length > 200) {
    res.status(400).json({ error: 'prompt is required and must be at most 200 characters' });
    return;
  }

  const completion = `${PREFIX}${prompt}${SUFFIX}`;
  const validation = validateCompletion(completion);
  if (!validation.ok) {
    res.status(422).json({ error: validation.error, completion });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(completion);
  } catch {
    res.status(422).json({ error: 'completion is not valid JSON', completion });
    return;
  }

  const tenant = parsed.tenant;
  if (typeof tenant !== 'string') {
    res.status(422).json({ error: 'tenant must be a string' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT tenant, secret FROM target_tenant_secrets WHERE tenant = '${tenant}' AND tenant <> 'admin' LIMIT 1`,
    );
    if (result.rowCount === 0) {
      res.status(403).json({ error: 'tenant is not authorized' });
      return;
    }
    res.json({ ok: true, completion, tenant: result.rows[0].tenant, flag: result.rows[0].secret });
  } catch {
    res.status(500).json({ error: 'tenant lookup failed' });
  }
});

export default router;
