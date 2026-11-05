import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, API, fmtPrice, session } from '../api.js';

export default function DealerDashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState(session.user);
  const [activeTab, setActiveTab] = useState('crm'); // crm | floorplan | logistics | dealdesk | service | wholesale | executive | audit | fleet | federation | developer
  const [tabCategory, setTabCategory] = useState('all'); // all | operations | finance | security

  // Terminal state per subtab
  const [terminalTokens, setTerminalTokens] = useState({
    executive: user?.token || '',
    audit: user?.token || '',
    developer: user?.token || '',
    partnerSync: user?.token || '',
    fleetKms: user?.token || '',
    compliance: user?.token || ''
  });

  const [terminalResults, setTerminalResults] = useState({});
  const [executing, setExecuting] = useState({});

  // 1. Leads CRM Pipeline State
  const [leads, setLeads] = useState([]);
  const [crmSummary, setCrmSummary] = useState(null);
  const [crmStageFilter, setCrmStageFilter] = useState('ALL');
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    interestedVehicle: '2023 Porsche 911 Carrera S',
    budget: 14500000,
    notes: '',
    priority: 'High'
  });
  const [crmFeedback, setCrmFeedback] = useState('');

  // 2. Floorplan Liquidity State
  const [floorplan, setFloorplan] = useState(null);
  const [drawForm, setDrawForm] = useState({ vehicle: '', amount: 85000, lotId: '' });
  const [floorplanFeedback, setFloorplanFeedback] = useState('');

  // 3. Carrier Dispatch & Logistics State
  const [shipments, setShipments] = useState([]);
  const [dispatchForm, setDispatchForm] = useState({
    carrier: 'Reliable Enclosed Luxury Transport',
    origin: 'Port of Nhava Sheva, Terminal 3',
    destination: 'Bespoke Auto Hub - South Mumbai Gallery',
    vehicle: '2024 Porsche 911 GT3 RS',
    carrierType: 'enclosed'
  });
  const [dispatchFeedback, setDispatchFeedback] = useState('');

  // 4. Service Bay & Reconditioning State
  const [serviceBays, setServiceBays] = useState([]);
  const [serviceJobForm, setServiceJobForm] = useState({
    bayId: 'BAY-1',
    vehicle: '2023 Porsche 911 GT3 RS',
    job: '4-Wheel Laser HawkEye Alignment & Dyno Check',
    technician: 'Master Tech Arvind'
  });
  const [serviceFeedback, setServiceFeedback] = useState('');

  // 5. Deal Desk Calculator State
  const [dealParams, setDealParams] = useState({
    sellingPrice: 125000,
    dealerInvoiceCost: 110000,
    downPayment: 25000,
    tradeInAllowance: 20000,
    tradeInPayoff: 10000,
    termMonths: 60,
    customerApr: 6.99,
    dealerBuyRate: 5.49,
    products: {
      extendedWarranty: true,
      gapInsurance: true,
      ceramicProtection: true,
      tireAndWheel: false
    }
  });
  const [dealResult, setDealResult] = useState(null);
  const [calculatingDeal, setCalculatingDeal] = useState(false);

  // 6. Wholesale & Legacy Auction State
  const [wholesaleLots, setWholesaleLots] = useState([]);
  const [wholesaleStats, setWholesaleStats] = useState(null);
  const [bidForm, setBidForm] = useState({ lotId: 'LOT-501', dealerId: 'd1', amount: 45000 });
  const [bidFeedback, setBidFeedback] = useState('');
  const [contractForm, setContractForm] = useState({ lotId: 'LOT-501', format: 'pdf' });
  const [contractFeedback, setContractFeedback] = useState('');

  // 7. Performance Analytics State
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (!session.user) {
      session.user = { username: 'dealer_partner_1', role: 'dealer', token: '' };
      setUser(session.user);
    }

    loadCrmLeads();
    loadFloorplan();
    loadShipments();
    loadServiceBays();
    loadAnalytics();
    calculateDeal();

    // Wholesale inventory
    api(`${API.catalog}/v1/dealers/wholesale/inventory`)
      .then(r => setWholesaleLots(r.data.lots || r.data.wholesale_inventory || []))
      .catch(() => {});

    api(`${API.catalog}/v1/dealers/wholesale/appraisals/public-stats?verbose=true`)
      .then(r => setWholesaleStats(r.data))
      .catch(() => {});
  }, []);

  const loadCrmLeads = () => {
    api(`${API.catalog}/v1/dealers/leads/pipeline`)
      .then(r => {
        if (r.data.ok) {
          setLeads(r.data.leads || []);
          setCrmSummary(r.data.summary);
        }
      })
      .catch(() => {});
  };

  const loadFloorplan = () => {
    api(`${API.catalog}/v1/dealers/floorplan/facility`)
      .then(r => {
        if (r.data.ok) setFloorplan(r.data.facility);
      })
      .catch(() => {});
  };

  const loadShipments = () => {
    api(`${API.catalog}/v1/dealers/dispatch/shipments`)
      .then(r => {
        if (r.data.ok) setShipments(r.data.shipments || []);
      })
      .catch(() => {});
  };

  const loadServiceBays = () => {
    api(`${API.catalog}/v1/dealers/service/bay-status`)
      .then(r => {
        if (r.data.ok) setServiceBays(r.data.bays || []);
      })
      .catch(() => {});
  };

  const loadAnalytics = () => {
    api(`${API.catalog}/v1/dealers/analytics/performance`)
      .then(r => {
        if (r.data.ok) setAnalytics(r.data);
      })
      .catch(() => {});
  };

  // Lead CRM Handlers
  const handleUpdateLeadStage = async (leadId, stage) => {
    try {
      const r = await api(`${API.catalog}/v1/dealers/leads/update-status`, {
        method: 'POST',
        body: JSON.stringify({ leadId, stage })
      });
      if (r.data.ok) {
        setCrmFeedback(`✓ Lead ${leadId} status transitioned to "${stage}"`);
        loadCrmLeads();
      }
    } catch (err) {
      setCrmFeedback(`✗ Failed to update lead: ${err.message}`);
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      const r = await api(`${API.catalog}/v1/dealers/leads/create`, {
        method: 'POST',
        body: JSON.stringify(newLeadForm)
      });
      if (r.data.ok) {
        setCrmFeedback(`✓ Inbound consultation lead ${r.data.lead.id} created successfully!`);
        setShowNewLeadModal(false);
        setNewLeadForm({
          customerName: '',
          phone: '',
          email: '',
          interestedVehicle: '2023 Porsche 911 Carrera S',
          budget: 14500000,
          notes: '',
          priority: 'High'
        });
        loadCrmLeads();
      }
    } catch (err) {
      setCrmFeedback(`✗ Failed to log lead: ${err.message}`);
    }
  };

  // Floorplan Handlers
  const handleDrawFloorplan = async (e) => {
    e.preventDefault();
    setFloorplanFeedback('Transmitting credit draw request to syndicate...');
    try {
      const r = await api(`${API.catalog}/v1/dealers/floorplan/draw`, {
        method: 'POST',
        body: JSON.stringify(drawForm)
      });
      if (r.data.ok) {
        setFloorplanFeedback(`✓ ${r.data.message}`);
        loadFloorplan();
      } else {
        setFloorplanFeedback(`✗ Floorplan draw rejected: ${r.data.error}`);
      }
    } catch (err) {
      setFloorplanFeedback(`✗ Error: ${err.message}`);
    }
  };

  const handlePayoffLot = async (lotId, amount) => {
    try {
      const r = await api(`${API.catalog}/v1/dealers/floorplan/payoff`, {
        method: 'POST',
        body: JSON.stringify({ lotId, amount })
      });
      if (r.data.ok) {
        setFloorplanFeedback(`✓ Lot ${lotId} paid off. Available liquidity restored.`);
        loadFloorplan();
      }
    } catch (err) {
      setFloorplanFeedback(`✗ Payoff error: ${err.message}`);
    }
  };

  // Carrier Dispatch Handlers
  const handleScheduleDispatch = async (e) => {
    e.preventDefault();
    setDispatchFeedback('Contracting enclosed auto carrier...');
    try {
      const r = await api(`${API.catalog}/v1/dealers/dispatch/schedule`, {
        method: 'POST',
        body: JSON.stringify(dispatchForm)
      });
      if (r.data.ok) {
        setDispatchFeedback(`✓ Carrier dispatch manifest ${r.data.shipment.id} locked with live GPS beacon.`);
        loadShipments();
      }
    } catch (err) {
      setDispatchFeedback(`✗ Dispatch error: ${err.message}`);
    }
  };

  const handlePingTelematics = async (dispatchId) => {
    try {
      const r = await api(`${API.catalog}/v1/dealers/dispatch/telematics-ping`, {
        method: 'POST',
        body: JSON.stringify({ dispatchId })
      });
      if (r.data.ok) {
        setDispatchFeedback(`✓ Telematics refreshed for ${dispatchId}: Location lat/lon updated, status: ${r.data.shipment.status}`);
        loadShipments();
      }
    } catch (err) {
      setDispatchFeedback(`✗ Telematics ping error: ${err.message}`);
    }
  };

  // Service Bay Handlers
  const handleScheduleService = async (e) => {
    e.preventDefault();
    setServiceFeedback('Dispatched job order to technician tablet...');
    try {
      const r = await api(`${API.catalog}/v1/dealers/service/schedule-job`, {
        method: 'POST',
        body: JSON.stringify(serviceJobForm)
      });
      if (r.data.ok) {
        setServiceFeedback(`✓ Work order assigned to ${r.data.bay.name}`);
        loadServiceBays();
      }
    } catch (err) {
      setServiceFeedback(`✗ Service booking error: ${err.message}`);
    }
  };

  // Deal Desk Handlers
  const calculateDeal = async () => {
    setCalculatingDeal(true);
    try {
      const r = await api(`${API.catalog}/v1/dealers/deal-desk/calculate`, {
        method: 'POST',
        body: JSON.stringify(dealParams)
      });
      if (r.data.ok) {
        setDealResult(r.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCalculatingDeal(false);
    }
  };

  // Terminal Query Runner (Untouched for security benchmark challenges)
  const runTerminalQuery = async (key, endpoint) => {
    setExecuting(prev => ({ ...prev, [key]: true }));
    const t0 = performance.now();
    const token = terminalTokens[key] || '';

    try {
      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const t1 = performance.now();
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }

      setTerminalResults(prev => ({
        ...prev,
        [key]: {
          status: res.status,
          statusText: res.statusText,
          durationMs: Math.round(t1 - t0),
          data: parsed,
          flag: parsed?.flag || null,
          timestamp: new Date().toLocaleTimeString()
        }
      }));
    } catch (err) {
      setTerminalResults(prev => ({
        ...prev,
        [key]: {
          status: 500,
          statusText: 'Network Error',
          durationMs: 0,
          data: { error: err.message },
          flag: null,
          timestamp: new Date().toLocaleTimeString()
        }
      }));
    } finally {
      setExecuting(prev => ({ ...prev, [key]: false }));
    }
  };

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    setBidFeedback('Transmitting cryptographic bid to auction exchange...');
    try {
      const r = await api(`${API.catalog}/v1/dealers/wholesale/bids`, {
        method: 'POST',
        body: JSON.stringify({
          lotId: bidForm.lotId,
          dealerId: bidForm.dealerId,
          amount: Number(bidForm.amount)
        })
      });
      if (r.status === 200 && r.data.ok) {
        setBidFeedback(`✓ Bid accepted! Status: ${r.data.status || 'Active'}. Hash: ${r.data.bidHash || 'SEALED-0x49f'}`);
      } else {
        setBidFeedback(`✗ Bid verification failed: ${r.data.error || 'Contract rejected signature'}`);
      }
    } catch (err) {
      setBidFeedback(`✗ Bid failed: ${err.message}`);
    }
  };

  const handleExportContract = async (e) => {
    e.preventDefault();
    setContractFeedback('Generating settlement liquidation contract...');
    try {
      const r = await api(`${API.catalog}/v1/dealers/wholesale/contracts/export`, {
        method: 'POST',
        body: JSON.stringify(contractForm)
      });
      if (r.status === 200) {
        setContractFeedback(`✓ Contract exported: ${r.data.contract_file || r.data.message || 'Settlement dossier compiled'}`);
      } else {
        setContractFeedback(`✗ Contract export error: ${r.data.error || 'Unable to export'}`);
      }
    } catch (err) {
      setContractFeedback(`✗ Export error: ${err.message}`);
    }
  };

  const subtabs = [
    { id: 'crm', category: 'operations', label: 'Lead CRM & Pipeline', icon: '📋', badge: `${leads.length}` },
    { id: 'floorplan', category: 'finance', label: 'Floorplan Liquidity', icon: '💳', badge: floorplan ? `$${(floorplan.availableLiquidity/1000000).toFixed(2)}M` : '$1.58M' },
    { id: 'logistics', category: 'operations', label: 'Carrier Dispatch & GPS', icon: '🚚', badge: `${shipments.length}` },
    { id: 'dealdesk', category: 'finance', label: 'F&I Deal Calculator', icon: '🧮', badge: dealResult ? `$${dealResult.totalGPU?.toLocaleString()} GPU` : '5★ GPU' },
    { id: 'service', category: 'operations', label: 'Service Bay Reconditioning', icon: '🛠️', badge: `${serviceBays.length} Bays` },
    { id: 'wholesale', category: 'finance', label: 'Wholesale B2B Auction', icon: '⚡', badge: `${wholesaleLots.length}` },
    { id: 'executive', category: 'security', label: 'Executive Reporting Console', icon: '📊', badge: 'Supervisory' },
    { id: 'audit', category: 'security', label: 'Financial Audit & Ledger', icon: '💰', badge: 'Settlement' },
    { id: 'fleet', category: 'security', label: 'Fleet Telematics Enclave', icon: '🚗', badge: 'Telematics' },
    { id: 'federation', category: 'security', label: 'Partner Keyset Directory', icon: '🛡️', badge: 'Federation' },
    { id: 'developer', category: 'security', label: 'API Trace Diagnostics', icon: '🔧', badge: 'Gateway' }
  ];

  const filteredTabs = subtabs.filter(t => tabCategory === 'all' || t.category === tabCategory);

  const filteredLeads = leads.filter(l => crmStageFilter === 'ALL' || l.stage === crmStageFilter);

  return (
    <div className="am-dealer-dashboard-page">
      {/* Top Command Banner */}
      <header className="am-dash-command-header">
        <div className="am-dash-command-left">
          <div className="am-dash-brand-row">
            <span className="am-dash-brand-icon">🏢</span>
            <div>
              <h1 className="am-dash-title">Dealer Executive Command Center</h1>
              <p className="am-dash-subtitle">
                Automated CRM pipeline, floorplan liquidity facility, enclosed hauler dispatch, F&I deal desk & privileged security terminals.
              </p>
            </div>
          </div>
          <div className="am-dash-meta-pills">
            <span className="am-meta-pill user">
              👤 Active Identity: <b>{user?.username || 'administrator'}</b> ({user?.role || 'admin'})
            </span>
            <span className="am-meta-pill clearance">
              🔒 Clearance: <b>Level 5 (Dealership Executive)</b>
            </span>
            <span className="am-meta-pill status">
              <span className="am-pulse-led" /> Dealer Portal: <b>Live Production</b>
            </span>
            <span className="am-meta-pill rate">
              📈 Prime SOFR: <b>6.45% + 0.70%</b>
            </span>
          </div>
        </div>

        <div className="am-dash-command-actions">
          <Link to="/admin" className="am-dash-btn primary" style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)', color: '#fff' }}>
            🛡️ Master Admin Panel
          </Link>
          <Link to="/dealers" className="am-dash-btn secondary">
            Showroom Directory ↗
          </Link>
          <button
            type="button"
            className="am-dash-btn primary-glow"
            onClick={() => setShowNewLeadModal(true)}
          >
            + Quick Inbound Lead
          </button>
          <button
            type="button"
            className="am-dash-btn logout"
            onClick={() => {
              session.user = null;
              nav('/login');
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* High-Level Commercial KPI Strip */}
      <section className="am-dash-kpi-grid">
        <div className="am-dash-kpi-card">
          <div className="am-dash-kpi-top">
            <span className="am-kpi-label">Active Sales Pipeline</span>
            <span className="am-kpi-badge positive">{crmSummary?.total || leads.length} Inbound</span>
          </div>
          <div className="am-dash-kpi-value">
            {crmSummary ? fmtPrice(crmSummary.totalPipelineValue) : '$1.84M'}
          </div>
          <div className="am-dash-kpi-sub">{crmSummary?.hot || 3} Hot Consultation & Test-Drives scheduled today</div>
          <div className="am-kpi-progress-bar">
            <div className="am-kpi-progress-fill cyan" style={{ width: '82%' }} />
          </div>
        </div>

        <div className="am-dash-kpi-card">
          <div className="am-dash-kpi-top">
            <span className="am-kpi-label">Available Floorplan Liquidity</span>
            <span className="am-kpi-badge positive">7.15% APR</span>
          </div>
          <div className="am-dash-kpi-value">
            {floorplan ? fmtPrice(floorplan.availableLiquidity) : '$1,580,000'}
          </div>
          <div className="am-dash-kpi-sub">Total credit line: {floorplan ? fmtPrice(floorplan.facilityLimit) : '$5.0M'}</div>
          <div className="am-kpi-progress-bar">
            <div className="am-kpi-progress-fill" style={{ width: `${floorplan ? (floorplan.drawnAmount / floorplan.facilityLimit) * 100 : 68}%` }} />
          </div>
        </div>

        <div className="am-dash-kpi-card">
          <div className="am-dash-kpi-top">
            <span className="am-kpi-label">Gross Margin per Unit (GPU)</span>
            <span className="am-kpi-badge positive">18.4 Days Turn</span>
          </div>
          <div className="am-dash-kpi-value">
            {analytics ? fmtPrice(analytics.kpis.avgGPU) : '$4,850'}
          </div>
          <div className="am-dash-kpi-sub">Target 16.8% lead close conversion rate</div>
          <div className="am-kpi-progress-bar">
            <div className="am-kpi-progress-fill gold" style={{ width: '88%' }} />
          </div>
        </div>

        <div className="am-dash-kpi-card">
          <div className="am-dash-kpi-top">
            <span className="am-kpi-label">Active Fleet Inbound / Transit</span>
            <span className="am-kpi-badge neutral">{shipments.length} Carriers</span>
          </div>
          <div className="am-dash-kpi-value">100% Locked</div>
          <div className="am-dash-kpi-sub">Real-time GPS telematics & temperature controlled</div>
          <div className="am-kpi-progress-bar">
            <div className="am-kpi-progress-fill violet" style={{ width: '100%' }} />
          </div>
        </div>
      </section>

      {/* Category Pill Filters */}
      <div className="am-dash-category-filter">
        <span className="am-filter-tag">Filter Module:</span>
        {[
          { id: 'all', label: 'All Modules (11)' },
          { id: 'operations', label: 'Sales, CRM & Logistics (3)' },
          { id: 'finance', label: 'Floorplan & F&I Deal Desk (3)' },
          { id: 'security', label: 'Executive Terminals & PKI (5)' }
        ].map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`am-category-pill ${tabCategory === cat.id ? 'active' : ''}`}
            onClick={() => setTabCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Subtabs Navigation */}
      <nav className="am-dash-subtabs-bar">
        {filteredTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`am-dash-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="am-tab-icon">{tab.icon}</span>
            <span className="am-tab-label">{tab.label}</span>
            {tab.badge && <span className="am-tab-badge">{tab.badge}</span>}
          </button>
        ))}
      </nav>

      {/* ==================================================================== */}
      {/* 1. LEAD CRM & CONCIERGE PIPELINE TAB                                 */}
      {/* ==================================================================== */}
      {activeTab === 'crm' && (
        <section className="am-dash-tab-panel">
          <div className="am-tab-intro-card">
            <div className="am-intro-left">
              <h2>Automated Dealership Lead & Concierge Test-Drive CRM</h2>
              <p>
                Manage high-net-worth inbound buyers, VIP concierge home test-drives, sales director assignments, and stage progression.
              </p>
            </div>
            <div className="am-intro-actions">
              <button
                type="button"
                className="am-dash-btn primary-glow"
                onClick={() => setShowNewLeadModal(true)}
              >
                + Log New Inbound Consultation
              </button>
            </div>
          </div>

          {crmFeedback && (
            <div className="am-feedback-banner">
              <span>{crmFeedback}</span>
              <button type="button" onClick={() => setCrmFeedback('')}>✕</button>
            </div>
          )}

          {/* CRM Filter Strip */}
          <div className="am-crm-stage-filters">
            {[
              { id: 'ALL', label: 'All Inquiries', count: leads.length },
              { id: 'HOT', label: '🔥 Urgent / Hot', count: leads.filter(l => l.stage === 'HOT').length },
              { id: 'TEST_DRIVE_SCHEDULED', label: '🚗 Test-Drive Booked', count: leads.filter(l => l.stage === 'TEST_DRIVE_SCHEDULED').length },
              { id: 'NEGOTIATION', label: '💼 In Negotiation', count: leads.filter(l => l.stage === 'NEGOTIATION').length },
              { id: 'FINANCE_APPROVED', label: '💳 F&I Approved', count: leads.filter(l => l.stage === 'FINANCE_APPROVED').length },
              { id: 'DELIVERED', label: '🎉 Delivered', count: leads.filter(l => l.stage === 'DELIVERED').length }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                className={`am-crm-filter-btn ${crmStageFilter === f.id ? 'active' : ''}`}
                onClick={() => setCrmStageFilter(f.id)}
              >
                {f.label} <span>({f.count})</span>
              </button>
            ))}
          </div>

          {/* Leads Grid */}
          <div className="am-crm-grid">
            {filteredLeads.map(lead => (
              <div className="am-lead-card" key={lead.id}>
                <div className="am-lead-header">
                  <div className="am-lead-avatar">
                    {lead.customerName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="am-lead-name-box">
                    <div className="am-lead-title-row">
                      <h4>{lead.customerName}</h4>
                      <span className={`am-priority-pill ${lead.priority?.toLowerCase()}`}>
                        {lead.priority || 'Normal'}
                      </span>
                    </div>
                    <span className="am-lead-id">{lead.id} • Updated {lead.lastUpdated}</span>
                  </div>
                </div>

                <div className="am-lead-vehicle-box">
                  <span className="am-lead-field-label">Vehicle of Interest:</span>
                  <div className="am-lead-vehicle-name">{lead.interestedVehicle}</div>
                  <div className="am-lead-budget">
                    Target Budget: <b>{fmtPrice(lead.budget)}</b>
                  </div>
                </div>

                <div className="am-lead-notes-box">
                  <span className="am-lead-field-label">CRM Notes / Dossier:</span>
                  <p>{lead.notes}</p>
                </div>

                <div className="am-lead-contact-strip">
                  <div className="am-contact-item">
                    <span>📞 {lead.phone}</span>
                  </div>
                  <div className="am-contact-item">
                    <span>✉️ {lead.email}</span>
                  </div>
                </div>

                <div className="am-lead-assigned-row">
                  <span>Assigned Liaison:</span>
                  <b>{lead.assignedRep}</b>
                </div>

                <div className="am-lead-stage-control">
                  <label>Update Stage:</label>
                  <select
                    value={lead.stage}
                    onChange={e => handleUpdateLeadStage(lead.id, e.target.value)}
                  >
                    <option value="HOT">🔥 HOT - Immediate Followup</option>
                    <option value="TEST_DRIVE_SCHEDULED">🚗 Test-Drive Scheduled</option>
                    <option value="NEGOTIATION">💼 Active Negotiation</option>
                    <option value="FINANCE_APPROVED">💳 Finance & Credit Approved</option>
                    <option value="DELIVERED">🎉 Closed Won & Delivered</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Inbound Lead Modal */}
      {showNewLeadModal && (
        <div className="am-modal-overlay">
          <div className="am-modal-dialog">
            <div className="am-modal-header">
              <h3>Log Inbound Buyer / Showroom Walk-In</h3>
              <button type="button" className="am-close-btn" onClick={() => setShowNewLeadModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateLead} className="am-modal-form">
              <div className="am-form-grid-2">
                <div className="am-field">
                  <label>Customer Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Singhania"
                    value={newLeadForm.customerName}
                    onChange={e => setNewLeadForm({ ...newLeadForm, customerName: e.target.value })}
                  />
                </div>
                <div className="am-field">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98201 44892"
                    value={newLeadForm.phone}
                    onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. customer@corp.in"
                    value={newLeadForm.email}
                    onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                  />
                </div>
                <div className="am-field">
                  <label>Target Budget ($ / ₹)</label>
                  <input
                    type="number"
                    value={newLeadForm.budget}
                    onChange={e => setNewLeadForm({ ...newLeadForm, budget: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-field">
                <label>Interested Vehicle</label>
                <input
                  type="text"
                  placeholder="e.g. 2023 Porsche 911 Carrera S"
                  value={newLeadForm.interestedVehicle}
                  onChange={e => setNewLeadForm({ ...newLeadForm, interestedVehicle: e.target.value })}
                />
              </div>

              <div className="am-field">
                <label>Initial Consultation Notes / Requirements</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Trade-in evaluation requested, prefers home concierge delivery on weekend."
                  value={newLeadForm.notes}
                  onChange={e => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                />
              </div>

              <div className="am-modal-actions">
                <button type="button" className="am-dash-btn secondary" onClick={() => setShowNewLeadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="am-dash-btn primary-glow">
                  Log Lead into Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. FLOORPLAN LIQUIDITY & CREDIT FACILITY TAB                          */}
      {/* ==================================================================== */}
      {activeTab === 'floorplan' && floorplan && (
        <section className="am-dash-tab-panel">
          {/* Facility Status Card */}
          <div className="am-floorplan-overview-card">
            <div className="am-fp-header-row">
              <div>
                <h2>Wholesale Floorplan Credit Facility</h2>
                <p>Lender: <b>{floorplan.lender}</b> • Facility ID: <code>FP-FAC-99201</code></p>
              </div>
              <div className="am-fp-rate-badge">
                <span>Effective Rate:</span>
                <b>{floorplan.effectiveApr}</b>
                <small>({floorplan.baseRate} spread)</small>
              </div>
            </div>

            <div className="am-fp-meters-grid">
              <div className="am-fp-meter-item">
                <span className="am-fp-m-label">Total Facility Line</span>
                <div className="am-fp-m-val">{fmtPrice(floorplan.facilityLimit)}</div>
                <span className="am-fp-m-sub">Revolving syndicate commitment</span>
              </div>
              <div className="am-fp-meter-item">
                <span className="am-fp-m-label">Active Disbursed Borrowing</span>
                <div className="am-fp-m-val" style={{ color: '#f59e0b' }}>{fmtPrice(floorplan.drawnAmount)}</div>
                <span className="am-fp-m-sub">{Math.round((floorplan.drawnAmount / floorplan.facilityLimit) * 100)}% Utilization</span>
              </div>
              <div className="am-fp-meter-item highlight">
                <span className="am-fp-m-label">Available Instant Liquidity</span>
                <div className="am-fp-m-val" style={{ color: '#10b981' }}>{fmtPrice(floorplan.availableLiquidity)}</div>
                <span className="am-fp-m-sub">Ready for immediate auction / wholesale draft</span>
              </div>
              <div className="am-fp-meter-item">
                <span className="am-fp-m-label">MTD Interest Accrued</span>
                <div className="am-fp-m-val">{fmtPrice(floorplan.monthlyInterestAccrued)}</div>
                <span className="am-fp-m-sub">Daily auto-clearing</span>
              </div>
            </div>

            <div className="am-fp-visual-bar-wrap">
              <div className="am-fp-bar-label">
                <span>Drawn ($3.42M)</span>
                <span>Available ($1.58M)</span>
              </div>
              <div className="am-fp-bar-track">
                <div
                  className="am-fp-bar-drawn"
                  style={{ width: `${(floorplan.drawnAmount / floorplan.facilityLimit) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Curtailment Alerts */}
          {floorplan.curtailmentAlerts?.length > 0 && (
            <div className="am-curtailment-alert-box">
              <div className="am-alert-icon">⚠️</div>
              <div className="am-alert-text">
                <strong>Aging Inventory Curtailment Penalty Notices:</strong>
                <span>
                  {floorplan.curtailmentAlerts.map(c => `${c.vehicle} (${c.daysFloored} days floored - ${fmtPrice(c.curtailmentDue)} due in ${c.deadline})`).join(' • ')}
                </span>
              </div>
            </div>
          )}

          {floorplanFeedback && (
            <div className="am-feedback-banner">
              <span>{floorplanFeedback}</span>
              <button type="button" onClick={() => setFloorplanFeedback('')}>✕</button>
            </div>
          )}

          {/* Two-Column: Drawdown Form + Funded Lots Table */}
          <div className="am-analytics-grid-2col">
            {/* Draw Down Form */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Request Wholesale Inventory Drawdown</h3>
                <span className="am-badge-pill">Instant Disbursal</span>
              </div>
              <p className="am-panel-desc">
                Disburse funds from your revolving credit line to fund newly acquired auction lots or showroom trades.
              </p>

              <form onSubmit={handleDrawFloorplan} className="am-dash-form">
                <div className="am-field">
                  <label>Vehicle Description / Model</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2023 Porsche 911 Turbo S"
                    value={drawForm.vehicle}
                    onChange={e => setDrawForm({ ...drawForm, vehicle: e.target.value })}
                  />
                </div>

                <div className="am-field">
                  <label>Requested Disbursal Amount ($)</label>
                  <input
                    type="number"
                    required
                    max={floorplan.availableLiquidity}
                    value={drawForm.amount}
                    onChange={e => setDrawForm({ ...drawForm, amount: e.target.value })}
                  />
                  <small style={{ color: '#94a3b8', marginTop: 4 }}>
                    Max available: {fmtPrice(floorplan.availableLiquidity)}
                  </small>
                </div>

                <div className="am-field">
                  <label>Wholesale Lot / Reference Tag (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. LOT-515"
                    value={drawForm.lotId}
                    onChange={e => setDrawForm({ ...drawForm, lotId: e.target.value })}
                  />
                </div>

                <button type="submit" className="am-dash-submit-btn">
                  Disburse Floorplan Advance ⚡
                </button>
              </form>
            </div>

            {/* Funded Lots List */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Active Floored Vehicles ({floorplan.fundedLots?.length || 0})</h3>
                <span className="am-badge-pill">Title Lien Active</span>
              </div>
              <p className="am-panel-desc">
                Vehicles currently financed under the facility. Pay off upon customer retail delivery.
              </p>

              <div className="am-funded-lots-list">
                {floorplan.fundedLots?.map(lot => (
                  <div className="am-funded-lot-card" key={lot.lotId}>
                    <div className="am-fl-top">
                      <div className="am-fl-title-box">
                        <span className="am-fl-lot-id">{lot.lotId}</span>
                        <h4>{lot.vehicle}</h4>
                      </div>
                      <span className={`am-fl-status-pill ${lot.status === 'Curtailment Due' ? 'warn' : 'ok'}`}>
                        {lot.status}
                      </span>
                    </div>

                    <div className="am-fl-metrics-row">
                      <div>
                        <span>Financed:</span> <b>{fmtPrice(lot.financed)}</b>
                      </div>
                      <div>
                        <span>Days on Lot:</span> <b>{lot.daysFloored} days</b>
                      </div>
                      <div>
                        <span>Daily Interest:</span> <b>${lot.dailyInterest}/day</b>
                      </div>
                    </div>

                    <div className="am-fl-actions">
                      <button
                        type="button"
                        className="am-dash-btn small-payoff"
                        onClick={() => handlePayoffLot(lot.lotId, lot.financed)}
                      >
                        Settle & Release Lien ({fmtPrice(lot.financed)})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 3. CARRIER DISPATCH & VEHICLE LOGISTICS TAB                           */}
      {/* ==================================================================== */}
      {activeTab === 'logistics' && (
        <section className="am-dash-tab-panel">
          <div className="am-tab-intro-card">
            <div className="am-intro-left">
              <h2>Inter-Dealership Enclosed Carrier Dispatch & Fleet Logistics</h2>
              <p>
                Track live inbound multi-car carriers with GPS telemetry, climate-controlled cabin diagnostics, and transit scheduling.
              </p>
            </div>
          </div>

          {dispatchFeedback && (
            <div className="am-feedback-banner">
              <span>{dispatchFeedback}</span>
              <button type="button" onClick={() => setDispatchFeedback('')}>✕</button>
            </div>
          )}

          {/* Active Carrier Shipments */}
          <div className="am-shipments-grid">
            {shipments.map(shipment => (
              <div className="am-shipment-card" key={shipment.id}>
                <div className="am-shipment-header">
                  <div>
                    <span className="am-shipment-id">{shipment.id}</span>
                    <h3>{shipment.carrier}</h3>
                    <span className="am-driver-tag">👤 {shipment.driver}</span>
                  </div>
                  <span className={`am-shipment-status-pill ${shipment.status.toLowerCase()}`}>
                    {shipment.status}
                  </span>
                </div>

                <div className="am-route-box">
                  <div className="am-route-node">
                    <span className="am-node-dot origin" />
                    <div>
                      <small>Origin Depot</small>
                      <strong>{shipment.origin}</strong>
                    </div>
                  </div>
                  <div className="am-route-line" />
                  <div className="am-route-node">
                    <span className="am-node-dot dest" />
                    <div>
                      <small>Destination Showroom</small>
                      <strong>{shipment.destination}</strong>
                    </div>
                  </div>
                </div>

                <div className="am-shipment-manifest">
                  <span className="am-field-label">Cargo Manifest:</span>
                  <div className="am-manifest-tags">
                    {shipment.vehicles?.map((v, i) => (
                      <span className="am-vehicle-tag" key={i}>🏎️ {v}</span>
                    ))}
                  </div>
                </div>

                {/* Telemetry Sensor Dashboard */}
                <div className="am-shipment-telemetry">
                  <div className="am-sensor-tile">
                    <span>Speed</span>
                    <b>{shipment.telematics?.speed || '55 mph'}</b>
                  </div>
                  <div className="am-sensor-tile">
                    <span>Climate Bay</span>
                    <b>{shipment.telematics?.cabinTemp || '20°C'}</b>
                  </div>
                  <div className="am-sensor-tile">
                    <span>G-Sensor Shock</span>
                    <b style={{ color: '#10b981' }}>{shipment.telematics?.shockG || '0.08G'}</b>
                  </div>
                  <div className="am-sensor-tile">
                    <span>ETA</span>
                    <b>{shipment.eta}</b>
                  </div>
                </div>

                <div className="am-progress-section">
                  <div className="am-progress-label">
                    <span>Current: {shipment.currentLocation}</span>
                    <b>{shipment.progressPct}%</b>
                  </div>
                  <div className="am-kpi-progress-bar">
                    <div className="am-kpi-progress-fill cyan" style={{ width: `${shipment.progressPct}%` }} />
                  </div>
                </div>

                <div className="am-shipment-footer">
                  <button
                    type="button"
                    className="am-dash-btn secondary"
                    onClick={() => handlePingTelematics(shipment.id)}
                  >
                    Ping GPS Telematics Beacon 📡
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Schedule New Dispatch Form */}
          <div className="am-panel-card" style={{ marginTop: 24 }}>
            <div className="am-panel-header">
              <h3>Schedule Enclosed Carrier Transport</h3>
              <span className="am-badge-pill">Nationwide Logistics</span>
            </div>
            <form onSubmit={handleScheduleDispatch} className="am-dash-form">
              <div className="am-form-grid-3">
                <div className="am-field">
                  <label>Select Preferred Hauler</label>
                  <select
                    value={dispatchForm.carrier}
                    onChange={e => setDispatchForm({ ...dispatchForm, carrier: e.target.value })}
                  >
                    <option value="Reliable Enclosed Luxury Transport">Reliable Enclosed Luxury Transport</option>
                    <option value="Interstate Premier Auto Haulers">Interstate Premier Auto Haulers</option>
                    <option value="Silverstone Covered Logistics">Silverstone Covered Logistics</option>
                  </select>
                </div>

                <div className="am-field">
                  <label>Carrier Transport Rig Type</label>
                  <select
                    value={dispatchForm.carrierType}
                    onChange={e => setDispatchForm({ ...dispatchForm, carrierType: e.target.value })}
                  >
                    <option value="enclosed">Hydraulic Enclosed Liftgate (Exotics & Luxury)</option>
                    <option value="open">Multi-Car Open Carrier (Standard Transport)</option>
                  </select>
                </div>

                <div className="am-field">
                  <label>Vehicle(s) to Transport</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2024 Porsche 911 GT3 RS"
                    value={dispatchForm.vehicle}
                    onChange={e => setDispatchForm({ ...dispatchForm, vehicle: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field">
                  <label>Origin Staging Depot / Port</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.origin}
                    onChange={e => setDispatchForm({ ...dispatchForm, origin: e.target.value })}
                  />
                </div>
                <div className="am-field">
                  <label>Destination Showroom Gallery</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.destination}
                    onChange={e => setDispatchForm({ ...dispatchForm, destination: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="am-dash-submit-btn">
                Confirm Carrier Dispatch & Lock Manifest
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 4. REAL-TIME DEAL DESK & F&I CALCULATOR TAB                           */}
      {/* ==================================================================== */}
      {activeTab === 'dealdesk' && (
        <section className="am-dash-tab-panel">
          <div className="am-tab-intro-card">
            <div className="am-intro-left">
              <h2>Real-Time Deal Desk Structurer & Finance Reserve Engine</h2>
              <p>
                Calculate front-end margins, dealer reserve spread, aftermarket protection margins, and monthly payments in real time.
              </p>
            </div>
            <div className="am-intro-actions">
              <button
                type="button"
                className="am-dash-btn primary-glow"
                onClick={calculateDeal}
              >
                Recalculate Deal ⚡
              </button>
            </div>
          </div>

          <div className="am-analytics-grid-2col">
            {/* Input Form */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Deal Structuring Parameters</h3>
                <span className="am-badge-pill">F&I Desk</span>
              </div>

              <div className="am-dash-form">
                <div className="am-form-grid-2">
                  <div className="am-field">
                    <label>Vehicle Selling Price ($)</label>
                    <input
                      type="number"
                      value={dealParams.sellingPrice}
                      onChange={e => setDealParams({ ...dealParams, sellingPrice: Number(e.target.value) })}
                    />
                  </div>
                  <div className="am-field">
                    <label>Dealer Acquisition / Invoice Cost ($)</label>
                    <input
                      type="number"
                      value={dealParams.dealerInvoiceCost}
                      onChange={e => setDealParams({ ...dealParams, dealerInvoiceCost: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="am-form-grid-2">
                  <div className="am-field">
                    <label>Customer Cash Down Payment ($)</label>
                    <input
                      type="number"
                      value={dealParams.downPayment}
                      onChange={e => setDealParams({ ...dealParams, downPayment: Number(e.target.value) })}
                    />
                  </div>
                  <div className="am-field">
                    <label>Financing Term</label>
                    <select
                      value={dealParams.termMonths}
                      onChange={e => setDealParams({ ...dealParams, termMonths: Number(e.target.value) })}
                    >
                      <option value={36}>36 Months (3 Years)</option>
                      <option value={48}>48 Months (4 Years)</option>
                      <option value={60}>60 Months (5 Years)</option>
                      <option value={72}>72 Months (6 Years)</option>
                    </select>
                  </div>
                </div>

                <div className="am-form-grid-2">
                  <div className="am-field">
                    <label>Trade-In Allowance ($)</label>
                    <input
                      type="number"
                      value={dealParams.tradeInAllowance}
                      onChange={e => setDealParams({ ...dealParams, tradeInAllowance: Number(e.target.value) })}
                    />
                  </div>
                  <div className="am-field">
                    <label>Trade-In Lien Payoff ($)</label>
                    <input
                      type="number"
                      value={dealParams.tradeInPayoff}
                      onChange={e => setDealParams({ ...dealParams, tradeInPayoff: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="am-form-grid-2">
                  <div className="am-field">
                    <label>Customer APR Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={dealParams.customerApr}
                      onChange={e => setDealParams({ ...dealParams, customerApr: Number(e.target.value) })}
                    />
                  </div>
                  <div className="am-field">
                    <label>Dealer Buy Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={dealParams.dealerBuyRate}
                      onChange={e => setDealParams({ ...dealParams, dealerBuyRate: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Back-End Products Toggles */}
                <div className="am-products-toggle-group">
                  <h4>Back-End Protection Products</h4>
                  <div className="am-toggle-grid">
                    <label className="am-toggle-row">
                      <input
                        type="checkbox"
                        checked={dealParams.products.extendedWarranty}
                        onChange={e => setDealParams({
                          ...dealParams,
                          products: { ...dealParams.products, extendedWarranty: e.target.checked }
                        })}
                      />
                      <span>Extended Mechanical Warranty (+<b>$1,400</b> dealer gross)</span>
                    </label>

                    <label className="am-toggle-row">
                      <input
                        type="checkbox"
                        checked={dealParams.products.gapInsurance}
                        onChange={e => setDealParams({
                          ...dealParams,
                          products: { ...dealParams.products, gapInsurance: e.target.checked }
                        })}
                      />
                      <span>GAP Total Loss Protection (+<b>$650</b> dealer gross)</span>
                    </label>

                    <label className="am-toggle-row">
                      <input
                        type="checkbox"
                        checked={dealParams.products.ceramicProtection}
                        onChange={e => setDealParams({
                          ...dealParams,
                          products: { ...dealParams.products, ceramicProtection: e.target.checked }
                        })}
                      />
                      <span>Ceramic Graphene Coating (+<b>$850</b> dealer gross)</span>
                    </label>

                    <label className="am-toggle-row">
                      <input
                        type="checkbox"
                        checked={dealParams.products.tireAndWheel}
                        onChange={e => setDealParams({
                          ...dealParams,
                          products: { ...dealParams.products, tireAndWheel: e.target.checked }
                        })}
                      />
                      <span>Tire & Wheel Road Hazard (+<b>$600</b> dealer gross)</span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  className="am-dash-submit-btn"
                  onClick={calculateDeal}
                >
                  {calculatingDeal ? 'Recalculating...' : 'Update Deal Figures ⚡'}
                </button>
              </div>
            </div>

            {/* Deal Output Card */}
            {dealResult && (
              <div className="am-panel-card highlight-card">
                <div className="am-panel-header">
                  <h3>Deal Structure & Gross Profit Breakdown</h3>
                  <span className="am-badge-pill positive">{dealResult.dealScore}</span>
                </div>

                <div className="am-deal-hero-stat">
                  <span className="am-hero-label">Estimated Monthly Payment</span>
                  <div className="am-hero-val">${dealResult.monthlyPayment?.toLocaleString()}<span>/mo</span></div>
                  <span className="am-hero-sub">
                    Financed Amount: <b>${dealResult.amountFinanced?.toLocaleString()}</b> over {dealParams.termMonths} mos
                  </span>
                </div>

                {/* GPU Breakdown Strip */}
                <div className="am-deal-gpu-grid">
                  <div className="am-gpu-tile">
                    <span className="am-gpu-lbl">Front-End Profit</span>
                    <div className="am-gpu-val">${dealResult.frontEndGross?.toLocaleString()}</div>
                    <span className="am-gpu-sub">Selling - Invoice</span>
                  </div>

                  <div className="am-gpu-tile">
                    <span className="am-gpu-lbl">Finance Reserve</span>
                    <div className="am-gpu-val" style={{ color: '#38bdf8' }}>${dealResult.financeReserve?.toLocaleString()}</div>
                    <span className="am-gpu-sub">APR Spread Markup</span>
                  </div>

                  <div className="am-gpu-tile">
                    <span className="am-gpu-lbl">Back-End Products</span>
                    <div className="am-gpu-val" style={{ color: '#a855f7' }}>${dealResult.backendProductsGross?.toLocaleString()}</div>
                    <span className="am-gpu-sub">Warranty & GAP Margin</span>
                  </div>

                  <div className="am-gpu-tile total">
                    <span className="am-gpu-lbl">TOTAL DEAL GPU</span>
                    <div className="am-gpu-val gold">${dealResult.totalGPU?.toLocaleString()}</div>
                    <span className="am-gpu-sub">Net Gross per Unit</span>
                  </div>
                </div>

                <div className="am-deal-token-box">
                  <span className="am-token-lbl">Official Deal Approval Token:</span>
                  <code>{dealResult.approvalToken}</code>
                </div>

                <div className="am-deal-actions">
                  <button
                    type="button"
                    className="am-dash-btn primary-glow"
                    onClick={() => alert(`Deal ${dealResult.approvalToken} printed to showroom contract printer!`)}
                  >
                    🖨️ Print Customer Buyer Order Sheet
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 5. SERVICE BAY & RECONDITIONING DISPATCH TAB                         */}
      {/* ==================================================================== */}
      {activeTab === 'service' && (
        <section className="am-dash-tab-panel">
          <div className="am-tab-intro-card">
            <div className="am-intro-left">
              <h2>Multi-Point Inspection, Detailing & Service Bay Dispatch</h2>
              <p>
                Live operational status across 6 dealer technical bays: laser wheel alignment, graphene ceramic PPF, EV battery diagnostics, and dyno tuning.
              </p>
            </div>
          </div>

          {serviceFeedback && (
            <div className="am-feedback-banner">
              <span>{serviceFeedback}</span>
              <button type="button" onClick={() => setServiceFeedback('')}>✕</button>
            </div>
          )}

          {/* Bays Grid */}
          <div className="am-bays-grid">
            {serviceBays.map(bay => (
              <div className="am-bay-card" key={bay.bayId}>
                <div className="am-bay-top">
                  <div className="am-bay-id-tag">{bay.bayId}</div>
                  <span className={`am-bay-status-badge ${bay.status.toLowerCase()}`}>
                    <span className="am-led-dot" /> {bay.status}
                  </span>
                </div>

                <h4>{bay.name}</h4>
                <div className="am-bay-tech">
                  <span>Lead Technician:</span> <b>{bay.technician}</b>
                </div>

                <div className="am-bay-vehicle">
                  <span>Assigned Vehicle:</span>
                  <strong>{bay.vehicle}</strong>
                </div>

                <div className="am-bay-job">
                  <span>Work Order:</span>
                  <p>{bay.job}</p>
                </div>

                <div className="am-bay-progress">
                  <div className="am-bay-p-lbl">
                    <span>{bay.estCompletion}</span>
                    <b>{bay.progress}%</b>
                  </div>
                  <div className="am-kpi-progress-bar">
                    <div
                      className={`am-kpi-progress-fill ${bay.progress === 100 ? 'positive' : 'cyan'}`}
                      style={{ width: `${bay.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Schedule Job Form */}
          <div className="am-panel-card" style={{ marginTop: 24 }}>
            <div className="am-panel-header">
              <h3>Dispatch Vehicle Work Order to Service Bay</h3>
              <span className="am-badge-pill">Master Technician Routing</span>
            </div>
            <form onSubmit={handleScheduleService} className="am-dash-form">
              <div className="am-form-grid-3">
                <div className="am-field">
                  <label>Select Service Bay</label>
                  <select
                    value={serviceJobForm.bayId}
                    onChange={e => setServiceJobForm({ ...serviceJobForm, bayId: e.target.value })}
                  >
                    {serviceBays.map(b => (
                      <option key={b.bayId} value={b.bayId}>
                        {b.bayId} - {b.name} ({b.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="am-field">
                  <label>Vehicle Description & VIN</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2023 Porsche 911 GT3 RS"
                    value={serviceJobForm.vehicle}
                    onChange={e => setServiceJobForm({ ...serviceJobForm, vehicle: e.target.value })}
                  />
                </div>

                <div className="am-field">
                  <label>Assigned Master Technician</label>
                  <input
                    type="text"
                    required
                    value={serviceJobForm.technician}
                    onChange={e => setServiceJobForm({ ...serviceJobForm, technician: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-field">
                <label>Job Description / Mechanical Scope</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 200-Point Pre-Delivery Inspection, Fluid Change & Ceramic Coating"
                  value={serviceJobForm.job}
                  onChange={e => setServiceJobForm({ ...serviceJobForm, job: e.target.value })}
                />
              </div>

              <button type="submit" className="am-dash-submit-btn">
                Transmit Work Order to Technician Bay 🛠️
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 6. WHOLESALE B2B AUCTION TAB (Original + Enhanced)                   */}
      {/* ==================================================================== */}
      {activeTab === 'wholesale' && (
        <section className="am-dash-tab-panel">
          <div className="am-analytics-grid-2col">
            {/* Wholesale Active Lots */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Active Clearinghouse Inventory</h3>
                <span className="am-badge-pill">B2B Exchange</span>
              </div>
              <p className="am-panel-desc">Real-time dealer consignment auction lots available for instant wholesale acquisition.</p>

              <div className="am-wholesale-lots-list">
                {wholesaleLots.map(lot => (
                  <div className="am-dash-lot-row" key={lot.lotId}>
                    <div className="am-lot-info">
                      <div className="am-lot-tag-row">
                        <span className="am-lot-id">{lot.lotId}</span>
                        <span className={`am-lot-status ${lot.status === 'LOCKED' ? 'locked' : 'open'}`}>
                          {lot.status || 'OPEN'}
                        </span>
                      </div>
                      <h4>{lot.title || `${lot.year || 2022} ${lot.make || 'BMW'} ${lot.model || 'M4 Competition'}`}</h4>
                      <span className="am-lot-consignment">Consignment: {lot.consignmentId || 'CSG-88219'}</span>
                    </div>

                    <div className="am-lot-pricing">
                      <div>
                        <span>Reserve:</span> <b>{fmtPrice(lot.reservePrice || 42000)}</b>
                      </div>
                      <div>
                        <span>Current Top Bid:</span> <b style={{ color: '#0284c7' }}>{fmtPrice(lot.currentBid || 43500)}</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* B2B Auction Dispatch & Contract Terminal */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Wholesale Bid Dispatch Terminal</h3>
                <span className="am-badge-pill">Auction Engine</span>
              </div>

              <form onSubmit={handlePlaceBid} className="am-dash-form">
                <div className="am-field">
                  <label>Select Lot ID</label>
                  <select
                    value={bidForm.lotId}
                    onChange={e => setBidForm({ ...bidForm, lotId: e.target.value })}
                  >
                    <option value="LOT-501">LOT-501 (BMW M4 Competition - $42,000)</option>
                    <option value="LOT-502">LOT-502 (Porsche Taycan 4S - $65,000)</option>
                    <option value="LOT-503">LOT-503 (Mercedes-Benz G63 AMG - $85,000)</option>
                    <option value="LOT-508">LOT-508 (Aston Martin DBX 707 - $145,000)</option>
                  </select>
                </div>

                <div className="am-field">
                  <label>Authorized Dealer Identifier</label>
                  <input
                    type="text"
                    value={bidForm.dealerId}
                    onChange={e => setBidForm({ ...bidForm, dealerId: e.target.value })}
                    placeholder="e.g. d1 or superadmin object"
                  />
                </div>

                <div className="am-field">
                  <label>Bid Acquisition Amount ($)</label>
                  <input
                    type="number"
                    value={bidForm.amount}
                    onChange={e => setBidForm({ ...bidForm, amount: e.target.value })}
                  />
                </div>

                <button type="submit" className="am-dash-submit-btn">
                  Submit Authenticated B2B Bid
                </button>
              </form>

              {bidFeedback && (
                <div className="am-feedback-box" style={{ marginTop: 14 }}>
                  {bidFeedback}
                </div>
              )}

              <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

              <div className="am-panel-header" style={{ marginBottom: 12 }}>
                <h4>Export Liquidation Settlement Contract</h4>
              </div>
              <form onSubmit={handleExportContract} className="am-dash-form row-form">
                <input
                  type="text"
                  value={contractForm.lotId}
                  onChange={e => setContractForm({ ...contractForm, lotId: e.target.value })}
                  placeholder="Lot ID"
                  style={{ maxWidth: 140 }}
                />
                <select
                  value={contractForm.format}
                  onChange={e => setContractForm({ ...contractForm, format: e.target.value })}
                >
                  <option value="pdf">PDF Dossier</option>
                  <option value="csv">CSV Ledger</option>
                  <option value="json">JSON Telemetry</option>
                </select>
                <button type="submit" className="am-dash-btn primary">
                  Export Contract
                </button>
              </form>
              {contractFeedback && (
                <div className="am-feedback-box" style={{ marginTop: 12 }}>
                  {contractFeedback}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 7. EXECUTIVE KPIS & COMMERCIALS TAB (Preserved for CTF benchmark)   */}
      {/* ==================================================================== */}
      {activeTab === 'executive' && (
        <section className="am-dash-tab-panel">
          <div className="am-analytics-grid-2col">
            {/* Visual Revenue Analytics */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Quarterly Revenue Velocity</h3>
                <span className="am-badge-pill">FY 2026 Audit</span>
              </div>
              <p className="am-panel-desc">Real-time liquidation velocity across multi-state dealer partner hubs.</p>
              
              <div className="am-chart-bars">
                {[
                  { q: 'Q1', val: '$920k', pct: 60 },
                  { q: 'Q2', val: '$1.15M', pct: 75 },
                  { q: 'Q3', val: '$1.32M', pct: 86 },
                  { q: 'Q4 (Est.)', val: '$1.43M', pct: 95 }
                ].map((item, i) => (
                  <div className="am-chart-col" key={i}>
                    <div className="am-bar-track">
                      <div className="am-bar-inner" style={{ height: `${item.pct}%` }}>
                        <span className="am-bar-tag">{item.val}</span>
                      </div>
                    </div>
                    <span className="am-bar-label">{item.q}</span>
                  </div>
                ))}
              </div>

              <div className="am-regional-breakdown">
                <h4>Regional Showroom Allocation</h4>
                <div className="am-region-row">
                  <span>Mumbai Central Depot</span>
                  <b>38% ($1.83M)</b>
                </div>
                <div className="am-region-row">
                  <span>Delhi NCR Hub</span>
                  <b>32% ($1.54M)</b>
                </div>
                <div className="am-region-row">
                  <span>Bengaluru Tech Park</span>
                  <b>20% ($964k)</b>
                </div>
                <div className="am-region-row">
                  <span>Chennai Coast Port</span>
                  <b>10% ($482k)</b>
                </div>
              </div>
            </div>

            {/* Interactive Executive KPI Terminal */}
            <div className="am-panel-card terminal-card">
              <div className="am-panel-header">
                <div className="am-terminal-title-group">
                  <span className="am-terminal-led" />
                  <h3>Executive Reporting Terminal</h3>
                </div>
                <span className="am-auth-req-badge">Restricted Access</span>
              </div>
              <p className="am-panel-desc">
                Administrative verification console for executive KPI reporting and commercial telemetry.
              </p>

              <div className="am-token-input-section">
                <label>Bearer Authorization Token:</label>
                <div className="am-token-row">
                  <input
                    type="text"
                    className="am-terminal-input"
                    value={terminalTokens.executive}
                    onChange={e => setTerminalTokens({ ...terminalTokens, executive: e.target.value })}
                    placeholder="Enter Bearer authorization token..."
                  />
                  <button
                    type="button"
                    className="am-terminal-exec-btn"
                    disabled={executing.executive}
                    onClick={() => runTerminalQuery('executive', '/api/iam/v1/reports/executive')}
                  >
                    {executing.executive ? 'Querying...' : 'Query Terminal ⚡'}
                  </button>
                </div>
              </div>

              {/* Terminal Screen Output */}
              <div className="am-terminal-screen">
                <div className="am-screen-header">
                  <span>CONSOLE OUTPUT // TERMINAL 01</span>
                  {terminalResults.executive && (
                    <span className={`am-status-tag ${terminalResults.executive.status === 200 ? 'ok' : 'err'}`}>
                      HTTP {terminalResults.executive.status} ({terminalResults.executive.durationMs}ms)
                    </span>
                  )}
                </div>
                <pre className="am-screen-body">
                  {terminalResults.executive
                    ? JSON.stringify(terminalResults.executive.data, null, 2)
                    : '// Enter authorization token and execute query to inspect executive telemetry.'}
                </pre>

                {terminalResults.executive?.flag && (
                  <div className="am-terminal-flag-banner">
                    <span className="am-trophy">🏆</span>
                    <div>
                      <strong>Verification Token:</strong>
                      <code>{terminalResults.executive.flag}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 8. FINANCIAL AUDIT & LEDGER TAB (Preserved for CTF benchmark)       */}
      {/* ==================================================================== */}
      {activeTab === 'audit' && (
        <section className="am-dash-tab-panel">
          <div className="am-analytics-grid-2col">
            {/* Real-time Ledger Table */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Real-time Financial Audit Ledger</h3>
                <span className="am-badge-pill">HMAC Sealed</span>
              </div>
              <p className="am-panel-desc">Real-time dealer consignment transactions, escrow releases, and settlement proofs.</p>

              <div className="am-table-wrapper">
                <table className="am-dash-table">
                  <thead>
                    <tr>
                      <th>Settlement ID</th>
                      <th>Dealer Counterparty</th>
                      <th>Volume</th>
                      <th>Escrow Status</th>
                      <th>Audit Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>TXN-882190</code></td>
                      <td>AutoHub Mumbai</td>
                      <td><b>$42,000</b></td>
                      <td><span className="am-table-tag verified">SEALED</span></td>
                      <td><code>0x7f..1a</code></td>
                    </tr>
                    <tr>
                      <td><code>TXN-882191</code></td>
                      <td>Prime Motors Delhi</td>
                      <td><b>$65,000</b></td>
                      <td><span className="am-table-tag verified">SEALED</span></td>
                      <td><code>0x8c..3e</code></td>
                    </tr>
                    <tr>
                      <td><code>TXN-882192</code></td>
                      <td>Apex Supercars BLR</td>
                      <td><b>$85,000</b></td>
                      <td><span className="am-table-tag pending">ESCROW LOCK</span></td>
                      <td><code>0x4a..99</code></td>
                    </tr>
                    <tr>
                      <td><code>TXN-882193</code></td>
                      <td>Velocity Exotics</td>
                      <td><b>$38,000</b></td>
                      <td><span className="am-table-tag verified">SEALED</span></td>
                      <td><code>0x1f..5b</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Audit Terminal */}
            <div className="am-panel-card terminal-card">
              <div className="am-panel-header">
                <div className="am-terminal-title-group">
                  <span className="am-terminal-led" />
                  <h3>Financial Audit Terminal</h3>
                </div>
                <span className="am-auth-req-badge">Restricted Access</span>
              </div>
              <p className="am-panel-desc">Cryptographic ledger verification and settlement clearing console.</p>

              <div className="am-token-input-section">
                <label>Bearer Authorization Token:</label>
                <div className="am-token-row">
                  <input
                    type="text"
                    className="am-terminal-input"
                    value={terminalTokens.audit}
                    onChange={e => setTerminalTokens({ ...terminalTokens, audit: e.target.value })}
                    placeholder="Enter Bearer authorization token..."
                  />
                  <button
                    type="button"
                    className="am-terminal-exec-btn"
                    disabled={executing.audit}
                    onClick={() => runTerminalQuery('audit', '/api/iam/v1/reports/audit')}
                  >
                    {executing.audit ? 'Auditing...' : 'Run Audit ⚡'}
                  </button>
                </div>
              </div>

              <div className="am-terminal-screen">
                <div className="am-screen-header">
                  <span>CONSOLE OUTPUT // AUDIT TERMINAL 02</span>
                  {terminalResults.audit && (
                    <span className={`am-status-tag ${terminalResults.audit.status === 200 ? 'ok' : 'err'}`}>
                      HTTP {terminalResults.audit.status} ({terminalResults.audit.durationMs}ms)
                    </span>
                  )}
                </div>
                <pre className="am-screen-body">
                  {terminalResults.audit
                    ? JSON.stringify(terminalResults.audit.data, null, 2)
                    : '// Enter authorization token and execute to verify cryptographic ledger.'}
                </pre>
                {terminalResults.audit?.flag && (
                  <div className="am-terminal-flag-banner">
                    <span className="am-trophy">🏆</span>
                    <div>
                      <strong>Verification Token:</strong>
                      <code>{terminalResults.audit.flag}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 9. FLEET TELEMATICS & KMS TAB (Preserved for CTF benchmark)          */}
      {/* ==================================================================== */}
      {activeTab === 'fleet' && (
        <section className="am-dash-tab-panel">
          <div className="am-analytics-grid-2col">
            {/* Live Telematics Matrix */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Connected Vehicle Telematics</h3>
                <span className="am-badge-pill">OBD-II Telemetry</span>
              </div>
              <p className="am-panel-desc">Active real-time vehicle CAN bus telemetry stream across partner dealer fleets.</p>

              <div className="am-telematics-grid">
                <div className="am-telemetry-box">
                  <span className="am-t-label">Fleet GPS Active</span>
                  <div className="am-t-val">142 / 142</div>
                  <span className="am-t-sub">100% Tracking Lock</span>
                </div>
                <div className="am-telemetry-box">
                  <span className="am-t-label">Mean Engine Health</span>
                  <div className="am-t-val" style={{ color: '#10b981' }}>98.4%</div>
                  <span className="am-t-sub">Zero Critical DTCs</span>
                </div>
                <div className="am-telemetry-box">
                  <span className="am-t-label">HSM Key Rings</span>
                  <div className="am-t-val" style={{ color: '#06b6d4' }}>Active</div>
                  <span className="am-t-sub">Hardware Root of Trust</span>
                </div>
                <div className="am-telemetry-box">
                  <span className="am-t-label">OTA Firmware</span>
                  <div className="am-t-val">v4.18.2</div>
                  <span className="am-t-sub">Latest Security Patch</span>
                </div>
              </div>
            </div>

            {/* Fleet Hardware KMS Terminal */}
            <div className="am-panel-card terminal-card">
              <div className="am-panel-header">
                <div className="am-terminal-title-group">
                  <span className="am-terminal-led" />
                  <h3>Commercial Fleet Hardware KMS</h3>
                </div>
                <span className="am-auth-req-badge">Restricted Access</span>
              </div>
              <p className="am-panel-desc">Commercial fleet diagnostics and hardware key management enclave.</p>

              <div className="am-token-input-section">
                <label>Bearer Authorization Token:</label>
                <div className="am-token-row">
                  <input
                    type="text"
                    className="am-terminal-input"
                    value={terminalTokens.fleetKms}
                    onChange={e => setTerminalTokens({ ...terminalTokens, fleetKms: e.target.value })}
                    placeholder="Enter Bearer authorization token..."
                  />
                  <button
                    type="button"
                    className="am-terminal-exec-btn"
                    disabled={executing.fleetKms}
                    onClick={() => runTerminalQuery('fleetKms', '/api/iam/v1/reports/fleet-kms')}
                  >
                    {executing.fleetKms ? 'Verifying...' : 'Query KMS ⚡'}
                  </button>
                </div>
              </div>

              <div className="am-terminal-screen">
                <div className="am-screen-header">
                  <span>CONSOLE OUTPUT // FLEET KMS TERMINAL 05</span>
                  {terminalResults.fleetKms && (
                    <span className={`am-status-tag ${terminalResults.fleetKms.status === 200 ? 'ok' : 'err'}`}>
                      HTTP {terminalResults.fleetKms.status} ({terminalResults.fleetKms.durationMs}ms)
                    </span>
                  )}
                </div>
                <pre className="am-screen-body">
                  {terminalResults.fleetKms
                    ? JSON.stringify(terminalResults.fleetKms.data, null, 2)
                    : '// Enter authorization token and execute to inspect fleet KMS telemetry.'}
                </pre>
                {terminalResults.fleetKms?.flag && (
                  <div className="am-terminal-flag-banner">
                    <span className="am-trophy">🏆</span>
                    <div>
                      <strong>Verification Token:</strong>
                      <code>{terminalResults.fleetKms.flag}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 10. IDENTITY FEDERATION & PKI TAB (Preserved for CTF benchmark)      */}
      {/* ==================================================================== */}
      {activeTab === 'federation' && (
        <section className="am-dash-tab-panel">
          <div className="am-analytics-grid-2col">
            {/* Terminal: Partner Keyset Sync (JKU) */}
            <div className="am-panel-card terminal-card">
              <div className="am-panel-header">
                <div className="am-terminal-title-group">
                  <span className="am-terminal-led" />
                  <h3>Dealership Partner Sync</h3>
                </div>
                <span className="am-auth-req-badge">Restricted Access</span>
              </div>

              <div className="am-token-input-section">
                <label>Bearer Authorization Token:</label>
                <div className="am-token-row">
                  <input
                    type="text"
                    className="am-terminal-input"
                    value={terminalTokens.partnerSync}
                    onChange={e => setTerminalTokens({ ...terminalTokens, partnerSync: e.target.value })}
                    placeholder="Enter Bearer authorization token..."
                  />
                  <button
                    type="button"
                    className="am-terminal-exec-btn"
                    disabled={executing.partnerSync}
                    onClick={() => runTerminalQuery('partnerSync', '/api/iam/v1/reports/partner-sync')}
                  >
                    {executing.partnerSync ? 'Syncing...' : 'Sync Partner ⚡'}
                  </button>
                </div>
              </div>

              <div className="am-terminal-screen">
                <div className="am-screen-header">
                  <span>CONSOLE OUTPUT // PARTNER SYNC</span>
                  {terminalResults.partnerSync && (
                    <span className={`am-status-tag ${terminalResults.partnerSync.status === 200 ? 'ok' : 'err'}`}>
                      HTTP {terminalResults.partnerSync.status}
                    </span>
                  )}
                </div>
                <pre className="am-screen-body">
                  {terminalResults.partnerSync
                    ? JSON.stringify(terminalResults.partnerSync.data, null, 2)
                    : '// Query to test remote partner keyset synchronization.'}
                </pre>
                {terminalResults.partnerSync?.flag && (
                  <div className="am-terminal-flag-banner">
                    <span className="am-trophy">🏆</span>
                    <div>
                      <strong>Verification Token:</strong>
                      <code>{terminalResults.partnerSync.flag}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Terminal: Certificate Compliance */}
            <div className="am-panel-card terminal-card">
              <div className="am-panel-header">
                <div className="am-terminal-title-group">
                  <span className="am-terminal-led" />
                  <h3>Enterprise Certificate Compliance</h3>
                </div>
                <span className="am-auth-req-badge">Restricted Access</span>
              </div>

              <div className="am-token-input-section">
                <label>Bearer Authorization Token:</label>
                <div className="am-token-row">
                  <input
                    type="text"
                    className="am-terminal-input"
                    value={terminalTokens.compliance}
                    onChange={e => setTerminalTokens({ ...terminalTokens, compliance: e.target.value })}
                    placeholder="Enter Bearer authorization token..."
                  />
                  <button
                    type="button"
                    className="am-terminal-exec-btn"
                    disabled={executing.compliance}
                    onClick={() => runTerminalQuery('compliance', '/api/iam/v1/reports/compliance')}
                  >
                    {executing.compliance ? 'Auditing...' : 'Check Compliance ⚡'}
                  </button>
                </div>
              </div>

              <div className="am-terminal-screen">
                <div className="am-screen-header">
                  <span>CONSOLE OUTPUT // COMPLIANCE TERMINAL</span>
                  {terminalResults.compliance && (
                    <span className={`am-status-tag ${terminalResults.compliance.status === 200 ? 'ok' : 'err'}`}>
                      HTTP {terminalResults.compliance.status}
                    </span>
                  )}
                </div>
                <pre className="am-screen-body">
                  {terminalResults.compliance
                    ? JSON.stringify(terminalResults.compliance.data, null, 2)
                    : '// Query to test public certificate compliance verification.'}
                </pre>
                {terminalResults.compliance?.flag && (
                  <div className="am-terminal-flag-banner">
                    <span className="am-trophy">🏆</span>
                    <div>
                      <strong>Verification Token:</strong>
                      <code>{terminalResults.compliance.flag}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* 11. API TRACES & OBSERVABILITY TAB (Preserved for CTF benchmark)     */}
      {/* ==================================================================== */}
      {activeTab === 'developer' && (
        <section className="am-dash-tab-panel">
          <div className="am-analytics-grid-2col">
            {/* API Observability Gauges */}
            <div className="am-panel-card">
              <div className="am-panel-header">
                <h3>Gateway API Observability</h3>
                <span className="am-badge-pill">Nginx Edge</span>
              </div>
              <p className="am-panel-desc">Real-time edge gateway performance, upstream latency and cache metrics.</p>

              <div className="am-observability-metrics">
                <div className="am-obs-item">
                  <span className="am-obs-label">Edge Cache Hit Ratio</span>
                  <div className="am-obs-val">89.4%</div>
                  <div className="am-kpi-progress-bar">
                    <div className="am-kpi-progress-fill cyan" style={{ width: '89%' }} />
                  </div>
                </div>

                <div className="am-obs-item">
                  <span className="am-obs-label">P95 Latency</span>
                  <div className="am-obs-val">18 ms</div>
                  <div className="am-kpi-progress-bar">
                    <div className="am-kpi-progress-fill" style={{ width: '25%' }} />
                  </div>
                </div>

                <div className="am-obs-item">
                  <span className="am-obs-label">TLS 1.3 Handshake Rate</span>
                  <div className="am-obs-val">100%</div>
                  <div className="am-kpi-progress-bar">
                    <div className="am-kpi-progress-fill" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Developer Traces Terminal */}
            <div className="am-panel-card terminal-card">
              <div className="am-panel-header">
                <div className="am-terminal-title-group">
                  <span className="am-terminal-led" />
                  <h3>Developer API Trace Diagnostics</h3>
                </div>
                <span className="am-auth-req-badge">Restricted Access</span>
              </div>

              <div className="am-token-input-section">
                <label>Bearer Authorization Token:</label>
                <div className="am-token-row">
                  <input
                    type="text"
                    className="am-terminal-input"
                    value={terminalTokens.developer}
                    onChange={e => setTerminalTokens({ ...terminalTokens, developer: e.target.value })}
                    placeholder="Enter Bearer authorization token..."
                  />
                  <button
                    type="button"
                    className="am-terminal-exec-btn"
                    disabled={executing.developer}
                    onClick={() => runTerminalQuery('developer', '/api/iam/v1/reports/developer')}
                  >
                    {executing.developer ? 'Tracing...' : 'Run Traces ⚡'}
                  </button>
                </div>
              </div>

              <div className="am-terminal-screen">
                <div className="am-screen-header">
                  <span>CONSOLE OUTPUT // DEVELOPER TRACES</span>
                  {terminalResults.developer && (
                    <span className={`am-status-tag ${terminalResults.developer.status === 200 ? 'ok' : 'err'}`}>
                      HTTP {terminalResults.developer.status} ({terminalResults.developer.durationMs}ms)
                    </span>
                  )}
                </div>
                <pre className="am-screen-body">
                  {terminalResults.developer
                    ? JSON.stringify(terminalResults.developer.data, null, 2)
                    : '// Query to inspect developer traces & trace telemetry.'}
                </pre>
                {terminalResults.developer?.flag && (
                  <div className="am-terminal-flag-banner">
                    <span className="am-trophy">🏆</span>
                    <div>
                      <strong>Verification Token:</strong>
                      <code>{terminalResults.developer.flag}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
