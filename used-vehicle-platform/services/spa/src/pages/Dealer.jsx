import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API, fmtPrice } from '../api.js';

export default function Dealer() {
  const [dealers, setDealers] = useState([]);
  const [activeTab, setActiveTab] = useState('directory'); // directory | wholesale | concierge
  const [searchCity, setSearchCity] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');
  const [wholesaleLots, setWholesaleLots] = useState([]);
  const [wholesaleStats, setWholesaleStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // VIP Concierge Form state
  const [conciergeForm, setConciergeForm] = useState({
    customerName: '',
    vehicleId: '1',
    preferredTime: 'Tomorrow 2:00 PM',
    deliveryAddress: '',
    customInstructions: ''
  });
  const [conciergeMsg, setConciergeMsg] = useState('');

  // Franchise Partner Application State
  const [partnerForm, setPartnerForm] = useState({
    dealershipName: '',
    primaryContact: '',
    email: '',
    phone: '',
    city: 'Mumbai',
    showroomSqFt: '15,000 sq.ft.',
    annualVolume: '120 Units',
    brandsRepresented: 'Porsche, Ferrari, BMW M, Mercedes-AMG'
  });
  const [partnerMsg, setPartnerMsg] = useState('');
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Fetch dealers
    api(`${API.catalog}/v1/dealers`)
      .then(r => {
        setDealers(r.data.dealers || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch wholesale B2B auction lots
    api(`${API.catalog}/v1/dealers/wholesale/inventory`)
      .then(r => setWholesaleLots(r.data.lots || r.data.wholesale_inventory || []))
      .catch(() => {});

    // Fetch wholesale public appraisal stats
    api(`${API.catalog}/v1/dealers/wholesale/appraisals/public-stats?verbose=true`)
      .then(r => setWholesaleStats(r.data))
      .catch(() => {});
  }, []);

  const handleBookConcierge = async (e) => {
    e.preventDefault();
    setConciergeMsg('Booking concierge test-drive...');
    try {
      const r = await api(`${API.catalog}/v1/customers/concierge/book`, {
        method: 'POST',
        body: JSON.stringify(conciergeForm)
      });
      if (r.status === 200 && r.data.bookingId) {
        setConciergeMsg(`✓ Concierge appointment confirmed! Booking ID: ${r.data.bookingId}. A dealer liaison has been assigned.`);
      } else {
        setConciergeMsg(`✗ Booking failed: ${r.data.error || 'Please check all required fields.'}`);
      }
    } catch (err) {
      setConciergeMsg('✗ Network error occurred while booking concierge.');
    }
  };

  const handlePartnerApply = async (e) => {
    e.preventDefault();
    setPartnerSubmitting(true);
    setPartnerMsg('Transmitting dealer accreditation dossier...');
    try {
      const r = await api(`${API.catalog}/v1/dealers/partners/apply`, {
        method: 'POST',
        body: JSON.stringify(partnerForm)
      });
      if (r.status === 200 && r.data.applicationId) {
        setPartnerMsg(`✓ Application ${r.data.applicationId} pre-approved (${r.data.status})! ${r.data.message} ${r.data.assignedLiaison}`);
      } else {
        setPartnerMsg(`✗ Application error: ${r.data.error || 'Could not verify dealership'}`);
      }
    } catch (err) {
      setPartnerMsg(`✗ Submission error: ${err.message}`);
    } finally {
      setPartnerSubmitting(false);
    }
  };

  const cities = ['All', 'Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Chennai'];

  const filteredDealers = dealers.filter(d => {
    const matchesCity = selectedCity === 'All' || d.location.toLowerCase().includes(selectedCity.toLowerCase());
    const matchesQuery = !searchCity || 
      d.name.toLowerCase().includes(searchCity.toLowerCase()) || 
      d.location.toLowerCase().includes(searchCity.toLowerCase());
    return matchesCity && matchesQuery;
  });

  return (
    <div className="am-dealer-hub-page">
      {/* Hero Header */}
      <div className="am-dealer-hero">
        <div className="am-dealer-hero-badge">
          <span className="am-hero-led" />
          <span>🏢 Verified Automotive Dealership Network</span>
        </div>
        <h1 className="am-dealer-title">
          Certified Partner <span>Dealerships & Clearinghouse</span>
        </h1>
        <p className="am-dealer-subtitle">
          Direct access to authorized dealer showrooms, 200-point mechanical certifications, 
          B2B wholesale auction bidding, and white-glove doorstep concierge handovers.
        </p>

        {/* Global Statistics Banner */}
        <div className="am-dealer-metrics-strip">
          <div className="am-dealer-metric">
            <strong>180+</strong>
            <span>Verified Showrooms</span>
          </div>
          <div className="am-dealer-metric-divider" />
          <div className="am-dealer-metric">
            <strong>4.8★</strong>
            <span>Avg Satisfaction Rating</span>
          </div>
          <div className="am-dealer-metric-divider" />
          <div className="am-dealer-metric">
            <strong>100%</strong>
            <span>Guaranteed Clear Title</span>
          </div>
          <div className="am-dealer-metric-divider" />
          <div className="am-dealer-metric">
            <strong>24h</strong>
            <span>Escrow & Title Disbursal</span>
          </div>
        </div>
      </div>

      {/* Main Hub Tabs */}
      <div className="am-dealer-tab-nav">
        <button
          type="button"
          className={`am-dealer-tab-pill ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          <span>🏬</span> Certified Showroom Directory
        </button>
        <button
          type="button"
          className={`am-dealer-tab-pill ${activeTab === 'wholesale' ? 'active' : ''}`}
          onClick={() => setActiveTab('wholesale')}
        >
          <span>⚡</span> B2B Wholesale Auction Terminal
          {wholesaleLots.length > 0 && <span className="am-lot-count-tag">{wholesaleLots.length} Lots</span>}
        </button>
        <button
          type="button"
          className={`am-dealer-tab-pill ${activeTab === 'concierge' ? 'active' : ''}`}
          onClick={() => setActiveTab('concierge')}
        >
          <span>🚗</span> VIP Doorstep Concierge Booking
        </button>
        <button
          type="button"
          className={`am-dealer-tab-pill ${activeTab === 'partner_apply' ? 'active' : ''}`}
          onClick={() => setActiveTab('partner_apply')}
        >
          <span>🤝</span> Franchise Accreditation
        </button>
        <button
          type="button"
          className={`am-dealer-tab-pill ${activeTab === 'logistics_network' ? 'active' : ''}`}
          onClick={() => setActiveTab('logistics_network')}
        >
          <span>🌐</span> National Transit Corridors
        </button>
      </div>

      {/* TAB 1: DEALERSHIP DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="am-dealer-content-section">
          {/* Filter & Search Bar */}
          <div className="am-dealer-controls-card">
            <div className="am-dealer-search-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search dealership by name, location, or landmark..."
                value={searchCity}
                onChange={e => setSearchCity(e.target.value)}
              />
              {searchCity && (
                <button type="button" className="am-clear-btn" onClick={() => setSearchCity('')}>✕</button>
              )}
            </div>

            <div className="am-dealer-city-pills">
              {cities.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`am-city-filter-btn ${selectedCity === c ? 'active' : ''}`}
                  onClick={() => setSelectedCity(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Dealership Grid */}
          {loading ? (
            <div className="am-loading-state">
              <div className="am-spinner" />
              <p>Locating verified partner showrooms...</p>
            </div>
          ) : (
            <div className="am-dealer-grid">
              {filteredDealers.map((d, index) => {
                const initials = d.name.split(' ').map(w => w[0]).join('').slice(0, 2);
                return (
                  <article className="am-dealer-luxury-card" key={d.id}>
                    <div className="am-dealer-card-header">
                      <div className="am-dealer-avatar">
                        <span>{initials}</span>
                      </div>
                      <div className="am-dealer-title-group">
                        <div className="am-dealer-name-row">
                          <h3>{d.name}</h3>
                          <span className="am-verified-pill" title="Certified Stratos Dealership">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                            Verified
                          </span>
                        </div>
                        <div className="am-dealer-location-row">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>{d.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="am-dealer-stats-row">
                      <div className="am-dealer-stat-item">
                        <span className="am-stat-label">Showroom Rating</span>
                        <div className="am-stat-value rating">
                          <span className="am-star">★</span> {d.rating}
                          <span className="am-stat-sub">/ 5.0</span>
                        </div>
                      </div>

                      <div className="am-dealer-stat-item">
                        <span className="am-stat-label">In-Stock Fleet</span>
                        <div className="am-stat-value">
                          {d.cars} <span>vehicles</span>
                        </div>
                      </div>

                      <div className="am-dealer-stat-item">
                        <span className="am-stat-label">Operating Hours</span>
                        <div className="am-stat-value status-open">
                          <span className="am-open-dot" /> 9 AM – 8:30 PM
                        </div>
                      </div>
                    </div>

                    <div className="am-dealer-features-tags">
                      <span>✓ 200-Pt Inspection</span>
                      <span>✓ Doorstep Delivery</span>
                      <span>✓ Instant Trade-In</span>
                      <span>✓ Pre-Approved EMI</span>
                    </div>

                    <div className="am-dealer-card-actions">
                      <a
                        className="am-dealer-btn secondary"
                        href={`tel:${d.phone.replace(/\s/g, '')}`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        {d.phone}
                      </a>

                      <Link
                        className="am-dealer-btn primary"
                        to={`/dealers/${d.id}/contact`}
                      >
                        Contact Showroom
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WHOLESALE B2B AUCTION CLEARINGHOUSE */}
      {activeTab === 'wholesale' && (
        <div className="am-wholesale-section">
          <div className="am-wholesale-banner">
            <div className="am-wholesale-banner-text">
              <span className="am-b2b-badge">B2B Dealership Network Only</span>
              <h2>Dealer Wholesale Auction Clearinghouse</h2>
              <p>
                Browse verified wholesale liquidation lots, review consignment clearinghouse metrics, 
                and submit authenticated dealer bids with cryptographic contract issuance.
              </p>
            </div>
            {wholesaleStats && (
              <div className="am-wholesale-stats-box">
                <div className="am-ws-item">
                  <span>Total Active Lots</span>
                  <b>{wholesaleStats.total_lots || wholesaleLots.length || 3}</b>
                </div>
                <div className="am-ws-item">
                  <span>Active Live Bids</span>
                  <b>{wholesaleStats.active_bids || 2}</b>
                </div>
                <div className="am-ws-item">
                  <span>Clearinghouse Index</span>
                  <b>{wholesaleStats.market_clearing_index ? `${wholesaleStats.market_clearing_index}%` : '104.8%'}</b>
                </div>
              </div>
            )}
          </div>

          <div className="am-wholesale-grid">
            {wholesaleLots.map(lot => {
              const carTitle = lot.title || `${lot.year || 2021} ${lot.make || 'BMW'} ${lot.model || 'M4 Competition'}`;
              return (
                <div className="am-wholesale-card" key={lot.lotId}>
                  <div className="am-wholesale-header">
                    <span className="am-lot-badge">{lot.lotId}</span>
                    <span className={`am-tier-tag ${lot.status === 'LOCKED' ? 'locked' : ''}`}>
                      {lot.status || 'OPEN'}
                    </span>
                  </div>
                  <h3>{carTitle}</h3>
                  <div className="am-wholesale-meta">
                    <span>📋 Consignment: <b>{lot.consignmentId || 'CSG-88219'}</b></span>
                    <span>📍 Central Wholesale Depot</span>
                    <span>⚙️ Grade A+ Certified</span>
                  </div>
                  <div className="am-wholesale-pricing">
                    <div className="am-reserve-price">
                      <span>Reserve Price</span>
                      <strong>{fmtPrice(lot.reservePrice || 42000)}</strong>
                    </div>
                    <div className="am-est-retail">
                      <span>Current Top Bid</span>
                      <span style={{ color: '#0284c7', fontWeight: 800 }}>{fmtPrice(lot.currentBid || 43500)}</span>
                    </div>
                  </div>
                  <div className="am-wholesale-actions">
                    <button
                      type="button"
                      className="am-bid-btn"
                      disabled={lot.status === 'LOCKED'}
                      onClick={() => alert(`B2B Auction Bid: To place bids on ${lot.lotId} (${carTitle}), authenticate via the B2B Dealer API or submit an authorization token.`)}
                    >
                      {lot.status === 'LOCKED' ? '🔒 Lot Locked (Pending Escrow)' : 'Place Wholesale Acquisition Bid'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: VIP CONCIERGE TEST DRIVE BOOKING */}
      {activeTab === 'concierge' && (
        <div className="am-concierge-section">
          <div className="am-concierge-card">
            <div className="am-concierge-header">
              <div className="am-concierge-icon">🚗</div>
              <div>
                <h2>Book VIP Doorstep Concierge Handover</h2>
                <p>Have an authorized dealer specialist bring any certified vehicle directly to your residence or corporate office for an executive test drive.</p>
              </div>
            </div>

            <form onSubmit={handleBookConcierge} className="am-concierge-form">
              <div className="am-form-grid">
                <div className="am-field">
                  <label>Your Full Name</label>
                  <input
                    placeholder="e.g. Elena Rostova"
                    value={conciergeForm.customerName}
                    onChange={e => setConciergeForm({ ...conciergeForm, customerName: e.target.value })}
                    required
                  />
                </div>

                <div className="am-field">
                  <label>Select Vehicle ID</label>
                  <select
                    value={conciergeForm.vehicleId}
                    onChange={e => setConciergeForm({ ...conciergeForm, vehicleId: e.target.value })}
                  >
                    <option value="1">Toyota Corolla 2018 ($12,000)</option>
                    <option value="2">Honda Civic 2020 ($16,000)</option>
                    <option value="3">Ford Mustang 1967 ($45,000)</option>
                    <option value="4">Tesla Model 3 2022 ($35,000)</option>
                    <option value="5">Hyundai Creta 2021 ($14,500)</option>
                    <option value="10">Toyota Fortuner 2020 ($32,000)</option>
                    <option value="21">BMW 3 Series 2020 ($38,000)</option>
                    <option value="22">Mercedes-Benz C-Class 2021 ($42,000)</option>
                  </select>
                </div>

                <div className="am-field">
                  <label>Preferred Date & Time</label>
                  <input
                    placeholder="e.g. Tomorrow at 3:00 PM"
                    value={conciergeForm.preferredTime}
                    onChange={e => setConciergeForm({ ...conciergeForm, preferredTime: e.target.value })}
                    required
                  />
                </div>

                <div className="am-field">
                  <label>Delivery / Test-Drive Address</label>
                  <input
                    placeholder="e.g. 742 Evergreen Terrace, Suite 400"
                    value={conciergeForm.deliveryAddress}
                    onChange={e => setConciergeForm({ ...conciergeForm, deliveryAddress: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="am-field" style={{ marginTop: 14 }}>
                <label>Special Handover Instructions</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Please bring full 200-point inspection dossier and tire wear digital gauge."
                  value={conciergeForm.customInstructions}
                  onChange={e => setConciergeForm({ ...conciergeForm, customInstructions: e.target.value })}
                />
              </div>

              <button type="submit" className="am-concierge-submit-btn">
                Confirm VIP Concierge Reservation
              </button>
            </form>

            {conciergeMsg && (
              <div className="am-concierge-alert">
                {conciergeMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FRANCHISE ACCREDITATION */}
      {activeTab === 'partner_apply' && (
        <div className="am-dealer-content-section">
          <div className="am-concierge-card" style={{ maxWidth: 960 }}>
            <div className="am-concierge-header">
              <span className="am-concierge-tag">🤝 Dealer Network Expansion</span>
              <h2>Authorized Dealership Franchise Accreditation</h2>
              <p>
                Join India's premier certified pre-owned luxury automotive network. Gain immediate access to 
                syndicated floorplan financing lines ($5M+ facility), B2B wholesale clearinghouse auction lots, 
                and white-glove doorstep delivery logistics.
              </p>
            </div>

            {/* Accreditation Tier Cards */}
            <div className="am-accreditation-tiers">
              <div className="am-tier-card gold">
                <span className="am-tier-badge">Tier 1 Certified Elite</span>
                <h3>Executive Dealer Partner</h3>
                <ul>
                  <li>✓ Direct wholesale exchange bid execution</li>
                  <li>✓ $5,000,000 revolving floorplan credit line</li>
                  <li>✓ Same-day title release & escrow clearance</li>
                  <li>✓ Nationwide enclosed hauler dispatch routing</li>
                </ul>
              </div>

              <div className="am-tier-card silver">
                <span className="am-tier-badge">Tier 2 Associate</span>
                <h3>Boutique Showroom Partner</h3>
                <ul>
                  <li>✓ B2B wholesale auction buying access</li>
                  <li>✓ 200-point mechanical certification badge</li>
                  <li>✓ Concierge test-drive booking dispatch</li>
                  <li>✓ Integrated CRM lead routing pipeline</li>
                </ul>
              </div>
            </div>

            {/* Partner Application Form */}
            <form onSubmit={handlePartnerApply} className="am-concierge-form" style={{ marginTop: 28 }}>
              <div className="am-form-grid-2">
                <div className="am-field">
                  <label>Dealership Legal Entity Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Luxury Supercars Pvt Ltd"
                    value={partnerForm.dealershipName}
                    onChange={e => setPartnerForm({ ...partnerForm, dealershipName: e.target.value })}
                  />
                </div>
                <div className="am-field">
                  <label>Primary Dealer Principal / Director</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Karan Singhania"
                    value={partnerForm.primaryContact}
                    onChange={e => setPartnerForm({ ...partnerForm, primaryContact: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field">
                  <label>Official Business Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. k.singhania@apexluxury.in"
                    value={partnerForm.email}
                    onChange={e => setPartnerForm({ ...partnerForm, email: e.target.value })}
                  />
                </div>
                <div className="am-field">
                  <label>Direct Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98200 11223"
                    value={partnerForm.phone}
                    onChange={e => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-3">
                <div className="am-field">
                  <label>Primary Showroom Metro</label>
                  <select
                    value={partnerForm.city}
                    onChange={e => setPartnerForm({ ...partnerForm, city: e.target.value })}
                  >
                    <option value="Mumbai">Mumbai (BKC / Worli)</option>
                    <option value="Delhi">Delhi NCR (Gurugram / Connaught)</option>
                    <option value="Bengaluru">Bengaluru (Indiranagar / UB City)</option>
                    <option value="Pune">Pune (Koregaon Park)</option>
                    <option value="Chennai">Chennai (Nungambakkam)</option>
                    <option value="Hyderabad">Hyderabad (Jubilee Hills)</option>
                  </select>
                </div>

                <div className="am-field">
                  <label>Facility Display Area</label>
                  <select
                    value={partnerForm.showroomSqFt}
                    onChange={e => setPartnerForm({ ...partnerForm, showroomSqFt: e.target.value })}
                  >
                    <option value="8,000 sq.ft.">8,000 - 12,000 sq.ft.</option>
                    <option value="15,000 sq.ft.">15,000 - 25,000 sq.ft.</option>
                    <option value="30,000+ sq.ft.">30,000+ sq.ft. Flagship</option>
                  </select>
                </div>

                <div className="am-field">
                  <label>Annual Delivery Volume</label>
                  <select
                    value={partnerForm.annualVolume}
                    onChange={e => setPartnerForm({ ...partnerForm, annualVolume: e.target.value })}
                  >
                    <option value="50-100 Units">50 - 100 Luxury Units / yr</option>
                    <option value="100-250 Units">100 - 250 Luxury Units / yr</option>
                    <option value="250+ Units">250+ High Volume Flagship</option>
                  </select>
                </div>
              </div>

              <div className="am-field">
                <label>Luxury Marques / OEM Brands Handled</label>
                <input
                  type="text"
                  placeholder="e.g. Porsche, Ferrari, BMW M, Mercedes-AMG, Aston Martin"
                  value={partnerForm.brandsRepresented}
                  onChange={e => setPartnerForm({ ...partnerForm, brandsRepresented: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="am-concierge-submit-btn"
                disabled={partnerSubmitting}
              >
                {partnerSubmitting ? 'Submitting Accreditation...' : 'Submit Dealer Accreditation Application 🤝'}
              </button>
            </form>

            {partnerMsg && (
              <div className="am-concierge-alert" style={{ marginTop: 20 }}>
                {partnerMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: NATIONAL LOGISTICS TRANSIT CORRIDORS */}
      {activeTab === 'logistics_network' && (
        <div className="am-dealer-content-section">
          <div className="am-concierge-card" style={{ maxWidth: 1040 }}>
            <div className="am-concierge-header">
              <span className="am-concierge-tag">🌐 Nationwide Inter-Dealer Transit</span>
              <h2>Certified Enclosed Transport Corridors & Staging Hubs</h2>
              <p>
                Guaranteed enclosed hydraulic liftgate routing connecting partner showrooms, wholesale ports, 
                and VIP delivery staging facilities across India with real-time GPS telematic locks.
              </p>
            </div>

            <div className="am-corridors-grid">
              <div className="am-corridor-card">
                <div className="am-corridor-top">
                  <span className="am-corridor-id">CORR-WEST-01</span>
                  <span className="am-corridor-status active">Active • Same-Day</span>
                </div>
                <h3>Western Super-Corridor</h3>
                <div className="am-corridor-route">
                  <span>Mumbai Port (Nhava Sheva)</span> ➔ <span>Pune Koregaon</span> ➔ <span>Ahmedabad SG Highway</span>
                </div>
                <div className="am-corridor-stats">
                  <div><span>Transit Time:</span> <b>5.5 Hours</b></div>
                  <div><span>Active Rigs:</span> <b>12 Enclosed Haulers</b></div>
                  <div><span>Fleet Telematics:</span> <b style={{ color: '#10b981' }}>Optimal (20°C)</b></div>
                </div>
              </div>

              <div className="am-corridor-card">
                <div className="am-corridor-top">
                  <span className="am-corridor-id">CORR-NORTH-02</span>
                  <span className="am-corridor-status active">Active • Overnight</span>
                </div>
                <h3>Northern Golden Quadrilateral</h3>
                <div className="am-corridor-route">
                  <span>Delhi NCR Hub</span> ➔ <span>Jaipur Luxury Row</span> ➔ <span>Chandigarh Sector 9</span>
                </div>
                <div className="am-corridor-stats">
                  <div><span>Transit Time:</span> <b>9.0 Hours</b></div>
                  <div><span>Active Rigs:</span> <b>14 Enclosed Haulers</b></div>
                  <div><span>Fleet Telematics:</span> <b style={{ color: '#10b981' }}>Optimal (21°C)</b></div>
                </div>
              </div>

              <div className="am-corridor-card">
                <div className="am-corridor-top">
                  <span className="am-corridor-id">CORR-SOUTH-03</span>
                  <span className="am-corridor-status active">Active • 24-Hour</span>
                </div>
                <h3>Southern Tech Highway</h3>
                <div className="am-corridor-route">
                  <span>Bengaluru Tech Park</span> ➔ <span>Chennai Auto Port</span> ➔ <span>Hyderabad Jubilee</span>
                </div>
                <div className="am-corridor-stats">
                  <div><span>Transit Time:</span> <b>12.5 Hours</b></div>
                  <div><span>Active Rigs:</span> <b>16 Enclosed Haulers</b></div>
                  <div><span>Fleet Telematics:</span> <b style={{ color: '#10b981' }}>Optimal (20°C)</b></div>
                </div>
              </div>

              <div className="am-corridor-card">
                <div className="am-corridor-top">
                  <span className="am-corridor-id">CORR-CENTRAL-04</span>
                  <span className="am-corridor-status active">Active • 18-Hour</span>
                </div>
                <h3>Central Industrial Express</h3>
                <div className="am-corridor-route">
                  <span>Indore Vijay Nagar</span> ➔ <span>Nagpur Logistics Yard</span> ➔ <span>Bhopal MP Nagar</span>
                </div>
                <div className="am-corridor-stats">
                  <div><span>Transit Time:</span> <b>8.0 Hours</b></div>
                  <div><span>Active Rigs:</span> <b>6 Enclosed Haulers</b></div>
                  <div><span>Fleet Telematics:</span> <b style={{ color: '#10b981' }}>Optimal (22°C)</b></div>
                </div>
              </div>
            </div>

            {/* Logistics Safeguards Strip */}
            <div className="am-dealer-metrics-strip" style={{ marginTop: 24 }}>
              <div className="am-dealer-metric">
                <strong>48 Rigs</strong>
                <span>Air-Ride Enclosed Hydraulic Rigs</span>
              </div>
              <div className="am-dealer-metric-divider" />
              <div className="am-dealer-metric">
                <strong>$10,000,000</strong>
                <span>Per-Rig Marine Cargo Insurance</span>
              </div>
              <div className="am-dealer-metric-divider" />
              <div className="am-dealer-metric">
                <strong>100%</strong>
                <span>Climate-Controlled Bay Diagnostics</span>
              </div>
              <div className="am-dealer-metric-divider" />
              <div className="am-dealer-metric">
                <strong>Digital BOL</strong>
                <span>200-Pt Inspection Photographic Receipt</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

