'use strict';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/* Real Editorial Product Photography Mapping */
const realProductImages = {
  'nova-x1': '/assets/products/nova-x1.jpg',
  'nova-fold': '/assets/products/nova-fold.jpg',
  'nova-mini': '/assets/products/nova-mini.jpg',
  'helix-book-ultra': '/assets/products/helix-book-ultra.jpg',
  'pulse-buds-pro': '/assets/products/pulse-buds-pro.jpg',
  'orbit-watch-s3': '/assets/products/orbit-watch-s3.jpg',
  'orbit-ring': '/assets/products/orbit-ring.jpg',
  'aether-frame': '/assets/products/aether-frame.jpg',
  'helix-studio': '/assets/products/helix-studio.jpg',
  'helix-dock': '/assets/products/helix-dock.jpg',
  'halo-headphones': '/assets/products/halo-headphones.jpg',
  'flux-speaker': '/assets/products/flux-speaker.jpg',
  'quantum-cam': '/assets/products/quantum-cam.jpg',
  'quantum-lens': '/assets/products/quantum-lens.jpg',
  'aether-air': '/assets/products/aether-air.jpg',
  'aether-beam': '/assets/products/aether-beam.jpg',
  'arc-controller': '/assets/products/arc-controller.jpg',
  'aether-deck': '/assets/products/aether-deck.jpg',
  'lumen-vision-8k': '/assets/products/lumen-vision-8k.jpg',
  'aero-tab-12': '/assets/products/aero-tab-12.jpg',
};

function getProductImage(slug, fallback) {
  return realProductImages[slug] || fallback || '/assets/products/nova-x1.jpg';
}

const categoryMeta = {
  Mobile: { index: '01', label: 'Pocket Tech', icon: '📱', copy: 'Folding glass, seamless titanium, and tactile pocket theatre.' },
  Computing: { index: '02', label: 'Desk Setup', icon: '☕', copy: 'Quiet machines, reference studio displays, and minimal aluminium.' },
  Audio: { index: '03', label: 'Soundscapes', icon: '🎧', copy: 'Beryllium drivers, space acoustics, and sculpted silence.' },
  Wearables: { index: '04', label: 'Body Harmony', icon: '⌚', copy: 'Zirconia ceramic, woven straps, and ambient biometrics.' },
  Vision: { index: '05', label: 'Future Optics', icon: '👓', copy: 'Micro-LED light engines and film-grade amber tints.' },
  Imaging: { index: '06', label: 'Creator Studio', icon: '📷', copy: 'Pocket cinema optics with knurled mechanical dials.' },
  Home: { index: '07', label: 'Living Spaces', icon: '🌿', copy: 'Fluted ceramic air purifiers and pocket laser cinemas.' },
  Play: { index: '08', label: 'Tactile Play', icon: '🎮', copy: 'Chalk white ergonomics, felt textures, and hall-effect triggers.' },
};

const newArrivals = new Set([
  'nova-fold', 'nova-mini', 'helix-studio', 'helix-dock', 'halo-headphones',
  'orbit-ring', 'aether-frame', 'quantum-lens', 'aether-air', 'aether-beam',
  'arc-controller', 'aether-deck',
]);

const state = {
  products: [],
  user: null,
  sessionLoaded: false,
  renderToken: 0,
  activeSaveSlug: null,
};

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function toast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

