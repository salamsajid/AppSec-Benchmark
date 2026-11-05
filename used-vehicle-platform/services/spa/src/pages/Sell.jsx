import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API, fmtPrice } from '../api.js';

const QUICK_PRESETS = [
  { make: 'Porsche', model: '911 Carrera S', year: '2023', price: '124000', mileage: '12500', fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'GT Silver', location: 'Beverly Hills, CA', description: 'Immaculate single-owner 992 Carrera S. Sport Chrono Package, PASM Sport Suspension, full front PPF.' },
  { make: 'BMW', model: 'M4 Competition', year: '2022', price: '78500', mileage: '18200', fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'Isle of Man Green', location: 'Miami, FL', description: 'Carbon package, Executive package, laser lights, M-Carbon bucket seats. Always garaged and dealer maintained.' },
  { make: 'Mercedes-Benz', model: 'AMG C63 S', year: '2021', price: '69000', mileage: '24000', fuel: 'Petrol', transmission: 'Automatic', body: 'Sedan', color: 'Obsidian Black', location: 'New York, NY', description: 'Twin-turbo 4.0L V8 AMG performance exhaust, Burmester 3D surround sound, Driver Assistance suite.' },
  { make: 'Tesla', model: 'Model S Plaid', year: '2023', price: '86000', mileage: '14100', fuel: 'Electric', transmission: 'Automatic', body: 'Sedan', color: 'Deep Blue Metallic', location: 'Austin, TX', description: 'Tri-motor AWD 1,020 HP. Full Self-Driving enabled, 21-inch Arachnid wheels, cream premium interior.' },
  { make: 'Audi', model: 'RS5 Sportback', year: '2022', price: '72500', mileage: '19800', fuel: 'Petrol', transmission: 'Automatic', body: 'Coupe', color: 'Nardo Grey', location: 'San Francisco, CA', description: 'Dynamic package, RS sport exhaust, ceramic front brakes, Bang & Olufsen sound, carbon optic exterior.' },
];

