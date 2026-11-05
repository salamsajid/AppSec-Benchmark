import express from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { asyncRoute, randomId, randomRef, safeString } from '../util.js';

const router = express.Router();

const createSchema = z.object({
  type: z.enum(['flight', 'hotel']),
  itemId: z.string().min(1).max(80),
  passengerName: z.string().min(2).max(160),
  passportNo: z.string().min(3).max(40),
  notes: z.string().max(500).optional().default(''),
});

function bookingView(row) {
  return {
    id: row.id,
    ref: row.ref,
    type: row.type,
    itemId: row.item_id,
    status: row.status,
    amountCents: row.amount_cents,
    passengerName: row.passenger_name,
    passportNo: row.passport_no,
    notes: row.notes,
    meta: row.meta,
    createdAt: row.created_at,
  };
}

router.use(requireAuth);

router.get('/', asyncRoute(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM bookings WHERE user_id = $1 AND status <> \'archived\' ORDER BY created_at DESC',
    [req.auth.sub],
  );
  res.json({ bookings: result.rows.map(bookingView) });
}));

router.post('/', asyncRoute(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid booking details' });
    return;
  }

  const { type, itemId, passengerName, passportNo, notes } = parsed.data;
  let amount = 0;

  if (type === 'flight') {
    const flight = await pool.query('SELECT price_cents FROM flights WHERE id = $1', [itemId]);
    if (!flight.rows[0]) {
      res.status(404).json({ error: 'fare no longer available' });
      return;
    }
    amount = flight.rows[0].price_cents;
  } else {
    const hotel = await pool.query('SELECT price_cents FROM hotels WHERE id = $1', [itemId]);
    if (!hotel.rows[0]) {
      res.status(404).json({ error: 'stay no longer available' });
      return;
    }
    amount = hotel.rows[0].price_cents * 2;
  }

  const id = randomId('bkg_');
  let ref = randomRef();
  let inserted = null;
  for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
    try {
      const result = await pool.query(
        `INSERT INTO bookings (id, ref, user_id, type, item_id, status, amount_cents, passenger_name, passport_no, notes, meta)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,'{"channel":"web"}')
         RETURNING *`,
        [id, ref, req.auth.sub, type, itemId, amount, passengerName, passportNo, safeString(notes, 500)],
      );
      inserted = result.rows[0];
    } catch (error) {
      if (error.code !== '23505') throw error;
      ref = randomRef();
    }
  }

  if (!inserted) {
    res.status(503).json({ error: 'could not reserve itinerary' });
    return;
  }

  await pool.query(
    'INSERT INTO audit_logs (actor, action, detail) VALUES ($1,$2,$3)',
    [req.auth.email, 'booking_created', JSON.stringify({ ref: inserted.ref, type, amount })],
  );

  res.status(201).json({ booking: bookingView(inserted) });
}));

router.get('/:ref', asyncRoute(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM bookings WHERE ref = $1 AND user_id = $2 AND status <> \'archived\'',
    [String(req.params.ref).slice(0, 40), req.auth.sub],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'booking not found' });
    return;
  }
  res.json({ booking: bookingView(result.rows[0]) });
}));

router.post('/:ref/pay', asyncRoute(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM bookings WHERE ref = $1 AND user_id = $2 AND status <> \'archived\'',
    [String(req.params.ref).slice(0, 40), req.auth.sub],
  );
  const booking = result.rows[0];
  if (!booking) {
    res.status(404).json({ error: 'booking not found' });
    return;
  }
  if (booking.status === 'paid') {
    res.json({ booking: bookingView(booking), payment: { state: 'settled' } });
    return;
  }

  await pool.query("UPDATE bookings SET status = 'awaiting_partner' WHERE id = $1", [booking.id]);
  res.json({
    booking: bookingView({ ...booking, status: 'awaiting_partner' }),
    payment: {
      state: 'awaiting_partner',
      partner: 'orbit-pay',
      endpoint: '/api/partner/webhook',
      message: 'OrbitPay settles this itinerary through its signed webhook. Keep the booking reference available.',
    },
  });
}));

export default router;