async function api(path, options = {}) {
  const config = { credentials: 'same-origin', ...options };
  if (config.body && typeof config.body !== 'string') {
    config.headers = { 'content-type': 'application/json', ...(config.headers || {}) };
    config.body = JSON.stringify(config.body);
  }
  const response = await fetch(path, config);
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  if (!response.ok) {
    const error = new Error((data && data.error) || `request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function currentRoute() {
  return location.hash.replace(/^#/, '') || '/';
}

function parseQuery(route) {
  const index = route.indexOf('?');
  return new URLSearchParams(index >= 0 ? route.slice(index + 1) : '');
}

function baseRoute(route) {
  return route.split('?')[0];
}

/* ==========================================================================
   Pinterest Saved Pins & Moodboards State
   ========================================================================== */
function getSavedPins() {
  try {
    return new Set(JSON.parse(localStorage.getItem('aetherion-saved-pins') || '["nova-fold","halo-headphones","helix-book-ultra"]'));
  } catch {
    return new Set(['nova-fold', 'halo-headphones']);
  }
}

function setSavedPins(set) {
  localStorage.setItem('aetherion-saved-pins', JSON.stringify([...set]));
  updateChrome();
}

function getLikedPins() {
  try {
    return new Set(JSON.parse(localStorage.getItem('aetherion-liked-pins') || '["pulse-buds-pro","orbit-watch-s3"]'));
  } catch {
    return new Set(['pulse-buds-pro']);
  }
}

function setLikedPins(set) {
  localStorage.setItem('aetherion-liked-pins', JSON.stringify([...set]));
}

function getBoards() {
  const defaultBoards = [
    {
      id: 'desk',
      name: '☕ Dream Desk Setup',
      description: 'Clean ergonomic minimalism, natural light, and tactile oak desk objects',
      pins: ['helix-studio', 'helix-book-ultra', 'arc-controller', 'helix-dock'],
    },
    {
      id: 'audio',
      name: '🎧 Tactile Audio Haven',
      description: 'Acoustic architecture, space acoustics, and sculpted beryllium drivers',
      pins: ['halo-headphones', 'pulse-buds-pro', 'flux-speaker'],
    },
    {
      id: 'carry',
      name: '📱 Minimalist Daily Carry',
      description: 'Pocketable folding glass, titanium ceramics, and biometric harmony',
      pins: ['nova-fold', 'orbit-ring', 'orbit-watch-s3', 'aether-frame'],
    },
    {
      id: 'living',
      name: '🌿 Japandi Living Space',
      description: 'Quiet room air, fluted ceramic textures, and sculptural ambient light',
      pins: ['aether-air', 'aether-beam', 'lumen-vision-8k'],
    },
    {
      id: 'wishlist',
      name: '✨ Series 04 Wishlist',
      description: 'Curated inspiration for the next studio refresh',
      pins: ['quantum-cam', 'nova-x1', 'aero-tab-12'],
    },
  ];
  try {
    const raw = localStorage.getItem('aetherion-user-boards');
    return raw ? JSON.parse(raw) : defaultBoards;
  } catch {
    return defaultBoards;
  }
}

function setBoards(boards) {
  localStorage.setItem('aetherion-user-boards', JSON.stringify(boards));
  updateChrome();
}

function updateChrome() {
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  const cartEl = document.getElementById('cart-count');
  if (cartEl) cartEl.textContent = String(count);

  const savedCount = getSavedPins().size;
  const savedEl = document.getElementById('saved-count');
  if (savedEl) savedEl.textContent = String(savedCount);

  const pill = document.getElementById('account-pill');
  if (pill) {
    if (state.user) {
      pill.textContent = state.user.name.split(' ')[0];
      pill.href = '#/account';
    } else {
      pill.textContent = 'Sign in';
      pill.href = '#/signin';
    }
  }

  const route = baseRoute(currentRoute());
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const target = link.getAttribute('href').replace(/^#\//, '');
    link.classList.toggle('active', route.startsWith(`/${target}`) || (target === 'shop' && route === '/shop'));
  });
}

async function refreshSession() {
  try {
    const data = await api('/api/auth/session');
    state.user = data.user;
  } catch {
    state.user = null;
  } finally {
    state.sessionLoaded = true;
    updateChrome();
  }
}

async function loadProducts() {
  if (state.products.length) return state.products;
  const data = await api('/api/catalog/products');
  state.products = data.products || [];
  return state.products;
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('aetherion-cart') || '[]');
  } catch {
    return [];
  }
}

function setCart(items) {
  localStorage.setItem('aetherion-cart', JSON.stringify(items));
  updateChrome();
}

function addToCart(slug, qty = 1) {
  const items = getCart();
  const line = items.find((item) => item.slug === slug);
  if (line) line.qty += qty;
  else items.push({ slug, qty });
  setCart(items);
  const product = state.products.find((item) => item.slug === slug);
  toast(`Added ${product ? product.name : 'Device'} to your bag · View Bag ↗`);
}

/* ==========================================================================
   Pinterest Masonry Product Pin Card
   ========================================================================== */
function pinCard(product, index = 0, options = {}) {
  const isNew = newArrivals.has(product.slug);
  const badge = isNew ? '✦ New Arrival' : product.featured ? '★ Editor’s Pick' : 'Series 04';
  const savedPins = getSavedPins();
  const isSaved = savedPins.has(product.slug);
  const likedPins = getLikedPins();
  const isLiked = likedPins.has(product.slug);
  const image = getProductImage(product.slug, product.image);
  const meta = categoryMeta[product.category] || { icon: '✨', label: product.category };

  // Calculate base like count for aesthetic authenticity
  const baseLikes = 280 + (product.id * 37) % 310 + (isLiked ? 1 : 0);

  // Vary card height rhythm
  const aspectClass = index % 5 === 1 ? 'tall' : index % 5 === 3 ? 'tall' : '';

  return `
    <article class="pin-card ${aspectClass}" data-slug="${escapeHtml(product.slug)}" data-category="${escapeHtml(product.category)}">
      <div class="pin-media" data-view="${escapeHtml(product.slug)}">
        <img class="pin-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}">
        <div class="pin-overlay">
          <div class="pin-overlay-top">
            <span class="pin-category-chip">${meta.icon} ${escapeHtml(product.category)}</span>
            <button class="pin-save-btn ${isSaved ? 'is-saved' : ''}" type="button" data-pin-save="${escapeHtml(product.slug)}">
              ${isSaved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
          <div class="pin-overlay-bottom">
            <button class="pin-quick-view-btn" type="button" data-quick-view="${escapeHtml(product.slug)}">
              Inspect Pin ↗
            </button>
            <button class="pin-quick-add-btn" type="button" data-add="${escapeHtml(product.slug)}" aria-label="Add ${escapeHtml(product.name)} to bag">
              + Bag
            </button>
          </div>
        </div>
      </div>
      <div class="pin-meta">
        <h3><a href="#/product/${encodeURIComponent(product.slug)}">${escapeHtml(product.name)}</a></h3>
        <p class="pin-tagline">${escapeHtml(product.tagline)}</p>
        <div class="pin-footer">
          <span class="pin-price">${money.format(Number(product.price))}<small>incl. taxes</small></span>
          <button class="pin-like-btn ${isLiked ? 'liked' : ''}" type="button" data-pin-like="${escapeHtml(product.slug)}" aria-label="Like ${escapeHtml(product.name)}">
            ${isLiked ? '❤️' : '♡'} <span class="like-count">${baseLikes}</span>
          </button>
        </div>
      </div>
    </article>`;
}

function pinMasonryGrid(products, options = {}) {
  return `<div class="pin-masonry-grid">${products.map((product, index) => pinCard(product, index, options)).join('')}</div>`;
}

/* ==========================================================================
   Moodboard Horizontal Tags Strip
   ========================================================================== */
function moodboardStrip(activeCategory = 'All') {
  const chips = [
    { id: 'All', label: '✦ All Inspiration', count: 20 },
    { id: 'Computing', label: '☕ Desk Aesthetics', count: 4 },
    { id: 'Mobile', label: '📱 Pocket Essentials', count: 3 },
    { id: 'Audio', label: '🎧 Sound & Silence', count: 3 },
    { id: 'Wearables', label: '⌚ Wearable Harmony', count: 2 },
    { id: 'Vision', label: '👓 Future Optics', count: 2 },
    { id: 'Imaging', label: '📷 Creator Studio', count: 2 },
    { id: 'Home', label: '🌿 Living Spaces', count: 2 },
    { id: 'Play', label: '🎮 Tactile Play', count: 2 },
  ];

  return `
    <div class="moodboard-strip-wrap">
      <div class="moodboard-strip">
        ${chips.map((chip) => `
          <button class="moodboard-chip ${chip.id === activeCategory ? 'active' : ''}" type="button" data-filter="${escapeHtml(chip.id)}">
            <span>${escapeHtml(chip.label)}</span>
            <span class="chip-count">${chip.count}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
}

/* ==========================================================================
   Home Page View (Pinterest Editorial Inspiration)
   ========================================================================== */
async function renderHome() {
  await loadProducts();
  const featured = state.products.filter((product) => product.featured);
  const arrivals = state.products.filter((product) => newArrivals.has(product.slug)).slice(0, 8);

  app.innerHTML = `
    <!-- Moodboard Tag Strip -->
    ${moodboardStrip('All')}

    <!-- Editorial Light Hero -->
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">Aetherion / Series 04 / Curated Moodboard</span>
        <h1>Objects for a life<br><em>in motion.</em></h1>
        <p class="hero-lede">Discover the aesthetic confluence of quiet intelligence, tactile materials, and organic design. Electronics crafted to disappear into your spaces and anticipate the day.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/shop">Explore Pins Wall <span aria-hidden="true">↗</span></a>
          <a class="btn btn-ghost" href="#/boards">Curated Moodboards 📌</a>
        </div>
        <div class="hero-meta">
          <div><strong>20</strong><span>Objects in Orbit</span></div>
          <div><strong>100<span>%</span></strong><span>Recycled Titanium</span></div>
          <div><strong>0.1<span>ms</span></strong><span>Neural Response</span></div>
        </div>
      </div>

      <!-- Real Product Pinterest Cluster -->
      <div class="hero-pin-cluster">
        <article class="hero-pin-card pin-lead">
          <span class="hero-pin-badge">☕ Travertine & Fold</span>
          <span class="hero-pin-save">Save</span>
          <img src="/assets/products/nova-fold.jpg" alt="Nova Fold on travertine">
          <div class="hero-pin-caption">
            <strong>Nova Fold</strong>
            <span>${money.format(129999)}</span>
          </div>
        </article>
        <article class="hero-pin-card pin-sub">
          <span class="hero-pin-badge">🎧 Sculptural Sound</span>
          <span class="hero-pin-save">Save</span>
          <img src="/assets/products/halo-headphones.jpg" alt="Halo Headphones">
          <div class="hero-pin-caption">
            <strong>Halo Headphones</strong>
            <span>${money.format(54999)}</span>
          </div>
        </article>
      </div>
    </section>

    <!-- Trending Pins Section -->
    <section class="pin-masonry-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Curated Highlights</span>
          <h2>Trending on<br><em>the aesthetic feed.</em></h2>
        </div>
        <p class="section-subtitle">Real materials, natural light, and quiet functionality. Each device is saved across thousands of community moodboards.</p>
        <a class="section-link" href="#/shop">View all 20 pins <span aria-hidden="true">↗</span></a>
      </div>
      ${pinMasonryGrid(featured.slice(0, 8))}
    </section>

    <!-- Curated Moodboard Categories -->
    <section class="pin-masonry-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Visual Collections</span>
          <h2>Inspiration by<br><em>living space.</em></h2>
        </div>
        <a class="section-link" href="#/boards">Explore all boards <span aria-hidden="true">↗</span></a>
      </div>
      <div class="boards-grid">
        <a class="board-card" href="#/shop?category=Computing">
          <div class="board-collage">
            <img class="board-collage-main" src="/assets/products/helix-studio.jpg" alt="">
            <img class="board-collage-sub" src="/assets/products/helix-book-ultra.jpg" alt="">
            <img class="board-collage-sub" src="/assets/products/arc-controller.jpg" alt="">
          </div>
          <div class="board-info">
            <h3>☕ Dream Desk Setup</h3>
            <p>Clean Scandinavian blonde oak, reference displays, and tactile felt mats.</p>
            <div class="board-meta-row">
              <span class="board-pin-count">4 Curated Objects</span>
              <span class="board-open-btn">Open Board ↗</span>
            </div>
          </div>
        </a>

        <a class="board-card" href="#/shop?category=Audio">
          <div class="board-collage">
            <img class="board-collage-main" src="/assets/products/halo-headphones.jpg" alt="">
            <img class="board-collage-sub" src="/assets/products/pulse-buds-pro.jpg" alt="">
            <img class="board-collage-sub" src="/assets/products/flux-speaker.jpg" alt="">
          </div>
          <div class="board-info">
            <h3>🎧 Tactile Audio Haven</h3>
            <p>Beryllium acoustic drivers, boucle textured wool, and sculptured silence.</p>
            <div class="board-meta-row">
              <span class="board-pin-count">3 Curated Objects</span>
              <span class="board-open-btn">Open Board ↗</span>
            </div>
          </div>
        </a>

        <a class="board-card" href="#/shop?category=Mobile">
          <div class="board-collage">
            <img class="board-collage-main" src="/assets/products/nova-fold.jpg" alt="">
            <img class="board-collage-sub" src="/assets/products/orbit-watch-s3.jpg" alt="">
            <img class="board-collage-sub" src="/assets/products/orbit-ring.jpg" alt="">
          </div>
          <div class="board-info">
            <h3>📱 Everyday Minimalist Carry</h3>
            <p>Zirconia ceramic, champagne titanium, and pocketable uninterrupted glass.</p>
            <div class="board-meta-row">
              <span class="board-pin-count">4 Curated Objects</span>
              <span class="board-open-btn">Open Board ↗</span>
            </div>
          </div>
        </a>
      </div>
    </section>

    <!-- New Arrivals Masonry Feed -->
    <section class="pin-masonry-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Just Arrived</span>
          <h2>Fresh additions to<br><em>the Series 04 horizon.</em></h2>
        </div>
        <p class="section-subtitle">Twelve new tactile forms, each crafted in natural earth pigments and satin finishes.</p>
        <a class="section-link" href="#/shop">Browse all objects <span aria-hidden="true">↗</span></a>
      </div>
      ${pinMasonryGrid(arrivals)}
    </section>
  `;
}

/* ==========================================================================
   Explore / Pins Wall View (`#/shop`)
   ========================================================================== */
async function renderShop(route) {
  await loadProducts();
  const query = parseQuery(route);
  const category = query.get('category') || 'All';
  const search = (query.get('q') || '').toLowerCase();
  const sort = query.get('sort') || 'curated';

  let products = state.products;
  if (search) {
    const result = await api(`/api/catalog/search?q=${encodeURIComponent(search)}`);
    products = result.results || [];
  }
  if (category && category !== 'All') {
    products = products.filter((product) => product.category === category);
  }

  if (sort === 'price-low') products = [...products].sort((a, b) => Number(a.price) - Number(b.price));
  else if (sort === 'price-high') products = [...products].sort((a, b) => Number(b.price) - Number(a.price));
  else if (sort === 'newest') products = [...products].sort((a, b) => Number(b.id) - Number(a.id));
  else if (sort === 'name') products = [...products].sort((a, b) => a.name.localeCompare(b.name));

  const heading = search ? `Pins matching “${escapeHtml(search)}”` : category === 'All' ? 'All Aesthetic Pins' : `${escapeHtml(category)} Moodboard`;

  app.innerHTML = `
    <!-- Moodboard Tag Strip -->
    ${moodboardStrip(category)}

    <section class="shop-hero">
      <div>
        <span class="eyebrow">Series 04 / Pin Collection</span>
        <h1>Curated objects for<br><em>living spaces.</em></h1>
        <p>Browse through physical objects, real materials, and ambient intelligence. Save any item directly to your personal moodboards.</p>
      </div>
      <div class="collection-bar">
        <label class="sort-control">Sort pins
          <select id="sort-select">
            <option value="curated" ${sort === 'curated' ? 'selected' : ''}>Curated / Aesthetic</option>
            <option value="newest" ${sort === 'newest' ? 'selected' : ''}>New Arrivals</option>
            <option value="price-low" ${sort === 'price-low' ? 'selected' : ''}>Price · Low to High</option>
            <option value="price-high" ${sort === 'price-high' ? 'selected' : ''}>Price · High to Low</option>
            <option value="name" ${sort === 'name' ? 'selected' : ''}>A–Z</option>
          </select>
        </label>
      </div>
    </section>

    <div class="shop-results-head">
      <span><strong>${heading}</strong></span>
      <span>Displaying <strong>${products.length}</strong> of ${state.products.length} objects</span>
    </div>

    ${products.length ? pinMasonryGrid(products) : `
      <div class="empty-state" style="background:#fff;border-radius:24px;box-shadow:var(--shadow-pin);padding:60px 20px;">
        <strong>Nothing drifted into this board yet.</strong>
        <p>Try searching for titanium, desk setup, sound, or explore another category.</p>
        <div style="margin-top:20px"><a class="btn btn-primary" href="#/shop">View All Pins</a></div>
      </div>
    `}
  `;
}

/* ==========================================================================
   Pinterest Moodboards Page (`#/boards`)
   ========================================================================== */
async function renderBoards() {
  await loadProducts();
  const boards = getBoards();
  const savedPins = getSavedPins();
  const savedProducts = state.products.filter((p) => savedPins.has(p.slug));

  app.innerHTML = `
    <section class="boards-page-header">
      <div>
        <span class="eyebrow">Personal Curation</span>
        <h1>Your aesthetic<br><em>moodboards.</em></h1>
        <p class="section-subtitle">Collections of objects, materials, and living space setups saved for inspiration.</p>
      </div>
      <button class="btn btn-primary" type="button" id="btn-open-create-board">+ Create New Board</button>
    </section>

    <!-- Boards Collage Grid -->
    <div class="boards-grid">
      <!-- Default All Saved Board -->
      <a class="board-card" href="#/shop">
        <div class="board-collage">
          <img class="board-collage-main" src="${getProductImage('nova-fold')}" alt="">
          <img class="board-collage-sub" src="${getProductImage('halo-headphones')}" alt="">
          <img class="board-collage-sub" src="${getProductImage('orbit-watch-s3')}" alt="">
        </div>
        <div class="board-info">
          <h3>📌 Quick Saved Pins</h3>
          <p>Every object you pinned while browsing the collection.</p>
          <div class="board-meta-row">
            <span class="board-pin-count">${savedPins.size} Saved Pins</span>
            <span class="board-open-btn">View Pins ↗</span>
          </div>
        </div>
      </a>

      <!-- Curated User Boards -->
      ${boards.map((board) => {
        const p1 = board.pins[0] ? getProductImage(board.pins[0]) : getProductImage('nova-x1');
        const p2 = board.pins[1] ? getProductImage(board.pins[1]) : getProductImage('helix-book-ultra');
        const p3 = board.pins[2] ? getProductImage(board.pins[2]) : getProductImage('pulse-buds-pro');
        return `
          <div class="board-card">
            <div class="board-collage">
              <img class="board-collage-main" src="${p1}" alt="">
              <img class="board-collage-sub" src="${p2}" alt="">
              <img class="board-collage-sub" src="${p3}" alt="">
            </div>
            <div class="board-info">
              <h3>${escapeHtml(board.name)}</h3>
              <p>${escapeHtml(board.description || 'Curated board of aesthetic objects.')}</p>
              <div class="board-meta-row">
                <span class="board-pin-count">${board.pins.length} Objects</span>
                <a class="board-open-btn" href="#/shop">Explore Board ↗</a>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Saved Pins Masonry Wall -->
    <section class="pin-masonry-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Saved Objects</span>
          <h2>Pins in your<br><em>personal orbit.</em></h2>
        </div>
      </div>
      ${savedProducts.length ? pinMasonryGrid(savedProducts) : `
        <div class="empty-state" style="background:#fff;border-radius:24px;padding:50px;text-align:center;">
          <strong>No saved pins yet.</strong>
          <p>Hover on any product pin and click "Save" to build your aesthetic board.</p>
          <a class="btn btn-primary" href="#/shop" style="margin-top:18px">Explore Pins Wall</a>
        </div>
      `}
    </section>
  `;
}

/* ==========================================================================
   Pinterest Pin Detail View (`#/product/:slug`)
   ========================================================================== */
async function renderProduct(route) {
  const raw = route.slice('/product/'.length);
  let slug = raw;
  try {
    slug = decodeURIComponent(raw);
  } catch {}

  app.innerHTML = '<div class="loading"><div class="spinner"></div><span>Locating aesthetic pin…</span></div>';
  try {
    const data = await api(`/api/catalog/items/${slug}`);
    if (!data.product) throw new Error('not found');
    const product = data.product;
    await loadProducts();

    const image = getProductImage(product.slug, product.image);
    const meta = categoryMeta[product.category] || { icon: '✨', label: product.category, index: '04' };
    const stock = Number(product.stock);
    const savedPins = getSavedPins();
    const isSaved = savedPins.has(product.slug);

    const specs = Object.entries(product.specs || {})
      .map(([key, value]) => `
        <div class="pd-spec-pill">
          <span>${escapeHtml(key)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `).join('');

    // Companion items for "More Pins Like This"
    const related = state.products.filter((item) => item.slug !== product.slug).slice(0, 4);

    app.innerHTML = `
      <div class="product-detail-wrap">
        <div class="breadcrumb">
          <a href="#/">Home</a>
          <span>/</span>
          <a href="#/shop?category=${encodeURIComponent(product.category)}">${escapeHtml(product.category)}</a>
          <span>/</span>
          <span>${escapeHtml(product.name)}</span>
        </div>

        <div class="pin-detail-card">
          <!-- Real Product Visual Column -->
          <div class="pd-visual-col">
            <span class="pd-image-badge">${meta.icon} ${escapeHtml(meta.label)} · Series 04</span>
            <img class="pd-main-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}">
          </div>

          <!-- Product Story & Actions Column -->
          <div class="pd-info-col">
            <div class="pd-top-bar">
              <div class="pd-curator">
                <span class="pd-curator-avatar">A</span>
                <span>Curated by Aether Design Studio</span>
              </div>
              <div class="pd-actions-top">
                <button class="pin-save-btn ${isSaved ? 'is-saved' : ''}" type="button" data-pin-save="${escapeHtml(product.slug)}">
                  ${isSaved ? 'Saved ✓' : 'Save'}
                </button>
              </div>
            </div>

            <span class="eyebrow">${escapeHtml(product.category)} / Tactile Series 04</span>
            <h1>${escapeHtml(product.name)}</h1>
            <div class="pd-tagline">${escapeHtml(product.tagline)}</div>

            <div class="pd-price-row">
              <span class="pd-price">${money.format(Number(product.price))}</span>
              <span class="pd-stock-pill ${stock <= 2 ? 'low' : ''}">
                ${stock <= 2 ? '● Only two pieces left' : '● In Stock for Express Dispatch'}
              </span>
            </div>

            <p class="pd-desc">${escapeHtml(product.description)}</p>

            <!-- Aesthetic Material Swatches -->
            <div class="pd-swatches">
              <span class="pd-swatch-label">Finish:</span>
              <button class="pd-swatch-btn swatch-travertine active" title="Travertine Sand" type="button"></button>
              <button class="pd-swatch-btn swatch-zirconia" title="Zirconia Chalk" type="button"></button>
              <button class="pd-swatch-btn swatch-graphite" title="Space Graphite" type="button"></button>
              <button class="pd-swatch-btn swatch-amber" title="Amber Tint" type="button"></button>
            </div>

            <!-- Specs Grid -->
            <div class="pd-specs-grid">
              ${specs}
            </div>

            <!-- Primary CTAs -->
            <div class="pd-action-btns">
              <button class="btn btn-primary" type="button" data-add="${escapeHtml(product.slug)}">
                Add to Bag · ${money.format(Number(product.price))}
              </button>
              <button class="btn btn-secondary" type="button" data-buy="${escapeHtml(product.slug)}">
                Buy Now ↗
              </button>
            </div>

            <!-- Assurance Perks -->
            <div class="pd-perks">
              <div class="pd-perk-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
                <span>Complimentary express courier delivery included</span>
              </div>
              <div class="pd-perk-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
                <span>Two-year comprehensive Aether Care protection</span>
              </div>
              <div class="pd-perk-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
                <span>30-day aesthetic trial with seamless returns</span>
              </div>
            </div>
          </div>
        </div>

        <!-- "More Pins Like This" Section -->
        <section class="pin-masonry-section">
          <div class="section-header">
            <div>
              <span class="eyebrow">Visual Affinity</span>
              <h2>More pins like<br><em>this composition.</em></h2>
            </div>
            <a class="section-link" href="#/shop">View All Pins <span aria-hidden="true">↗</span></a>
          </div>
          ${pinMasonryGrid(related)}
        </section>
      </div>
    `;
  } catch (error) {
    app.innerHTML = `
      <div class="empty-state" style="background:#fff;border-radius:24px;padding:60px 20px;text-align:center;">
        <strong>This pin drifted out of orbit.</strong>
        <p>${escapeHtml(error.message)}</p>
        <div style="margin-top:20px"><a class="btn btn-primary" href="#/shop">Return to Collection</a></div>
      </div>
    `;
  }
}

/* ==========================================================================
   Cart View (`#/cart`)
   ========================================================================== */
async function renderCart() {
  await loadProducts();
  const items = getCart();
  const lines = items
    .map((item) => {
      const product = state.products.find((entry) => entry.slug === item.slug);
      if (!product) return '';
      const image = getProductImage(product.slug, product.image);
      return `
        <div class="cart-line">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" style="border-radius:18px;object-fit:cover;width:100px;height:100px;background:#f5efe4;">
          <div style="flex:1">
            <span class="eyebrow" style="font-size:10px;margin-bottom:2px">${escapeHtml(product.category)}</span>
            <h3 style="margin:2px 0 4px;font-size:17px"><a href="#/product/${encodeURIComponent(product.slug)}" style="color:var(--text)">${escapeHtml(product.name)}</a></h3>
            <p style="margin:0 0 10px;color:var(--text-secondary);font-size:13px">${money.format(Number(product.price))} each</p>
            <div class="qty">
              <button type="button" data-dec="${escapeHtml(product.slug)}" aria-label="Decrease quantity">−</button>
              <span style="font-weight:700;min-width:24px;text-align:center">${item.qty}</span>
              <button type="button" data-inc="${escapeHtml(product.slug)}" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <div style="text-align:right">
            <div class="line-total" style="font-size:17px;font-weight:800">${money.format(Number(product.price) * item.qty)}</div>
            <button class="btn btn-ghost btn-small" type="button" data-remove="${escapeHtml(product.slug)}" style="margin-top:12px;color:var(--text-muted)">Remove</button>
          </div>
        </div>`;
    })
    .join('');

  const subtotal = items.reduce((sum, item) => {
    const product = state.products.find((entry) => entry.slug === item.slug);
    return sum + (product ? Number(product.price) * item.qty : 0);
  }, 0);

  const totalCount = items.reduce((sum, item) => sum + item.qty, 0);

  // Recommendations for empty cart or companion items
  const recommended = state.products.slice(0, 4);

  app.innerHTML = `
    <section class="boards-page-header">
      <div>
        <span class="eyebrow">Your Bag</span>
        <h1>Bag / <em>${totalCount} object${totalCount === 1 ? '' : 's'}</em></h1>
        <p class="section-subtitle">Every piece is prepared by hand in our studio and dispatched in biodegradable protective pulp.</p>
      </div>
    </section>

    ${items.length ? `
      <div class="cart-layout">
        <div class="cart-lines">${lines}</div>
        <aside class="cart-summary">
          <h3>Order summary</h3>
          <div class="summary-row"><span>Subtotal</span><span>${money.format(subtotal)}</span></div>
          <div class="summary-row"><span>Insured Express Courier</span><span style="color:var(--success);font-weight:700">Complimentary</span></div>
          <div class="summary-row"><span>Aether Care (24 Months)</span><span style="color:var(--success);font-weight:700">Included</span></div>
          <div class="summary-row total"><span>Total</span><strong>${money.format(subtotal)}</strong></div>
          <a class="btn btn-primary" href="#/checkout" style="width:100%;text-align:center;margin-top:20px;display:block">Proceed to Checkout ↗</a>
          
          <div class="pd-perks" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">
            <div class="pd-perk-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
              <span>30-Day aesthetic trial with free returns</span>
            </div>
            <div class="pd-perk-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
              <span>Direct doorstep exchange via Aether Care</span>
            </div>
          </div>
        </aside>
      </div>` : `
      <div class="empty-state" style="background:#ffffff;border:1px solid var(--line);border-radius:28px;padding:56px 24px;text-align:center;box-shadow:var(--shadow-pin)">
        <div style="width:64px;height:64px;border-radius:50%;background:#f7f3ec;display:grid;place-items:center;margin:0 auto 16px;font-size:24px">🛍️</div>
        <strong style="font-size:20px;letter-spacing:-0.02em">Your bag is waiting for its first object.</strong>
        <p style="max-width:440px;margin:8px auto 20px;color:var(--text-secondary);font-size:13.5px">Explore the Series 04 pins wall, save ideas to your moodboards, or add pieces directly to your collection.</p>
        <a class="btn btn-primary" href="#/shop">Explore Pins Wall ↗</a>
      </div>

      <section class="pin-masonry-section" style="margin-top:60px">
        <div class="section-header">
          <div>
            <span class="eyebrow">Studio Recommendations</span>
            <h2>Pieces from<br><em>Series 04.</em></h2>
          </div>
          <a class="section-link" href="#/shop">View Collection <span aria-hidden="true">↗</span></a>
        </div>
        ${pinMasonryGrid(recommended)}
      </section>
    `}`;
}

/* ==========================================================================
   Checkout View (`#/checkout`)
   ========================================================================== */
function renderCheckout() {
  if (!state.user) {
    app.innerHTML = `
      <div class="empty-state" style="background:#fff;border-radius:24px;padding:60px 20px;text-align:center;">
        <strong>Sign in to continue.</strong>
        <p>Aether ID securely retains your delivery coordinates and order records.</p>
        <div style="margin-top:20px"><a class="btn btn-primary" href="#/signin">Sign in with Aether ID</a></div>
      </div>`;
    return;
  }
  const items = getCart();
  const subtotal = items.reduce((sum, item) => {
    const product = state.products.find((entry) => entry.slug === item.slug);
    return sum + (product ? Number(product.price) * item.qty : 0);
  }, 0);

  app.innerHTML = `
    <section><span class="eyebrow">Order Dispatch</span><h1 class="page-title">Confirm your<br><em>coordinates.</em></h1></section>
    <div class="cart-layout">
      <div class="panel">
        <h2>Delivery Address</h2>
        <form data-form="checkout">
          <div class="form-field"><label>Full name</label><input name="name" value="${escapeHtml(state.user.name)}" required></div>
          <div class="form-field"><label>Address</label><textarea name="address" placeholder="Residence, street, area, Bengaluru, PIN" required></textarea></div>
          <div class="form-field"><label>Delivery note</label><input name="note" placeholder="Gate code, floor, preferred courier time"></div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Place Order · ${money.format(subtotal)}</button><a class="btn btn-ghost" href="#/cart">Back to Bag</a></div>
        </form>
      </div>
      <aside class="cart-summary">
        <h3>${items.length} Object${items.length === 1 ? '' : 's'}</h3>
        ${items.map((item) => {
          const product = state.products.find((entry) => entry.slug === item.slug);
          return product ? `<div class="summary-row"><span>${escapeHtml(product.name)} × ${item.qty}</span><span>${money.format(Number(product.price) * item.qty)}</span></div>` : '';
        }).join('')}
        <div class="summary-row total"><span>Total</span><strong>${money.format(subtotal)}</strong></div>
        <p style="font-size:12px;color:var(--text-muted);margin-top:14px">By confirming this order you accept complimentary insured courier delivery and the 30-day aesthetic trial.</p>
      </aside>
    </div>`;
}

/* ==========================================================================
   Auth Views (Signin, Register, Reset)
   ========================================================================== */
function signinView() {
  return `
    <div class="auth-split-wrapper">
      <section class="auth-card">
        <span class="eyebrow">Aether ID Portal</span>
        <h1>Welcome back.</h1>
        <p>Access your saved moodboards, orders, and wallet balance.</p>
        <form data-form="signin" class="auth-form">
          <div class="form-field"><label for="signin-email">Email Address</label><input id="signin-email" name="email" type="email" autocomplete="username" placeholder="name@aetherion.space" required></div>
          <div class="form-field"><label for="signin-password">Password</label><input id="signin-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required></div>
          <div class="auth-error" id="signin-error"></div>
          <div class="form-actions"><button class="btn btn-primary" type="submit" style="width:100%">Sign in to Aether ID</button></div>
        </form>
        <div style="margin:20px 0;text-align:center;font-size:11px;color:var(--text-muted);letter-spacing:0.06em;text-transform:uppercase">or continue with</div>
        <a class="btn btn-ghost" id="oauth-start" href="#/signin" style="width:100%;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3"/></svg>
          Continue with Aether SSO
        </a>
        <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--line);display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:12.5px">
          <button class="btn btn-ghost btn-small" type="button" id="show-otp">Use one-time code</button>
          <div style="display:flex;gap:14px;align-self:center">
            <a href="#/reset" style="color:var(--text-secondary)">Forgot password?</a>
            <a href="#/register" style="color:var(--pin-red);font-weight:700">Create ID ↗</a>
          </div>
        </div>
        <div class="otp-box" id="otp-box" style="margin-top:18px;padding:20px;background:#f5efe4;border-radius:20px;border:1px solid var(--line);">
          <form data-form="otp-request">
            <div class="form-field"><label>Email address</label><input name="identifier" type="email" placeholder="you@example.com" required></div>
            <button class="btn btn-ghost btn-small" type="submit">Send OTP code</button>
            <div id="otp-hint" style="font-size:11px;color:var(--text-muted);margin-top:6px"></div>
          </form>
          <form data-form="otp-verify" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--line);">
            <div class="form-field"><label>One-time 4-digit code</label><input name="code" inputmode="numeric" maxlength="4" placeholder="4 digits" required></div>
            <input type="hidden" name="identifier" id="otp-identifier">
            <button class="btn btn-primary btn-small" type="submit">Verify & Sign in</button>
            <div class="auth-error" id="otp-error"></div>
          </form>
        </div>
      </section>
      <aside class="auth-showcase-visual">
        <img src="/assets/products/nova-fold.jpg" alt="Aetherion titanium instrument" loading="eager">
        <div class="auth-showcase-overlay">
          <div class="auth-quote-card">
            <blockquote>"One identity. Infinite horizon. Your saved moodboards, orders, and telemetry remain synchronized across all your devices."</blockquote>
            <cite>Aetherion Design Studio · Series 04</cite>
          </div>
        </div>
      </aside>
    </div>`;
}

function registerView() {
  return `
    <div class="auth-split-wrapper">
      <section class="auth-card">
        <span class="eyebrow">Membership</span>
        <h1>Create your ID.</h1>
        <p>One unified account for moodboards, orders, and the Aether Care plan.</p>
        <form data-form="register" class="auth-form">
          <div class="form-field"><label>Full Name</label><input name="name" placeholder="Eleni Vane" required autocomplete="name"></div>
          <div class="form-field"><label>Email Address</label><input name="email" type="email" placeholder="eleni@domain.com" required autocomplete="email"></div>
          <div class="form-field"><label>Create Password</label><input name="password" type="password" minlength="8" placeholder="Minimum 8 characters" required autocomplete="new-password"></div>
          <div class="auth-error" id="register-error"></div>
          <div class="form-actions"><button class="btn btn-primary" type="submit" style="width:100%">Create Aether ID ↗</button></div>
        </form>
        <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--line);text-align:center">
          <a href="#/signin" style="font-size:13px;color:var(--text-secondary)">Already have an ID? <strong style="color:var(--text)">Return to sign in</strong></a>
        </div>
      </section>
      <aside class="auth-showcase-visual">
        <img src="/assets/products/halo-headphones.jpg" alt="Halo studio acoustics" loading="eager">
        <div class="auth-showcase-overlay">
          <div class="auth-quote-card">
            <blockquote>"A quieter relationship with technology. Hardware and telemetry crafted to live harmoniously in architectural living spaces."</blockquote>
            <cite>Aetherion House · Bengaluru & Milan</cite>
          </div>
        </div>
      </aside>
    </div>`;
}

function resetView(route) {
  const token = parseQuery(route).get('token') || '';
  return `
    <div class="auth-split-wrapper">
      <section class="auth-card">
        <span class="eyebrow">Recovery</span>
        <h1>Reset password.</h1>
        <p>Enter the security token sent to your email to configure a new password.</p>
        <form data-form="reset" class="auth-form">
          <div class="form-field"><label>Email Address</label><input name="email" type="email" placeholder="you@example.com" required></div>
          <div class="form-field"><label>Reset Token</label><input name="token" value="${escapeHtml(token)}" placeholder="Paste the token from your email" required></div>
          <div class="form-field"><label>New Password</label><input name="password" type="password" minlength="8" placeholder="Minimum 8 characters" required autocomplete="new-password"></div>
          <div class="auth-error" id="reset-error"></div>
          <div class="form-actions"><button class="btn btn-primary" type="submit" style="width:100%">Update Password</button></div>
        </form>
        <div style="margin-top:24px;border-top:1px solid var(--line);padding-top:20px;">
          <form data-form="forgot">
            <div class="form-field"><label>Need a token? Send recovery link</label><input name="email" type="email" placeholder="you@example.com" required></div>
            <div id="forgot-hint" style="font-size:11px;color:var(--text-muted);margin-bottom:8px"></div>
            <button class="btn btn-ghost btn-small" type="submit">Dispatch Recovery Email</button>
          </form>
        </div>
      </section>
      <aside class="auth-showcase-visual">
        <img src="/assets/products/orbit-ring.jpg" alt="Aetherion security orbit" loading="eager">
        <div class="auth-showcase-overlay">
          <div class="auth-quote-card">
            <blockquote>"Protected at every orbit. Cryptographic security keys and private telemetry safeguard your personal aesthetic archive."</blockquote>
            <cite>Aetherion Governance & Trust</cite>
          </div>
        </div>
      </aside>
    </div>`;
}

/* ==========================================================================
   Account Overview View (`#/account`)
   ========================================================================== */
async function renderAccount() {
  if (!state.sessionLoaded) await refreshSession();
  if (!state.user) {
    app.innerHTML = `
      <section class="boards-page-header" style="max-width:1040px;margin:20px auto 0">
        <div>
          <span class="eyebrow">Aether ID Sanctuary</span>
          <h1>Member archive<br><em>& telemetry.</em></h1>
          <p class="section-subtitle">Your private sanctuary for saved boards, order dispatch coordinates, and wallet credit.</p>
        </div>
      </section>
      <div class="member-sanctuary-preview">
        <div class="sanctuary-info">
          <span class="eyebrow">Tactile Membership</span>
          <h2 style="font-size:26px;letter-spacing:-0.03em;margin:8px 0 12px">Privileges of an Aether Collector</h2>
          <p style="font-size:13px;line-height:1.6;color:var(--text-secondary)">
            An Aether ID synchronizes your aesthetic pin boards, wallet credits, and hardware care coverage across all your devices.
          </p>
          <div class="sanctuary-privileges">
            <div class="privilege-item">
              <span class="privilege-icon">📌</span>
              <div>
                <strong>Personal Moodboards</strong>
                <p>Pin objects, organize room setups, and share aesthetic palettes.</p>
              </div>
            </div>
            <div class="privilege-item">
              <span class="privilege-icon">🪙</span>
              <div>
                <strong>Aether Wallet & Rewards</strong>
                <p>Deposit voucher credits and receive 5% tactile cashback on hardware.</p>
              </div>
            </div>
            <div class="privilege-item">
              <span class="privilege-icon">🛡️</span>
              <div>
                <strong>Concierge Care Protection</strong>
                <p>24-month doorstep exchange and guaranteed 10-year repair parts.</p>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap">
            <a class="btn btn-primary" href="#/signin">Sign in to Aether ID</a>
            <a class="btn btn-ghost" href="#/register">Create Account ↗</a>
          </div>
        </div>
        <div class="sanctuary-card-art">
          <div class="card-art-chip"></div>
          <div class="card-art-title">Aetherion Member Pass</div>
          <div class="card-art-holder">AESTHETIC COLLECTOR</div>
          <div class="card-art-footer">
            <span>SERIES 04 / TITANIUM</span>
            <span>VALID AT ALL ORBITS</span>
          </div>
        </div>
      </div>`;
    return;
  }
  app.innerHTML = '<div class="loading"><div class="spinner"></div><span>Opening member record…</span></div>';
  try {
    const data = await api('/api/account/overview');
    const profile = data.profile;
    const vault = profile.vault || profile.perkVault;

    app.innerHTML = `
      <div class="account-grid">
        <section class="profile-pass-card">
          <div class="profile-meta-block">
            <div class="profile-avatar-initial">${escapeHtml(profile.name.charAt(0).toUpperCase())}</div>
            <div>
              <span class="eyebrow" style="color:var(--terracotta)">Aether ID · ${escapeHtml(profile.role.toUpperCase())}</span>
              <h1 style="margin:4px 0 6px;font-size:32px;letter-spacing:-0.03em">${escapeHtml(profile.name)}</h1>
              <p style="margin:0;font-size:13px;color:var(--text-secondary)">${escapeHtml(profile.email)} · Member since ${new Date(profile.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
            </div>
          </div>
          <div class="profile-wallet-card">
            <span>Aether Wallet</span>
            <strong>${money.format(profile.wallet)}</strong>
          </div>
        </section>

        ${vault ? `
          <div class="panel" style="grid-column:1/-1">
            <span class="eyebrow">Governance Vault Note</span>
            <div class="vault-note" style="margin-top:12px;padding:16px;background:#f3ece0;border-radius:16px;font-family:var(--mono);word-break:break-all">
              ${escapeHtml(vault)}
            </div>
          </div>` : ''}

        <section class="panel">
          <span class="eyebrow">Orders</span>
          <h2>Recent Orders</h2>
          ${data.recentOrders.length ? data.recentOrders.map((order) => `
            <a class="order-row" href="#/order/${order.id}" style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)">
              <span>#${order.id} · ${new Date(order.created_at).toLocaleDateString('en-IN')}</span>
              <strong>${money.format(Number(order.total))}</strong>
              <span>${escapeHtml(order.status)}</span>
            </a>
          `).join('') : '<p>No orders yet. Your first device is waiting in the collection.</p>'}
          <div style="margin-top:18px"><a class="btn btn-ghost btn-small" href="#/shop">Explore Pins</a></div>
        </section>

        <section class="panel">
          <span class="eyebrow">Wallet</span>
          <h2>Redeem Credit</h2>
          <p>Deposit reward credit directly into your Aether wallet.</p>
          <form data-form="redeem" style="display:flex;gap:8px;margin-top:12px">
            <input name="code" placeholder="Reward voucher" style="flex:1" required>
            <button class="btn btn-primary btn-small" type="submit">Redeem</button>
          </form>
          <div id="redeem-hint" style="font-size:11px;color:var(--text-muted);margin-top:6px"></div>
        </section>

        <section class="panel">
          <span class="eyebrow">Promotions</span>
          <h2>Stack Vouchers</h2>
          <form data-form="stack" style="display:flex;gap:8px;margin-top:12px">
            <input name="codes" placeholder="NEON-ARC, WELCOME-500" style="flex:1" required>
            <button class="btn btn-ghost btn-small" type="submit">Apply</button>
          </form>
          <div id="stack-hint" style="font-size:11px;color:var(--text-muted);margin-top:6px"></div>
        </section>

        <section class="panel">
          <span class="eyebrow">Archive</span>
          <h2>Export Account Record</h2>
          <p>Download a copy of your member data.</p>
          <div style="margin-top:12px"><a class="btn btn-ghost btn-small" href="/api/account/export?scope=self" target="_blank" rel="noreferrer">Download Archive</a></div>
        </section>

        <section class="panel">
          <span class="eyebrow">Documents</span>
          <h2>Invoice Vault</h2>
          <form data-form="invoice" style="display:flex;gap:8px;margin-top:12px">
            <input name="file" value="current.txt" style="flex:1">
            <button class="btn btn-ghost btn-small" type="submit">Open Document</button>
          </form>
          <div id="invoice-hint" style="font-size:11px;color:var(--text-muted);margin-top:6px"></div>
        </section>

        <section class="panel">
          <span class="eyebrow">Session Management</span>
          <h2>Identity Details</h2>
          <p>Role: <strong>${escapeHtml(profile.role)}</strong> · Email ${profile.emailVerified ? 'verified ✓' : 'pending'}</p>
          <div style="margin-top:18px;display:flex;gap:12px">
            <button class="btn btn-ghost btn-small" type="button" data-logout>Sign out</button>
            ${profile.role === 'admin' ? '<a class="btn btn-secondary btn-small" href="#/admin">Operations Console ↗</a>' : ''}
          </div>
        </section>
      </div>`;
  } catch (error) {
    if (error.status === 401) {
      state.user = null;
      updateChrome();
      app.innerHTML = `<div class="empty-state"><strong>Session expired.</strong><p>Please sign in again.</p><a class="btn btn-primary" href="#/signin">Sign in</a></div>`;
    } else {
      app.innerHTML = `<div class="empty-state"><strong>Account unavailable.</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  }
}

/* ==========================================================================
   Order Details View (`#/order/:id`)
   ========================================================================== */
async function renderOrder(route) {
  if (!state.sessionLoaded) await refreshSession();
  if (!state.user) {
    app.innerHTML = `<div class="empty-state"><strong>Sign in to view orders.</strong><a class="btn btn-primary" href="#/signin">Sign in</a></div>`;
    return;
  }
  const id = baseRoute(route).slice('/order/'.length);
  app.innerHTML = '<div class="loading"><div class="spinner"></div><span>Retrieving settlement record…</span></div>';
  try {
    const data = await api(`/api/account/orders/${encodeURIComponent(id)}`);
    const order = data.order;
    const items = Array.isArray(order.items) ? order.items : [];
    app.innerHTML = `
      <section><span class="eyebrow">Order Dispatch</span><h1 class="page-title">Order #${escapeHtml(String(order.id))}</h1></section>
      <div class="cart-layout">
        <section class="panel">
          <h2>${items.length} Object${items.length === 1 ? '' : 's'}</h2>
          ${items.map((item) => `
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)">
              <span>${escapeHtml(item.name || item.slug)} × ${escapeHtml(String(item.qty || 1))}</span>
              <strong>${money.format(Number(item.price) * Number(item.qty || 1))}</strong>
            </div>
          `).join('')}
          <div class="summary-row total" style="margin-top:18px"><span>Total</span><strong>${money.format(Number(order.total))}</strong></div>
          <p style="margin-top:14px;color:var(--text-secondary);font-size:12.5px">Status: <strong>${escapeHtml(order.status)}</strong> · Address: ${escapeHtml(order.address || '')}</p>
        </section>
        <aside class="cart-summary">
          <h3>Request a Refund</h3>
          <form data-form="refund">
            <input type="hidden" name="id" value="${escapeHtml(String(order.id))}">
            <div class="form-field"><label>Amount</label><input name="amount" type="number" min="1" step="1" value="${escapeHtml(String(Math.round(Number(order.total))))}" required></div>
            <button class="btn btn-primary" type="submit">Submit Refund</button>
            <div id="refund-hint" style="font-size:11px;color:var(--text-muted);margin-top:6px"></div>
          </form>
        </aside>
      </div>`;
  } catch (error) {
    app.innerHTML = `<div class="empty-state"><strong>Order not available.</strong><p>${escapeHtml(error.message)}</p><a class="btn btn-ghost" href="#/account">Return to Account</a></div>`;
  }
}

/* ==========================================================================
   Support & Care View (`#/support`)
   ========================================================================== */
function renderSupport() {
  app.innerHTML = `
    <section class="shop-hero">
      <div>
        <span class="eyebrow">Aether Care & Studio</span>
        <h1>Concierge from<br><em>the horizon.</em></h1>
        <p>Direct assistance with white-glove warranty, hardware servicing, architectural commissions, and verified page inspection.</p>
        <div class="concierge-live-badge">
          <span class="pulse-dot"></span>
          <span>Studio Concierge Active · Response ~12 min · Bengaluru · Milan · Kyoto</span>
        </div>
      </div>
    </section>

    <!-- Three Luxury Care Pillars -->
    <div class="care-pillars-grid">
      <div class="care-pillar-card">
        <div class="care-pillar-icon">🛡️</div>
        <h3>24-Month White Glove</h3>
        <p>Doorstep hardware replacement for any acoustic, mechanical, or surface defect. Zero deductible, zero delay.</p>
      </div>
      <div class="care-pillar-card">
        <div class="care-pillar-icon">🌿</div>
        <h3>130% Carbon Compensated</h3>
        <p>Every dispatch travels in compostable molded bamboo fiber with verified carbon retirement certificates.</p>
      </div>
      <div class="care-pillar-card">
        <div class="care-pillar-icon">⚙️</div>
        <h3>10-Year Repair Horizon</h3>
        <p>Guaranteed spare parts inventory, modular battery kits, and open schematics for lifetime longevity.</p>
      </div>
    </div>

    <!-- Concierge Intake Surfaces -->
    <div class="support-grid">
      <section class="support-card">
        <span class="eyebrow">Concierge Audit</span>
        <h2>Report a Page</h2>
        <p>Our operator bot opens reported pages to verify layout integrity, tactile typography, and security signals.</p>
        <form data-form="report">
          <div class="form-field">
            <label>Page URL</label>
            <input name="url" type="url" value="${escapeHtml(location.origin)}/#/product/nova-x1" required>
            <div class="test-url-chips">
              <span class="test-chip-label">Quick audit:</span>
              <button type="button" class="test-chip" onclick="this.closest('form').querySelector('input[name=url]').value='${escapeHtml(location.origin)}/#/product/nova-x1'">Nova X1</button>
              <button type="button" class="test-chip" onclick="this.closest('form').querySelector('input[name=url]').value='${escapeHtml(location.origin)}/#/vision'">Materials</button>
              <button type="button" class="test-chip" onclick="this.closest('form').querySelector('input[name=url]').value='${escapeHtml(location.origin)}/#/boards'">Boards</button>
            </div>
          </div>
          <button class="btn btn-primary" type="submit">Dispatch Operator Review ↗</button>
          <div class="report-success" id="report-success" style="font-size:12px;margin-top:10px;color:var(--success);font-weight:600"></div>
        </form>
      </section>

      <section class="support-card">
        <span class="eyebrow">Studio Intake</span>
        <h2>Message the Studio</h2>
        <p>Direct dialogue with a hardware curator or acoustic specialist.</p>
        <form data-form="support">
          <div class="form-field"><label>Your Email</label><input name="email" type="email" value="${state.user ? escapeHtml(state.user.email) : ''}" placeholder="you@domain.com" required></div>
          <div class="form-field"><label>Subject / Topic</label><input name="subject" placeholder="Acoustic tuning, custom order, or repair request" required></div>
          <div class="form-field"><label>Message</label><textarea name="body" rows="4" placeholder="How can the design studio assist your space?" required></textarea></div>
          <button class="btn btn-primary" type="submit">Send Message ↗</button>
          <div id="support-hint" style="font-size:11.5px;color:var(--text-muted);margin-top:8px"></div>
        </form>
      </section>
    </div>

    <!-- Care FAQ Accordion -->
    <section class="care-faq-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Studio Care FAQ</span>
          <h2>Frequently examined<br><em>questions.</em></h2>
        </div>
      </div>
      <div class="care-faq-list">
        <details class="care-faq-item" open>
          <summary>How does the 30-day tactile trial work?</summary>
          <p>Unbox the hardware in your architectural space. Experience its acoustics, stone finishes, and screen matte coating. If it does not harmonize with your environment, our insured courier will collect it in its original packaging with zero return fees.</p>
        </details>
        <details class="care-faq-item">
          <summary>What is covered under the 24-month Aether Care protection?</summary>
          <p>All mechanical, acoustic, and electrical assemblies are covered. If your titanium hinge experiences friction or your acoustic driver shows distortion, we dispatch an immediate swap device before you return the original.</p>
        </details>
        <details class="care-faq-item">
          <summary>Can I order replacement ear cushions or titanium components?</summary>
          <p>Yes. Our instruments feature solderless modular construction. Hand-woven Belgian wool cushions, titanium arms, and battery cartridges can be ordered individually through your member account.</p>
        </details>
        <details class="care-faq-item">
          <summary>How are dispatches kept 130% carbon-compensated?</summary>
          <p>We measure total cradle-to-gate logistics emissions and purchase gold-standard afforestation credits at 1.3× multiplier. All packaging is 100% biodegradable unbleached plant pulp.</p>
        </details>
      </div>
    </section>
  `;
}

/* ==========================================================================
   Vision & Materials Laboratory View (`#/vision`)
   ========================================================================== */
function renderVision() {
  app.innerHTML = `
    <section class="vision-hero">
      <div class="vision-hero-inner">
        <span class="eyebrow">Series 04 / Material Taxonomy</span>
        <h1 class="page-title">The architecture of<br><em>honest matter.</em></h1>
        <p class="vision-hero-lede">
          We reject disposable polymers and faux-luxury veneers. Every Aetherion instrument is carved from geological stone, grade-5 aerospace titanium, hand-finished Scandinavian timber, and tactile acoustic wool—materials crafted to age with poetic patina and live harmoniously in architectural living spaces.
        </p>
        <div class="vision-hero-meta">
          <div class="vision-stat"><span class="vision-stat-num">100%</span><span class="vision-stat-label">Solderless Modular Design</span></div>
          <div class="vision-stat-sep">/</div>
          <div class="vision-stat"><span class="vision-stat-num">0%</span><span class="vision-stat-label">Single-Use Plastics</span></div>
          <div class="vision-stat-sep">/</div>
          <div class="vision-stat"><span class="vision-stat-num">24 Mo</span><span class="vision-stat-label">White-Glove Care Guarantee</span></div>
        </div>
      </div>
    </section>

    <!-- Material Taxonomy Showcase: 6 Tactile Cards -->
    <section class="materials-taxonomy-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Tactile Library</span>
          <h2>Six elemental<br><em>substances.</em></h2>
        </div>
        <p class="section-subtext">Click any material specimen to trace its geological origin, thermal properties, and featured instruments.</p>
      </div>

      <div class="material-grid">
        <!-- Card 1: Travertine -->
        <article class="material-specimen-card">
          <div class="specimen-img-wrap">
            <img src="/assets/products/nova-x1.jpg" alt="Travertine stone with Nova X1" loading="eager">
            <span class="specimen-badge">Geological · Tuscan Travertine</span>
          </div>
          <div class="specimen-content">
            <div class="specimen-header">
              <span class="specimen-num">01 / Mineral</span>
              <h3>Travertine & Sandstone</h3>
            </div>
            <p>Extracted from geothermal quarries. Naturally microporous, cool to human touch, and acoustically absorbent to neutralize electromagnetic resonance.</p>
            <div class="specimen-tags">
              <span>● Thermal Mass</span>
              <span>● Matte Honed</span>
              <span>● Natural Grain</span>
            </div>
            <div class="specimen-orbit-devices">
              <span class="orbit-label">Featured In:</span>
              <a href="#/product/nova-x1" class="orbit-pill">Nova X1 ↗</a>
              <a href="#/product/orbit-ring" class="orbit-pill">Orbit Ring ↗</a>
            </div>
          </div>
        </article>

        <!-- Card 2: Titanium -->
        <article class="material-specimen-card">
          <div class="specimen-img-wrap">
            <img src="/assets/products/nova-fold.jpg" alt="Titanium fold hinge" loading="eager">
            <span class="specimen-badge">Aerospace · Grade 5 Titanium</span>
          </div>
          <div class="specimen-content">
            <div class="specimen-header">
              <span class="specimen-num">02 / Metallurgy</span>
              <h3>Satin Aerospace Titanium</h3>
            </div>
            <p>Vacuum-annealed Ti-6Al-4V alloy. 45% lighter than surgical steel with unmatched biocompatibility and micro-bead blasted silky tactile finish.</p>
            <div class="specimen-tags">
              <span>● Zero Corrosion</span>
              <span>● Featherweight</span>
              <span>● Biocompatible</span>
            </div>
            <div class="specimen-orbit-devices">
              <span class="orbit-label">Featured In:</span>
              <a href="#/product/nova-fold" class="orbit-pill">Nova Fold ↗</a>
              <a href="#/product/orbit-watch-s3" class="orbit-pill">Orbit Watch ↗</a>
            </div>
          </div>
        </article>

        <!-- Card 3: Zirconia Ceramic -->
        <article class="material-specimen-card">
          <div class="specimen-img-wrap">
            <img src="/assets/products/pulse-buds-pro.jpg" alt="Zirconia ceramic acoustic housing" loading="eager">
            <span class="specimen-badge">Crystalline · Zirconia Ceramic</span>
          </div>
          <div class="specimen-content">
            <div class="specimen-header">
              <span class="specimen-num">03 / Crystalline</span>
              <h3>Diamond-Polished Zirconia</h3>
            </div>
            <p>Sintered at 1,500°C for extreme surface density. Scratch-proof, silk-smooth against skin, and RF-transparent for lossless spatial audio transmission.</p>
            <div class="specimen-tags">
              <span>● 8.5 Mohs Hardness</span>
              <span>● RF Transparent</span>
              <span>● Hypoallergenic</span>
            </div>
            <div class="specimen-orbit-devices">
              <span class="orbit-label">Featured In:</span>
              <a href="#/product/pulse-buds-pro" class="orbit-pill">Pulse Buds ↗</a>
              <a href="#/product/arc-controller" class="orbit-pill">Arc Wheel ↗</a>
            </div>
          </div>
        </article>

        <!-- Card 4: Bouclé Acoustic Weave -->
        <article class="material-specimen-card">
          <div class="specimen-img-wrap">
            <img src="/assets/products/halo-headphones.jpg" alt="Bouclé acoustic weave and aluminum" loading="eager">
            <span class="specimen-badge">Textile · Belgian Bouclé</span>
          </div>
          <div class="specimen-content">
            <div class="specimen-header">
              <span class="specimen-num">04 / Textile</span>
              <h3>Belgian Bouclé Acoustic Weave</h3>
            </div>
            <p>Crafted by heritage weavers in Flanders. Knitted virgin wool and spun linen create an acoustic mesh that lets high frequencies breathe without resonance.</p>
            <div class="specimen-tags">
              <span>● Sonic Transparency</span>
              <span>● Breathable Fiber</span>
              <span>● Natural Lanolin</span>
            </div>
            <div class="specimen-orbit-devices">
              <span class="orbit-label">Featured In:</span>
              <a href="#/product/halo-headphones" class="orbit-pill">Halo Studio ↗</a>
              <a href="#/product/flux-speaker" class="orbit-pill">Flux Speaker ↗</a>
            </div>
          </div>
        </article>

        <!-- Card 5: Amber Borosilicate Optics -->
        <article class="material-specimen-card">
          <div class="specimen-img-wrap">
            <img src="/assets/products/aether-frame.jpg" alt="Modernist amber optics" loading="eager">
            <span class="specimen-badge">Optics · Amber Borosilicate</span>
          </div>
          <div class="specimen-content">
            <div class="specimen-header">
              <span class="specimen-num">05 / Optical</span>
              <h3>Amber Borosilicate Glass</h3>
            </div>
            <p>Dual-curve optical mineral glass coated with multi-layer anti-reflective zirconium fluoride. Enhances architectural light and filters circadian blue glare.</p>
            <div class="specimen-tags">
              <span>● Zero Distortion</span>
              <span>● Mineral Tint</span>
              <span>● Anti-Reflective</span>
            </div>
            <div class="specimen-orbit-devices">
              <span class="orbit-label">Featured In:</span>
              <a href="#/product/aether-frame" class="orbit-pill">Aether Frame ↗</a>
              <a href="#/product/quantum-cam" class="orbit-pill">Quantum Cam ↗</a>
            </div>
          </div>
        </article>

        <!-- Card 6: Scandinavian Timber -->
        <article class="material-specimen-card">
          <div class="specimen-img-wrap">
            <img src="/assets/products/helix-studio.jpg" alt="Blonde Scandinavian oak" loading="eager">
            <span class="specimen-badge">Organic · Nordic Timber</span>
          </div>
          <div class="specimen-content">
            <div class="specimen-header">
              <span class="specimen-num">06 / Organic</span>
              <h3>Blonde Scandinavian Oak</h3>
            </div>
            <p>FSC-certified slow-growth Swedish oak, precision milled with CNC accuracy and finished with cold-pressed natural beeswax to develop a deep golden patina.</p>
            <div class="specimen-tags">
              <span>● FSC Certified</span>
              <span>● Organic Wax</span>
              <span>● Living Grain</span>
            </div>
            <div class="specimen-orbit-devices">
              <span class="orbit-label">Featured In:</span>
              <a href="#/product/helix-studio" class="orbit-pill">Helix Studio ↗</a>
              <a href="#/product/aether-air" class="orbit-pill">Aether Air ↗</a>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- Manifesto Pillars Section -->
    <section class="manifesto-pillars-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Design Axioms</span>
          <h2>Principles of the<br><em>quiet horizon.</em></h2>
        </div>
      </div>
      <div class="axioms-grid">
        <div class="axiom-card">
          <span class="axiom-num">01</span>
          <h3>Patina Over Plastic</h3>
          <p>Synthetic gadgets get greasy, scratched, and discarded. Natural materials absorb the touch of human hands and grow richer every season.</p>
        </div>
        <div class="axiom-card">
          <span class="axiom-num">02</span>
          <h3>Acoustic Resonance</h3>
          <p>True audio fidelity begins with physical damping. Travertine mass and wool boucle tune sonic reflections before digital DSP touches the signal.</p>
        </div>
        <div class="axiom-card">
          <span class="axiom-num">03</span>
          <h3>Zero-Bonded Construction</h3>
          <p>Every fastener is visible and serviceable. We use zero permanent adhesives, ensuring any component can be repaired or recycled decades from now.</p>
        </div>
        <div class="axiom-card">
          <span class="axiom-num">04</span>
          <h3>Quiet Ambient Presence</h3>
          <p>Hardware that refuses to compete with human attention. No intrusive blinking LEDs or loud logos—just serene, contemplative form.</p>
        </div>
      </div>
    </section>

    <!-- CTAs -->
    <section class="vision-cta-section">
      <div class="vision-cta-inner">
        <h2>Experience the collection in motion.</h2>
        <p>Browse pins, save compositions to your personal moodboards, or order with complimentary white-glove delivery.</p>
        <div class="vision-cta-actions">
          <a class="btn btn-primary" href="#/shop">Explore Pins Wall ↗</a>
          <a class="btn btn-ghost" href="#/boards">View Moodboards</a>
        </div>
      </div>
    </section>
  `;
}

/* ==========================================================================
   Admin Operations Console View (`#/admin`)
   ========================================================================== */
async function renderAdmin() {
  if (!state.user) {
    app.innerHTML = `<div class="empty-state"><strong>Operator authentication required.</strong><a class="btn btn-primary" href="#/signin">Sign in</a></div>`;
    return;
  }
  app.innerHTML = '<div class="loading"><div class="spinner"></div><span>Opening operations vault…</span></div>';
  try {
    const vault = await api('/api/admin/vault');
    app.innerHTML = `
      <section><span class="eyebrow">Governance & Trust</span><h1 class="page-title">Operations Console</h1></section>
      <div class="panel" style="margin-bottom:24px">
        <h2>Control Plane Status</h2>
        <div style="font-family:var(--mono);font-size:12px;background:#f5efe4;padding:18px;border-radius:16px;line-height:1.8">
          <div>region: <strong>${escapeHtml(vault.governance.region)}</strong></div>
          <div>tier: <strong>${escapeHtml(vault.governance.tier)}</strong></div>
          <div>principal: <strong>${escapeHtml(vault.principal)}</strong></div>
          <div style="margin-top:10px;word-break:break-all">vault: <strong style="color:var(--success)">${escapeHtml(vault.vault)}</strong></div>
        </div>
      </div>
      <div class="panel">
        <h2>Operator Surfaces</h2>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <a class="btn btn-ghost" href="#/support">Review Queue</a>
          <a class="btn btn-ghost" href="#/account">Member Directory</a>
          <button class="btn btn-secondary" type="button" data-logout>End Operator Session</button>
        </div>
      </div>`;
  } catch (error) {
    app.innerHTML = `<div class="empty-state"><strong>Restricted Console.</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

/* ==========================================================================
   OAuth Callback Handler
   ========================================================================== */
async function handleOauthCallback() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const stateValue = params.get('state');
  const expectedState = sessionStorage.getItem('aetherion-oauth-state');
  if (!code) {
    app.innerHTML = '<div class="empty-state"><strong>Missing authorization code.</strong></div>';
    return;
  }
  try {
    const data = await api('/api/auth/oauth/exchange', {
      method: 'POST',
      body: { code, redirectUri: `${location.origin}/oauth/callback` },
    });
    state.user = data.user;
    sessionStorage.removeItem('aetherion-oauth-state');
    history.replaceState({}, '', '/#/account');
    updateChrome();
    await renderRoute();
  } catch (error) {
    app.innerHTML = `<div class="empty-state"><strong>Identity exchange failed.</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

/* ==========================================================================
   Route Switcher
   ========================================================================== */
async function renderRoute() {
  const token = ++state.renderToken;
  const route = currentRoute();
  const path = baseRoute(route);
  updateChrome();
  try {
    if (path === '/' || path === '') await renderHome();
    else if (path === '/shop') await renderShop(route);
    else if (path === '/boards') await renderBoards();
    else if (path.startsWith('/product/')) await renderProduct(path);
    else if (path === '/cart') await renderCart();
    else if (path === '/checkout') { await loadProducts(); renderCheckout(); }
    else if (path === '/signin') { app.innerHTML = signinView(); configureOauthLink(); }
    else if (path === '/register') app.innerHTML = registerView();
    else if (path === '/reset') app.innerHTML = resetView(route);
    else if (path === '/account') await renderAccount();
    else if (path.startsWith('/order/')) await renderOrder(path);
    else if (path === '/support') renderSupport();
    else if (path === '/vision') renderVision();
    else if (path === '/admin') await renderAdmin();
    else {
      app.innerHTML = `<div class="empty-state"><strong>Signal Lost.</strong><p>Page does not exist.</p><a class="btn btn-primary" href="#/">Return Home</a></div>`;
    }
    if (token !== state.renderToken) return;
    updateChrome();
  } catch (error) {
    if (token !== state.renderToken) return;
    console.error(error);
    app.innerHTML = `<div class="empty-state"><strong>Signal Lost.</strong><p>${escapeHtml(error.message)}</p><a class="btn btn-ghost" href="#/">Return Home</a></div>`;
  }
}

function configureOauthLink() {
  const link = document.getElementById('oauth-start');
  if (!link) return;
  const redirectUri = `${location.origin}/oauth/callback`;
  const stateValue = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
  sessionStorage.setItem('aetherion-oauth-state', stateValue);
  link.href = `/idp/authorize?client_id=aetherion-web&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('openid profile email')}&state=${encodeURIComponent(stateValue)}`;
}

/* ==========================================================================
   Pinterest "Save to Board" Modal Flow
   ========================================================================== */
function openSaveToBoardModal(slug) {
  state.activeSaveSlug = slug;
  const modal = document.getElementById('board-modal');
  if (!modal) return;

  const product = state.products.find((p) => p.slug === slug);
  const previewEl = document.getElementById('board-pin-preview');
  if (previewEl && product) {
    const img = getProductImage(product.slug, product.image);
    previewEl.innerHTML = `
      <img class="board-preview-thumb" src="${escapeHtml(img)}" alt="">
      <div class="board-preview-info">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.category)} · ${money.format(Number(product.price))}</span>
      </div>
    `;
  }

  renderBoardList();
  modal.hidden = false;
}

function renderBoardList(filterQuery = '') {
  const listEl = document.getElementById('board-list');
  if (!listEl) return;
  let boards = getBoards();
  if (filterQuery) {
    boards = boards.filter((b) => b.name.toLowerCase().includes(filterQuery.toLowerCase()));
  }

  listEl.innerHTML = boards.map((board) => `
    <div class="board-option-row" data-board-id="${escapeHtml(board.id)}">
      <div>
        <strong>${escapeHtml(board.name)}</strong>
        <span>${board.pins.length} items</span>
      </div>
      <button class="board-save-pill" type="button" data-save-to-board="${escapeHtml(board.id)}">Save</button>
    </div>
  `).join('');
}

function closeSaveToBoardModal() {
  const modal = document.getElementById('board-modal');
  if (modal) modal.hidden = true;
  state.activeSaveSlug = null;
}

/* ==========================================================================
   Event Listeners (Click & Submit)
   ========================================================================== */
function handleClick(event) {
  // Pinterest Save Pin
  const saveBtn = event.target.closest('[data-pin-save]');
  if (saveBtn) {
    const slug = saveBtn.dataset.pinSave;
    openSaveToBoardModal(slug);
    return;
  }

  // Quick View / Inspect Pin
  const quickView = event.target.closest('[data-quick-view]');
  if (quickView) {
    location.hash = `/product/${encodeURIComponent(quickView.dataset.quickView)}`;
    return;
  }

  // Pin Media Click -> View Product
  const pinMedia = event.target.closest('[data-view]');
  if (pinMedia && !event.target.closest('button')) {
    location.hash = `/product/${encodeURIComponent(pinMedia.dataset.view)}`;
    return;
  }

  // Pinterest Like Button
  const likeBtn = event.target.closest('[data-pin-like]');
  if (likeBtn) {
    const slug = likeBtn.dataset.pinLike;
    const liked = getLikedPins();
    const countEl = likeBtn.querySelector('.like-count');
    let currentCount = countEl ? parseInt(countEl.textContent, 10) : 300;

    if (liked.has(slug)) {
      liked.delete(slug);
      likeBtn.classList.remove('liked');
      likeBtn.innerHTML = `♡ <span class="like-count">${currentCount - 1}</span>`;
    } else {
      liked.add(slug);
      likeBtn.classList.add('liked');
      likeBtn.innerHTML = `❤️ <span class="like-count">${currentCount + 1}</span>`;
      toast('Pinned to your favorites ❤️');
    }
    setLikedPins(liked);
    return;
  }

  // Save to specific board from modal
  const saveToBoard = event.target.closest('[data-save-to-board]');
  if (saveToBoard && state.activeSaveSlug) {
    const boardId = saveToBoard.dataset.saveToBoard;
    const boards = getBoards();
    const targetBoard = boards.find((b) => b.id === boardId);
    if (targetBoard) {
      if (!targetBoard.pins.includes(state.activeSaveSlug)) {
        targetBoard.pins.push(state.activeSaveSlug);
        setBoards(boards);
      }
      const saved = getSavedPins();
      saved.add(state.activeSaveSlug);
      setSavedPins(saved);
      toast(`Saved to ${targetBoard.name} 📌`);
    }
    closeSaveToBoardModal();
    renderRoute();
    return;
  }

  // Close Save to Board Modal
  if (event.target.closest('#close-board-modal') || event.target.id === 'board-modal') {
    closeSaveToBoardModal();
    return;
  }

  // Open Create Board from Boards page
  if (event.target.closest('#btn-open-create-board')) {
    const name = prompt('Enter a name for your new aesthetic board:');
    if (name && name.trim()) {
      const boards = getBoards();
      const newId = 'board_' + Date.now();
      boards.push({ id: newId, name: name.trim(), description: 'Personal curated board', pins: [] });
      setBoards(boards);
      toast(`Board "${name.trim()}" created! 📌`);
      renderRoute();
    }
    return;
  }

  // Swatch selection on product detail page
  const swatch = event.target.closest('.pd-swatch-btn');
  if (swatch) {
    document.querySelectorAll('.pd-swatch-btn').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    return;
  }

  // Add to Bag
  const add = event.target.closest('[data-add]');
  if (add) {
    addToCart(add.dataset.add, 1);
    return;
  }

  // Buy Now
  const buy = event.target.closest('[data-buy]');
  if (buy) {
    addToCart(buy.dataset.buy, 1);
    location.hash = '/cart';
    return;
  }

  // Cart Qty Steppers
  const inc = event.target.closest('[data-inc]');
  if (inc) {
    const items = getCart();
    const line = items.find((item) => item.slug === inc.dataset.inc);
    if (line) line.qty += 1;
    setCart(items);
    renderRoute();
    return;
  }
  const dec = event.target.closest('[data-dec]');
  if (dec) {
    const items = getCart()
      .map((item) => (item.slug === dec.dataset.dec ? { ...item, qty: item.qty - 1 } : item))
      .filter((item) => item.qty > 0);
    setCart(items);
    renderRoute();
    return;
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    setCart(getCart().filter((item) => item.slug !== remove.dataset.remove));
    renderRoute();
    return;
  }

  // Filter chips / tags
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    const value = filter.dataset.filter;
    location.hash = value === 'All' ? '/shop' : `/shop?category=${encodeURIComponent(value)}`;
    return;
  }

  // Logout
  const logout = event.target.closest('[data-logout]');
  if (logout) {
    api('/api/auth/logout', { method: 'POST' }).finally(() => {
      state.user = null;
      updateChrome();
      toast('Signed out from Aether ID');
      location.hash = '/';
    });
  }
}

async function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  const data = Object.fromEntries(new FormData(form).entries());

  if (kind === 'signin') {
    const errorEl = document.getElementById('signin-error');
    if (errorEl) errorEl.textContent = '';
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: data });
      state.user = result.user;
      updateChrome();
      toast(`Welcome back, ${result.user.name.split(' ')[0]}`);
      history.pushState({}, '', '/#/account');
      await renderRoute();
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message;
    }
    return;
  }

  if (kind === 'register') {
    const errorEl = document.getElementById('register-error');
    if (errorEl) errorEl.textContent = '';
    try {
      const result = await api('/api/auth/register', { method: 'POST', body: data });
      state.user = result.user;
      updateChrome();
      toast('Aether ID created');
      history.pushState({}, '', '/#/account');
      await renderRoute();
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message;
    }
    return;
  }

  if (kind === 'otp-request') {
    const hint = document.getElementById('otp-hint');
    if (hint) hint.textContent = 'Requesting code…';
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'mutation($identifier:String!){ requestOtp(identifier:$identifier){ sent hint expiresIn } }',
          variables: { identifier: data.identifier },
        }),
      });
      const payload = await response.json();
      const request = payload.data && payload.data.requestOtp;
      if (hint) hint.textContent = request ? `Code sent · expires in ${request.expiresIn}s` : (payload.errors?.[0]?.message || 'Could not send code.');
      const hidden = document.getElementById('otp-identifier');
      if (hidden) hidden.value = data.identifier;
    } catch {
      if (hint) hint.textContent = 'Service unavailable.';
    }
    return;
  }

  if (kind === 'otp-verify') {
    const errorEl = document.getElementById('otp-error');
    if (errorEl) errorEl.textContent = '';
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'mutation($identifier:String!,$code:String!){ otpVerify(identifier:$identifier,code:$code){ token user{ email name role vault } } }',
          variables: { identifier: data.identifier, code: data.code },
        }),
      });
      const payload = await response.json();
      const result = payload.data && payload.data.otpVerify;
      if (!result) throw new Error('Code not accepted.');
      const session = await api('/api/auth/token-session', { method: 'POST', body: { token: result.token } });
      state.user = session.user;
      updateChrome();
      toast('Identity confirmed');
      history.pushState({}, '', '/#/account');
      await renderRoute();
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message;
    }
    return;
  }

  if (kind === 'checkout') {
    try {
      const items = getCart();
      if (!items.length) throw new Error('Your bag is empty.');
      await api('/api/catalog/orders', { method: 'POST', body: { items, address: `${data.name}, ${data.address} ${data.note || ''}` } });
      setCart([]);
      toast('Order confirmed · in transit to your orbit');
      history.pushState({}, '', '/#/account');
      await renderRoute();
    } catch (error) {
      toast(error.message);
    }
    return;
  }

  if (kind === 'report') {
    const status = document.getElementById('report-success');
    if (status) status.textContent = 'Dispatching operator review…';
    try {
      await api('/api/reports', { method: 'POST', body: { url: data.url } });
      if (status) status.textContent = 'Queued. An operator bot will review this page shortly.';
    } catch (error) {
      if (status) status.textContent = error.message;
    }
    return;
  }

  if (kind === 'forgot') {
    const hint = document.getElementById('forgot-hint');
    if (hint) hint.textContent = 'Sending recovery link…';
    try {
      await api('/api/auth/password/forgot', { method: 'POST', body: { email: data.email } });
      if (hint) hint.textContent = 'Recovery link sent. Check your mailbox.';
    } catch (error) {
      if (hint) hint.textContent = error.message;
    }
    return;
  }

  if (kind === 'reset') {
    const errorEl = document.getElementById('reset-error');
    if (errorEl) errorEl.textContent = '';
    try {
      await api('/api/auth/password/reset', { method: 'POST', body: { token: data.token, password: data.password } });
      toast('Password updated · Sign in again');
      history.pushState({}, '', '/#/signin');
      await renderRoute();
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message;
    }
    return;
  }

  if (kind === 'refund') {
    const hint = document.getElementById('refund-hint');
    if (hint) hint.textContent = 'Submitting…';
    try {
      const result = await api(`/api/account/orders/${encodeURIComponent(data.id)}/refund`, { method: 'POST', body: { amount: Number(data.amount) } });
      if (hint) hint.textContent = `Refunded ${money.format(Number(result.refunded))} · wallet ${money.format(Number(result.wallet))}`;
      setTimeout(renderRoute, 500);
    } catch (error) {
      if (hint) hint.textContent = error.message;
    }
    return;
  }

  if (kind === 'redeem') {
    const hint = document.getElementById('redeem-hint');
    if (hint) hint.textContent = 'Redeeming…';
    try {
      const result = await api('/api/account/wallet/redeem', { method: 'POST', body: { code: data.code } });
      if (hint) hint.textContent = `Credited ${money.format(result.credited)} · new balance ${money.format(result.wallet)}`;
      setTimeout(renderRoute, 500);
    } catch (error) {
      if (hint) hint.textContent = error.message;
    }
    return;
  }

  if (kind === 'stack') {
    const hint = document.getElementById('stack-hint');
    if (hint) hint.textContent = 'Applying vouchers…';
    try {
      const codes = String(data.codes || '').split(',').map((code) => code.trim()).filter(Boolean);
      const result = await api('/api/account/wallet/apply', { method: 'POST', body: { codes } });
      if (hint) hint.textContent = `Credited ${money.format(Number(result.credited))} · applied ${(result.applied || []).join(', ')}`;
      setTimeout(renderRoute, 500);
    } catch (error) {
      if (hint) hint.textContent = error.message;
    }
    return;
  }

  if (kind === 'invoice') {
    const hint = document.getElementById('invoice-hint');
    if (hint) hint.textContent = 'Opening document…';
    try {
      const response = await fetch(`/api/account/invoices/download?file=${encodeURIComponent(data.file)}`);
      const text = await response.text();
      if (hint) hint.textContent = response.ok ? String(text).slice(0, 500) : `Document unavailable (${response.status})`;
    } catch (error) {
      if (hint) hint.textContent = error.message;
    }
    return;
  }

  if (kind === 'support') {
    const hint = document.getElementById('support-hint');
    if (hint) hint.textContent = 'Sending message…';
    try {
      await api('/api/support/tickets', { method: 'POST', body: data });
      if (hint) hint.textContent = 'Message received. A specialist will reply by email.';
      form.reset();
    } catch (error) {
      if (hint) hint.textContent = error.message;
    }
    return;
  }
}

