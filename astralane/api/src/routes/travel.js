import express from 'express';
import { pool } from '../db.js';
import { asyncRoute, clamp } from '../util.js';

const router = express.Router();

const airports = [
  ['JFK', 'New York', 'John F. Kennedy International'],
  ['LHR', 'London', 'Heathrow'],
  ['SFO', 'San Francisco', 'San Francisco International'],
  ['NRT', 'Tokyo', 'Narita International'],
  ['HND', 'Tokyo', 'Haneda'],
  ['LAX', 'Los Angeles', 'Los Angeles International'],
  ['BOM', 'Mumbai', 'Chhatrapati Shivaji Maharaj'],
  ['DXB', 'Dubai', 'Dubai International'],
  ['DEL', 'Delhi', 'Indira Gandhi International'],
  ['SIN', 'Singapore', 'Changi'],
  ['CDG', 'Paris', 'Charles de Gaulle'],
  ['SYD', 'Sydney', 'Kingsford Smith'],
  ['AKL', 'Auckland', 'Auckland Airport'],
  ['BLR', 'Bengaluru', 'Kempegowda International'],
  ['HNL', 'Honolulu', 'Daniel K. Inouye'],
  ['MIA', 'Miami', 'Miami International'],
  ['SEA', 'Seattle', 'Seattle-Tacoma'],
  ['YYZ', 'Toronto', 'Pearson International'],
];

const experiences = [
  { id: 'exp-aurora', title: 'Aurora flight over Iceland', city: 'Reykjavik', priceCents: 89000, duration: '6 hours', tag: 'Sky' },
  { id: 'exp-reef', title: 'Coral nursery dive', city: 'Singapore', priceCents: 34000, duration: '4 hours', tag: 'Ocean' },
  { id: 'exp-dune', title: 'Silent dune crossing', city: 'Dubai', priceCents: 42000, duration: '8 hours', tag: 'Desert' },
  { id: 'exp-train', title: 'Midnight express tasting menu', city: 'Tokyo', priceCents: 28000, duration: '3 hours', tag: 'Taste' },
];

const destinationCards = [
  { code: 'LHR', city: 'London', country: 'United Kingdom', priceFrom: 79900, accent: 'violet', note: 'Aurora season' },
  { code: 'NRT', city: 'Tokyo', country: 'Japan', priceFrom: 78900, accent: 'cyan', note: 'Neon nights' },
  { code: 'DXB', city: 'Dubai', country: 'UAE', priceFrom: 24900, accent: 'amber', note: 'Desert meridians' },
  { code: 'SIN', city: 'Singapore', country: 'Singapore', priceFrom: 26900, accent: 'emerald', note: 'Ocean glass' },
  { code: 'CDG', city: 'Paris', country: 'France', priceFrom: 65900, accent: 'rose', note: 'Left bank light' },
  { code: 'SYD', city: 'Sydney', country: 'Australia', priceFrom: 21900, accent: 'blue', note: 'Harbour dawn' },
];

function flightView(row) {
  return {
    id: row.id,
    airline: row.airline,
    flightNo: row.flight_no,
    origin: row.origin,
    destination: row.destination,
    departAt: row.depart_at,
    arriveAt: row.arrive_at,
    priceCents: row.price_cents,
    cabin: row.cabin,
    seats: row.seats,
    internal: row.is_internal,
  };
}

router.get('/airports', (_req, res) => {
  res.json({
    airports: airports.map(([code, city, name]) => ({ code, city, name })),
  });
});

router.get('/destinations', (_req, res) => {
  res.json({ destinations: destinationCards });
});

router.get('/experiences', (_req, res) => {
  res.json({ experiences });
});

router.get('/flights', asyncRoute(async (req, res) => {
  const origin = String(req.query.from || '').toUpperCase().slice(0, 3);
  const destination = String(req.query.to || '').toUpperCase().slice(0, 3);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : null;
  const cabin = req.query.cabin && req.query.cabin !== 'Any' ? String(req.query.cabin).slice(0, 20) : null;
  const limit = clamp(Number(req.query.limit || 40), 1, 100);

  const values = [];
  const where = [];

  if (origin) {
    values.push(origin);
    where.push(`origin = $${values.length}`);
  }
  if (destination) {
    values.push(destination);
    where.push(`destination = $${values.length}`);
  }
  if (date) {
    values.push(date);
    where.push(`depart_at::date = $${values.length}::date`);
  }
  if (cabin) {
    values.push(cabin);
    where.push(`cabin = $${values.length}`);
  }

  values.push(limit);
  const result = await pool.query(
    `SELECT * FROM flights
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY depart_at ASC, price_cents ASC
     LIMIT $${values.length}`,
    values,
  );

  res.json({ flights: result.rows.map(flightView) });
}));

router.get('/hotels', asyncRoute(async (req, res) => {
  const city = String(req.query.city || '').trim().slice(0, 80);
  const result = city
    ? await pool.query('SELECT * FROM hotels WHERE city ILIKE $1 ORDER BY rating DESC', [`%${city}%`])
    : await pool.query('SELECT * FROM hotels ORDER BY rating DESC');

  res.json({
    hotels: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      priceCents: row.price_cents,
      rating: Number(row.rating),
      blurb: row.blurb,
    })),
  });
}));

router.get('/flights/:id', asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT * FROM flights WHERE id = $1', [String(req.params.id).slice(0, 80)]);
  if (!result.rows[0]) {
    res.status(404).json({ error: 'fare not found' });
    return;
  }
  res.json({ flight: flightView(result.rows[0]) });
}));

router.get('/hotels/:id', asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT * FROM hotels WHERE id = $1', [String(req.params.id).slice(0, 80)]);
  if (!result.rows[0]) {
    res.status(404).json({ error: 'stay not found' });
    return;
  }
  const row = result.rows[0];
  res.json({
    hotel: {
      id: row.id,
      name: row.name,
      city: row.city,
      priceCents: row.price_cents,
      rating: Number(row.rating),
      blurb: row.blurb,
    },
  });
}));

export default router;
