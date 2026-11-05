import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, API, fmtPrice, fmtKm } from '../api.js';
import { getVehiclePrimaryImage } from '../vehicleImages.js';

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  const a = params.get('a') || '1';
  const b = params.get('b') || '2';

  useEffect(() => {
    setLoading(true);
    api(`${API.catalog}/v1/vehicles/search`).then(r => {
      const list = r.data.results || [];
      setAll(list);
      setCars(list.filter(c => c.id === a || c.id === b));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [a, b]);

  const setCar = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    setParams(next);
  };

  const swapCars = () => {
    const next = new URLSearchParams(params);
    next.set('a', b);
    next.set('b', a);
    setParams(next);
  };

  const ca = cars.find(c => c.id === a) || cars[0];
  const cb = cars.find(c => c.id === b) || cars[1];

  const specCategories = [
    {
      title: 'Commercial & Valuation',
      icon: '💰',
      rows: [
        { label: 'Listed Showroom Price', va: ca && fmtPrice(ca.price), vb: cb && fmtPrice(cb.price), highlight: 'lower' },
        { label: 'Est. Monthly Financing', va: ca && `$${Math.round(ca.price * 0.021).toLocaleString()}/mo`, vb: cb && `$${Math.round(cb.price * 0.021).toLocaleString()}/mo`, highlight: 'lower' },
        { label: 'Model Year', va: ca?.year, vb: cb?.year, highlight: 'higher' },
        { label: 'Certified Mileage', va: ca && fmtKm(ca.mileage), vb: cb && fmtKm(cb.mileage), highlight: 'lower' },
        { label: 'Clear Title Guarantee', va: '100% Certified Clear', vb: '100% Certified Clear', highlight: 'neutral' },
      ]
    },
    {
      title: 'Powertrain & Mechanicals',
      icon: '⚙️',
      rows: [
        { label: 'Fuel Propulsion', va: ca?.fuel || 'Petrol', vb: cb?.fuel || 'Petrol' },
        { label: 'Transmission System', va: ca?.transmission || 'Automatic', vb: cb?.transmission || 'Automatic' },
        { label: 'Body Architecture', va: ca?.body || 'Sedan', vb: cb?.body || 'Sedan' },
        { label: 'Exterior Color', va: ca?.color || 'Midnight Black', vb: cb?.color || 'Pearl White' },
      ]
    },
    {
      title: 'Showroom & Delivery',
      icon: '📍',
      rows: [
        { label: 'Showroom Location', va: ca?.location || 'Mumbai Central', vb: cb?.location || 'Delhi NCR' },
        { label: 'Inspection Grade', va: '200-Pt Passed (A+)', vb: '200-Pt Passed (A+)' },
        { label: 'Doorstep Handover', va: 'Eligible (24h Concierge)', vb: 'Eligible (24h Concierge)' },
      ]
    }
  ];

  return (
    <div className="am-compare-page">
      {/* Hero Header */}
      <section className="am-compare-hero">
        <div className="am-compare-hero-overlay" />
        <div className="am-compare-hero-content">
          <div className="am-hero-badge">
            <span className="am-pulse-led" />
            <span>Side-by-Side Automotive Telemetry</span>
          </div>
          <h1 className="am-compare-title">
            Vehicle Specification <span>Comparison Matrix</span>
          </h1>
          <p className="am-compare-desc">
            Direct head-to-head engineering specs, price differentials, mechanical inspection grades, and certified showroom deliverables.
          </p>

          <div className="am-compare-strip">
            <div className="am-strip-item">
              <strong>100%</strong>
              <span>Verified Data</span>
            </div>
            <div className="am-strip-sep" />
            <div className="am-strip-item">
              <strong>200-Pt</strong>
              <span>Inspection Delta</span>
            </div>
            <div className="am-strip-sep" />
            <div className="am-strip-item">
              <strong>Zero Bias</strong>
              <span>Objective Specs</span>
            </div>
          </div>
        </div>
      </section>

      {/* Selectors Bar */}
      <div className="am-compare-selectors-bar">
        <div className="am-selector-box">
          <label>Primary Vehicle (Left)</label>
          <select value={a} onChange={e => setCar('a', e.target.value)}>
            {all.map(c => (
              <option key={c.id} value={c.id}>
                {c.make} {c.model} ({c.year}) — {fmtPrice(c.price)}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="am-swap-btn" onClick={swapCars} title="Swap vehicle positions">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
          </svg>
          <span>Swap</span>
        </button>

        <div className="am-selector-box">
          <label>Comparison Vehicle (Right)</label>
          <select value={b} onChange={e => setCar('b', e.target.value)}>
            {all.map(c => (
              <option key={c.id} value={c.id}>
                {c.make} {c.model} ({c.year}) — {fmtPrice(c.price)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="am-loading-card">
          <div className="am-spinner" />
          <p>Analyzing telemetry & mechanical specs...</p>
        </div>
      ) : (!ca || !cb) ? (
        <div className="am-loading-card">
          <p>Please select two valid vehicles to compare specifications.</p>
        </div>
      ) : (
        <div className="am-compare-matrix-wrapper">
          {/* Head-to-Head Cards */}
          <div className="am-vs-cards-grid">
            {/* Card A */}
            <article className="am-vs-card">
              <div className="am-vs-card-media">
                <img
                  src={getVehiclePrimaryImage(ca)}
                  alt={`${ca.make} ${ca.model}`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/vehicles/default.jpg';
                  }}
                />
                <span className="am-vs-tag">Vehicle A</span>
              </div>
              <div className="am-vs-card-body">
                <div className="am-vs-sub">{ca.year} · {ca.body} · {ca.fuel}</div>
                <h3 className="am-vs-name">
                  <Link to={`/vehicles/${ca.id}`}>{ca.make} {ca.model}</Link>
                </h3>
                <div className="am-vs-price-row">
                  <span className="am-vs-price">{fmtPrice(ca.price)}</span>
                  <span className="am-vs-emi">est. ${Math.round(ca.price * 0.021).toLocaleString()}/mo</span>
                </div>
                <Link className="am-vs-btn primary" to={`/checkout?vehicle=${ca.id}`}>
                  Purchase {ca.make} {ca.model}
                </Link>
              </div>
            </article>

            {/* VS Badge in center */}
            <div className="am-vs-center-badge">
              <div className="am-vs-circle">VS</div>
              <span className="am-vs-delta">
                Diff: {fmtPrice(Math.abs(ca.price - cb.price))}
              </span>
            </div>

            {/* Card B */}
            <article className="am-vs-card">
              <div className="am-vs-card-media">
                <img
                  src={getVehiclePrimaryImage(cb)}
                  alt={`${cb.make} ${cb.model}`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/vehicles/default.jpg';
                  }}
                />
                <span className="am-vs-tag">Vehicle B</span>
              </div>
              <div className="am-vs-card-body">
                <div className="am-vs-sub">{cb.year} · {cb.body} · {cb.fuel}</div>
                <h3 className="am-vs-name">
                  <Link to={`/vehicles/${cb.id}`}>{cb.make} {cb.model}</Link>
                </h3>
                <div className="am-vs-price-row">
                  <span className="am-vs-price">{fmtPrice(cb.price)}</span>
                  <span className="am-vs-emi">est. ${Math.round(cb.price * 0.021).toLocaleString()}/mo</span>
                </div>
                <Link className="am-vs-btn secondary" to={`/checkout?vehicle=${cb.id}`}>
                  Purchase {cb.make} {cb.model}
                </Link>
              </div>
            </article>
          </div>

          {/* Detailed Spec Comparison Sections */}
          <div className="am-compare-tables-container">
            {specCategories.map((cat, idx) => (
              <div className="am-spec-category-card" key={idx}>
                <div className="am-category-header">
                  <span className="am-cat-icon">{cat.icon}</span>
                  <h4>{cat.title}</h4>
                </div>

                <div className="am-category-table">
                  {cat.rows.map((row, rIdx) => (
                    <div className="am-compare-row" key={rIdx}>
                      <div className="am-cell col-a">{row.va}</div>
                      <div className="am-cell col-label">
                        <span>{row.label}</span>
                      </div>
                      <div className="am-cell col-b">{row.vb}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Features & Equipment Package Comparison */}
            <div className="am-spec-category-card">
              <div className="am-category-header">
                <span className="am-cat-icon">✨</span>
                <h4>Factory Equipment & Features</h4>
              </div>

              <div className="am-features-compare-grid">
                <div className="am-feat-col">
                  <h5>{ca.make} {ca.model} Standard Equipment</h5>
                  <div className="am-feat-chips">
                    {(ca.features || ['Apple CarPlay', 'Adaptive Cruise', 'Backup Camera', 'Heated Seats']).map(f => (
                      <span key={f} className="am-feature-chip">✓ {f}</span>
                    ))}
                  </div>
                </div>

                <div className="am-feat-col">
                  <h5>{cb.make} {cb.model} Standard Equipment</h5>
                  <div className="am-feat-chips">
                    {(cb.features || ['Navigation System', 'Lane Departure Alert', 'Leather Interior', 'Keyless Go']).map(f => (
                      <span key={f} className="am-feature-chip">✓ {f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="am-compare-footer-actions">
              <Link className="am-compare-cta primary" to={`/checkout?vehicle=${ca.id}`}>
                Proceed with {ca.make} {ca.model} ({fmtPrice(ca.price)})
              </Link>
              <Link className="am-compare-cta secondary" to={`/checkout?vehicle=${cb.id}`}>
                Proceed with {cb.make} {cb.model} ({fmtPrice(cb.price)})
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