/* ==========================================================================
   Application Boot
   ========================================================================== */
function boot() {
  if (location.pathname === '/oauth/callback/resume') {
    const next = new URLSearchParams(location.search).get('next') || '/';
    window.location.replace(next);
    return;
  }

  window.addEventListener('scroll', () => {
    const header = document.getElementById('site-header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  // Pinterest Quick Search Input in Header
  const quickSearch = document.getElementById('quick-search-input');
  const clearBtn = document.getElementById('quick-search-clear');
  if (quickSearch) {
    quickSearch.addEventListener('input', () => {
      if (clearBtn) clearBtn.hidden = !quickSearch.value;
    });
    quickSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = quickSearch.value.trim();
        location.hash = q ? `/shop?q=${encodeURIComponent(q)}` : '/shop';
      }
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (quickSearch) {
        quickSearch.value = '';
        clearBtn.hidden = true;
        quickSearch.focus();
      }
    });
  }

  // Create Board Form in Modal
  const createBoardForm = document.getElementById('create-board-form');
  if (createBoardForm) {
    createBoardForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('new-board-name');
      if (input && input.value.trim()) {
        const boards = getBoards();
        const newId = 'board_' + Date.now();
        const newBoard = {
          id: newId,
          name: input.value.trim(),
          description: 'Custom aesthetic board',
          pins: state.activeSaveSlug ? [state.activeSaveSlug] : [],
        };
        boards.push(newBoard);
        setBoards(boards);
        if (state.activeSaveSlug) {
          const saved = getSavedPins();
          saved.add(state.activeSaveSlug);
          setSavedPins(saved);
        }
        toast(`Board "${newBoard.name}" created and pin saved! 📌`);
        input.value = '';
        closeSaveToBoardModal();
        renderRoute();
      }
    });
  }

  // Board search filter inside modal
  const boardSearch = document.getElementById('board-search-input');
  if (boardSearch) {
    boardSearch.addEventListener('input', () => {
      renderBoardList(boardSearch.value.trim());
    });
  }

  // Mobile search drawer fallback
  const drawer = document.getElementById('search-drawer');
  const searchInput = document.getElementById('search-input');
  const searchToggle = document.getElementById('search-toggle');
  const searchClose = document.getElementById('search-close');
  if (searchToggle && drawer) {
    searchToggle.addEventListener('click', () => {
      drawer.hidden = false;
      setTimeout(() => searchInput && searchInput.focus(), 30);
    });
  }
  if (searchClose && drawer) {
    searchClose.addEventListener('click', () => {
      drawer.hidden = true;
    });
  }
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = searchInput ? searchInput.value.trim() : '';
      if (drawer) drawer.hidden = true;
      location.hash = value ? `/shop?q=${encodeURIComponent(value)}` : '/shop';
    });
  }

  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('change', (event) => {
    if (event.target.id !== 'sort-select') return;
    const params = parseQuery(currentRoute());
    params.set('sort', event.target.value);
    location.hash = `/shop?${params.toString()}`;
  });

  window.addEventListener('hashchange', renderRoute);

  document.addEventListener('click', (event) => {
    if (event.target.closest('#show-otp')) {
      document.getElementById('otp-box')?.classList.toggle('open');
    }
  });

  refreshSession().finally(async () => {
    if (location.pathname === '/oauth/callback') {
      await handleOauthCallback();
      return;
    }
    await renderRoute();
  });
}

boot();