export default function Sell() {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    make: '',
    model: '',
    year: '',
    price: '',
    mileage: '',
    fuel: 'Petrol',
    transmission: 'Automatic',
    body: 'Sedan',
    color: '',
    location: '',
    description: ''
  });
  const [photoUrl, setPhotoUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [listingId, setListingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const nav = useNavigate();

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const applyPreset = (preset) => {
    setF({ ...preset });
    setMsg(`Loaded specs for ${preset.year} ${preset.make} ${preset.model}`);
  };

  const create = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const r = await fetch(`${API.catalog}/v1/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          price: Number(f.price),
          year: Number(f.year),
          mileage: Number(f.mileage)
        }),
      }).then(x => x.json());

      if (r.id) {
        setListingId(r.id);
        setMsg(`Listed! Your vehicle id is ${r.id}.`);
        setStep(3);
      } else {
        setMsg(typeof r === 'object' ? JSON.stringify(r).slice(0, 200) : String(r));
      }
    } catch (err) {
      setMsg(`Submission error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const importUrl = async (e) => {
    e.preventDefault();
    if (!photoUrl) return;
    setImporting(true);
    try {
      const r = await fetch(`${API.lead}/v1/listings/import-photos?url=${encodeURIComponent(photoUrl)}`).then(x => x.json());
      setMsg(`Photo Import Result: ${JSON.stringify(r).slice(0, 300)}`);
    } catch (err) {
      setMsg(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e) => {
    if (e.target.files) {
      const names = Array.from(e.target.files).map(file => file.name);
      setUploadedFiles(prev => [...prev, ...names]);
      setMsg(`Added ${names.length} appraisal photograph(s) for diagnostic inspection.`);
    }
  };

  // Dynamic Valuation Estimator calculations
  const rawPrice = Number(f.price) || 45000;
  const estimatedTradeOffer = Math.round(rawPrice * 0.91);
  const estimatedRetailValue = Math.round(rawPrice * 1.05);
  const showroomExchangeCredit = estimatedTradeOffer + 1500;

  return (
    <div className="am-tradein-page">
      {/* Luxury Hero Banner */}
      <section className="am-tradein-hero">
        <div className="am-tradein-hero-overlay" />
        <div className="am-tradein-hero-content">
          <div className="am-hero-badge">
            <span className="am-pulse-led" />
            <span>AI Automated Trade-In & Valuation Studio</span>
          </div>
          <h1 className="am-tradein-title">
            Instant Algorithmic <span>Appraisal & Direct Trade-In</span>
          </h1>
          <p className="am-tradein-subtitle">
            Unlock maximum equity with our optical diagnostic scanner, live dealer network pricing, and guaranteed same-day showroom exchange credit.
          </p>

          <div className="am-tradein-kpi-bar">
            <div className="am-kpi-pill">
              <span className="am-kpi-num">2-Min</span>
              <span className="am-kpi-txt">Instant Valuation</span>
            </div>
            <div className="am-kpi-sep" />
            <div className="am-kpi-pill">
              <span className="am-kpi-num">+$1,500</span>
              <span className="am-kpi-txt">Showroom Trade Equity</span>
            </div>
            <div className="am-kpi-sep" />
            <div className="am-kpi-pill">
              <span className="am-kpi-num">100% Free</span>
              <span className="am-kpi-txt">Zero Obligation Offer</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Step Bar */}
      <div className="am-tradein-steps-bar">
        <button
          type="button"
          className={`am-tradein-step-btn ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}
          onClick={() => setStep(1)}
        >
          <span className="am-step-num">01</span>
          <div className="am-step-meta">
            <strong>Vehicle Specifications</strong>
            <small>Mechanical & Chassis Telemetry</small>
          </div>
        </button>

        <div className="am-step-line" />

        <button
          type="button"
          className={`am-tradein-step-btn ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}
          onClick={() => setStep(2)}
        >
          <span className="am-step-num">02</span>
          <div className="am-step-meta">
            <strong>Photo Appraisal & Media</strong>
            <small>High-Res Visual Diagnostic</small>
          </div>
        </button>

        <div className="am-step-line" />

        <button
          type="button"
          className={`am-tradein-step-btn ${step === 3 ? 'active' : ''}`}
          onClick={() => setStep(3)}
        >
          <span className="am-step-num">03</span>
          <div className="am-step-meta">
            <strong>Certified Valuation</strong>
            <small>Official Trade-In Certificate</small>
          </div>
        </button>
      </div>

      {/* Main Grid Content */}
      <div className="am-tradein-layout">
        {/* Left / Main Workspace Area */}
        <div className="am-tradein-main">
          {step === 1 && (
            <div className="am-tradein-card">
              <div className="am-card-header">
                <div>
                  <h2 className="am-card-title">1. Vehicle Specifications & Condition</h2>
                  <p className="am-card-desc">Enter your vehicle details or click any luxury preset to instantly populate market parameters.</p>
                </div>
              </div>

              {/* Quick Spec Presets */}
              <div className="am-preset-chips-row">
                <span className="am-preset-label">Quick Fill Presets:</span>
                <div className="am-preset-buttons">
                  {QUICK_PRESETS.map(p => (
                    <button
                      type="button"
                      key={p.model}
                      className="am-preset-chip"
                      onClick={() => applyPreset(p)}
                    >
                      ⚡ {p.year} {p.make} {p.model}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={create} className="am-tradein-form">
                <div className="am-form-grid-2">
                  <div className="am-field">
                    <label>Make / Marque *</label>
                    <input
                      required
                      value={f.make}
                      onChange={e => set('make', e.target.value)}
                      placeholder="e.g. Porsche, BMW, Mercedes"
                      className="am-input"
                    />
                  </div>
                  <div className="am-field">
                    <label>Model & Trim *</label>
                    <input
                      required
                      value={f.model}
                      onChange={e => set('model', e.target.value)}
                      placeholder="e.g. 911 Carrera S, M4 Competition"
                      className="am-input"
                    />
                  </div>
                </div>

                <div className="am-form-grid-3">
                  <div className="am-field">
                    <label>Model Year *</label>
                    <input
                      required
                      type="number"
                      min="1990"
                      max="2027"
                      value={f.year}
                      onChange={e => set('year', e.target.value)}
                      placeholder="e.g. 2022"
                      className="am-input"
                    />
                  </div>
                  <div className="am-field">
                    <label>Asking / Market Price ($) *</label>
                    <input
                      required
                      type="number"
                      value={f.price}
                      onChange={e => set('price', e.target.value)}
                      placeholder="e.g. 74500"
                      className="am-input"
                    />
                  </div>
                  <div className="am-field">
                    <label>Odometer Mileage (mi) *</label>
                    <input
                      required
                      type="number"
                      value={f.mileage}
                      onChange={e => set('mileage', e.target.value)}
                      placeholder="e.g. 18500"
                      className="am-input"
                    />
                  </div>
                </div>

                <div className="am-form-grid-3">
                  <div className="am-field">
                    <label>Fuel Propulsion</label>
                    <select value={f.fuel} onChange={e => set('fuel', e.target.value)} className="am-select">
                      {['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid'].map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="am-field">
                    <label>Transmission Type</label>
                    <select value={f.transmission} onChange={e => set('transmission', e.target.value)} className="am-select">
                      {['Automatic', 'Manual', 'PDK / Dual-Clutch', 'CVT', 'Direct Drive'].map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="am-field">
                    <label>Body Architecture</label>
                    <select value={f.body} onChange={e => set('body', e.target.value)} className="am-select">
                      {['Sedan', 'Coupe', 'SUV', 'Convertible', 'Hatchback', 'Wagon'].map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                </div>

                <div className="am-form-grid-2">
                  <div className="am-field">
                    <label>Exterior Factory Color</label>
                    <input
                      value={f.color}
                      onChange={e => set('color', e.target.value)}
                      placeholder="e.g. Chalk Grey, Midnight Blue"
                      className="am-input"
                    />
                  </div>
                  <div className="am-field">
                    <label>Showroom / Vehicle Location</label>
                    <input
                      value={f.location}
                      onChange={e => set('location', e.target.value)}
                      placeholder="e.g. Beverly Hills, CA"
                      className="am-input"
                    />
                  </div>
                </div>

                <div className="am-field">
                  <label>Mechanical Condition, Packages & Options</label>
                  <textarea
                    rows={3}
                    value={f.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Describe maintenance records, ceramic coating, clean Carfax status, factory packages, and tires..."
                    className="am-textarea"
                  />
                </div>

                <div className="am-form-actions">
                  <button className="am-btn primary-glow" type="submit" disabled={submitting}>
                    {submitting ? 'Submitting Valuation Telemetry...' : '⚡ Submit Vehicle & Generate Offer'}
                  </button>
                  <button className="am-btn outline" type="button" onClick={() => setStep(2)}>
                    Skip to Photo Appraisal →
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="am-tradein-card">
              <div className="am-card-header">
                <div>
                  <h2 className="am-card-title">2. High-Resolution Visual Inspection & SSRF Photo Ingestion</h2>
                  <p className="am-card-desc">Upload vehicle photos for laser body panel analysis or import assets directly from remote dealership servers.</p>
                </div>
              </div>

              {/* Photo Upload Zone */}
              <div className="am-dropzone-box">
                <div className="am-dropzone-icon">📷</div>
                <div className="am-dropzone-text">
                  <strong>Drag & drop high-resolution photographs</strong>
                  <span>Supports front 3/4, odometer cluster, interior leather, tire tread, and engine bay</span>
                </div>
                <label className="am-upload-trigger-btn">
                  Browse Device Files
                  <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="am-uploaded-chips">
                  {uploadedFiles.map((fn, idx) => (
                    <span key={idx} className="am-uploaded-chip">
                      ✓ {fn}
                    </span>
                  ))}
                </div>
              )}

              {/* URL Import SSRF Form */}
              <div className="am-url-import-panel">
                <div className="am-import-badge">
                  <span>Remote Image Ingestion Protocol</span>
                </div>
                <h4 style={{ margin: '10px 0 6px 0', fontSize: '15px' }}>Import Remote Inspection Photographs via URI</h4>
                <p className="am-muted" style={{ fontSize: '13px', marginBottom: '14px' }}>
                  Synchronize showroom photos hosted on external dealer servers, cloud buckets, or inspection webhooks.
                </p>

                <form onSubmit={importUrl} className="am-url-import-form">
                  <div className="am-import-input-row">
                    <input
                      className="am-input"
                      style={{ flex: 1 }}
                      placeholder="https://dealer-assets.cdn.internal/vehicles/photo-bundle.jpg"
                      value={photoUrl}
                      onChange={e => setPhotoUrl(e.target.value)}
                    />
                    <button className="am-btn secondary" type="submit" disabled={importing}>
                      {importing ? 'Connecting...' : 'Fetch Photo'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="am-form-actions" style={{ marginTop: '24px' }}>
                <button className="am-btn outline" type="button" onClick={() => setStep(1)}>
                  ← Back to Specifications
                </button>
                <button className="am-btn primary-glow" type="button" onClick={() => setStep(3)}>
                  Proceed to Certified Valuation →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="am-tradein-card am-success-card">
              <div className="am-success-header">
                <div className="am-success-icon-badge">🎉</div>
                <h2 className="am-card-title">Vehicle Appraisal Certified & Active!</h2>
                <p className="am-card-desc">
                  Your vehicle appraisal report has been registered in the catalog and broadcast to our verified network of 280+ luxury dealerships.
                </p>
              </div>

              <div className="am-certificate-box">
                <div className="am-cert-header">
                  <div>
                    <span className="am-cert-pill">OFFICIAL CERTIFICATE OF APPRAISAL</span>
                    <h3 style={{ margin: '6px 0 0 0', fontSize: '18px' }}>
                      {f.year || '2023'} {f.make || 'Certified'} {f.model || 'Vehicle'}
                    </h3>
                  </div>
                  <div className="am-cert-id">
                    <span>Listing ID</span>
                    <strong>#{listingId || '7942'}</strong>
                  </div>
                </div>

                <div className="am-cert-metrics">
                  <div className="am-cert-metric">
                    <label>Instant Trade-In Credit</label>
                    <div className="am-val-highlight">{fmtPrice(showroomExchangeCredit)}</div>
                    <small>Valid towards any showroom vehicle</small>
                  </div>
                  <div className="am-cert-metric">
                    <label>Outright Cash Offer</label>
                    <div className="am-val-strong">{fmtPrice(estimatedTradeOffer)}</div>
                    <small>Same-day wire or bank transfer</small>
                  </div>
                  <div className="am-cert-metric">
                    <label>Private Market Benchmark</label>
                    <div>{fmtPrice(estimatedRetailValue)}</div>
                    <small>Based on live algorithmic indexing</small>
                  </div>
                </div>

                <div className="am-cert-footer">
                  <span className="am-cert-guarantee">🛡️ 7-Day / 500-Mile Price Lock Guarantee</span>
                  <span className="am-cert-timestamp">Appraised: Just Now</span>
                </div>
              </div>

              <div className="am-form-actions" style={{ justifyContent: 'center', marginTop: '28px' }}>
                <Link className="am-btn primary-glow" to="/search" style={{ textDecoration: 'none' }}>
                  Browse Showroom Inventory with Trade-In Credit →
                </Link>
                <button className="am-btn outline" type="button" onClick={() => nav('/')}>
                  Back to Showroom
                </button>
              </div>
            </div>
          )}

          {msg && (
            <div className="am-note am-tradein-feedback">
              <div className="am-note-icon">ℹ️</div>
              <div className="am-note-msg">{msg}</div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Dynamic Valuation Summary & Perks */}
        <aside className="am-tradein-sidebar">
          {/* Live Valuation Card */}
          <div className="am-sidebar-widget am-valuation-summary-card">
            <div className="am-widget-header">
              <span className="am-widget-tag">Live Market Index</span>
              <h3>Algorithmic Valuation</h3>
            </div>

            <div className="am-summary-vehicle">
              <strong>{f.year || '2023'} {f.make || 'Luxury'} {f.model || 'Model'}</strong>
              <span>{f.mileage ? `${Number(f.mileage).toLocaleString()} mi` : 'Estimated ~15k mi'} · {f.transmission || 'Automatic'}</span>
            </div>

            <div className="am-valuation-display">
              <div className="am-val-label">Instant Trade-In Value</div>
              <div className="am-val-amount">{fmtPrice(estimatedTradeOffer)}</div>
              <div className="am-val-range">Market Span: {fmtPrice(estimatedTradeOffer * 0.95)} – {fmtPrice(estimatedTradeOffer * 1.08)}</div>
            </div>

            <div className="am-bonus-box">
              <div className="am-bonus-badge">+ $1,500 Trade Bonus</div>
              <p>Apply this vehicle toward any certified inventory vehicle today to unlock a $1,500 showroom upgrade incentive.</p>
              <div className="am-bonus-total">
                <span>Total Showroom Purchasing Power:</span>
                <strong>{fmtPrice(showroomExchangeCredit)}</strong>
              </div>
            </div>

            <div className="am-inspection-checklist">
              <div className="am-check-item">
                <span className="am-check-ok">✓</span>
                <span>Real-time algorithmic depreciation curve analysis</span>
              </div>
              <div className="am-check-item">
                <span className="am-check-ok">✓</span>
                <span>Title history and Carfax lien verification</span>
              </div>
              <div className="am-check-item">
                <span className="am-check-ok">✓</span>
                <span>Complimentary doorstep concierge appraisal</span>
              </div>
            </div>
          </div>

          {/* Trade-In Advantages Card */}
          <div className="am-sidebar-widget am-advantages-card">
            <h4>Why Trade-In with UVP?</h4>
            <div className="am-advantage-item">
              <div className="am-adv-icon">⚡</div>
              <div>
                <strong>Zero Selling Hassle</strong>
                <p>No sketchy private buyers, no test drives with strangers, no haggling.</p>
              </div>
            </div>
            <div className="am-advantage-item">
              <div className="am-adv-icon">💰</div>
              <div>
                <strong>Sales Tax Advantage</strong>
                <p>In most states, only pay sales tax on the trade-in price difference.</p>
              </div>
            </div>
            <div className="am-advantage-item">
              <div className="am-adv-icon">🏎️</div>
              <div>
                <strong>Seamless Key-for-Key Swap</strong>
                <p>Drive your current car in, drive your dream certified vehicle home.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
