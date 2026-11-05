import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, session } from '../api.js';

export default function Support() {
  const [searchParams] = useSearchParams();
  const prefillVehicle = searchParams.get('vehicle') || '';

  const user = session.user;

  // Tabs: 'ticket' | 'track' | 'faq' | 'locations'
  const [activeTab, setActiveTab] = useState('ticket');

  // FAQ State
  const [faqs, setFaqs] = useState([]);
  const [faqSearch, setFaqSearch] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  // New Ticket State
  const [ticketForm, setTicketForm] = useState({
    customerName: user ? user.name || user.username : '',
    email: user ? user.email || '' : '',
    phone: '',
    category: 'Delivery Logistics',
    priority: 'high',
    subject: '',
    message: '',
    vehicleId: prefillVehicle,
  });
  const [submitting, setSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(null);
  const [formError, setFormError] = useState('');

  // Ticket Tracking State
  const [ticketsList, setTicketsList] = useState([]);
  const [trackQuery, setTrackQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');

  useEffect(() => {
    fetchFaqs();
    fetchRecentTickets();
  }, []);

  const fetchFaqs = async () => {
    try {
      const res = await api('/api/catalog/v1/support/faq');
      if (res.data && res.data.faqs) {
        setFaqs(res.data.faqs);
      }
    } catch (e) {
      console.warn('Failed to load FAQs', e);
    }
  };

  const fetchRecentTickets = async () => {
    try {
      const res = await api('/api/catalog/v1/support/tickets');
      if (res.data && res.data.tickets) {
        setTicketsList(res.data.tickets);
        if (res.data.tickets.length > 0 && !selectedTicket) {
          setSelectedTicket(res.data.tickets[0]);
        }
      }
    } catch (e) {
      console.warn('Failed to load tickets', e);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!ticketForm.customerName || !ticketForm.email || !ticketForm.message) {
      setFormError('Please fill in your name, email, and detailed message.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        customerName: ticketForm.customerName,
        email: ticketForm.email,
        phone: ticketForm.phone || 'N/A',
        subject: ticketForm.subject || `${ticketForm.category} Assistance`,
        category: ticketForm.category,
        priority: ticketForm.priority,
        message: ticketForm.message,
        vehicleId: ticketForm.vehicleId || null,
      };

      const res = await api('/api/catalog/v1/support/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.data && res.data.ok && res.data.ticket) {
        setTicketSuccess(res.data.ticket);
        fetchRecentTickets();
        setTicketForm({
          customerName: user ? user.name || user.username : '',
          email: user ? user.email || '' : '',
          phone: '',
          category: 'Delivery Logistics',
          priority: 'high',
          subject: '',
          message: '',
          vehicleId: '',
        });
      } else {
        setFormError(res.data?.error || 'Failed to submit customer ticket.');
      }
    } catch (err) {
      setFormError('Network error connecting to Stratos Support Desk.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackSearch = async (e) => {
    e.preventDefault();
    if (!trackQuery.trim()) return;
    try {
      const res = await api(`/api/catalog/v1/support/tickets/${trackQuery.trim()}`);
      if (res.data && res.data.ok && res.data.ticket) {
        setSelectedTicket(res.data.ticket);
      } else {
        // Fallback search in local list
        const found = ticketsList.find(
          (t) =>
            t.id.toLowerCase() === trackQuery.toLowerCase() ||
            t.customerName.toLowerCase().includes(trackQuery.toLowerCase())
        );
        if (found) setSelectedTicket(found);
        else alert(`Ticket "${trackQuery}" not found in current desk database.`);
      }
    } catch (err) {
      alert('Error querying ticket database.');
    }
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;
    const newMsg = {
      sender: user?.username || selectedTicket.customerName,
      text: replyMessage.trim(),
      time: new Date().toISOString(),
    };
    setSelectedTicket({
      ...selectedTicket,
      messages: [...(selectedTicket.messages || []), newMsg],
    });
    setReplyMessage('');
  };

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div className="am-support-page">
      {/* Hero Concierge Header */}
      <section className="am-support-hero">
        <div className="am-support-hero-badge">
          <span className="am-pulse-dot" /> 24/7 Concierge & White-Glove Support
        </div>
        <h1 className="am-support-title">How May We Assist You Today?</h1>
        <p className="am-support-subtitle">
          Direct priority connection to Stratos client liaisons, delivery logistics dispatchers,
          master technicians, and title escrow officers.
        </p>

        {/* Emergency Quick Action Hotline Strip */}
        <div className="am-support-hotline-strip">
          <div className="am-hotline-item">
            <span className="am-hotline-icon">📞</span>
            <div>
              <span className="am-hotline-label">Direct Concierge Desk</span>
              <b>+1 (800) 555-AUTO (2886)</b>
            </div>
          </div>
          <div className="am-hotline-item">
            <span className="am-hotline-icon">🚨</span>
            <div>
              <span className="am-hotline-label">Emergency Roadside Towing</span>
              <b>+1 (800) 999-ROAD (7623)</b>
            </div>
          </div>
          <div className="am-hotline-item">
            <span className="am-hotline-icon">✉️</span>
            <div>
              <span className="am-hotline-label">Priority Escrow Liaison</span>
              <b>concierge@stratos.internal</b>
            </div>
          </div>
          <div className="am-hotline-item">
            <span className="am-hotline-icon">⏱️</span>
            <div>
              <span className="am-hotline-label">Guaranteed First Response</span>
              <b>Under 15 Minutes (24/7)</b>
            </div>
          </div>
        </div>
      </section>

      {/* Main Support Workspace & Navigation Tabs */}
      <div className="am-support-container">
        <div className="am-support-tabs">
          <button
            className={`am-support-tab-btn ${activeTab === 'ticket' ? 'active' : ''}`}
            onClick={() => setActiveTab('ticket')}
          >
            Submit Priority Inquiry
          </button>
          <button
            className={`am-support-tab-btn ${activeTab === 'track' ? 'active' : ''}`}
            onClick={() => setActiveTab('track')}
          >
            Live Ticket Tracker ({ticketsList.length})
          </button>
          <button
            className={`am-support-tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveTab('faq')}
          >
            Knowledge Base & FAQ
          </button>
          <button
            className={`am-support-tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            Flagship Galleries & Service
          </button>
        </div>

        {/* TAB 1: Submit Priority Ticket */}
        {activeTab === 'ticket' && (
          <div className="am-support-panel">
            <div className="am-panel-grid-2col">
              {/* Form Column */}
              <div>
                <h3 className="am-panel-heading">Open a Verified Concierge Ticket</h3>
                <p className="am-panel-sub">
                  Every inquiry receives an immutable reference ID and direct allocation to a dedicated automotive specialist.
                </p>

                {ticketSuccess && (
                  <div className="am-alert-success" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b>✓ Ticket #{ticketSuccess.id} Successfully Dispatched!</b>
                      <button
                        className="am-btn-small"
                        onClick={() => {
                          setSelectedTicket(ticketSuccess);
                          setActiveTab('track');
                        }}
                      >
                        Track Live →
                      </button>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                      Assigned to: <b>{ticketSuccess.assignedTo}</b>. Target response SLA: under 15 minutes.
                    </p>
                  </div>
                )}

                {formError && <div className="am-alert-error" style={{ marginBottom: 16 }}>{formError}</div>}

                <form onSubmit={handleCreateTicket} className="am-support-form">
                  <div className="am-form-row-2">
                    <div className="am-form-field">
                      <label>Client Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sarah Jenkins"
                        value={ticketForm.customerName}
                        onChange={(e) => setTicketForm({ ...ticketForm, customerName: e.target.value })}
                        disabled={submitting}
                      />
                    </div>
                    <div className="am-form-field">
                      <label>Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. client@domain.com"
                        value={ticketForm.email}
                        onChange={(e) => setTicketForm({ ...ticketForm, email: e.target.value })}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="am-form-row-2">
                    <div className="am-form-field">
                      <label>Direct Contact Phone</label>
                      <input
                        type="tel"
                        placeholder="+1 (555) 234-5678"
                        value={ticketForm.phone}
                        onChange={(e) => setTicketForm({ ...ticketForm, phone: e.target.value })}
                        disabled={submitting}
                      />
                    </div>
                    <div className="am-form-field">
                      <label>Inquiry Category</label>
                      <select
                        value={ticketForm.category}
                        onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                        disabled={submitting}
                      >
                        <option value="Delivery Logistics">Enclosed White-Glove Delivery Logistics</option>
                        <option value="Title & Registration">Title Transfer, Escrow & Registration</option>
                        <option value="Mechanical & Warranty">Mechanical Inspection & Warranty Claims</option>
                        <option value="Trade-In Appraisal">Instant Trade-In Valuation Dispute</option>
                        <option value="VIP Allocation Pre-Order">VIP Launch Allocation & Customization</option>
                        <option value="Technical Support">Digital Account & IAM Access</option>
                      </select>
                    </div>
                  </div>

                  <div className="am-form-row-2">
                    <div className="am-form-field">
                      <label>Priority Level</label>
                      <select
                        value={ticketForm.priority}
                        onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                        disabled={submitting}
                      >
                        <option value="NORMAL">Normal Priority (2-hour response)</option>
                        <option value="HIGH">High Priority (30-minute response)</option>
                        <option value="URGENT">Critical / In-Transit Emergency (&lt; 15 mins)</option>
                      </select>
                    </div>
                    <div className="am-form-field">
                      <label>Associated Vehicle ID (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. 1, 7, 24"
                        value={ticketForm.vehicleId}
                        onChange={(e) => setTicketForm({ ...ticketForm, vehicleId: e.target.value })}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="am-form-field">
                    <label>Subject</label>
                    <input
                      type="text"
                      placeholder="Brief headline of your request"
                      value={ticketForm.subject}
                      onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                      disabled={submitting}
                    />
                  </div>

                  <div className="am-form-field">
                    <label>Detailed Message & Specifications *</label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Describe your inquiry, delivery timeline, or technical requirements in detail..."
                      value={ticketForm.message}
                      onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                      disabled={submitting}
                    />
                  </div>

                  <button type="submit" className="am-btn primary am-btn-large" disabled={submitting}>
                    {submitting ? 'Dispatching to Concierge Desk...' : 'Submit Priority Ticket →'}
                  </button>
                </form>
              </div>

              {/* Informational Column */}
              <div className="am-support-sidebar">
                <div className="am-service-guarantee-card">
                  <span className="am-badge-gold">THE STRATOS PLEDGE</span>
                  <h4>Guaranteed 100% Escrow Protection</h4>
                  <ul className="am-guarantee-list">
                    <li>
                      <b>Encrypted Payment Escrow:</b> Funds are released to verified dealers only after you accept vehicle delivery.
                    </li>
                    <li>
                      <b>7-Day / 500-Mile Trial:</b> If the vehicle does not match the 360° studio scan, we issue a 100% immediate refund.
                    </li>
                    <li>
                      <b>Complimentary Transport:</b> Nationwide covered delivery directly to your home or office driveway.
                    </li>
                    <li>
                      <b>Dedicated Specialist:</b> A single dedicated liaison handles your purchase from deposit to keys.
                    </li>
                  </ul>
                </div>

                <div className="am-concierge-team-card">
                  <h4>On-Duty Senior Liaisons</h4>
                  <div className="am-liaison-row">
                    <div className="am-avatar-pill">AC</div>
                    <div>
                      <b>Alex Chen</b>
                      <span>Chief of Concierge Services • Online</span>
                    </div>
                  </div>
                  <div className="am-liaison-row">
                    <div className="am-avatar-pill">MV</div>
                    <div>
                      <b>Marcus Vance</b>
                      <span>Master Diagnostic Inspector • Online</span>
                    </div>
                  </div>
                  <div className="am-liaison-row">
                    <div className="am-avatar-pill">ES</div>
                    <div>
                      <b>Elena Sterling</b>
                      <span>Escrow Settlement Director • Online</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Live Ticket Tracker */}
        {activeTab === 'track' && (
          <div className="am-support-panel">
            <div className="am-track-header">
              <div>
                <h3 className="am-panel-heading">Live Concierge Ticket Tracker</h3>
                <p className="am-panel-sub">
                  Inspect ticket history, response timestamps, and exchange real-time updates with assigned liaisons.
                </p>
              </div>
              <form onSubmit={handleTrackSearch} className="am-ticket-search-form">
                <input
                  type="text"
                  placeholder="Enter Ticket ID (e.g. TCK-1001)..."
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  className="am-search-input"
                />
                <button type="submit" className="am-btn secondary">Lookup</button>
              </form>
            </div>

            <div className="am-ticket-workspace-grid">
              {/* Left Ticket List */}
              <div className="am-ticket-list-column">
                <div className="am-list-header-label">Recent Desk Inquiries</div>
                {ticketsList.map((t) => (
                  <div
                    key={t.id}
                    className={`am-ticket-item-card ${selectedTicket?.id === t.id ? 'active' : ''}`}
                    onClick={() => setSelectedTicket(t)}
                  >
                    <div className="am-ticket-card-top">
                      <b>#{t.id}</b>
                      <span className={`am-status-badge ${t.status.toLowerCase()}`}>{t.status}</span>
                    </div>
                    <div className="am-ticket-card-subj">{t.subject}</div>
                    <div className="am-ticket-card-meta">
                      <span>{t.customerName}</span>
                      <span>{new Date(t.created).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Ticket Thread View */}
              <div className="am-ticket-detail-column">
                {selectedTicket ? (
                  <div className="am-ticket-view">
                    <div className="am-ticket-view-header">
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className="am-ticket-id-tag">#{selectedTicket.id}</span>
                          <span className="am-priority-pill">{selectedTicket.priority} PRIORITY</span>
                          <span className="am-category-tag">{selectedTicket.category}</span>
                        </div>
                        <h3 className="am-ticket-view-title">{selectedTicket.subject}</h3>
                      </div>
                      <div className="am-assigned-box">
                        <span className="am-assigned-label">Liaison Assigned:</span>
                        <b>{selectedTicket.assignedTo}</b>
                      </div>
                    </div>

                    <div className="am-ticket-meta-strip">
                      <span>Client: <b>{selectedTicket.customerName}</b> ({selectedTicket.email})</span>
                      <span>Phone: <b>{selectedTicket.phone}</b></span>
                      {selectedTicket.vehicleId && <span>Vehicle ID: <b>#{selectedTicket.vehicleId}</b></span>}
                    </div>

                    {/* Messages Transcript */}
                    <div className="am-ticket-chat-transcript">
                      {selectedTicket.messages &&
                        selectedTicket.messages.map((m, i) => (
                          <div
                            key={i}
                            className={`am-chat-bubble ${m.sender === 'support' ? 'support' : 'client'}`}
                          >
                            <div className="am-chat-bubble-header">
                              <b>{m.sender === 'support' ? selectedTicket.assignedTo : m.sender}</b>
                              <span>{new Date(m.time).toLocaleTimeString()}</span>
                            </div>
                            <p className="am-chat-bubble-text">{m.text}</p>
                          </div>
                        ))}
                    </div>

                    {/* Quick Reply Form */}
                    <form onSubmit={handleSendReply} className="am-ticket-reply-form">
                      <input
                        type="text"
                        placeholder="Type response to assigned concierge officer..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        className="am-reply-input"
                      />
                      <button type="submit" className="am-btn primary">Send Message</button>
                    </form>
                  </div>
                ) : (
                  <div className="am-empty-ticket-view">
                    <p>Select a ticket from the left panel to inspect the active concierge thread.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FAQ & Knowledge Base */}
        {activeTab === 'faq' && (
          <div className="am-support-panel">
            <div className="am-faq-header">
              <h3 className="am-panel-heading">Stratos Knowledge Base & FAQ</h3>
              <p className="am-panel-sub">
                Official documentation on vehicle condition guarantees, nationwide delivery, return policies, and escrow security.
              </p>
              <input
                type="text"
                placeholder="Search frequently asked questions..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="am-faq-search-input"
              />
            </div>

            <div className="am-faq-accordion-list">
              {filteredFaqs.map((faq, index) => (
                <div
                  key={index}
                  className={`am-faq-card ${expandedFaq === index ? 'expanded' : ''}`}
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  <div className="am-faq-question-row">
                    <span className="am-faq-q-text">{faq.q}</span>
                    <span className="am-faq-toggle-icon">{expandedFaq === index ? '−' : '+'}</span>
                  </div>
                  {expandedFaq === index && (
                    <div className="am-faq-answer-body">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Showroom Galleries & Service Centers */}
        {activeTab === 'locations' && (
          <div className="am-support-panel">
            <h3 className="am-panel-heading">Stratos Flagship Galleries & Service Pavilions</h3>
            <p className="am-panel-sub">
              Visit our certified delivery studios for private vehicle viewings, 360° turntable scans, and white-glove handover.
            </p>

            <div className="am-locations-grid">
              <div className="am-location-card">
                <span className="am-loc-city">Palo Alto, California</span>
                <h4>Silicon Valley Flagship Experience</h4>
                <p>2800 Sand Hill Road, Menlo Park / Palo Alto, CA 94025</p>
                <div className="am-loc-meta">
                  <span>Phone: +1 (650) 555-0199</span>
                  <span>Hours: Mon - Sun 9:00 AM - 8:00 PM PST</span>
                </div>
              </div>

              <div className="am-location-card">
                <span className="am-loc-city">Manhattan, New York</span>
                <h4>Hudson Yards Showcase Pavilion</h4>
                <p>500 West 33rd Street, Hudson Yards, New York, NY 10001</p>
                <div className="am-loc-meta">
                  <span>Phone: +1 (212) 555-0144</span>
                  <span>Hours: Mon - Sat 10:00 AM - 7:00 PM EST</span>
                </div>
              </div>

              <div className="am-location-card">
                <span className="am-loc-city">Beverly Hills, California</span>
                <h4>Rodeo Drive Collector Salon</h4>
                <p>9400 Wilshire Blvd, Beverly Hills, CA 90212</p>
                <div className="am-loc-meta">
                  <span>Phone: +1 (310) 555-0188</span>
                  <span>Hours: Mon - Sat 10:00 AM - 8:00 PM PST</span>
                </div>
              </div>

              <div className="am-location-card">
                <span className="am-loc-city">London, United Kingdom</span>
                <h4>Mayfair Automotive Gallery</h4>
                <p>15 Berkeley Square, Mayfair, London W1J 6BD, UK</p>
                <div className="am-loc-meta">
                  <span>Phone: +44 20 7946 0991</span>
                  <span>Hours: Mon - Fri 9:30 AM - 6:30 PM GMT</span>
                </div>
              </div>

              <div className="am-location-card">
                <span className="am-loc-city">Mumbai, India</span>
                <h4>Bandra-Kurla Complex Hub</h4>
                <p>G Block BKC, Bandra East, Mumbai, Maharashtra 400051</p>
                <div className="am-loc-meta">
                  <span>Phone: +91 22 5550 4321</span>
                  <span>Hours: Mon - Sat 10:00 AM - 8:00 PM IST</span>
                </div>
              </div>

              <div className="am-location-card highlight">
                <span className="am-loc-city">Nationwide Transport</span>
                <h4>Direct Enclosed Carrier Fleet</h4>
                <p>Climate-controlled transport direct to any residential address in 48 contiguous states.</p>
                <div className="am-loc-meta">
                  <span>GPS Telematics Beacon on all carrier trucks</span>
                  <span>Zero-deductible transit insurance included</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
