import crypto from 'node:crypto';
import { buildSchema, GraphQLError } from 'graphql';
import { createHandler } from 'graphql-http/lib/use/express';
import { config } from './config.js';
import { pool } from './db.js';
import { clamp } from './util.js';

class CursorError extends Error {
  constructor(code) {
    super('cursor rejected');
    this.code = code;
  }
}

function encodeCursor(payload) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', config.cursorKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, encrypted]).toString('base64url');
}

function decodeCursor(cursor) {
  let raw;
  try {
    raw = Buffer.from(String(cursor), 'base64url');
  } catch {
    throw new CursorError('CURSOR_FORMAT');
  }

  if (raw.length < 32 || (raw.length - 16) % 16 !== 0) {
    throw new CursorError('CURSOR_FORMAT');
  }

  const iv = raw.subarray(0, 16);
  const ciphertext = raw.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', config.cursorKey, iv);
  decipher.setAutoPadding(false);

  let padded;
  try {
    padded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new CursorError('CURSOR_PADDING');
  }

  const padding = padded[padded.length - 1];
  if (!padding || padding > 16 || padding > padded.length) {
    throw new CursorError('CURSOR_PADDING');
  }
  for (let index = padded.length - padding; index < padded.length; index += 1) {
    if (padded[index] !== padding) throw new CursorError('CURSOR_PADDING');
  }

  let payload;
  try {
    payload = JSON.parse(padded.subarray(0, padded.length - padding).toString('utf8'));
  } catch {
    throw new CursorError('CURSOR_FORMAT');
  }

  return payload;
}

function flightWhere(args) {
  const clauses = [];
  if (args.origin) clauses.push(`origin = '${String(args.origin).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)}'`);
  if (args.destination) clauses.push(`destination = '${String(args.destination).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)}'`);
  if (args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date)) clauses.push(`depart_at::date = '${args.date}'::date`);
  return clauses.length ? clauses.join(' AND ') : 'true';
}

function mapFlight(row) {
  return {
    id: row.id,
    airline: row.airline,
    flightNo: row.flight_no,
    origin: row.origin,
    destination: row.destination,
    departAt: row.depart_at.toISOString(),
    arriveAt: row.arrive_at.toISOString(),
    priceCents: row.price_cents,
    cabin: row.cabin,
    seats: row.seats,
  };
}

