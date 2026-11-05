import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const router = express.Router();
const FLAG = process.env.FLAG_JSONB || 'ASTRA{postgres_jsonb_collation_7e35}';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://astralane:astralane_lab_db_password@db:5432/astralane';
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

export async function initJsonb() {
  const client = await pool.connect();
  try {
    try {
      await client.query(
        "CREATE COLLATION astra_ci (provider = icu, locale = 'und-u-ks-level2', deterministic = false)",
      );
    } catch (error) {
      if (error.code !== '42710') throw error;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS target_profiles (
        email text PRIMARY KEY,
        role jsonb NOT NULL DEFAULT '{"kind":"member"}'::jsonb
      )
    `);

    await client.query(`
      INSERT INTO target_profiles (email, role) VALUES
        ('visitor@astralane.travel', '{"kind":"member"}'::jsonb),
        ('ops@astralane.travel', '{"kind":"admin"}'::jsonb)
      ON CONFLICT (email) DO NOTHING
    `);
  } finally {
    client.release();
  }
}

router.get('/', (_req, res) => {
  res.json({
    service: 'astralane-jsonb-target',
    profileEndpoint: '/arena/runtime/jsonb/profile',
    adminEndpoint: '/arena/runtime/jsonb/admin',
    hint: 'Profile updates compare the requested role with JavaScript string equality, while the administrator query uses a non-deterministic ICU collation.',
  });
});

router.post('/profile', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = String(req.body?.role || '').trim();
  if (!email || !role) {
    res.status(400).json({ error: 'email and role are required' });
    return;
  }
  if (role === 'admin') {
    res.status(403).json({ error: 'administrator role cannot be assigned' });
    return;
  }
  if (role.length > 64) {
    res.status(400).json({ error: 'role is too long' });
    return;
  }

  try {
    const result = await pool.query(
      'UPDATE target_profiles SET role = jsonb_build_object($2::text, $3::text) WHERE email = $1 RETURNING email, role',
      [email, 'kind', role],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    res.json({ ok: true, profile: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'profile update failed' });
  }
});

router.get('/admin', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT email, role->>'kind' AS kind
         FROM target_profiles
        WHERE email = $1
          AND (role->>'kind') COLLATE astra_ci = 'admin'`,
      [email],
    );
    if (result.rowCount === 0) {
      res.status(403).json({ error: 'administrator role required' });
      return;
    }
    const profile = result.rows[0];
    const escalated = profile.kind !== 'admin';
    res.json({
      ok: true,
      email: profile.email,
      effectiveRole: profile.kind,
      ...(escalated ? { flag: FLAG } : {}),
    });
  } catch {
    res.status(500).json({ error: 'authorization lookup failed' });
  }
});

export default router;
