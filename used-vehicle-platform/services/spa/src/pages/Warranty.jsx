import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtPrice } from '../api.js';

export default function Warranty() {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('plan-platinum');
  const [vehiclePrice, setVehiclePrice] = useState(38000);
  const [vehicleYear, setVehicleYear] = useState(2021);
  const [vehicleMileage, setVehicleMileage] = useState(28000);
  const [deductible, setDeductible] = useState(100);
  const [quoteResult, setQuoteResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    calculateQuote();
  }, [selectedPlanId, vehiclePrice, vehicleYear, vehicleMileage, deductible]);

  const fetchPlans = async () => {
    try {
      const res = await api('/api/catalog/v1/warranty/plans');
      if (res.data && res.data.plans) {
        setPlans(res.data.plans);
      }
    } catch (e) {
      console.warn('Could not load warranty plans', e);
    }
  };

  const calculateQuote = async () => {
    setCalculating(true);
    try {
      const payload = {
        planId: selectedPlanId,
        vehiclePrice: Number(vehiclePrice),
        vehicleYear: Number(vehicleYear),
        vehicleMileage: Number(vehicleMileage),
        deductible: Number(deductible),
      };
      const res = await api('/api/catalog/v1/warranty/quote', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.data && res.data.ok) {
        setQuoteResult(res.data);
      }
    } catch (e) {
      console.warn('Failed to calculate quote', e);
    } finally {
      setCalculating(false);
    }
  };

  const handleEnroll = () => {
    setEnrollSuccess(true);
  };

  return (
    <div className="am-warranty-page">
      {/* Hero Header */}
      <section className="am-warranty-hero">
        <div className="am-warranty-hero-badge">
          <span className="am-pulse-dot" /> Stratos Certified Shield™ Protection
        </div>
        <h1 className="am-warranty-title">Comprehensive Coverage. Absolute Peace of Mind.</h1>
        <p className="am-warranty-subtitle">
          Factory-grade bumper-to-bumper extended warranty, high-voltage electric powertrain shielding,
          and nationwide zero-out-of-pocket authorized service network.
        </p>
      </section>

      {/* Plans Comparison Grid */}
      <section className="am-warranty-plans-section">
        <h2 className="am-section-title-center">Select Your Protection Tier</h2>
        <div className="am-warranty-plans-grid">
          {plans.map((p) => {
            const isSelected = selectedPlanId === p.id;
            const isPlatinum = p.id === 'plan-platinum';
            return (
              <div
                key={p.id}
                className={`am-warranty-card ${isSelected ? 'selected' : ''} ${isPlatinum ? 'popular' : ''}`}
                onClick={() => setSelectedPlanId(p.id)}
              >
                {isPlatinum && <div className="am-popular-tag">MOST POPULAR • MAXIMUM VALUE</div>}
                <div className="am-warranty-card-header">
                  <h3 className="am-plan-name">{p.name}</h3>
                  <span className="am-plan-tier">{p.tier}</span>
                  <div className="am-plan-price-row">
                    <span className="am-price-large">${p.pricePerMonth}</span>
                    <span className="am-price-period">/ month</span>
                  </div>
                  <span className="am-plan-duration">
                    {p.coverageMonths} Months / {p.coverageMiles.toLocaleString()} Miles
                  </span>
                </div>

                <div className="am-warranty-perks-list">
                  {p.perks.map((perk, idx) => (
                    <div key={idx} className="am-perk-row">
                      <span className="am-perk-check">✓</span>
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className={`am-plan-select-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedPlanId(p.id)}
                >
                  {isSelected ? '✓ Selected Plan' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Rate Calculator */}
      <section className="am-warranty-calc-section">
        <div className="am-calc-card">
          <div className="am-calc-form-side">
            <span className="am-calc-badge">PRECISION RISK ALGORITHM</span>
            <h3 className="am-calc-title">Instant Warranty Quote Customizer</h3>
            <p className="am-calc-sub">
              Adjust vehicle parameters and deductible amount to view your real-time underwriting premium.
            </p>

            <div className="am-calc-inputs">
              <div className="am-calc-input-group">
                <label>Vehicle Purchase Value: <b>{fmtPrice(vehiclePrice)}</b></label>
                <input
                  type="range"
                  min="10000"
                  max="150000"
                  step="2500"
                  value={vehiclePrice}
                  onChange={(e) => setVehiclePrice(Number(e.target.value))}
                  className="am-range-slider"
                />
              </div>

              <div className="am-calc-row-2">
                <div className="am-calc-input-group">
                  <label>Model Year: <b>{vehicleYear}</b></label>
                  <select
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(Number(e.target.value))}
                    className="am-calc-select"
                  >
                    {[2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="am-calc-input-group">
                  <label>Current Mileage: <b>{Number(vehicleMileage).toLocaleString()} mi</b></label>
                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="5000"
                    value={vehicleMileage}
                    onChange={(e) => setVehicleMileage(Number(e.target.value))}
                    className="am-range-slider"
                  />
                </div>
              </div>

              <div className="am-calc-input-group">
                <label>Deductible Per Claim Visit:</label>
                <div className="am-deductible-chips">
                  {[0, 100, 250].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`am-deductible-btn ${deductible === d ? 'active' : ''}`}
                      onClick={() => setDeductible(d)}
                    >
                      ${d} Deductible {d === 0 ? '(Zero Out of Pocket)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quote Output Preview Side */}
          <div className="am-calc-output-side">
            {enrollSuccess ? (
              <div className="am-enroll-success-box">
                <div className="am-success-icon-badge">✓</div>
                <h4>Protection Policy Initiated!</h4>
                <p>
                  Your policy certificate token <code>POL-SHIELD-{Math.floor(100000 + Math.random() * 900000)}</code> has been
                  attached to your client profile.
                </p>
                <div className="am-enroll-meta">
                  <div>Coverage: <b>{quoteResult?.plan}</b></div>
                  <div>Monthly Premium: <b>${quoteResult?.monthlyPrice} / mo</b></div>
                  <div>Deductible: <b>${quoteResult?.deductible}</b></div>
                </div>
                <button
                  type="button"
                  className="am-btn secondary"
                  style={{ marginTop: 20 }}
                  onClick={() => setEnrollSuccess(false)}
                >
                  Adjust Parameters
                </button>
              </div>
            ) : (
              <div className="am-quote-output-card">
                <span className="am-quote-output-label">Underwriting Premium Quote</span>
                <div className="am-quote-price-wrap">
                  <span className="am-quote-currency">$</span>
                  <span className="am-quote-amount">
                    {calculating ? '...' : (quoteResult ? quoteResult.monthlyPrice : '68')}
                  </span>
                  <span className="am-quote-unit">/ month</span>
                </div>
                <div className="am-quote-annual">
                  Or ${quoteResult ? quoteResult.annualPrice : '816'} billed annually (save 10%)
                </div>

                <div className="am-quote-breakdown">
                  <div className="am-breakdown-row">
                    <span>Plan Tier:</span>
                    <b>{quoteResult?.plan || 'Platinum Elite Care'}</b>
                  </div>
                  <div className="am-breakdown-row">
                    <span>Selected Deductible:</span>
                    <b>${deductible} per authorized visit</b>
                  </div>
                  <div className="am-breakdown-row">
                    <span>Authorized Facilities:</span>
                    <b>1,400+ Franchised OEM Dealerships</b>
                  </div>
                  <div className="am-breakdown-row">
                    <span>Emergency Towing / Rental:</span>
                    <b style={{ color: '#30d158' }}>Included ($0 Cost)</b>
                  </div>
                </div>

                <p className="am-quote-note">
                  {quoteResult?.coverageSummary || 'Guaranteed repair coverage at all verified OEM facilities nationwide.'}
                </p>

                <button
                  type="button"
                  className="am-btn primary am-btn-large"
                  style={{ width: '100%', marginTop: 16 }}
                  onClick={handleEnroll}
                >
                  Enroll in Certified Shield Protection →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="am-warranty-pillars">
        <div className="am-pillar-card">
          <div className="am-pillar-icon">⚡</div>
          <h4>EV Battery & Inverter Shield</h4>
          <p>Full replacement protection against capacity degradation below 70% and power electronics malfunction.</p>
        </div>
        <div className="am-pillar-card">
          <div className="am-pillar-icon">🚗</div>
          <h4>Direct Dealership Pay</h4>
          <p>No tedious reimbursement forms. Stratos pays the dealership service center directly with corporate card.</p>
        </div>
        <div className="am-pillar-card">
          <div className="am-pillar-icon">🔁</div>
          <h4>Transferable Value</h4>
          <p>100% transferable to subsequent private owners, maximizing vehicle resale equity by up to $2,800.</p>
        </div>
      </section>
    </div>
  );
}