function mapBooking(row) {
  return {
    id: row.id,
    ref: row.ref,
    type: row.type,
    status: row.status,
    amountCents: row.amount_cents,
    passengerName: row.passenger_name,
    passportNo: row.passport_no,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

const schema = buildSchema(`
  type Flight {
    id: ID!
    airline: String!
    flightNo: String!
    origin: String!
    destination: String!
    departAt: String!
    arriveAt: String!
    priceCents: Int!
    cabin: String!
    seats: Int!
  }

  type Hotel {
    id: ID!
    name: String!
    city: String!
    priceCents: Int!
    rating: Float!
    blurb: String!
  }

  type Booking {
    id: ID!
    ref: String!
    type: String!
    status: String!
    amountCents: Int!
    passengerName: String!
    passportNo: String
    notes: String
    createdAt: String!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: String!
    loyaltyTier: String!
  }

  type PageInfo {
    endCursor: String
    hasNextPage: Boolean!
  }

  type FlightEdge {
    node: Flight!
    cursor: String!
  }

  type HotelEdge {
    node: Hotel!
    cursor: String!
  }

  type BookingEdge {
    node: Booking!
    cursor: String!
  }

  type FlightConnection {
    edges: [FlightEdge!]!
    pageInfo: PageInfo!
  }

  type HotelConnection {
    edges: [HotelEdge!]!
    pageInfo: PageInfo!
  }

  type BookingConnection {
    edges: [BookingEdge!]!
    pageInfo: PageInfo!
  }

  type Query {
    flights(origin: String, destination: String, date: String, first: Int = 10, after: String): FlightConnection!
    hotels(city: String, first: Int = 10, after: String): HotelConnection!
    bookings(first: Int = 10, after: String): BookingConnection!
    me: User
  }
`);

function cursorFailure(error) {
  if (error instanceof CursorError) {
    return new GraphQLError('cursor rejected', { extensions: { code: error.code } });
  }
  return error;
}

const rootValue = {
  flights: async (args) => {
    try {
      let filter = flightWhere(args);
      let offset = 0;
      let limit = clamp(args.first || 10, 1, 50);

      if (args.after) {
        const payload = decodeCursor(args.after);
        if (payload.kind !== 'flights') throw new CursorError('CURSOR_STATE');
        filter = typeof payload.filter === 'string' ? payload.filter : filter;
        offset = clamp(Number(payload.offset || 0), 0, 100_000);
        limit = clamp(Number(payload.limit || limit), 1, 100);
      }

      const result = await pool.query(
        `SELECT * FROM flights WHERE ${filter} ORDER BY depart_at ASC, price_cents ASC LIMIT ${limit + 1} OFFSET ${offset}`,
      );
      const rows = result.rows.slice(0, limit);
      const nextOffset = offset + rows.length;
      return {
        edges: rows.map((row) => ({
          node: mapFlight(row),
          cursor: encodeCursor({ kind: 'flights', filter, offset: nextOffset, limit }),
        })),
        pageInfo: {
          endCursor: rows.length ? encodeCursor({ kind: 'flights', filter, offset: nextOffset, limit }) : null,
          hasNextPage: result.rows.length > limit,
        },
      };
    } catch (error) {
      throw cursorFailure(error);
    }
  },

  hotels: async (args) => {
    try {
      let filter = args.city
        ? `city ILIKE '%${String(args.city).replace(/'/g, "''").slice(0, 80)}%'`
        : 'true';
      let offset = 0;
      let limit = clamp(args.first || 10, 1, 50);

      if (args.after) {
        const payload = decodeCursor(args.after);
        if (payload.kind !== 'hotels') throw new CursorError('CURSOR_STATE');
        filter = typeof payload.filter === 'string' ? payload.filter : filter;
        offset = clamp(Number(payload.offset || 0), 0, 100_000);
        limit = clamp(Number(payload.limit || limit), 1, 100);
      }

      const result = await pool.query(
        `SELECT * FROM hotels WHERE ${filter} ORDER BY rating DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      );
      const rows = result.rows.slice(0, limit);
      const nextOffset = offset + rows.length;
      return {
        edges: rows.map((row) => ({
          node: {
            id: row.id,
            name: row.name,
            city: row.city,
            priceCents: row.price_cents,
            rating: Number(row.rating),
            blurb: row.blurb,
          },
          cursor: encodeCursor({ kind: 'hotels', filter, offset: nextOffset, limit }),
        })),
        pageInfo: {
          endCursor: rows.length ? encodeCursor({ kind: 'hotels', filter, offset: nextOffset, limit }) : null,
          hasNextPage: result.rows.length > limit,
        },
      };
    } catch (error) {
      throw cursorFailure(error);
    }
  },

  bookings: async (args, context) => {
    if (!context.auth) {
      throw new GraphQLError('authentication required', { extensions: { code: 'UNAUTHENTICATED' } });
    }

    try {
      let filter = `user_id = '${context.auth.sub}' AND status <> 'archived'`;
      let offset = 0;
      let limit = clamp(args.first || 10, 1, 50);

      if (args.after) {
        const payload = decodeCursor(args.after);
        if (payload.kind !== 'bookings') throw new CursorError('CURSOR_STATE');
        filter = typeof payload.filter === 'string' ? payload.filter : filter;
        offset = clamp(Number(payload.offset || 0), 0, 100_000);
        limit = clamp(Number(payload.limit || limit), 1, 100);
      }

      const result = await pool.query(
        `SELECT * FROM bookings WHERE ${filter} ORDER BY created_at DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      );
      const rows = result.rows.slice(0, limit);
      const nextOffset = offset + rows.length;
      return {
        edges: rows.map((row) => ({
          node: mapBooking(row),
          cursor: encodeCursor({ kind: 'bookings', filter, offset: nextOffset, limit }),
        })),
        pageInfo: {
          endCursor: rows.length ? encodeCursor({ kind: 'bookings', filter, offset: nextOffset, limit }) : null,
          hasNextPage: result.rows.length > limit,
        },
      };
    } catch (error) {
      throw cursorFailure(error);
    }
  },

  me: async (_args, context) => {
    if (!context.auth) return null;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [context.auth.sub]);
    const user = result.rows[0];
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      loyaltyTier: user.loyalty_tier,
    };
  },
};

export const graphqlHandler = createHandler({
  schema,
  rootValue,
  context: (req) => ({ auth: req.raw?.auth || req.auth || null }),
});
