import crypto from 'node:crypto';
import pg from 'pg';
import { config } from './config.js';
import { hashPassword, sleep } from './util.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export function query(text, params) {
  return pool.query(text, params);
}

function at(daysAhead, hour, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

const routeTemplates = [
  { id: 'AL101', airline: 'Orion Air', flightNo: 'OR 101', origin: 'JFK', destination: 'LHR', hour: 20, minutes: 7 * 60 + 10, price: 84900, cabin: 'Economy', seats: 42 },
  { id: 'AL102', airline: 'NovaJet', flightNo: 'NJ 220', origin: 'JFK', destination: 'LHR', hour: 9, minutes: 7 * 60 + 35, price: 289900, cabin: 'Business', seats: 12 },
  { id: 'AL103', airline: 'Helios', flightNo: 'HE 77', origin: 'JFK', destination: 'LHR', hour: 18, minutes: 6 * 60 + 55, price: 132900, cabin: 'Premium', seats: 24 },
  { id: 'AL201', airline: 'Aurora', flightNo: 'AU 12', origin: 'LHR', destination: 'JFK', hour: 11, minutes: 7 * 60 + 20, price: 79900, cabin: 'Economy', seats: 38 },
  { id: 'AL202', airline: 'Vega', flightNo: 'VG 900', origin: 'LHR', destination: 'JFK', hour: 16, minutes: 7 * 60 + 45, price: 256900, cabin: 'Business', seats: 10 },
  { id: 'AL301', airline: 'Orion Air', flightNo: 'OR 88', origin: 'SFO', destination: 'NRT', hour: 13, minutes: 10 * 60 + 45, price: 78900, cabin: 'Economy', seats: 55 },
  { id: 'AL302', airline: 'NovaJet', flightNo: 'NJ 308', origin: 'SFO', destination: 'NRT', hour: 10, minutes: 10 * 60 + 20, price: 199900, cabin: 'Premium', seats: 18 },
  { id: 'AL303', airline: 'Aurora', flightNo: 'AU 611', origin: 'LAX', destination: 'HND', hour: 15, minutes: 11 * 60 + 30, price: 89900, cabin: 'Economy', seats: 46 },
  { id: 'AL401', airline: 'Helios', flightNo: 'HE 44', origin: 'BOM', destination: 'DXB', hour: 7, minutes: 3 * 60 + 10, price: 24900, cabin: 'Economy', seats: 68 },
  { id: 'AL402', airline: 'Vega', flightNo: 'VG 118', origin: 'BOM', destination: 'DXB', hour: 19, minutes: 3 * 60 + 25, price: 39900, cabin: 'Premium', seats: 22 },
  { id: 'AL403', airline: 'Orion Air', flightNo: 'OR 540', origin: 'DEL', destination: 'SIN', hour: 1, minutes: 5 * 60 + 40, price: 38900, cabin: 'Economy', seats: 50 },
  { id: 'AL404', airline: 'NovaJet', flightNo: 'NJ 777', origin: 'DEL', destination: 'SIN', hour: 23, minutes: 5 * 60 + 55, price: 73900, cabin: 'Business', seats: 14 },
  { id: 'AL405', airline: 'Aurora', flightNo: 'AU 303', origin: 'DXB', destination: 'LHR', hour: 8, minutes: 7 * 60 + 50, price: 59900, cabin: 'Economy', seats: 40 },
  { id: 'AL406', airline: 'Helios', flightNo: 'HE 512', origin: 'CDG', destination: 'JFK', hour: 12, minutes: 8 * 60 + 25, price: 65900, cabin: 'Economy', seats: 44 },
  { id: 'AL407', airline: 'Vega', flightNo: 'VG 88', origin: 'JFK', destination: 'CDG', hour: 21, minutes: 7 * 60 + 30, price: 69900, cabin: 'Economy', seats: 36 },
  { id: 'AL408', airline: 'Orion Air', flightNo: 'OR 220', origin: 'SYD', destination: 'AKL', hour: 10, minutes: 3 * 60 + 5, price: 21900, cabin: 'Economy', seats: 60 },
  { id: 'AL409', airline: 'NovaJet', flightNo: 'NJ 51', origin: 'SIN', destination: 'HND', hour: 6, minutes: 6 * 60 + 45, price: 45900, cabin: 'Economy', seats: 48 },
  { id: 'AL410', airline: 'Aurora', flightNo: 'AU 702', origin: 'BLR', destination: 'SFO', hour: 2, minutes: 17 * 60 + 55, price: 109900, cabin: 'Economy', seats: 32 },
  { id: 'AL411', airline: 'Helios', flightNo: 'HE 903', origin: 'HNL', destination: 'LAX', hour: 14, minutes: 5 * 60 + 20, price: 32900, cabin: 'Economy', seats: 58 },
  { id: 'AL412', airline: 'Vega', flightNo: 'VG 160', origin: 'MIA', destination: 'JFK', hour: 8, minutes: 2 * 60 + 50, price: 19900, cabin: 'Economy', seats: 72 },
  { id: 'AL413', airline: 'Orion Air', flightNo: 'OR 701', origin: 'SEA', destination: 'LHR', hour: 17, minutes: 9 * 60 + 5, price: 87900, cabin: 'Economy', seats: 34 },
  { id: 'AL414', airline: 'NovaJet', flightNo: 'NJ 604', origin: 'YYZ', destination: 'LHR', hour: 20, minutes: 6 * 60 + 50, price: 71900, cabin: 'Economy', seats: 41 },
  { id: 'AL415', airline: 'Aurora', flightNo: 'AU 415', origin: 'JFK', destination: 'NRT', hour: 13, minutes: 13 * 60 + 45, price: 98900, cabin: 'Economy', seats: 44 },
  { id: 'AL416', airline: 'Vega', flightNo: 'VG 416', origin: 'JFK', destination: 'DXB', hour: 2, minutes: 12 * 60 + 40, price: 89900, cabin: 'Economy', seats: 51 },
  { id: 'AL417', airline: 'NovaJet', flightNo: 'NJ 417', origin: 'JFK', destination: 'SIN', hour: 23, minutes: 18 * 60 + 25, price: 104900, cabin: 'Economy', seats: 39 },
  { id: 'AL418', airline: 'Helios', flightNo: 'HE 418', origin: 'JFK', destination: 'SYD', hour: 21, minutes: 21 * 60 + 15, price: 119900, cabin: 'Economy', seats: 33 },
  { id: 'AL900', airline: 'Astra Private', flightNo: 'AP 001', origin: 'JFK', destination: 'LHR', hour: 22, minutes: 3 * 60 + 25, price: 2400000, cabin: 'First', seats: 4, internal: true },
];

const hotelSeed = [
  ['HTL-SKY', 'The Skyline Atrium', 'New York', 42800, 4.8, 'A vertical garden sanctuary above Manhattan with a private observatory.'],
  ['HTL-AUR', 'Aurora House London', 'London', 38900, 4.7, 'A quiet glasshouse hotel in Mayfair with a zero-waste kitchen.'],
  ['HTL-NEO', 'Neo Tokyo Capsule', 'Tokyo', 17900, 4.5, 'Sleep inside a light sculpture in Shibuya, steps from the midnight train.'],
  ['HTL-DUN', 'Dune Meridian', 'Dubai', 31900, 4.6, 'A desert-edge resort with a solar sail roof and a cold plunge spa.'],
  ['HTL-SEA', 'Sea Glass Marina', 'Singapore', 26900, 4.9, 'A floating hotel in Marina Bay with a coral nursery below the lobby.'],
  ['HTL-ALP', 'Alpine Signal', 'Zurich', 35900, 4.4, 'A alpine design hotel with a cable-car arrival and a listening lounge.'],
  ['HTL-SOL', 'Solaris Bay', 'Sydney', 29900, 4.7, 'Harbour-view suites, an ocean pool, and a rooftop observatory.'],
  ['HTL-ORB', 'Orbit Suites', 'Paris', 33900, 4.6, 'A Left Bank townhouse with a private cinema and a courtyard bakery.'],
];

export async function bootstrap() {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      ready = true;
      break;
    } catch {
      await sleep(1000);
    }
  }
  if (!ready) throw new Error('database did not become ready');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      name text NOT NULL,
      role text NOT NULL DEFAULT 'traveler',
      loyalty_tier text NOT NULL DEFAULT 'Silver',
      passport_no text,
      phone text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS flights (
      id text PRIMARY KEY,
      airline text NOT NULL,
      flight_no text NOT NULL,
      origin text NOT NULL,
      destination text NOT NULL,
      depart_at timestamptz NOT NULL,
      arrive_at timestamptz NOT NULL,
      price_cents integer NOT NULL,
      cabin text NOT NULL,
      seats integer NOT NULL,
      is_internal boolean NOT NULL DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS hotels (
      id text PRIMARY KEY,
      name text NOT NULL,
      city text NOT NULL,
      price_cents integer NOT NULL,
      rating numeric(2,1) NOT NULL,
      blurb text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id text PRIMARY KEY,
      ref text UNIQUE NOT NULL,
      user_id text NOT NULL REFERENCES users(id),
      type text NOT NULL,
      item_id text,
      status text NOT NULL DEFAULT 'pending',
      amount_cents integer NOT NULL,
      passenger_name text,
      passport_no text,
      notes text,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS partner_secrets (
      partner text PRIMARY KEY,
      secret text NOT NULL,
      flag text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_keys (
      purpose text PRIMARY KEY,
      private_jwk jsonb NOT NULL,
      public_jwk jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id bigserial PRIMARY KEY,
      actor text,
      action text NOT NULL,
      detail jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const users = [
    ['usr_ops', config.adminEmail, hashPassword(config.adminPassword), 'Ops Control', 'admin', 'Obsidian', 'P-OPS-0001', '+1-555-0100'],
    ['usr_nova', config.demoEmail, hashPassword(config.demoPassword), 'Nova Reyes', 'traveler', 'Gold', 'P-NOVA-8842', '+1-555-0188'],
    ['usr_kai', 'kai@astralane.travel', hashPassword(crypto.randomBytes(24).toString('base64url')), 'Kai Nakamura', 'traveler', 'Silver', 'P-KAI-2210', '+81-555-0133'],
    ['usr_mira', 'mira@astralane.travel', hashPassword(crypto.randomBytes(24).toString('base64url')), 'Mira Sol', 'traveler', 'Platinum', 'P-MIRA-5512', '+34-555-0177'],
  ];

  for (const user of users) {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, role, loyalty_tier, passport_no, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (email) DO NOTHING`,
      user,
    );
  }

  const flightRows = [];
  for (const route of routeTemplates) {
    for (let day = 1; day <= 14; day += 1) {
      const depart = at(day, route.hour, day % 2 === 0 ? 15 : 40);
      const arrive = new Date(depart.getTime() + route.minutes * 60 * 1000);
      const price = route.price + (day % 3) * 1400;
      flightRows.push([
        `${route.id}-${day}`,
        route.airline,
        route.flightNo,
        route.origin,
        route.destination,
        depart.toISOString(),
        arrive.toISOString(),
        price,
        route.cabin,
        route.seats,
        Boolean(route.internal),
      ]);
    }
  }

  for (const flight of flightRows) {
    await pool.query(
      `INSERT INTO flights (id, airline, flight_no, origin, destination, depart_at, arrive_at, price_cents, cabin, seats, is_internal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      flight,
    );
  }

  for (const hotel of hotelSeed) {
    await pool.query(
      `INSERT INTO hotels (id, name, city, price_cents, rating, blurb)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      hotel,
    );
  }

  const bookings = [
    ['bkg_ops_01', 'AL-OPS001', 'usr_ops', 'flight', 'AL101-7', 'confirmed', 84900, 'Ops Control', 'P-OPS-0001', 'VIP settlement reference', '{"channel":"concierge","seat":"1A"}'],
    ['bkg_nova_01', 'AL-NOVA01', 'usr_nova', 'flight', 'AL301-7', 'confirmed', 78900, 'Nova Reyes', 'P-NOVA-8842', 'Window seat, vegetarian meal', '{"channel":"web","seat":"14A"}'],
    ['bkg_kai_01', 'AL-KAI001', 'usr_kai', 'hotel', 'HTL-NEO', 'confirmed', 17900, 'Kai Nakamura', 'P-KAI-2210', 'Late arrival, quiet floor', '{"channel":"web","nights":3}'],
    ['bkg_mira_01', 'AL-MIRA01', 'usr_mira', 'flight', 'AL201-8', 'confirmed', 79900, 'Mira Sol', 'P-MIRA-5512', 'Fragile luggage note', '{"channel":"partner","seat":"3C"}'],
    ['bkg_arch_01', 'AL-ARCH01', 'usr_mira', 'flight', 'AL201-8', 'archived', 63500, 'Mira Sol', 'P-MIRA-5512', `${config.flags.graphql} · archived reconciliation note`, '{"channel":"archive","retention":"cold"}'],
  ];

  for (const booking of bookings) {
    await pool.query(
      `INSERT INTO bookings (id, ref, user_id, type, item_id, status, amount_cents, passenger_name, passport_no, notes, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (ref) DO NOTHING`,
      booking,
    );
  }

  await pool.query(
    `INSERT INTO partner_secrets (partner, secret, flag)
     VALUES ('orbit-pay', $1, $2)
     ON CONFLICT (partner) DO NOTHING`,
    [crypto.randomBytes(16).toString('hex'), config.flags.partner],
  );

  await pool.query(
    `INSERT INTO audit_logs (actor, action, detail) VALUES
      ('system','nightly_reconciliation','{"region":"global"}'),
      ('ops@astralane.travel','vault_access','{"scope":"settlements"}')
     ON CONFLICT DO NOTHING`,
  );
}

export async function partnerSecret(partner) {
  const result = await pool.query('SELECT secret, flag FROM partner_secrets WHERE partner = $1', [partner]);
  return result.rows[0] || null;
}
