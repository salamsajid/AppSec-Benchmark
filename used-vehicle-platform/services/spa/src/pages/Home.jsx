import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, API, fmtPrice, fmtKm } from '../api.js';
import { getVehiclePrimaryImage } from '../vehicleImages.js';

const CATEGORIES = [
  { label: 'All Vehicles', icon: '🚗', link: '/search', cat: 'all' },
  { label: 'SUVs', icon: '🚙', link: '/search?body=SUV', cat: 'suv' },
  { label: 'Sedans', icon: '🏎️', link: '/search?body=Sedan', cat: 'sedan' },
  { label: 'Electric EVs', icon: '⚡', link: '/search?q=electric', cat: 'ev' },
  { label: 'Hatchbacks', icon: '🚙', link: '/search?body=Hatchback', cat: 'hatch' },
  { label: 'Trade-In / Sell', icon: '🏷️', link: '/sell', cat: 'trade' },
  { label: 'Financing', icon: '🧮', link: '/emi', cat: 'emi' },
  { label: 'AI Specialist', icon: '🤖', link: '/assistant', cat: 'ai' },
];

const QUICK_TAGS = [
  { label: '⚡ 100% Electric', query: 'electric' },
  { label: '🚙 Automatic SUVs', query: 'SUV' },
  { label: '💰 Under $15,000', query: '15000' },
  { label: '🏆 Low Mileage (<30k mi)', query: 'low mileage' },
  { label: '🏎️ German Luxury', query: 'BMW' },
];

const CUSTOMER_REVIEWS = [
  {
    name: 'Aarav Mehta',
    location: 'Mumbai, MH',
    car: '2022 Tesla Model 3',
    stars: 5,
    text: 'Seamless online escrow and doorstep handover in under 24 hours. The car was 100% detailed and matched the 200-point inspection report down to the millimetre.',
    initials: 'AM'
  },
  {
    name: 'Priyanka Sharma',
    location: 'Bengaluru, KA',
    car: '2021 Hyundai Creta SX',
    stars: 5,
    text: 'Zero paperwork hassle. Pre-approved financing went through on my phone in 5 minutes with zero down payment. Best car buying experience in India.',
    initials: 'PS'
  },
  {
    name: 'Vikramaditya Rao',
    location: 'Delhi NCR',
    car: '2020 Toyota Fortuner 4x4',
    stars: 5,
    text: 'Trade-in value for my older car was 15% higher than local dealers. Money hit my account the same afternoon. Apple-grade transparency throughout.',
    initials: 'VR'
  }
];

const LAUNCH_HEROES = [
  {
    id: 'launch-porsche',
    name: 'Porsche Macan EV Turbo',
    tagline: 'Electrified Dynamics. 800V Architecture & Stuttgart Heritage.',
    gif: '/sports-car-porsche-cinematic.gif',
    fallbackImg: '/launches/porsche-macan-ev.jpg',
    specs: { hp: '630 HP', zeroToSixty: '3.1 sec', topSpeed: '161 mph', range: '381 mi' },
    badge: '2027 WORLD PREMIERE',
    price: '$105,300',
    colorHex: '#0071e3',
    audioFreq: 'electric'
  },
  {
    id: 'launch-ferrari',
    name: 'Ferrari 12Cilindri V12',
    tagline: '830 Horsepower of Pure Maranello Naturally Aspirated Symphony.',
    gif: '/sports-car-ferrari-full.gif',
    fallbackImg: '/launches/ferrari-12c.jpg',
    specs: { hp: '830 HP', zeroToSixty: '2.8 sec', topSpeed: '217 mph', redline: '9,500 RPM' },
    badge: 'NATURALLY ASPIRATED V12',
    price: '$423,000',
    colorHex: '#dc2626',
    audioFreq: 'v12'
  },
  {
    id: 'launch-lamborghini',
    name: 'Lamborghini Revuelto HPEV',
    tagline: '1,001 Horsepower Tri-Motor Hybrid with Carbon Monofuselage.',
    gif: '/sports-car-lamborghini-full.gif',
    fallbackImg: '/launches/porsche-macan-ev.jpg',
    specs: { hp: '1,001 HP', zeroToSixty: '2.5 sec', topSpeed: '219 mph', torque: '1,062 Nm' },
    badge: 'HYPERCAR PREVIEW',
    price: '$608,358',
    colorHex: '#eab308',
    audioFreq: 'v12'
  },
  {
    id: 'launch-porsche-gt3',
    name: 'Porsche 911 GT3 RS Track Spec',
    tagline: 'Pure Motorsport Aerodynamics with DRS Active Hydraulic Wing.',
    gif: '/sports-car-porsche-full.gif',
    fallbackImg: '/launches/porsche-macan-ev.jpg',
    specs: { hp: '518 HP', zeroToSixty: '3.0 sec', downforce: '860 kg', engine: '4.0L Boxer' },
    badge: 'GT MOTORSPORT',
    price: '$241,300',
    colorHex: '#10b981',
    audioFreq: 'flat6'
  }
];

