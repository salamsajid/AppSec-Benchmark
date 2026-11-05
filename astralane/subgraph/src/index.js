import express from 'express';
import { buildSchema } from 'graphql';
import { createHandler } from 'graphql-http/lib/use/express';
import pg from 'pg';

const { Pool } = pg;

const PORT = Number(process.env.PORT || 4001);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://astralane:astralane_lab_db_password@db:5432/astralane';
const FEDERATION_FLAG = process.env.FLAG_FEDERATION || 'ASTRA{federation_entities_ssrf_c1e8}';

const pool = new Pool({ connectionString: DATABASE_URL, max: 6 });

const schema = buildSchema(`
  scalar _Any
  scalar _FieldSet
  directive @key(fields: _FieldSet!) repeatable on OBJECT | INTERFACE

  type User @key(fields: "id") {
    id: ID!
    email: String!
    name: String!
    role: String!
    loyaltyTier: String!
    ssn: String
    vaultCode: String
  }

  union _Entity = User

  type Query {
    users: [User!]!
    user(id: ID!): User
    _entities(representations: [_Any!]!): [_Entity]!
  }
`);

function mapUser(row) {
  return {
    __typename: 'User',
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    loyaltyTier: row.loyalty_tier,
    ssn: row.passport_no,
    vaultCode: row.role === 'admin' ? FEDERATION_FLAG : 'not-issued',
  };
}

const rootValue = {
  users: async () => {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    return result.rows.map(mapUser);
  },
  user: async ({ id }) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [String(id)]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  },
  _entities: async ({ representations }) => {
    const entities = [];
    for (const representation of representations || []) {
      if (!representation || representation.__typename !== 'User' || !representation.id) {
        entities.push(null);
        continue;
      }
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [String(representation.id)]);
      entities.push(result.rows[0] ? mapUser(result.rows[0]) : null);
    }
    return entities;
  },
  __resolveType: (object) => object.__typename || 'User',
};

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'astralane-federation-subgraph', federation: 'v2' });
});

app.all('/graphql', createHandler({
  schema,
  rootValue,
  graphiql: false,
}));

async function start() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await pool.query('SELECT 1 FROM users LIMIT 1');
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`AstraLane federation subgraph listening on ${PORT}`));
}

start().catch((error) => {
  console.error('subgraph failed', error);
  process.exit(1);
});
