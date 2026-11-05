'use strict';

const crypto = require('crypto');
const express = require('express');
const {
  buildSchema,
  execute,
  parse,
  specifiedRules,
  validate,
  GraphQLError,
} = require('graphql');
const { NoSchemaIntrospectionCustomRule } = require('graphql/validation');
const config = require('./config');
const { pool } = require('./db');
const { normalizeEmail, signSession, maskEmail } = require('./util');

const schema = buildSchema(`
  type OtpRequest {
    sent: Boolean!
    identifier: String!
    expiresIn: Int!
    hint: String
  }

  type Member {
    id: String!
    email: String!
    name: String!
    role: String!
    wallet: Float!
    vault: String
  }

  type AuthPayload {
    token: String!
    user: Member!
  }

  type Order {
    id: Int!
    total: Float!
    status: String!
    items: String!
    address: String
    owner: String
    vault: String
  }

  type Query {
    serviceStatus: String!
    order(id: Int!): Order
  }

  type Mutation {
    requestOtp(identifier: String!): OtpRequest!
    otpVerify(identifier: String!, code: String!): AuthPayload
  }
`);

const otpStore = new Map();

function identifierKey(identifier) {
  const raw = String(identifier || '').trim();
  if (raw.includes('@')) return normalizeEmail(raw);
  return raw.replace(/[^0-9]/g, '');
}

const rootValue = {
  serviceStatus: () => 'aetherion-member-graph/v2',
  order: async ({ id }) => {
    const result = await pool.query(
      `SELECT o.*, u.email AS owner_email, u.role AS owner_role
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [id]
    );
    const order = result.rows[0];
    if (!order) return null;
    return {
      id: order.id,
      total: Number(order.total),
      status: order.status,
      items: JSON.stringify(order.items),
      address: order.address,
      owner: order.owner_email,
      vault: order.owner_role === 'admin' ? config.flags.graphqlIdor : null,
    };
  },
  requestOtp: async ({ identifier }) => {
    const key = identifierKey(identifier);
    if (!key) throw new GraphQLError('identifier required');
    const result = await pool.query(
      'SELECT id, email, phone FROM users WHERE email = $1 OR phone = $2 LIMIT 1',
      [key.includes('@') ? key : '__none__', key.includes('@') ? '__none__' : `+${key}`]
    );
    const user = result.rows[0];
    if (user) {
      const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
      otpStore.set(key, { code, userId: user.id, expires: Date.now() + 10 * 60 * 1000 });
    }
    return {
      sent: true,
      identifier: key,
      expiresIn: 600,
      hint: user ? maskEmail(user.email) : null,
    };
  },
  otpVerify: async ({ identifier, code }) => {
    const key = identifierKey(identifier);
    const entry = otpStore.get(key);
    if (!entry || entry.expires < Date.now() || entry.code !== String(code || '')) {
      return null;
    }
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [entry.userId]);
    const user = result.rows[0];
    if (!user) return null;
    otpStore.delete(key);
    return {
      token: signSession(user, { via: 'otp', expiresIn: '1h' }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        wallet: Number(user.wallet),
        vault: user.vault || null,
      },
    };
  },
};

const router = express.Router();

const windows = new Map();
router.use((req, res, next) => {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || 'local')
    .split(',')[0]
    .trim();
  const now = Date.now();
  const entry = windows.get(ip) || { count: 0, reset: now + 60_000 };
  if (entry.reset < now) {
    entry.count = 0;
    entry.reset = now + 60_000;
  }
  entry.count += 1;
  windows.set(ip, entry);
  if (entry.count > 6) return res.status(429).json({ errors: [{ message: 'request budget exceeded' }] });
  next();
});

router.post('/', async (req, res) => {
  try {
    const { query, variables, operationName } = req.body || {};
    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ errors: [{ message: 'query required' }] });
    }
    if (query.length > 4_000_000) {
      return res.status(413).json({ errors: [{ message: 'document too large' }] });
    }
    const document = parse(query);
    const validationErrors = validate(schema, document, [
      ...specifiedRules,
      NoSchemaIntrospectionCustomRule,
    ]);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }
    const result = await execute({
      schema,
      document,
      rootValue,
      variableValues: variables,
      operationName,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

module.exports = router;