export default function Home() {
  const [cars, setCars] = useState([]);
  const [q, setQ] = useState('');
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const nav = useNavigate();
  const heroRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    api(`${API.catalog}/v1/vehicles/search`).then(r => {
      const list = r.data.results || [];
      setCars(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  // Autoplay through sports car launch hero reels
  useEffect(() => {
    let timer;
    if (isAutoplay && !isPlayingAudio) {
      timer = setInterval(() => {
        setActiveHeroIndex(prev => (prev + 1) % LAUNCH_HEROES.length);
      }, 7000);
    }
    return () => clearInterval(timer);
  }, [isAutoplay, isPlayingAudio]);

  const activeLaunch = LAUNCH_HEROES[activeHeroIndex];

  // Synthesize engine audio notes
  const playSound = () => {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      setIsPlayingAudio(true);
      const now = ctx.currentTime;

      if (activeLaunch.audioFreq === 'v12') {
        // High-revving Ferrari V12 scream
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.15);

        osc1.frequency.setValueAtTime(120, now);
        osc1.frequency.exponentialRampToValueAtTime(780, now + 1.2);
        osc1.frequency.exponentialRampToValueAtTime(320, now + 2.2);

        osc2.frequency.setValueAtTime(240, now);
        osc2.frequency.exponentialRampToValueAtTime(1560, now + 1.2);
        osc2.frequency.exponentialRampToValueAtTime(640, now + 2.2);

        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.4);
        osc2.stop(now + 2.4);
      } else {
        // Electric supersonic inverter whine
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.1);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(1100, now + 1.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

        osc.start(now);
        osc.stop(now + 2.2);
      }

      setTimeout(() => setIsPlayingAudio(false), 2400);
    } catch (e) {
      console.warn('Audio playback error', e);
      setIsPlayingAudio(false);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (heroRef.current && heroRef.current.requestFullscreen) {
        heroRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const scrollToStoreShelf = () => {
    const el = document.getElementById('store-inventory-shelf');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const featured = cars.slice(0, 8);
  const suvs = cars.filter(c => c.body === 'SUV').slice(0, 4);
  const evs = cars.filter(c => c.fuel === 'Electric').slice(0, 4);
  const spotlightCar = cars.find(c => c.fuel === 'Electric') || cars[3] || cars[0];

  return (
    <div>
      {/* FULL-SCREEN CINEMATIC SPORTS CAR LAUNCH HERO BANNER */}
      <section
        ref={heroRef}
        className={`as-cinema-hero ${isFullscreen ? 'fullscreen-mode' : ''}`}
      >
        {/* Animated Sports Car GIF Background */}
        <div className="as-cinema-bg-wrap">
          <img
            key={activeLaunch.id}
            src={activeLaunch.gif}
            alt={activeLaunch.name}
            className="as-cinema-bg-gif"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = activeLaunch.fallbackImg;
            }}
          />
          {/* Aesthetic Cinema Lighting Overlays */}
          <div className="as-cinema-vignette" />
          <div
            className="as-cinema-ambient-glow"
            style={{
              background: `radial-gradient(circle at 70% 40%, ${activeLaunch.colorHex}55 0%, transparent 65%)`
            }}
          />
        </div>

        {/* Top Floating Cinema HUD Bar */}
        <div className="as-cinema-top-hud">
          <div className="as-cinema-brand-chip">
            <span className="as-pulse-live-dot" />
            <span className="as-cinema-live-text">STRATOS WORLD PREMIERE</span>
            <span className="as-cinema-divider">|</span>
            <span className="as-cinema-badge-text">{activeLaunch.badge}</span>
          </div>

          <div className="as-cinema-controls">
            <button
              type="button"
              className={`as-cinema-ctrl-btn ${isPlayingAudio ? 'active' : ''}`}
              onClick={playSound}
              title="Audition Realistic Exhaust & Inverter Acoustics"
            >
              {isPlayingAudio ? '🔊 Auditioning Sound...' : '🔉 Audition Exhaust'}
            </button>
            <button
              type="button"
              className="as-cinema-ctrl-btn"
              onClick={toggleFullscreen}
              title="Toggle Full Screen Mode"
            >
              {isFullscreen ? '✕ Exit Full Screen' : '⛶ Full Screen'}
            </button>
          </div>
        </div>

        {/* Center / Bottom Cinema Content Overlay */}
        <div className="as-cinema-content">
          <div className="as-cinema-headline-group">
            <span className="as-cinema-eyebrow">
              {activeLaunch.badge} • ALLOCATION RESERVATIONS OPEN
            </span>
            <h1 className="as-cinema-title">{activeLaunch.name}</h1>
            <p className="as-cinema-subtitle">{activeLaunch.tagline}</p>
          </div>

          {/* Telemetry HUD Specs Strip */}
          <div className="as-cinema-specs-hud">
            {Object.entries(activeLaunch.specs).map(([k, v]) => (
              <div key={k} className="as-cinema-spec-pill">
                <span className="as-spec-val">{v}</span>
                <span className="as-spec-key">
                  {k === 'zeroToSixty' ? '0-60 MPH' : k.toUpperCase()}
                </span>
              </div>
            ))}
            <div className="as-cinema-spec-pill highlight">
              <span className="as-spec-val">{activeLaunch.price}</span>
              <span className="as-spec-key">STARTING MSRP</span>
            </div>
          </div>

          {/* Interactive Sports Car Switcher Buttons */}
          <div className="as-cinema-switcher-row">
            <span className="as-switcher-label">Select Launch Showcase:</span>
            <div className="as-cinema-pills">
              {LAUNCH_HEROES.map((launch, idx) => (
                <button
                  key={launch.id}
                  type="button"
                  className={`as-cinema-tab-pill ${activeHeroIndex === idx ? 'active' : ''}`}
                  onClick={() => {
                    setActiveHeroIndex(idx);
                    setIsAutoplay(false);
                  }}
                >
                  <span className="as-pill-dot" style={{ backgroundColor: launch.colorHex }} />
                  <span>{launch.name.split(' ')[0]} {launch.name.split(' ')[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="as-cinema-cta-row">
            <Link to="/launches" className="as-btn-glow-large">
              Reserve 2027 Allocation ({activeLaunch.price}) →
            </Link>
            <Link to="/studio-360" className="as-btn-glass-large">
              🔄 Open 360° Inspection Studio
            </Link>
            <button
              type="button"
              className="as-btn-ghost-scroll"
              onClick={scrollToStoreShelf}
            >
              Browse Used Inventory ↓
            </button>
          </div>
        </div>
      </section>

      {/* Anchor for Smooth Scrolling to Store Shelf */}
      <div id="store-inventory-shelf" style={{ height: 20 }} />

      {/* Apple Store Grand Header */}
      <div className="as-store-header">
        <div>
          <h1 className="as-headline">
            Store. <span>The best way to buy the quality pre-owned cars you love.</span>
          </h1>
        </div>
        <div className="as-specialist-card">
          <span className="as-specialist-avatar">🤖</span>
          <div className="as-specialist-info">
            <b>Need shopping advice?</b>
            <Link to="/assistant">Ask an AI Specialist ↗</Link>
          </div>
        </div>
      </div>

      {/* Live Market Stats Ticker */}
      <div className="as-market-ticker">
        <div className="as-ticker-chip">
          <span className="dot"></span>
          <span>120+ Verified Showroom Inventory</span>
        </div>
        <div className="as-ticker-chip">
          <span>⚡ 100% Clear RC & Title Guaranteed</span>
        </div>
        <div className="as-ticker-chip">
          <span>🛡️ 200-Point Apple-Grade Inspection</span>
        </div>
        <div className="as-ticker-chip">
          <span>🔄 7-Day Complete Money-Back Guarantee</span>
        </div>
        <div className="as-ticker-chip">
          <span>🚚 Free White-Glove Doorstep Delivery</span>
        </div>
      </div>

      {/* Apple Category Ribbon Shelf with Vibrant Color Accents */}
      <div className="as-ribbon">
        {CATEGORIES.map((cat) => (
          <Link key={cat.label} to={cat.link} className="as-ribbon-item" data-cat={cat.cat}>
            <div className="as-ribbon-circle">
              {cat.icon}
            </div>
            <span className="as-ribbon-label">{cat.label}</span>
          </Link>
        ))}
      </div>

      {/* Keynote Luxury Spotlight Banner */}
      {spotlightCar && (
        <div className="as-spotlight-banner">
          <div>
            <div className="as-spotlight-badge">
              <span>★ KEYNOTE SPOTLIGHT · CERTIFIED SHOWROOM</span>
            </div>
            <h2 className="as-spotlight-title">
              {spotlightCar.make} {spotlightCar.model}
            </h2>
            <p className="as-spotlight-desc">
              Experience the pinnacle of next-generation performance and whisper-quiet refinement. Single-owner provenance, 200-point certified, and covered by our comprehensive 3-year warranty.
            </p>
            <div className="as-spotlight-specs">
              <span className="as-spotlight-spec-chip">⚡ {spotlightCar.fuel}</span>
              <span className="as-spotlight-spec-chip">🏎️ {spotlightCar.transmission}</span>
              <span className="as-spotlight-spec-chip">🛣️ {fmtKm(spotlightCar.mileage)}</span>
              <span className="as-spotlight-spec-chip">📍 {spotlightCar.location}</span>
            </div>
            <div className="as-spotlight-actions">
              <Link to={`/vehicles/${spotlightCar.id}`} className="as-btn-glow">
                Explore Vehicle Details ›
              </Link>
              <Link to={`/checkout?vehicle=${spotlightCar.id}`} className="as-btn-glass">
                Reserve Online ({fmtPrice(spotlightCar.price)}) ›
              </Link>
            </div>
          </div>
          <div>
            <img
              src={getVehiclePrimaryImage(spotlightCar)}
              alt={`${spotlightCar.make} ${spotlightCar.model}`}
              className="as-spotlight-img"
              loading="lazy"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/vehicles/default.jpg';
              }}
            />
          </div>
        </div>
      )}

      {/* Clean Spotlight Search Input */}
      <form
        className="as-search-container"
        onSubmit={(e) => {
          e.preventDefault();
          nav(`/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <span style={{ fontSize: 18, marginRight: 10, color: '#0ea5e9' }}>🔍</span>
        <input
          placeholder="Search make, model, electric, sedan, Mumbai, Bangalore..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="as-search-btn" type="submit">Search Showroom</button>
      </form>

      {/* Quick Search Tag Chips */}
      <div className="as-quick-tags">
        <span className="as-quick-tags-label">Trending Searches:</span>
        {QUICK_TAGS.map(t => (
          <button
            key={t.label}
            type="button"
            className="as-tag-chip"
            onClick={() => nav(`/search?q=${encodeURIComponent(t.query)}`)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* The Latest Section */}
      <div className="as-section-head">
        <h2 className="as-section-title">
          The Latest Inventory. <span>Take a look at what’s new right now.</span>
        </h2>
        <Link className="as-section-link" to="/search">View all 120+ cars ›</Link>
      </div>

      <div className="as-grid">
        {featured.map((c, idx) => {
          let badgeType = 'badge-dealer';
          let badgeText = 'VERIFIED DEALER';
          if (idx === 0) {
            badgeType = 'badge-top';
            badgeText = '★ TOP PICK';
          } else if (c.fuel === 'Electric') {
            badgeType = 'badge-electric';
            badgeText = '⚡ 100% ELECTRIC';
          } else if (c.body === 'SUV') {
            badgeType = 'badge-suv';
            badgeText = '🚙 CERTIFIED SUV';
          }
          return (
            <AppleCarCard key={c.id} c={c} tag={badgeText} badgeType={badgeType} />
          );
        })}
      </div>

      {/* The Stratos Difference Value Section (Apple Store 4 Cards) */}
      <div className="as-section-head" style={{ marginTop: 56 }}>
        <h2 className="as-section-title">
          The Stratos Difference. <span>Even more reasons to shop with us.</span>
        </h2>
      </div>

      <div className="as-difference-grid">
        <div className="as-diff-card">
          <div className="as-diff-icon">💳</div>
          <b>Flexible Monthly EMI Plans</b>
          <p>Pre-approved financing from 15+ leading banks with zero down payment options and paperless instant KYC.</p>
        </div>
        <div className="as-diff-card">
          <div className="as-diff-icon">🛡️</div>
          <b>200+ Point Inspection</b>
          <p>Rigorous mechanical checks, battery health diagnostics, and clear title history guaranteed on all cars.</p>
        </div>
        <div className="as-diff-card">
          <div className="as-diff-icon">🔄</div>
          <b>7-Day Money Back Guarantee</b>
          <p>Drive it for a week. If you don't love it, return it for a 100% refund without questions asked.</p>
        </div>
        <div className="as-diff-card">
          <div className="as-diff-icon">🚚</div>
          <b>Free Doorstep Delivery</b>
          <p>Delivered fully detailed and sanitized to your doorstep with instant digital registration transfer.</p>
        </div>
      </div>

      {/* Top SUVs Section */}
      {suvs.length > 0 && (
        <>
          <div className="as-section-head">
            <h2 className="as-section-title">
              Popular SUVs. <span>Space, power, and road presence.</span>
            </h2>
            <Link className="as-section-link" to="/search?body=SUV">Explore SUVs ›</Link>
          </div>
          <div className="as-grid">
            {suvs.map(c => <AppleCarCard key={c.id} c={c} tag="🚙 CERTIFIED SUV" badgeType="badge-suv" />)}
          </div>
        </>
      )}

      {/* Electric Section */}
      {evs.length > 0 && (
        <>
          <div className="as-section-head">
            <h2 className="as-section-title">
              Electric Vehicles. <span>The future of driving, available today.</span>
            </h2>
            <Link className="as-section-link" to="/search?q=electric">Explore EVs ›</Link>
          </div>
          <div className="as-grid">
            {evs.map(c => <AppleCarCard key={c.id} c={c} tag="⚡ ZERO EMISSIONS" badgeType="badge-electric" />)}
          </div>
        </>
      )}

      {/* Customer Stories & Reviews Showcase */}
      <div className="as-section-head" style={{ marginTop: 56 }}>
        <h2 className="as-section-title">
          Real Owners. Real Journeys. <span>Trusted by over 45,000 drivers across India.</span>
        </h2>
        <Link className="as-section-link" to="/reviews">Read verified reviews ›</Link>
      </div>

      <div className="as-reviews-grid">
        {CUSTOMER_REVIEWS.map((rev) => (
          <div key={rev.name} className="as-review-card">
            <div>
              <div className="as-review-stars">{'★'.repeat(rev.stars)}</div>
              <p className="as-review-text">"{rev.text}"</p>
            </div>
            <div className="as-review-author">
              <div className="as-review-avatar">{rev.initials}</div>
              <div className="as-review-author-info">
                <b>{rev.name}</b>
                <span>{rev.car} · {rev.location}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Luxury Trade-In Banner */}
      <div className="as-tradein-banner">
        <div style={{ maxWidth: 640 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0284c7', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            STRATOS TRADE-IN & VALUATION
          </span>
          <h2 style={{ fontSize: 30, margin: '8px 0 10px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
            Sell or trade in your car for instant credit.
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: 15, lineHeight: 1.55 }}>
            Get an instant AI valuation in 60 seconds with our market pricing engine. We pick up from your doorstep with same-day escrow account settlement.
          </p>
        </div>
        <Link to="/sell" className="as-pill-btn" style={{ padding: '14px 28px', fontSize: 15 }}>
          Get Instant Valuation Estimate ›
        </Link>
      </div>
    </div>
  );
}

export function AppleCarCard({ c, tag = 'VERIFIED DEALER', badgeType = 'badge-dealer' }) {
  const [liked, setLiked] = useState(false);
  const estEmi = Math.round(Number(c.price) * 0.016);
  const imgUrl = getVehiclePrimaryImage(c);

  return (
    <article className="as-card">
      <div className="am-thumb">
        <span className={`as-card-badge ${badgeType}`}>
          {tag}
        </span>
        <button
          type="button"
          className={`as-heart-btn ${liked ? 'liked' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLiked(!liked);
          }}
          title={liked ? 'Saved to Favorites' : 'Add to Favorites'}
        >
          {liked ? '❤️' : '🤍'}
        </button>
        <img
          src={imgUrl}
          alt={`${c.make} ${c.model}`}
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/vehicles/default.jpg';
          }}
        />
      </div>
      <div className="am-card-body">
        <div>
          <h3 className="as-card-model">
            <Link to={`/vehicles/${c.id}`}>{c.make} {c.model}</Link>
          </h3>
          <div className="as-specs-row">
            <span className="as-spec-pill">{c.year}</span>
            <span className="as-spec-pill">🛣️ {fmtKm(c.mileage)}</span>
            <span className="as-spec-pill">⛽ {c.fuel}</span>
            <span className="as-spec-pill">🕹️ {c.transmission}</span>
          </div>
          <span className="as-price-tag">{fmtPrice(c.price)}</span>
          <div className="as-emi-pill">
            Or ${estEmi.toLocaleString('en-US')}/mo. with zero down
          </div>
        </div>

        <div className="as-card-actions">
          <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>
            📍 {c.location}
          </span>
          <Link to={`/vehicles/${c.id}`} className="as-pill-btn">
            Explore ›
          </Link>
        </div>
      </div>
    </article>
  );
}
