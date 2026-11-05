import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const CREDIT_TIERS = [
  { id: 'diamond', label: 'Super Prime (780+)', rate: 5.4, badge: 'Lowest APR' },
  { id: 'platinum', label: 'Prime (720–779)', rate: 6.8, badge: 'Popular' },
  { id: 'gold', label: 'Near Prime (660–719)', rate: 8.5, badge: 'Standard' },
  { id: 'custom', label: 'Custom APR', rate: null, badge: 'Bespoke' },
];

const TERM_OPTIONS = [24, 36, 48, 60, 72, 84];

const PREFERRED_LENDERS = [
  { name: 'UVP Capital Direct', tier: 'Exclusive Preferred', rate: '5.4% APR', origination: '$0 Fee', approval: 'Instant 60-Sec', perks: 'No prepayment penalties, rate match guarantee' },
  { name: 'Chase Auto Premier', tier: 'National Partner', rate: '5.8% APR', origination: '$0 Fee', approval: 'Same-Day', perks: '90-day first payment deferral option' },
  { name: 'Bank of America Private Client', tier: 'Preferred Banking', rate: '6.2% APR', origination: '$0 Fee', approval: '1 Business Day', perks: '0.50% interest rate discount for platinum deposit members' },
  { name: 'Capital One Auto Navigator', tier: 'Tier-1 Network', rate: '6.9% APR', origination: '$0 Fee', approval: 'Pre-Approved', perks: 'Real-time soft pull pre-qualification' },
];

export default function Emi() {
  const [mode, setMode] = useState('loan'); // 'loan' | 'lease'
  const [price, setPrice] = useState(48000);
  const [down, setDown] = useState(9600); // default 20%
  const [creditTier, setCreditTier] = useState('diamond');
  const [customRate, setCustomRate] = useState(6.5);
  const [months, setMonths] = useState(60);
  const [showSchedule, setShowSchedule] = useState(false);
  const [lockedMsg, setLockedMsg] = useState('');

  // Effective rate
  const selectedTier = CREDIT_TIERS.find(t => t.id === creditTier);
  const rate = selectedTier && selectedTier.rate !== null ? selectedTier.rate : customRate;

  // Loan calculation
  const principal = Math.max(0, price - down);
  const monthlyRate = (rate / 100) / 12;
  const n = months;

  let emi = 0;
  if (mode === 'loan') {
    if (monthlyRate > 0 && n > 0) {
      emi = principal * monthlyRate * Math.pow(1 + monthlyRate, n) / (Math.pow(1 + monthlyRate, n) - 1);
    } else if (n > 0) {
      emi = principal / n;
    }
  } else {
    // Executive Lease calculation: 36/48 mo, 54% residual
    const residualFactor = 0.54;
    const residualValue = price * residualFactor;
    const depreciation = (price - down - residualValue) / n;
    const moneyFactor = (rate / 100) / 24;
    const financeFee = (price - down + residualValue) * moneyFactor;
    emi = Math.max(0, depreciation + financeFee);
  }

  const totalPayable = mode === 'loan' ? (emi * n) + down : (emi * n) + down;
  const totalInterest = Math.max(0, totalPayable - price);
  const principalPct = totalPayable > 0 ? Math.min(100, Math.round((price / totalPayable) * 100)) : 100;
  const interestPct = Math.max(0, 100 - principalPct);

  const fmt = (v) => '$' + Math.round(v || 0).toLocaleString('en-US');

  const setDownPercentage = (pct) => {
    setDown(Math.round(price * (pct / 100)));
  };

  // Generate schedule rows (first 12 months)
  const scheduleRows = [];
  let balance = principal;
  for (let m = 1; m <= Math.min(n, 12); m++) {
    const interestPart = balance * monthlyRate;
    const principalPart = Math.min(balance, emi - interestPart);
    balance = Math.max(0, balance - principalPart);
    scheduleRows.push({
      month: m,
      payment: emi,
      principal: principalPart,
      interest: interestPart,
      balance: balance
    });
  }

  const handleLockRate = (lenderName) => {
    setLockedMsg(`🎉 Rate pre-approval code [UVP-APR-${Math.floor(100000 + Math.random() * 900000)}] locked with ${lenderName}! Valid for 30 calendar days.`);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="am-finance-page">
      {/* Luxury Hero Banner */}
      <section className="am-finance-hero">
        <div className="am-finance-hero-overlay" />
        <div className="am-finance-hero-content">
          <div className="am-hero-badge">
            <span className="am-pulse-led" />
            <span>Executive Automotive Financial Suite</span>
          </div>
          <h1 className="am-finance-title">
            Precision Automotive Financing <span>& Smart EMI Calculator</span>
          </h1>
          <p className="am-finance-subtitle">
            Structure your bespoke loan or executive lease with real-time prime rates, transparent amortization telemetry, and direct lender pre-approval.
          </p>

          <div className="am-finance-kpi-bar">
            <div className="am-kpi-pill">
              <span className="am-kpi-num">5.4% APR</span>
              <span className="am-kpi-txt">Super Prime Base</span>
            </div>
            <div className="am-kpi-sep" />
            <div className="am-kpi-pill">
              <span className="am-kpi-num">0% Down</span>
              <span className="am-kpi-txt">Options Available</span>
            </div>
            <div className="am-kpi-sep" />
            <div className="am-kpi-pill">
              <span className="am-kpi-num">Soft Pull</span>
              <span className="am-kpi-txt">No Credit Score Impact</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mode Switcher */}
      <div className="am-finance-mode-switch-wrapper">
        <div className="am-finance-mode-switch">
          <button
            type="button"
            className={`am-mode-pill ${mode === 'loan' ? 'active' : ''}`}
            onClick={() => setMode('loan')}
          >
            🏛️ Traditional Retail Loan (Vehicle Ownership)
          </button>
          <button
            type="button"
            className={`am-mode-pill ${mode === 'lease' ? 'active' : ''}`}
            onClick={() => setMode('lease')}
          >
            🏎️ Executive Luxury Lease (Lower Monthly Payment)
          </button>
        </div>
      </div>

      <div className="am-finance-layout">
        {/* Left Column: Interactive Calculator Controls */}
        <div className="am-finance-controls-card">
          <div className="am-card-header">
            <div>
              <h2 className="am-card-title">Financing Parameters</h2>
              <p className="am-card-desc">Adjust price, down payment, credit tier, and loan tenure to calculate live amortized installments.</p>
            </div>
          </div>

          {/* Vehicle On-Road Price */}
          <div className="am-calc-group">
            <div className="am-calc-label-row">
              <label>Vehicle On-Road Price</label>
              <div className="am-val-input-wrap">
                <span className="am-currency-symbol">$</span>
                <input
                  type="number"
                  min="5000"
                  max="350000"
                  step="500"
                  value={price}
                  onChange={e => setPrice(Number(e.target.value) || 0)}
                  className="am-calc-num-input"
                />
              </div>
            </div>
            <input
              type="range"
              min="10000"
              max="250000"
              step="1000"
              value={price}
              onChange={e => setPrice(Number(e.target.value))}
              className="am-range-slider"
            />
            <div className="am-quick-chips">
              {[25000, 45000, 75000, 110000, 185000].map(val => (
                <button
                  type="button"
                  key={val}
                  className={`am-chip-btn ${price === val ? 'selected' : ''}`}
                  onClick={() => setPrice(val)}
                >
                  ${(val / 1000)}k
                </button>
              ))}
            </div>
          </div>

          {/* Down Payment */}
          <div className="am-calc-group">
            <div className="am-calc-label-row">
              <div>
                <label>Down Payment / Trade-In Equity</label>
                <span className="am-calc-sublabel">
                  ({price > 0 ? Math.round((down / price) * 100) : 0}% of vehicle price)
                </span>
              </div>
              <div className="am-val-input-wrap">
                <span className="am-currency-symbol">$</span>
                <input
                  type="number"
                  min="0"
                  max={price}
                  step="500"
                  value={down}
                  onChange={e => setDown(Math.min(price, Number(e.target.value) || 0))}
                  className="am-calc-num-input"
                />
              </div>
            </div>
            <input
              type="range"
              min="0"
              max={price}
              step="500"
              value={down}
              onChange={e => setDown(Number(e.target.value))}
              className="am-range-slider"
            />
            <div className="am-quick-chips">
              {[0, 10, 20, 30, 40].map(pct => (
                <button
                  type="button"
                  key={pct}
                  className={`am-chip-btn ${down === Math.round(price * (pct / 100)) ? 'selected' : ''}`}
                  onClick={() => setDownPercentage(pct)}
                >
                  {pct === 0 ? 'Zero Down' : `${pct}% Down`}
                </button>
              ))}
            </div>
          </div>

          {/* Credit Tier Selector */}
          <div className="am-calc-group">
            <label className="am-group-title">Credit Profile & APR Bracket</label>
            <div className="am-credit-tier-grid">
              {CREDIT_TIERS.map(tier => (
                <button
                  type="button"
                  key={tier.id}
                  className={`am-tier-card ${creditTier === tier.id ? 'active' : ''}`}
                  onClick={() => setCreditTier(tier.id)}
                >
                  <div className="am-tier-top">
                    <strong>{tier.label}</strong>
                    <span className="am-tier-badge">{tier.badge}</span>
                  </div>
                  <div className="am-tier-rate">
                    {tier.rate !== null ? `${tier.rate}% APR` : 'Custom'}
                  </div>
                </button>
              ))}
            </div>

            {creditTier === 'custom' && (
              <div className="am-custom-apr-box">
                <div className="am-calc-label-row">
                  <label>Custom Annual Percentage Rate (APR)</label>
                  <span className="am-val-highlight">{customRate}%</span>
                </div>
                <input
                  type="range"
                  min="3.5"
                  max="18.0"
                  step="0.1"
                  value={customRate}
                  onChange={e => setCustomRate(Number(e.target.value))}
                  className="am-range-slider"
                />
              </div>
            )}
          </div>

          {/* Loan Tenure / Duration */}
          <div className="am-calc-group">
            <div className="am-calc-label-row">
              <label>Financing Term Duration</label>
              <span className="am-val-highlight">{months} Months ({Math.round(months / 12 * 10) / 10} yrs)</span>
            </div>
            <div className="am-term-pill-selector">
              {TERM_OPTIONS.map(m => (
                <button
                  type="button"
                  key={m}
                  className={`am-term-pill ${months === m ? 'active' : ''}`}
                  onClick={() => setMonths(m)}
                >
                  <strong>{m} mo</strong>
                  <small>{m / 12} yrs</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Visual Telemetry, Monthly Payment & Loan Diagnostics */}
        <div className="am-finance-results-col">
          {/* Main Monthly Payment Box */}
          <div className="am-payment-hero-card">
            <div className="am-payment-header">
              <span className="am-payment-tag">
                {mode === 'loan' ? 'Estimated Monthly Payment' : 'Estimated Executive Lease'}
              </span>
              <span className="am-rate-pill">{rate}% Fixed APR</span>
            </div>

            <div className="am-hero-amount-display">
              <span className="am-big-dollar">$</span>
              <span className="am-big-emi">{Math.round(emi).toLocaleString('en-US')}</span>
              <span className="am-big-period">/ month</span>
            </div>

            <div className="am-daily-cost">
              ≈ {fmt(emi / 30)} / day · Based on {months}-month {mode} term
            </div>

            {/* Principal vs Interest Visual Bar */}
            <div className="am-amortization-bar-wrapper">
              <div className="am-amort-legend">
                <span>Principal: {principalPct}% ({fmt(principal)})</span>
                <span>Interest: {interestPct}% ({fmt(totalInterest)})</span>
              </div>
              <div className="am-amort-bar">
                <div className="am-bar-principal" style={{ width: `${principalPct}%` }} />
                <div className="am-bar-interest" style={{ width: `${interestPct}%` }} />
              </div>
            </div>

            {/* Metric Tiles */}
            <div className="am-telemetry-tiles-grid">
              <div className="am-tile">
                <span className="am-tile-lbl">Net Financed Principal</span>
                <strong className="am-tile-val">{fmt(principal)}</strong>
              </div>
              <div className="am-tile">
                <span className="am-tile-lbl">Down Payment Paid</span>
                <strong className="am-tile-val">{fmt(down)}</strong>
              </div>
              <div className="am-tile">
                <span className="am-tile-lbl">Total Finance Charges</span>
                <strong className="am-tile-val">{fmt(totalInterest)}</strong>
              </div>
              <div className="am-tile">
                <span className="am-tile-lbl">Total Cash Outlay</span>
                <strong className="am-tile-val">{fmt(totalPayable)}</strong>
              </div>
            </div>

            <div className="am-payment-actions">
              <button
                type="button"
                className="am-btn primary-glow w-full"
                onClick={() => handleLockRate('UVP Capital Direct')}
              >
                ⚡ Lock In This {rate}% Pre-Approved Rate
              </button>
              <Link to="/search" className="am-btn outline w-full" style={{ textAlign: 'center', textDecoration: 'none' }}>
                Browse Vehicles Under {fmt(emi)}/mo →
              </Link>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="am-finance-disclaimer">
            <span className="am-disclaimer-icon">🛡️</span>
            <span>All estimates include destination fees. Rates subject to final credit underwriting and dealer documentation. No prepayment penalty.</span>
          </div>
        </div>
      </div>

      {/* Preferred Partner Lender Comparison Matrix */}
      <section className="am-lenders-section">
        <div className="am-section-title-wrap">
          <h3 className="am-section-title">Preferred Tier-1 Lender Network</h3>
          <p className="am-section-desc">Compare competitive offers from our direct institutional partners with guaranteed rate locks.</p>
        </div>

        <div className="am-lenders-grid">
          {PREFERRED_LENDERS.map((lender, i) => (
            <div className="am-lender-card" key={i}>
              <div className="am-lender-head">
                <div>
                  <span className="am-lender-tier">{lender.tier}</span>
                  <h4 className="am-lender-name">{lender.name}</h4>
                </div>
                <div className="am-lender-apr">{lender.rate}</div>
              </div>

              <div className="am-lender-specs">
                <div><span>Origination</span><strong>{lender.origination}</strong></div>
                <div><span>Approval</span><strong>{lender.approval}</strong></div>
              </div>

              <p className="am-lender-perk">✓ {lender.perks}</p>

              <button
                type="button"
                className="am-btn secondary"
                style={{ width: '100%', marginTop: 'auto' }}
                onClick={() => handleLockRate(lender.name)}
              >
                Apply with {lender.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Collapsible Amortization Schedule */}
      <section className="am-schedule-section">
        <button
          type="button"
          className="am-schedule-toggle-btn"
          onClick={() => setShowSchedule(!showSchedule)}
        >
          <span>📊 {showSchedule ? 'Hide' : 'View'} 12-Month Amortization Schedule Telemetry</span>
          <span>{showSchedule ? '▲' : '▼'}</span>
        </button>

        {showSchedule && (
          <div className="am-schedule-table-card">
            <table className="am-schedule-table">
              <thead>
                <tr>
                  <th>Payment #</th>
                  <th>Monthly Due</th>
                  <th>Principal Applied</th>
                  <th>Interest Charge</th>
                  <th>Remaining Loan Balance</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map(row => (
                  <tr key={row.month}>
                    <td>Month {row.month}</td>
                    <td><strong>{fmt(row.payment)}</strong></td>
                    <td className="am-text-green">{fmt(row.principal)}</td>
                    <td className="am-text-orange">{fmt(row.interest)}</td>
                    <td>{fmt(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {lockedMsg && (
        <div className="am-note am-finance-lock-banner">
          <div className="am-note-icon">🎉</div>
          <div>
            <strong>Pre-Approval Confirmation:</strong>
            <p style={{ margin: '4px 0 0 0' }}>{lockedMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
