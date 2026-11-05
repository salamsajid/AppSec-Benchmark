import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { session, api, API, fmtPrice } from '../api.js';

// Initial Rich Seed Data for Retail & VIP Customers
const SEED_CUSTOMERS = [
  { id: 1, name: 'Carlos Montoya', username: 'carlos', email: 'carlos@used-vehicles.lab', phone: '+1 (555) 234-5678', role: 'customer', tier: 'Standard Retail', status: 'active', balance: 20000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-01-15', totalOrders: 4, location: 'San Francisco, CA', notes: 'Frequent buyer of certified sports coupes.' },
  { id: 2, name: 'Wiener Peter', username: 'wiener', email: 'wiener@used-vehicles.lab', phone: '+1 (555) 345-6789', role: 'customer', tier: 'Standard Retail', status: 'active', balance: 20000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-02-20', totalOrders: 7, location: 'Chicago, IL', notes: 'Active in marketplace bids and trade-in appraisals.' },
  { id: 3, name: 'Emily Watson', username: 'emily.watson', email: 'emily.watson@gmail.com', phone: '+1 (555) 456-7890', role: 'customer', tier: 'VIP Prestige', status: 'active', balance: 65000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-05-10', totalOrders: 3, location: 'New York, NY', notes: 'Exclusive pre-orders for upcoming electric launches.' },
  { id: 4, name: 'Michael Chang', username: 'michael.chang', email: 'michael.chang@outlook.com', phone: '+1 (555) 567-8901', role: 'seller', tier: 'Verified Seller', status: 'active', balance: 42000, kycLevel: 'Tier 2 Documented', joinedDate: '2024-06-18', totalOrders: 2, location: 'Seattle, WA', notes: 'Consigned BMW M4 with clean inspection report.' },
  { id: 5, name: 'Olivia Taylor', username: 'olivia.taylor', email: 'olivia.taylor@icloud.com', phone: '+1 (555) 678-9012', role: 'customer', tier: 'VIP Prestige', status: 'active', balance: 94000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-07-02', totalOrders: 5, location: 'Austin, TX', notes: 'Cash buyer with verified bank settlement escrow.' },
  { id: 6, name: 'Lucas Silva', username: 'lucas.silva', email: 'lucas.silva@techcorp.io', phone: '+1 (555) 789-0123', role: 'customer', tier: 'Standard Retail', status: 'active', balance: 18500, kycLevel: 'Tier 2 Documented', joinedDate: '2024-08-11', totalOrders: 1, location: 'Denver, CO', notes: 'Completed instant pre-qualification for auto loan.' },
  { id: 7, name: 'Arjun Sharma', username: 'arjun.sharma', email: 'arjun.sharma99@gmail.com', phone: '+91 98200 44321', role: 'customer', tier: 'Standard Retail', status: 'active', balance: 31000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-09-05', totalOrders: 2, location: 'Mumbai, MH', notes: 'Interested in Mercedes-Benz E-Class pre-owned.' },
  { id: 8, name: 'Daniel Evans', username: 'daniel.evans', email: 'devans@mobilitypartners.com', phone: '+1 (555) 890-1234', role: 'corporate', tier: 'Corporate Fleet', status: 'active', balance: 120000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-09-22', totalOrders: 8, location: 'Atlanta, GA', notes: 'Corporate mobility lease account manager.' },
  { id: 9, name: 'Hannah Baker', username: 'hannah.baker', email: 'hbaker@designstudio.net', phone: '+1 (555) 901-2345', role: 'customer', tier: 'Standard Retail', status: 'pending_kyc', balance: 12000, kycLevel: 'Tier 1 Basic', joinedDate: '2024-10-01', totalOrders: 0, location: 'Boston, MA', notes: 'Identity proof uploaded; pending visual OCR check.' },
  { id: 10, name: 'Samuel Green', username: 'samuel.green', email: 'sam.green@greencapital.com', phone: '+1 (555) 012-3456', role: 'customer', tier: 'VIP Prestige', status: 'active', balance: 180000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-10-04', totalOrders: 6, location: 'Miami, FL', notes: 'Luxury supercar collector with concierge priority.' },
  { id: 11, name: 'Zack Morris', username: 'zack.morris', email: 'zack.m@pacificventures.com', phone: '+1 (555) 123-4567', role: 'customer', tier: 'Standard Retail', status: 'suspended', balance: 8500, kycLevel: 'Tier 1 Basic', joinedDate: '2024-10-08', totalOrders: 1, location: 'Los Angeles, CA', notes: 'Account temporarily suspended pending address verification.' },
  { id: 12, name: 'Natalie Portman', username: 'natalie.portman', email: 'natalie.p@hollywoodcreative.com', phone: '+1 (555) 234-9876', role: 'customer', tier: 'VIP Prestige', status: 'active', balance: 250000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-10-10', totalOrders: 4, location: 'Beverly Hills, CA', notes: 'VIP bespoke delivery to residential estate.' },
  { id: 13, name: 'Rohit Malhotra', username: 'rohit.malhotra', email: 'rohit.malhotra@delhitech.in', phone: '+91 98110 33221', role: 'seller', tier: 'Verified Seller', status: 'active', balance: 22000, kycLevel: 'Tier 2 Documented', joinedDate: '2024-10-12', totalOrders: 1, location: 'New Delhi, DL', notes: 'Trade-in valuation accepted for Hyundai Ioniq 5.' },
  { id: 14, name: 'Kavya Nair', username: 'kavya.nair', email: 'kavya.nair@keralabio.org', phone: '+91 98470 55432', role: 'customer', tier: 'Standard Retail', status: 'active', balance: 15000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-10-14', totalOrders: 2, location: 'Kochi, KL', notes: 'Verified buyer of certified family crossover.' },
  { id: 15, name: 'Sanjay Singh', username: 'sanjay.singh', email: 'sanjay.singh@puneglobal.com', phone: '+91 98900 66543', role: 'corporate', tier: 'Corporate Fleet', status: 'active', balance: 85000, kycLevel: 'Tier 3 Verified', joinedDate: '2024-10-15', totalOrders: 3, location: 'Pune, MH', notes: 'Executive pool car purchase under corporate scheme.' },
  { id: 16, name: 'Meera Joshi', username: 'meera.joshi', email: 'meera.joshi@ahmedabadtextiles.com', phone: '+91 98250 88765', role: 'customer', tier: 'Standard Retail', status: 'active', balance: 27500, kycLevel: 'Tier 3 Verified', joinedDate: '2024-10-16', totalOrders: 2, location: 'Ahmedabad, GJ', notes: 'Completed doorstep test drive booking.' },
];

// Initial Rich Seed Data for Dealership Franchises
const SEED_DEALERS = [
  { id: 'd1', name: 'AutoHub Mumbai', location: 'Andheri West, Mumbai', manager: 'Marcus Vance', email: 'sales@autohub.in', phone: '+91 98200 11111', rating: 4.6, cars: 42, tier: 'Platinum Franchise', status: 'verified', floorplanLimit: 3500000, floorplanUsed: 2100000, license: 'DL-MH-2024-1011', joinedDate: '2023-11-15', capacity: 60, serviceBays: 8 },
  { id: 'd2', name: 'Prime Motors Delhi', location: 'Okhla, New Delhi', manager: 'Elena Rostova', email: 'sales@primemotors.in', phone: '+91 98110 22222', rating: 4.4, cars: 35, tier: 'Gold Partner', status: 'verified', floorplanLimit: 2800000, floorplanUsed: 1650000, license: 'DL-DL-2024-2022', joinedDate: '2024-01-20', capacity: 50, serviceBays: 6 },
  { id: 'd3', name: 'CityDrive Bengaluru', location: 'Koramangala, Bengaluru', manager: 'David Kim', email: 'sales@citydrive.in', phone: '+91 99010 33333', rating: 4.7, cars: 51, tier: 'Platinum Franchise', status: 'verified', floorplanLimit: 4000000, floorplanUsed: 2850000, license: 'DL-KA-2024-3033', joinedDate: '2023-09-08', capacity: 70, serviceBays: 10 },
  { id: 'd4', name: 'Sunrise Cars Pune', location: 'Baner, Pune', manager: 'Sarah Jenkins', email: 'sales@sunrisecars.in', phone: '+91 98900 44444', rating: 4.3, cars: 28, tier: 'Silver Associate', status: 'verified', floorplanLimit: 1800000, floorplanUsed: 920000, license: 'DL-MH-2024-4044', joinedDate: '2024-03-14', capacity: 40, serviceBays: 4 },
  { id: 'd5', name: 'Galaxy Auto Chennai', location: 'OMR, Chennai', manager: 'Raj Patel', email: 'sales@galaxyauto.in', phone: '+91 98400 55555', rating: 4.5, cars: 38, tier: 'Gold Partner', status: 'verified', floorplanLimit: 2500000, floorplanUsed: 1480000, license: 'DL-TN-2024-5055', joinedDate: '2024-02-11', capacity: 50, serviceBays: 6 },
  { id: 'd6', name: 'Apex Luxury Motors Hyderabad', location: 'Jubilee Hills, Hyderabad', manager: 'Vikram Mehta', email: 'sales@apexluxury.in', phone: '+91 98480 66666', rating: 4.9, cars: 64, tier: 'Platinum Franchise', status: 'verified', floorplanLimit: 5500000, floorplanUsed: 3920000, license: 'DL-TG-2024-6066', joinedDate: '2023-06-30', capacity: 80, serviceBays: 12 },
  { id: 'd7', name: 'Deccan Certified Pre-Owned Ahmedabad', location: 'SG Highway, Ahmedabad', manager: 'Priya Deshmukh', email: 'sales@deccancertified.com', phone: '+91 98250 77777', rating: 4.8, cars: 45, tier: 'Platinum Franchise', status: 'verified', floorplanLimit: 3200000, floorplanUsed: 1850000, license: 'DL-GJ-2024-7077', joinedDate: '2023-12-10', capacity: 60, serviceBays: 7 },
  { id: 'd8', name: 'Heritage Classics Jaipur', location: 'C-Scheme, Jaipur', manager: 'Anand Verma', email: 'sales@heritageclassics.in', phone: '+91 98290 88888', rating: 4.7, cars: 31, tier: 'Gold Partner', status: 'verified', floorplanLimit: 2200000, floorplanUsed: 1150000, license: 'DL-RJ-2024-8088', joinedDate: '2024-04-05', capacity: 45, serviceBays: 5 },
  { id: 'd9', name: 'Malabar Motors Kochi', location: 'Edappally, Kochi', manager: 'K. R. Menon', email: 'sales@malabarmotors.in', phone: '+91 98470 99999', rating: 4.6, cars: 29, tier: 'Silver Associate', status: 'verified', floorplanLimit: 1500000, floorplanUsed: 780000, license: 'DL-KL-2024-9099', joinedDate: '2024-05-19', capacity: 35, serviceBays: 4 },
  { id: 'd10', name: 'Royal Auto Chandigarh', location: 'Sector 17, Chandigarh', manager: 'Harpreet Singh', email: 'sales@royalautochd.in', phone: '+91 98140 10101', rating: 4.8, cars: 40, tier: 'Platinum Franchise', status: 'verified', floorplanLimit: 3000000, floorplanUsed: 1720000, license: 'DL-CH-2024-1010', joinedDate: '2024-02-28', capacity: 55, serviceBays: 8 },
];

// Initial Pending Dealership Onboarding Applications
const SEED_APPLICATIONS = [
  { id: 'app-101', franchiseName: 'Skyline Performance Imports', city: 'Gurgaon, HR', contactPerson: 'Rohan Malhotra', email: 'rohan@skylineimports.in', phone: '+91 98100 88888', requestedFloorplan: 2000000, proposedUnits: 30, licenseDoc: 'IN-HR-GUR-2026-90', submittedDate: '2026-10-18', status: 'pending', notes: 'Specializes in Japanese domestic market imports and BMW M series.' },
  { id: 'app-102', franchiseName: 'Southern Star Mobility Hub', city: 'Coimbatore, TN', contactPerson: 'Anitha Krishnan', email: 'anitha@southernstar.in', phone: '+91 98420 77777', requestedFloorplan: 1500000, proposedUnits: 25, licenseDoc: 'IN-TN-CBE-2026-44', submittedDate: '2026-10-17', status: 'pending', notes: 'Focus on multi-brand hybrid and EV crossover remarketing.' },
  { id: 'app-103', franchiseName: 'Western Horizon Autos', city: 'Surat, GJ', contactPerson: 'Bhavin Patel', email: 'bhavin@westernhorizon.in', phone: '+91 98240 66666', requestedFloorplan: 2200000, proposedUnits: 35, licenseDoc: 'IN-GJ-SUR-2026-72', submittedDate: '2026-10-16', status: 'under_verification', notes: 'Facility covers 22,000 sq ft showroom with 8 EV high-voltage bays.' },
];

export default function AdminDashboard() {
  const nav = useNavigate();
  const user = session.user;

  // Admin Authentication Gate State (Only accessible with admin / #Welcome@Admin2026)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    try {
      const stored = localStorage.getItem('am_admin_auth');
      const currentUser = session.user;
      return stored === 'true' && (currentUser?.username === 'admin' || currentUser?.role === 'admin');
    } catch (e) {
      return false;
    }
  });

  const [gateUser, setGateUser] = useState('');
  const [gatePass, setGatePass] = useState('');
  const [gateError, setGateError] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [showGatePass, setShowGatePass] = useState(false);

  const handleGateLogin = (e) => {
    e.preventDefault();
    setGateError('');
    setGateLoading(true);

    if (gateUser.trim() === 'admin' && gatePass === '#Welcome@Admin2026') {
      setTimeout(() => {
        localStorage.setItem('am_admin_auth', 'true');
        session.user = { username: 'admin', role: 'admin', token: 'adm_jwt_governance_session' };
        setIsAdminAuthenticated(true);
        setGateLoading(false);
        logAudit('ADMIN_AUTH_SUCCESS', 'Master Administrator authenticated via Admin Portal Access Gate.');
        showToast('✓ Authentication successful. Welcome to the Governance Center.');
      }, 300);
    } else {
      setTimeout(() => {
        setGateLoading(false);
        setGateError('Access Denied: Invalid administrative credentials.');
        logAudit('ADMIN_AUTH_FAILED', `Unauthorized access attempt on Admin Portal with username: "${gateUser}".`);
      }, 300);
    }
  };

  const handleAdminSignout = () => {
    localStorage.removeItem('am_admin_auth');
    setIsAdminAuthenticated(false);
    setGatePass('');
    logAudit('ADMIN_AUTH_SIGNOUT', 'Master Administrator signed out of Governance Center.');
    showToast('You have exited the administrative session.', 'info');
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview');

  // Core Data Stores (backed by localStorage + API sync)
  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem('uvp_admin_customers');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return SEED_CUSTOMERS;
  });

  const [dealers, setDealers] = useState(() => {
    try {
      const saved = localStorage.getItem('uvp_admin_dealers');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return SEED_DEALERS;
  });

  const [applications, setApplications] = useState(() => {
    try {
      const saved = localStorage.getItem('uvp_admin_applications');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return SEED_APPLICATIONS;
  });

  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('uvp_admin_audit_logs');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return [
      { id: 'log-1', timestamp: new Date(Date.now() - 3600000 * 2).toLocaleTimeString(), actor: 'administrator', action: 'SYSTEM_BOOT', details: 'Stratos Administration Console initialized in operational cluster node 01.', status: 'SUCCESS' },
      { id: 'log-2', timestamp: new Date(Date.now() - 3600000 * 5).toLocaleTimeString(), actor: 'administrator', action: 'DEALER_VERIFY', details: 'Automated compliance check passed for Apex Luxury Motors (d6).', status: 'SUCCESS' },
      { id: 'log-3', timestamp: new Date(Date.now() - 3600000 * 8).toLocaleTimeString(), actor: 'system_cron', action: 'FLOORPLAN_AUDIT', details: 'Total wholesale floorplan credit line utilization calibrated at 62.4%.', status: 'SUCCESS' },
      { id: 'log-4', timestamp: new Date(Date.now() - 3600000 * 12).toLocaleTimeString(), actor: 'administrator', action: 'USER_KYC', details: 'Approved Tier 3 KYC verification dossier for Emily Watson (ID: 3).', status: 'SUCCESS' },
    ];
  });

  // Platform Feature Flags & Controls
  const [controls, setControls] = useState(() => {
    try {
      const saved = localStorage.getItem('uvp_admin_controls');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return {
      maintenanceMode: false,
      edgeCaching: true,
      rateLimit: 1200,
      ssoTimeout: '24 Hours',
      strictCors: true,
      auditAlerts: true,
    };
  });

  // UI Search & Filter States
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all');
  const [customerRoleFilter, setCustomerRoleFilter] = useState('all');

  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerTierFilter, setDealerTierFilter] = useState('all');
  const [dealerStatusFilter, setDealerStatusFilter] = useState('all');
  const [dealerViewMode, setDealerViewMode] = useState('table'); // 'table' | 'grid'

  // Modals States
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [showDeleteCustomerModal, setShowDeleteCustomerModal] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState(null);

  const [showAddDealerModal, setShowAddDealerModal] = useState(false);
  const [showEditDealerModal, setShowEditDealerModal] = useState(false);
  const [showDeleteDealerModal, setShowDeleteDealerModal] = useState(false);
  const [activeDealer, setActiveDealer] = useState(null);

  const [viewDetailModal, setViewDetailModal] = useState(null); // { type: 'customer' | 'dealer' | 'app', data: ... }

  // Customer Form State
  const [custForm, setCustForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    role: 'customer',
    tier: 'Standard Retail',
    status: 'active',
    balance: 20000,
    kycLevel: 'Tier 3 Verified',
    location: '',
    notes: '',
  });

  // Dealer Form State
  const [dealerForm, setDealerForm] = useState({
    name: '',
    location: '',
    manager: '',
    email: '',
    phone: '',
    rating: 4.8,
    cars: 30,
    tier: 'Gold Partner',
    status: 'verified',
    floorplanLimit: 2500000,
    license: '',
    capacity: 50,
  });

  // Toast Notification State
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3600);
  };

  // Persist State Changes
  useEffect(() => {
    localStorage.setItem('uvp_admin_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('uvp_admin_dealers', JSON.stringify(dealers));
  }, [dealers]);

  useEffect(() => {
    localStorage.setItem('uvp_admin_applications', JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    localStorage.setItem('uvp_admin_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('uvp_admin_controls', JSON.stringify(controls));
  }, [controls]);

  // Synchronize with backend API on mount
  useEffect(() => {
    // Sync backend dealers if available
    api(`${API.catalog}/v1/dealers`)
      .then(res => {
        if (res.data && Array.isArray(res.data.dealers) && res.data.dealers.length > 0) {
          setDealers(prev => {
            // merge backend records preserving local enrichments
            const existingIds = new Set(prev.map(d => d.id));
            const fresh = [...prev];
            res.data.dealers.forEach(bd => {
              if (!existingIds.has(bd.id)) {
                fresh.push({
                  ...bd,
                  manager: bd.name.includes(' ') ? bd.name.split(' ')[0] + ' GM' : 'General Manager',
                  tier: 'Gold Partner',
                  status: 'verified',
                  floorplanLimit: 2500000,
                  floorplanUsed: 1200000,
                  license: `DL-IND-2026-${bd.id}`,
                  joinedDate: '2024-01-01',
                  capacity: 45,
                  serviceBays: 6,
                });
              }
            });
            return fresh;
          });
        }
      })
      .catch(() => { /* use cached fallback */ });
  }, []);

  // Log Audit Helper
  const logAudit = (action, details) => {
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      actor: user?.username || 'administrator',
      action,
      details,
      status: 'SUCCESS',
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // =========================================================================
  // CUSTOMER CRUD OPERATIONS
  // =========================================================================

  const handleOpenAddCustomer = () => {
    setCustForm({
      name: '',
      username: '',
      email: '',
      phone: '+1 (555) 000-0000',
      role: 'customer',
      tier: 'Standard Retail',
      status: 'active',
      balance: 20000,
      kycLevel: 'Tier 3 Verified',
      location: 'New York, NY',
      notes: 'New account created by administrative console.',
    });
    setShowAddCustomerModal(true);
  };

  const handleSaveNewCustomer = (e) => {
    e.preventDefault();
    if (!custForm.name || !custForm.username || !custForm.email) {
      showToast('Please fill out all mandatory customer fields.', 'error');
      return;
    }
    // check duplicate username
    if (customers.some(c => c.username.toLowerCase() === custForm.username.toLowerCase())) {
      showToast('A user account with this username already exists.', 'error');
      return;
    }

    const newCustomer = {
      id: Date.now(),
      name: custForm.name,
      username: custForm.username.toLowerCase().trim(),
      email: custForm.email.toLowerCase().trim(),
      phone: custForm.phone || '+1 (555) 000-0000',
      role: custForm.role,
      tier: custForm.tier,
      status: custForm.status,
      balance: Number(custForm.balance) || 0,
      kycLevel: custForm.kycLevel,
      joinedDate: new Date().toISOString().split('T')[0],
      totalOrders: 0,
      location: custForm.location || 'Metro Hub',
      notes: custForm.notes || 'Created via Admin Panel.',
    };

    setCustomers(prev => [newCustomer, ...prev]);
    logAudit('CUSTOMER_CREATE', `Created user account for ${newCustomer.name} (@${newCustomer.username}) with credit balance ${fmtPrice(newCustomer.balance)}.`);
    showToast(`✓ Customer @${newCustomer.username} successfully registered!`);
    setShowAddCustomerModal(false);
  };

  const handleOpenEditCustomer = (customer) => {
    setActiveCustomer(customer);
    setCustForm({ ...customer });
    setShowEditCustomerModal(true);
  };

  const handleSaveEditCustomer = (e) => {
    e.preventDefault();
    if (!custForm.name || !custForm.email) {
      showToast('Customer name and email cannot be empty.', 'error');
      return;
    }

    setCustomers(prev => prev.map(c => {
      if (c.id === activeCustomer.id) {
        return {
          ...c,
          name: custForm.name,
          email: custForm.email,
          phone: custForm.phone,
          role: custForm.role,
          tier: custForm.tier,
          status: custForm.status,
          balance: Number(custForm.balance),
          kycLevel: custForm.kycLevel,
          location: custForm.location,
          notes: custForm.notes,
        };
      }
      return c;
    }));

    logAudit('CUSTOMER_UPDATE', `Updated profile and credit parameters for customer @${activeCustomer.username}.`);
    showToast(`✓ Customer @${activeCustomer.username} updated successfully!`);
    setShowEditCustomerModal(false);
    setActiveCustomer(null);
  };

  const handleConfirmDeleteCustomer = () => {
    if (!activeCustomer) return;
    setCustomers(prev => prev.filter(c => c.id !== activeCustomer.id));
    logAudit('CUSTOMER_DELETE', `Revoked and deleted customer record for @${activeCustomer.username} (ID: ${activeCustomer.id}).`);
    showToast(`✓ Customer @${activeCustomer.username} removed from directory.`);
    setShowDeleteCustomerModal(false);
    setActiveCustomer(null);
  };

  const toggleCustomerStatus = (customer) => {
    const nextStatus = customer.status === 'active' ? 'suspended' : 'active';
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, status: nextStatus } : c));
    logAudit('CUSTOMER_STATUS_CHANGE', `Toggled account status of @${customer.username} to ${nextStatus.toUpperCase()}.`);
    showToast(`Account @${customer.username} is now ${nextStatus}.`);
  };

  const handleAdjustBalance = (customer, delta) => {
    const newBal = Math.max(0, (customer.balance || 0) + delta);
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, balance: newBal } : c));
    logAudit('BALANCE_ADJUST', `Adjusted balance for @${customer.username} by ${delta > 0 ? '+' : ''}${fmtPrice(delta)} (New: ${fmtPrice(newBal)}).`);
    showToast(`Adjusted @${customer.username} balance to ${fmtPrice(newBal)}`);
  };

  // =========================================================================
  // DEALERSHIP CRUD OPERATIONS
  // =========================================================================

  const handleOpenAddDealer = () => {
    const nextId = `d${dealers.length + 1}`;
    setDealerForm({
      id: nextId,
      name: '',
      location: '',
      manager: '',
      email: '',
      phone: '+91 98000 00000',
      rating: 4.8,
      cars: 35,
      tier: 'Gold Partner',
      status: 'verified',
      floorplanLimit: 2500000,
      license: `DL-AUTO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      capacity: 50,
    });
    setShowAddDealerModal(true);
  };

  const handleSaveNewDealer = (e) => {
    e.preventDefault();
    if (!dealerForm.name || !dealerForm.location || !dealerForm.email) {
      showToast('Please fill out all mandatory dealership fields.', 'error');
      return;
    }

    const newDealer = {
      id: dealerForm.id || `d${Date.now()}`,
      name: dealerForm.name,
      location: dealerForm.location,
      manager: dealerForm.manager || 'Executive Principal',
      email: dealerForm.email,
      phone: dealerForm.phone,
      rating: Number(dealerForm.rating) || 4.5,
      cars: Number(dealerForm.cars) || 20,
      tier: dealerForm.tier,
      status: dealerForm.status,
      floorplanLimit: Number(dealerForm.floorplanLimit) || 2000000,
      floorplanUsed: Math.round(Number(dealerForm.floorplanLimit || 2000000) * 0.45),
      license: dealerForm.license || `DL-AUTO-${Date.now()}`,
      joinedDate: new Date().toISOString().split('T')[0],
      capacity: Number(dealerForm.capacity) || 50,
      serviceBays: 6,
    };

    setDealers(prev => [newDealer, ...prev]);
    logAudit('DEALER_CREATE', `Enrolled verified franchise dealership: ${newDealer.name} (${newDealer.id}) in ${newDealer.location}.`);
    showToast(`✓ Dealership "${newDealer.name}" registered successfully!`);
    setShowAddDealerModal(false);
  };

  const handleOpenEditDealer = (dealer) => {
    setActiveDealer(dealer);
    setDealerForm({ ...dealer });
    setShowEditDealerModal(true);
  };

  const handleSaveEditDealer = (e) => {
    e.preventDefault();
    if (!dealerForm.name || !dealerForm.location) {
      showToast('Dealership name and location are required.', 'error');
      return;
    }

    setDealers(prev => prev.map(d => {
      if (d.id === activeDealer.id) {
        return {
          ...d,
          name: dealerForm.name,
          location: dealerForm.location,
          manager: dealerForm.manager,
          email: dealerForm.email,
          phone: dealerForm.phone,
          rating: Number(dealerForm.rating),
          cars: Number(dealerForm.cars),
          tier: dealerForm.tier,
          status: dealerForm.status,
          floorplanLimit: Number(dealerForm.floorplanLimit),
          license: dealerForm.license,
          capacity: Number(dealerForm.capacity),
        };
      }
      return d;
    }));

    logAudit('DEALER_UPDATE', `Modified franchise parameters for ${activeDealer.name} (${activeDealer.id}).`);
    showToast(`✓ Dealership "${activeDealer.name}" updated successfully!`);
    setShowEditDealerModal(false);
    setActiveDealer(null);
  };

  const handleConfirmDeleteDealer = () => {
    if (!activeDealer) return;
    setDealers(prev => prev.filter(d => d.id !== activeDealer.id));
    logAudit('DEALER_DELETE', `Revoked and deleted partner franchise ${activeDealer.name} (${activeDealer.id}).`);
    showToast(`✓ Dealership "${activeDealer.name}" removed from partner directory.`);
    setShowDeleteDealerModal(false);
    setActiveDealer(null);
  };

  const toggleDealerStatus = (dealer) => {
    const nextStatus = dealer.status === 'verified' ? 'suspended' : 'verified';
    setDealers(prev => prev.map(d => d.id === dealer.id ? { ...d, status: nextStatus } : d));
    logAudit('DEALER_STATUS_CHANGE', `Toggled franchise status of ${dealer.name} to ${nextStatus.toUpperCase()}.`);
    showToast(`Franchise ${dealer.name} status updated to ${nextStatus}.`);
  };

  // =========================================================================
  // DEALERSHIP ONBOARDING QUEUE (APPROVALS)
  // =========================================================================

  const handleApproveApplication = (app) => {
    // 1. Create a new active dealership from the application
    const newDealer = {
      id: `d${dealers.length + 1}`,
      name: app.franchiseName,
      location: app.city,
      manager: app.contactPerson,
      email: app.email,
      phone: app.phone,
      rating: 5.0,
      cars: app.proposedUnits || 25,
      tier: 'Gold Partner',
      status: 'verified',
      floorplanLimit: app.requestedFloorplan || 2000000,
      floorplanUsed: 0,
      license: app.licenseDoc || `DL-ONBOARD-${Date.now()}`,
      joinedDate: new Date().toISOString().split('T')[0],
      capacity: (app.proposedUnits || 25) * 2,
      serviceBays: 6,
    };

    setDealers(prev => [newDealer, ...prev]);
    // 2. Remove application or mark as approved
    setApplications(prev => prev.filter(a => a.id !== app.id));
    logAudit('APPLICATION_APPROVE', `Approved dealership application for ${app.franchiseName} in ${app.city}. Granted ${fmtPrice(newDealer.floorplanLimit)} floorplan facility.`);
    showToast(`🎉 Approved! ${app.franchiseName} is now an active verified partner franchise!`);
  };

  const handleDeclineApplication = (app) => {
    setApplications(prev => prev.filter(a => a.id !== app.id));
    logAudit('APPLICATION_DECLINE', `Declined franchise application for ${app.franchiseName} (${app.city}).`);
    showToast(`Declined application for ${app.franchiseName}.`, 'info');
  };

  // =========================================================================
  // SYSTEM CONTROLS & CACHE OPERATIONS
  // =========================================================================

  const handlePurgeEdgeCache = () => {
    logAudit('CACHE_PURGE', 'Flushed all edge gateway HTTP cache layers and invalidated stale static buffer.');
    showToast('⚡ Edge cache successfully purged! All showroom and vehicle routes revalidated.');
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all admin customers and dealers to production baseline defaults?')) {
      setCustomers(SEED_CUSTOMERS);
      setDealers(SEED_DEALERS);
      setApplications(SEED_APPLICATIONS);
      localStorage.removeItem('uvp_admin_customers');
      localStorage.removeItem('uvp_admin_dealers');
      localStorage.removeItem('uvp_admin_applications');
      logAudit('FACTORY_RESET', 'Restored pristine directory state for all customers and dealerships.');
      showToast('✓ Reset complete. Default production directory restored.');
    }
  };

  // =========================================================================
  // FILTERED LISTS & COMPUTED METRICS
  // =========================================================================

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const q = customerSearch.toLowerCase();
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.location && c.location.toLowerCase().includes(q));
      const matchStatus = customerStatusFilter === 'all' || c.status === customerStatusFilter;
      const matchRole = customerRoleFilter === 'all' || c.role === customerRoleFilter;
      return matchQ && matchStatus && matchRole;
    });
  }, [customers, customerSearch, customerStatusFilter, customerRoleFilter]);

  const filteredDealers = useMemo(() => {
    return dealers.filter(d => {
      const q = dealerSearch.toLowerCase();
      const matchQ = !q || d.name.toLowerCase().includes(q) || d.location.toLowerCase().includes(q) || (d.manager && d.manager.toLowerCase().includes(q)) || d.id.toLowerCase().includes(q);
      const matchTier = dealerTierFilter === 'all' || d.tier.toLowerCase().includes(dealerTierFilter.toLowerCase());
      const matchStatus = dealerStatusFilter === 'all' || d.status === dealerStatusFilter;
      return matchQ && matchTier && matchStatus;
    });
  }, [dealers, dealerSearch, dealerTierFilter, dealerStatusFilter]);

  // Executive KPI Aggregations
  const totalCustomerPurchasingPower = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.balance || 0), 0);
  }, [customers]);

  const totalWholesaleFloorplan = useMemo(() => {
    return dealers.reduce((acc, d) => acc + (d.floorplanLimit || 0), 0);
  }, [dealers]);

  const totalDealerVehicles = useMemo(() => {
    return dealers.reduce((acc, d) => acc + (d.cars || 0), 0);
  }, [dealers]);

  // Security Gate: Admin portal should only be accessible with admin creds (admin / #Welcome@Admin2026)
  if (!isAdminAuthenticated) {
    return (
      <div className="am-admin-gate-wrapper">
        <div className="am-admin-gate-card">
          <div className="am-gate-shield-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <rect x="9" y="10" width="6" height="5" rx="1" />
              <path d="M10 10V8a2 2 0 0 1 4 0v2" />
            </svg>
          </div>

          <div className="am-gate-badge">
            <span className="am-pulse-led" style={{ background: '#f43f5e', boxShadow: '0 0 10px #f43f5e' }} />
            Restricted Admin Area
          </div>

          <h2 className="am-gate-title">Stratos Governance Console</h2>
          <p className="am-gate-subtitle">
            Enter authorized master administrator credentials to access executive controls, customer KYC dossiers, and dealership franchise operations.
          </p>

          {gateError && (
            <div className="am-gate-error-alert">
              <span className="am-gate-error-icon">⚠️</span>
              <div className="am-gate-error-text">{gateError}</div>
            </div>
          )}

          <form onSubmit={handleGateLogin} className="am-gate-form">
            <div className="am-gate-field">
              <label>Administrator Username</label>
              <div className="am-gate-input-wrapper">
                <span className="am-gate-icon">👤</span>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter administrator username..."
                  value={gateUser}
                  onChange={e => setGateUser(e.target.value)}
                  className="am-gate-input"
                />
              </div>
            </div>

            <div className="am-gate-field">
              <label>Security Keyphrase / Password</label>
              <div className="am-gate-input-wrapper">
                <span className="am-gate-icon">🔑</span>
                <input
                  type={showGatePass ? 'text' : 'password'}
                  required
                  placeholder="Enter administrator password..."
                  value={gatePass}
                  onChange={e => setGatePass(e.target.value)}
                  className="am-gate-input"
                />
                <button
                  type="button"
                  className="am-gate-toggle-pass"
                  onClick={() => setShowGatePass(!showGatePass)}
                  title={showGatePass ? 'Hide password' : 'Show password'}
                >
                  {showGatePass ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={gateLoading}
              className="am-gate-submit-btn"
            >
              {gateLoading ? 'Verifying Credentials...' : 'Authenticate & Enter Console ⚡'}
            </button>
          </form>

          <div className="am-gate-footer">
            <span className="am-gate-compliance">
              🔒 256-bit AES Cryptographic Session • SuperAdmin Clearance Required
            </span>
            <Link to="/" className="am-gate-back-link">
              ← Return to Customer Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="am-admin-wrapper">
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`am-admin-toast ${toast.type}`}>
          <div className="am-toast-icon">
            {toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✓'}
          </div>
          <div className="am-toast-message">{toast.message}</div>
          <button className="am-toast-close" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      {/* Admin Executive Header Bar */}
      <div className="am-admin-header-card">
        <div className="am-admin-header-content">
          <div className="am-admin-badge-strip">
            <span className="am-badge-shield">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Master Governance Console
            </span>
            <span className="am-badge-node">Edge Node: SG-GATEWAY-01</span>
            <span className="am-badge-status-live">
              <span className="am-pulse-led" /> Cluster Operational
            </span>
          </div>

          <h1 className="am-admin-title">
            Stratos Enterprise Administration Center
          </h1>
          <p className="am-admin-subtitle">
            Centralized platform management, dealership franchise oversight, customer directory & financial compliance.
          </p>

          <div className="am-admin-meta-row">
            <div className="am-admin-actor-pill">
              👤 Active Admin: <b>{user?.username || 'admin'}</b>
              <span className="am-role-tag">Super Admin</span>
            </div>
            <div className="am-admin-quick-links">
              <Link to="/admin/documents" className="am-admin-link-btn">
                📁 Document Center ↗
              </Link>
              <Link to="/dealer-dashboard" className="am-admin-link-btn">
                🏢 Open Dealer Portal ↗
              </Link>
              <Link to="/search" className="am-admin-link-btn">
                🏪 View Storefront ↗
              </Link>
              <button className="am-admin-link-btn" onClick={handleResetDefaults}>
                🔄 Reset Baseline Data
              </button>
              <button className="am-admin-link-btn danger" onClick={handleAdminSignout}>
                🔒 Exit Admin Session
              </button>
            </div>
          </div>
        </div>

        {/* Quick Summary Pill Badges */}
        <div className="am-admin-quick-stats-grid">
          <div className="am-quick-stat-box">
            <span className="am-stat-label">Total Customers</span>
            <div className="am-stat-value">{customers.length}</div>
            <span className="am-stat-sub positive">+{customers.filter(c => c.status === 'active').length} Active</span>
          </div>
          <div className="am-quick-stat-box">
            <span className="am-stat-label">Partner Dealers</span>
            <div className="am-stat-value">{dealers.length}</div>
            <span className="am-stat-sub positive">{totalDealerVehicles} Showroom Units</span>
          </div>
          <div className="am-quick-stat-box">
            <span className="am-stat-label">Buyer Liquidity</span>
            <div className="am-stat-value">{fmtPrice(totalCustomerPurchasingPower)}</div>
            <span className="am-stat-sub">Escrow Balance</span>
          </div>
          <div className="am-quick-stat-box">
            <span className="am-stat-label">Credit Facility</span>
            <div className="am-stat-value">{fmtPrice(totalWholesaleFloorplan)}</div>
            <span className="am-stat-sub positive">62% Utilized</span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="am-admin-nav-bar">
        <button
          className={`am-admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Executive Overview
        </button>

        <button
          className={`am-admin-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Customer Directory ({customers.length})
        </button>

        <button
          className={`am-admin-tab-btn ${activeTab === 'dealers' ? 'active' : ''}`}
          onClick={() => setActiveTab('dealers')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Dealership Network ({dealers.length})
        </button>

        <button
          className={`am-admin-tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('approvals')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Onboarding Applications
          {applications.length > 0 && <span className="am-counter-badge">{applications.length}</span>}
        </button>

        <button
          className={`am-admin-tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
          onClick={() => setActiveTab('controls')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Platform Controls
        </button>

        <button
          className={`am-admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Audit Stream ({auditLogs.length})
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. EXECUTIVE OVERVIEW TAB                                           */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div className="am-admin-tab-body">
          {/* Executive Analytics KPI Cards */}
          <div className="am-admin-kpi-grid">
            <div className="am-admin-kpi-card">
              <div className="am-kpi-header">
                <span className="am-kpi-label">Customer Accounts</span>
                <span className="am-kpi-trend positive">+14.2% MoM</span>
              </div>
              <div className="am-kpi-number">{customers.length}</div>
              <div className="am-kpi-detail">
                <span>{customers.filter(c => c.status === 'active').length} Active</span>
                <span>•</span>
                <span>{customers.filter(c => c.tier.includes('VIP')).length} VIP Prestige</span>
              </div>
              <div className="am-admin-progress">
                <div className="am-admin-progress-bar cyan" style={{ width: '92%' }} />
              </div>
            </div>

            <div className="am-admin-kpi-card">
              <div className="am-kpi-header">
                <span className="am-kpi-label">Verified Dealerships</span>
                <span className="am-kpi-trend positive">+3 Pending Approval</span>
              </div>
              <div className="am-kpi-number">{dealers.length}</div>
              <div className="am-kpi-detail">
                <span>{dealers.filter(d => d.tier.includes('Platinum')).length} Platinum</span>
                <span>•</span>
                <span>{dealers.filter(d => d.tier.includes('Gold')).length} Gold Partners</span>
              </div>
              <div className="am-admin-progress">
                <div className="am-admin-progress-bar violet" style={{ width: '85%' }} />
              </div>
            </div>

            <div className="am-admin-kpi-card">
              <div className="am-kpi-header">
                <span className="am-kpi-label">Wholesale Liquidity Facility</span>
                <span className="am-kpi-trend positive">Tier-1 Escrow</span>
              </div>
              <div className="am-kpi-number">{fmtPrice(totalWholesaleFloorplan)}</div>
              <div className="am-kpi-detail">
                <span>Active Draws: $18.4M</span>
                <span>•</span>
                <span>0 Default Rate</span>
              </div>
              <div className="am-admin-progress">
                <div className="am-admin-progress-bar emerald" style={{ width: '64%' }} />
              </div>
            </div>

            <div className="am-admin-kpi-card">
              <div className="am-kpi-header">
                <span className="am-kpi-label">Platform Security Status</span>
                <span className="am-kpi-trend positive">99.98% SLA</span>
              </div>
              <div className="am-kpi-number text-emerald">Optimal</div>
              <div className="am-kpi-detail">
                <span>TLS 1.3 Active</span>
                <span>•</span>
                <span>Zero Breach Canaries</span>
              </div>
              <div className="am-admin-progress">
                <div className="am-admin-progress-bar amber" style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Quick Action Operations Bar */}
          <div className="am-admin-section-card">
            <div className="am-section-title-row">
              <div>
                <h3 className="am-section-h3">⚡ Executive Quick Action Operations</h3>
                <p className="am-section-desc">Instantly dispatch platform modifications, register new entities or invalidate cached state.</p>
              </div>
              <div className="am-action-btn-group">
                <button className="am-btn-primary" onClick={handleOpenAddCustomer}>
                  ➕ Add New Customer
                </button>
                <button className="am-btn-primary indigo" onClick={handleOpenAddDealer}>
                  🏢 Register Partner Dealership
                </button>
                <button className="am-btn-secondary" onClick={handlePurgeEdgeCache}>
                  ⚡ Purge Edge Cache
                </button>
              </div>
            </div>
          </div>

          {/* 2-Column Overview Layout: Recent Dealers & Recent Customers */}
          <div className="am-admin-two-col">
            {/* Recent Customers Overview Card */}
            <div className="am-admin-section-card">
              <div className="am-section-title-row">
                <h3 className="am-section-h3">👥 Retail & VIP Buyer Directory</h3>
                <button className="am-link-action" onClick={() => setActiveTab('customers')}>
                  View All ({customers.length}) →
                </button>
              </div>

              <div className="am-admin-mini-list">
                {customers.slice(0, 5).map(c => (
                  <div key={c.id} className="am-mini-item">
                    <div className="am-mini-avatar">
                      {c.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="am-mini-info">
                      <div className="am-mini-name">{c.name} <span className="am-tag-role">@{c.username}</span></div>
                      <div className="am-mini-meta">{c.email} • {c.location}</div>
                    </div>
                    <div className="am-mini-right">
                      <div className="am-mini-balance">{fmtPrice(c.balance)}</div>
                      <span className={`am-status-badge ${c.status}`}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Dealerships Overview Card */}
            <div className="am-admin-section-card">
              <div className="am-section-title-row">
                <h3 className="am-section-h3">🏢 Verified Partner Dealerships</h3>
                <button className="am-link-action" onClick={() => setActiveTab('dealers')}>
                  Manage Network ({dealers.length}) →
                </button>
              </div>

              <div className="am-admin-mini-list">
                {dealers.slice(0, 5).map(d => (
                  <div key={d.id} className="am-mini-item">
                    <div className="am-mini-avatar dealer">
                      {d.id.toUpperCase()}
                    </div>
                    <div className="am-mini-info">
                      <div className="am-mini-name">{d.name}</div>
                      <div className="am-mini-meta">{d.location} • GM: {d.manager}</div>
                    </div>
                    <div className="am-mini-right">
                      <div className="am-mini-balance">{d.cars} Cars in Stock</div>
                      <span className="am-tier-badge platinum">{d.tier}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. CUSTOMER MANAGEMENT (FULL CRUD) TAB                              */}
      {/* ==================================================================== */}
      {activeTab === 'customers' && (
        <div className="am-admin-tab-body">
          {/* Controls Bar: Search, Filters & Add Button */}
          <div className="am-admin-table-toolbar">
            <div className="am-search-input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search customers by name, username, email, location..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="am-admin-search-input"
              />
              {customerSearch && (
                <button className="am-clear-btn" onClick={() => setCustomerSearch('')}>✕</button>
              )}
            </div>

            <div className="am-filter-group">
              <select
                value={customerStatusFilter}
                onChange={e => setCustomerStatusFilter(e.target.value)}
                className="am-admin-select"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending_kyc">Pending KYC</option>
              </select>

              <select
                value={customerRoleFilter}
                onChange={e => setCustomerRoleFilter(e.target.value)}
                className="am-admin-select"
              >
                <option value="all">All Account Roles</option>
                <option value="customer">Retail Buyer</option>
                <option value="seller">Verified Seller</option>
                <option value="corporate">Corporate Fleet</option>
              </select>

              <button className="am-btn-primary" onClick={handleOpenAddCustomer}>
                ➕ Add Customer
              </button>
            </div>
          </div>

          {/* Customer Table */}
          <div className="am-admin-table-card">
            <div className="am-table-scroll-wrap">
              <table className="am-admin-table">
                <thead>
                  <tr>
                    <th>Customer / User</th>
                    <th>Contact Details</th>
                    <th>Account Role & Tier</th>
                    <th>Wallet Balance</th>
                    <th>KYC Verification</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="am-table-empty">
                        <div className="am-empty-state">
                          <span className="am-empty-icon">🔍</span>
                          <h4>No customer accounts matched your search</h4>
                          <p>Try clearing filters or add a new customer account using the button above.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div className="am-user-cell">
                            <div className="am-user-avatar">
                              {c.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="am-user-fullname">{c.name}</div>
                              <div className="am-user-handle">@{c.username}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="am-cell-email">{c.email}</div>
                          <div className="am-cell-sub">{c.phone}</div>
                        </td>
                        <td>
                          <span className="am-role-pill">{c.tier}</span>
                          <div className="am-cell-sub">{c.location || 'Metro Hub'}</div>
                        </td>
                        <td>
                          <div className="am-balance-val">{fmtPrice(c.balance)}</div>
                          <div className="am-balance-actions">
                            <button
                              className="am-bal-quick-btn"
                              title="Add $5,000 Credit"
                              onClick={() => handleAdjustBalance(c, 5000)}
                            >
                              +$5k
                            </button>
                            <button
                              className="am-bal-quick-btn"
                              title="Deduct $5,000 Credit"
                              onClick={() => handleAdjustBalance(c, -5000)}
                            >
                              -$5k
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className={`am-kyc-badge ${c.kycLevel.toLowerCase().replace(/\s+/g, '-')}`}>
                            {c.kycLevel}
                          </span>
                        </td>
                        <td>
                          <span className={`am-status-badge ${c.status}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="am-row-actions">
                            <button
                              className="am-icon-action-btn view"
                              title="View Full Customer Dossier"
                              onClick={() => setViewDetailModal({ type: 'customer', data: c })}
                            >
                              👁️
                            </button>
                            <button
                              className="am-icon-action-btn edit"
                              title="Edit Customer Details"
                              onClick={() => handleOpenEditCustomer(c)}
                            >
                              ✏️
                            </button>
                            <button
                              className={`am-icon-action-btn ${c.status === 'active' ? 'suspend' : 'activate'}`}
                              title={c.status === 'active' ? 'Suspend Account' : 'Activate Account'}
                              onClick={() => toggleCustomerStatus(c)}
                            >
                              {c.status === 'active' ? '🔒' : '🔓'}
                            </button>
                            <button
                              className="am-icon-action-btn delete"
                              title="Delete Customer Account"
                              onClick={() => {
                                setActiveCustomer(c);
                                setShowDeleteCustomerModal(true);
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="am-table-footer">
              <span>Showing <b>{filteredCustomers.length}</b> of <b>{customers.length}</b> customer accounts</span>
              <span className="am-table-note">All modifications sync in real-time to administrative storage</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. DEALERSHIP MANAGEMENT (FULL CRUD) TAB                             */}
      {/* ==================================================================== */}
      {activeTab === 'dealers' && (
        <div className="am-admin-tab-body">
          {/* Controls Bar: Search, Filters & Add Button */}
          <div className="am-admin-table-toolbar">
            <div className="am-search-input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search dealerships by name, city, franchise ID, manager..."
                value={dealerSearch}
                onChange={e => setDealerSearch(e.target.value)}
                className="am-admin-search-input"
              />
              {dealerSearch && (
                <button className="am-clear-btn" onClick={() => setDealerSearch('')}>✕</button>
              )}
            </div>

            <div className="am-filter-group">
              <select
                value={dealerTierFilter}
                onChange={e => setDealerTierFilter(e.target.value)}
                className="am-admin-select"
              >
                <option value="all">All Franchise Tiers</option>
                <option value="platinum">Platinum Franchise</option>
                <option value="gold">Gold Partner</option>
                <option value="silver">Silver Associate</option>
              </select>

              <select
                value={dealerStatusFilter}
                onChange={e => setDealerStatusFilter(e.target.value)}
                className="am-admin-select"
              >
                <option value="all">All Verification Statuses</option>
                <option value="verified">Verified Partner</option>
                <option value="suspended">Suspended</option>
              </select>

              <div className="am-view-mode-toggle">
                <button
                  className={`am-view-mode-btn ${dealerViewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setDealerViewMode('table')}
                  title="Table View"
                >
                  ☰
                </button>
                <button
                  className={`am-view-mode-btn ${dealerViewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setDealerViewMode('grid')}
                  title="Card Grid View"
                >
                  ☷
                </button>
              </div>

              <button className="am-btn-primary indigo" onClick={handleOpenAddDealer}>
                🏢 Register Dealership
              </button>
            </div>
          </div>

          {dealerViewMode === 'table' ? (
            /* Table View */
            <div className="am-admin-table-card">
              <div className="am-table-scroll-wrap">
                <table className="am-admin-table">
                  <thead>
                    <tr>
                      <th>Dealership / Franchise</th>
                      <th>Location & Address</th>
                      <th>General Manager</th>
                      <th>Inventory Capacity</th>
                      <th>Rating</th>
                      <th>Floorplan Line</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDealers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="am-table-empty">
                          <div className="am-empty-state">
                            <span className="am-empty-icon">🏢</span>
                            <h4>No partner dealerships matched your search</h4>
                            <p>Adjust your search criteria or register a new franchise partner.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredDealers.map(d => (
                        <tr key={d.id}>
                          <td>
                            <div className="am-user-cell">
                              <div className="am-dealer-badge-box">
                                {d.id.toUpperCase()}
                              </div>
                              <div>
                                <div className="am-user-fullname">{d.name}</div>
                                <span className={`am-tier-badge ${d.tier.toLowerCase().includes('platinum') ? 'platinum' : d.tier.toLowerCase().includes('gold') ? 'gold' : 'silver'}`}>
                                  {d.tier}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="am-cell-email">{d.location}</div>
                            <div className="am-cell-sub">Lic: {d.license}</div>
                          </td>
                          <td>
                            <div className="am-cell-email">{d.manager}</div>
                            <div className="am-cell-sub">{d.email}</div>
                          </td>
                          <td>
                            <div className="am-balance-val">{d.cars} Cars</div>
                            <div className="am-cell-sub">Cap: {d.capacity || 50} Units</div>
                          </td>
                          <td>
                            <div className="am-rating-pill">
                              ⭐ {Number(d.rating).toFixed(1)}
                            </div>
                          </td>
                          <td>
                            <div className="am-balance-val">{fmtPrice(d.floorplanLimit)}</div>
                            <div className="am-cell-sub positive">Verified Escrow</div>
                          </td>
                          <td>
                            <span className={`am-status-badge ${d.status}`}>
                              {d.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="am-row-actions">
                              <button
                                className="am-icon-action-btn view"
                                title="View Dealership Facility Details"
                                onClick={() => setViewDetailModal({ type: 'dealer', data: d })}
                              >
                                👁️
                              </button>
                              <button
                                className="am-icon-action-btn edit"
                                title="Edit Dealership Franchise"
                                onClick={() => handleOpenEditDealer(d)}
                              >
                                ✏️
                              </button>
                              <button
                                className={`am-icon-action-btn ${d.status === 'verified' ? 'suspend' : 'activate'}`}
                                title={d.status === 'verified' ? 'Suspend Dealership' : 'Reinstate Dealership'}
                                onClick={() => toggleDealerStatus(d)}
                              >
                                {d.status === 'verified' ? '🔒' : '🔓'}
                              </button>
                              <button
                                className="am-icon-action-btn delete"
                                title="Revoke Franchise License"
                                onClick={() => {
                                  setActiveDealer(d);
                                  setShowDeleteDealerModal(true);
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="am-table-footer">
                <span>Showing <b>{filteredDealers.length}</b> of <b>{dealers.length}</b> partner dealerships</span>
                <span className="am-table-note">Floorplan credit facilities subject to quarterly forensic audits</span>
              </div>
            </div>
          ) : (
            /* Card Grid View */
            <div className="am-admin-dealers-grid">
              {filteredDealers.map(d => (
                <div key={d.id} className="am-admin-dealer-card">
                  <div className="am-dealer-card-top">
                    <span className="am-dealer-id-pill">{d.id.toUpperCase()}</span>
                    <span className={`am-tier-badge ${d.tier.toLowerCase().includes('platinum') ? 'platinum' : 'gold'}`}>
                      {d.tier}
                    </span>
                  </div>

                  <h3 className="am-dealer-card-title">{d.name}</h3>
                  <p className="am-dealer-card-loc">📍 {d.location}</p>

                  <div className="am-dealer-card-specs">
                    <div className="am-dealer-spec-item">
                      <span className="am-spec-lbl">General Manager</span>
                      <span className="am-spec-val">{d.manager}</span>
                    </div>
                    <div className="am-dealer-spec-item">
                      <span className="am-spec-lbl">Showroom Cars</span>
                      <span className="am-spec-val">{d.cars} Units</span>
                    </div>
                    <div className="am-dealer-spec-item">
                      <span className="am-spec-lbl">Floorplan Line</span>
                      <span className="am-spec-val">{fmtPrice(d.floorplanLimit)}</span>
                    </div>
                    <div className="am-dealer-spec-item">
                      <span className="am-spec-lbl">CSAT Rating</span>
                      <span className="am-spec-val text-amber">⭐ {Number(d.rating).toFixed(1)} / 5.0</span>
                    </div>
                  </div>

                  <div className="am-dealer-card-footer">
                    <span className={`am-status-badge ${d.status}`}>
                      {d.status}
                    </span>
                    <div className="am-row-actions">
                      <button
                        className="am-icon-action-btn view"
                        onClick={() => setViewDetailModal({ type: 'dealer', data: d })}
                      >
                        👁️
                      </button>
                      <button
                        className="am-icon-action-btn edit"
                        onClick={() => handleOpenEditDealer(d)}
                      >
                        ✏️
                      </button>
                      <button
                        className="am-icon-action-btn delete"
                        onClick={() => {
                          setActiveDealer(d);
                          setShowDeleteDealerModal(true);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. DEALERSHIP ONBOARDING QUEUE (APPROVALS) TAB                      */}
      {/* ==================================================================== */}
      {activeTab === 'approvals' && (
        <div className="am-admin-tab-body">
          <div className="am-admin-section-card">
            <div className="am-section-title-row">
              <div>
                <h3 className="am-section-h3">📋 Dealership Franchise Onboarding & Verification Queue</h3>
                <p className="am-section-desc">
                  Review applicant legal documentation, commercial facility audits and requested floorplan credit lines before authorizing new showroom franchises.
                </p>
              </div>
            </div>

            {applications.length === 0 ? (
              <div className="am-empty-state-large">
                <span className="am-empty-icon">🎉</span>
                <h3>All Onboarding Applications Processed</h3>
                <p>There are no pending dealership franchise requests in the queue at this time.</p>
              </div>
            ) : (
              <div className="am-applications-grid">
                {applications.map(app => (
                  <div key={app.id} className="am-app-card">
                    <div className="am-app-header">
                      <div>
                        <div className="am-app-ref">{app.id.toUpperCase()}</div>
                        <h4 className="am-app-title">{app.franchiseName}</h4>
                      </div>
                      <span className="am-status-badge pending_kyc">Pending Review</span>
                    </div>

                    <div className="am-app-body">
                      <div className="am-app-field">
                        <span className="lbl">Target Territory:</span>
                        <span className="val">📍 {app.city}</span>
                      </div>
                      <div className="am-app-field">
                        <span className="lbl">Principal Applicant:</span>
                        <span className="val">{app.contactPerson} ({app.phone})</span>
                      </div>
                      <div className="am-app-field">
                        <span className="lbl">Official Email:</span>
                        <span className="val">{app.email}</span>
                      </div>
                      <div className="am-app-field">
                        <span className="lbl">Requested Floorplan:</span>
                        <span className="val text-emerald font-bold">{fmtPrice(app.requestedFloorplan)}</span>
                      </div>
                      <div className="am-app-field">
                        <span className="lbl">Initial Inventory:</span>
                        <span className="val">{app.proposedUnits} Units</span>
                      </div>
                      <div className="am-app-field">
                        <span className="lbl">License Reference:</span>
                        <span className="val code">{app.licenseDoc}</span>
                      </div>
                      <p className="am-app-notes">
                        <b>Applicant Note:</b> "{app.notes}"
                      </p>
                    </div>

                    <div className="am-app-actions">
                      <button
                        className="am-btn-primary emerald"
                        onClick={() => handleApproveApplication(app)}
                      >
                        ✓ Authorize & Enroll Franchise
                      </button>
                      <button
                        className="am-btn-secondary danger"
                        onClick={() => handleDeclineApplication(app)}
                      >
                        ✕ Decline Application
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. PLATFORM CONTROLS & EDGE CONFIGURATION TAB                        */}
      {/* ==================================================================== */}
      {activeTab === 'controls' && (
        <div className="am-admin-tab-body">
          <div className="am-admin-section-card">
            <h3 className="am-section-h3">⚙️ Core Platform Security & Edge Governance</h3>
            <p className="am-section-desc">Global platform flags, reverse-proxy caching policies and cluster failover settings.</p>

            <div className="am-controls-grid">
              {/* Maintenance Mode */}
              <div className="am-control-tile">
                <div className="am-tile-info">
                  <div className="am-tile-title">Platform Maintenance Mode</div>
                  <div className="am-tile-desc">Temporarily redirect non-administrative traffic to static maintenance splash page.</div>
                </div>
                <label className="am-toggle-switch">
                  <input
                    type="checkbox"
                    checked={controls.maintenanceMode}
                    onChange={e => {
                      const next = e.target.checked;
                      setControls(prev => ({ ...prev, maintenanceMode: next }));
                      logAudit('MAINTENANCE_TOGGLE', `Maintenance mode changed to ${next ? 'ENABLED' : 'DISABLED'}.`);
                      showToast(`Maintenance mode is now ${next ? 'ACTIVE' : 'INACTIVE'}.`);
                    }}
                  />
                  <span className="am-toggle-slider" />
                </label>
              </div>

              {/* Edge Gateway Caching */}
              <div className="am-control-tile">
                <div className="am-tile-info">
                  <div className="am-tile-title">Nginx Edge In-Memory Micro-Caching</div>
                  <div className="am-tile-desc">Cache public catalog vehicle search queries for 30s at the gateway edge layer.</div>
                </div>
                <label className="am-toggle-switch">
                  <input
                    type="checkbox"
                    checked={controls.edgeCaching}
                    onChange={e => {
                      const next = e.target.checked;
                      setControls(prev => ({ ...prev, edgeCaching: next }));
                      logAudit('CACHE_POLICY_TOGGLE', `Edge caching policy toggled to ${next ? 'ENABLED' : 'DISABLED'}.`);
                    }}
                  />
                  <span className="am-toggle-slider" />
                </label>
              </div>

              {/* Strict CORS Policy */}
              <div className="am-control-tile">
                <div className="am-tile-info">
                  <div className="am-tile-title">Strict Cross-Origin (CORS) Policy</div>
                  <div className="am-tile-desc">Enforce whitelist-only origin headers and prevent null or third-party reflections.</div>
                </div>
                <label className="am-toggle-switch">
                  <input
                    type="checkbox"
                    checked={controls.strictCors}
                    onChange={e => {
                      const next = e.target.checked;
                      setControls(prev => ({ ...prev, strictCors: next }));
                      logAudit('CORS_TOGGLE', `Strict CORS enforcement changed to ${next ? 'STRICT' : 'PERMISSIVE'}.`);
                    }}
                  />
                  <span className="am-toggle-slider" />
                </label>
              </div>

              {/* Edge Cache Purge Button */}
              <div className="am-control-tile">
                <div className="am-tile-info">
                  <div className="am-tile-title">Purge Edge Gateway Cache</div>
                  <div className="am-tile-desc">Manually flush `/tmp/uvp-cache` in the reverse proxy container.</div>
                </div>
                <button className="am-btn-secondary" onClick={handlePurgeEdgeCache}>
                  ⚡ Purge Edge Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. AUDIT STREAM TAB                                                  */}
      {/* ==================================================================== */}
      {activeTab === 'audit' && (
        <div className="am-admin-tab-body">
          <div className="am-admin-section-card">
            <div className="am-section-title-row">
              <div>
                <h3 className="am-section-h3">📜 Administrative Chronological Audit Stream</h3>
                <p className="am-section-desc">Forensic event trail recording all identity, dealership, and financial state transitions.</p>
              </div>
              <button
                className="am-btn-secondary"
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
                  const dl = document.createElement('a');
                  dl.setAttribute('href', dataStr);
                  dl.setAttribute('download', `stratos_audit_stream_${Date.now()}.json`);
                  dl.click();
                  showToast('Exported audit log to JSON.');
                }}
              >
                📥 Export Audit JSON
              </button>
            </div>

            <div className="am-audit-timeline">
              {auditLogs.map((log, idx) => (
                <div key={log.id || idx} className="am-audit-entry">
                  <div className="am-audit-time">{log.timestamp}</div>
                  <div className="am-audit-marker">
                    <span className="am-audit-dot" />
                    {idx < auditLogs.length - 1 && <span className="am-audit-line" />}
                  </div>
                  <div className="am-audit-content">
                    <div className="am-audit-headline">
                      <span className="am-audit-action">{log.action}</span>
                      <span className="am-audit-actor">Actor: <b>{log.actor}</b></span>
                      <span className="am-audit-status">{log.status}</span>
                    </div>
                    <div className="am-audit-desc">{log.details}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD CUSTOMER                                                 */}
      {/* ==================================================================== */}
      {showAddCustomerModal && (
        <div className="am-modal-backdrop" onClick={() => setShowAddCustomerModal(false)}>
          <div className="am-modal-card" onClick={e => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3>➕ Register New Customer Account</h3>
              <button className="am-modal-close" onClick={() => setShowAddCustomerModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveNewCustomer} className="am-modal-form">
              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alexander Vance"
                    value={custForm.name}
                    onChange={e => setCustForm({ ...custForm, name: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. alex.vance"
                    value={custForm.username}
                    onChange={e => setCustForm({ ...custForm, username: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. alex@vancemotors.com"
                    value={custForm.email}
                    onChange={e => setCustForm({ ...custForm, email: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +1 (555) 890-4412"
                    value={custForm.phone}
                    onChange={e => setCustForm({ ...custForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-3">
                <div className="am-field-wrap">
                  <label>Role</label>
                  <select
                    value={custForm.role}
                    onChange={e => setCustForm({ ...custForm, role: e.target.value })}
                  >
                    <option value="customer">Retail Buyer</option>
                    <option value="seller">Verified Seller</option>
                    <option value="corporate">Corporate Fleet</option>
                  </select>
                </div>
                <div className="am-field-wrap">
                  <label>Membership Tier</label>
                  <select
                    value={custForm.tier}
                    onChange={e => setCustForm({ ...custForm, tier: e.target.value })}
                  >
                    <option value="Standard Retail">Standard Retail</option>
                    <option value="VIP Prestige">VIP Prestige</option>
                    <option value="Corporate Fleet">Corporate Fleet</option>
                    <option value="Verified Seller">Verified Seller</option>
                  </select>
                </div>
                <div className="am-field-wrap">
                  <label>Initial Credit Balance ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={custForm.balance}
                    onChange={e => setCustForm({ ...custForm, balance: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>KYC Verification Level</label>
                  <select
                    value={custForm.kycLevel}
                    onChange={e => setCustForm({ ...custForm, kycLevel: e.target.value })}
                  >
                    <option value="Tier 3 Verified">Tier 3 Verified</option>
                    <option value="Tier 2 Documented">Tier 2 Documented</option>
                    <option value="Tier 1 Basic">Tier 1 Basic</option>
                  </select>
                </div>
                <div className="am-field-wrap">
                  <label>Territory / City</label>
                  <input
                    type="text"
                    placeholder="e.g. San Francisco, CA"
                    value={custForm.location}
                    onChange={e => setCustForm({ ...custForm, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-field-wrap">
                <label>Administrative Notes</label>
                <textarea
                  rows="2"
                  placeholder="Internal audit notes or compliance observations..."
                  value={custForm.notes}
                  onChange={e => setCustForm({ ...custForm, notes: e.target.value })}
                />
              </div>

              <div className="am-modal-footer">
                <button type="button" className="am-btn-secondary" onClick={() => setShowAddCustomerModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="am-btn-primary">
                  ✓ Enroll Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT CUSTOMER                                                */}
      {/* ==================================================================== */}
      {showEditCustomerModal && activeCustomer && (
        <div className="am-modal-backdrop" onClick={() => setShowEditCustomerModal(false)}>
          <div className="am-modal-card" onClick={e => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3>✏️ Edit Customer: @{activeCustomer.username}</h3>
              <button className="am-modal-close" onClick={() => setShowEditCustomerModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="am-modal-form">
              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={custForm.name}
                    onChange={e => setCustForm({ ...custForm, name: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Username (Read Only)</label>
                  <input
                    type="text"
                    disabled
                    value={custForm.username}
                    className="am-input-disabled"
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    value={custForm.email}
                    onChange={e => setCustForm({ ...custForm, email: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    value={custForm.phone}
                    onChange={e => setCustForm({ ...custForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-3">
                <div className="am-field-wrap">
                  <label>Tier</label>
                  <select
                    value={custForm.tier}
                    onChange={e => setCustForm({ ...custForm, tier: e.target.value })}
                  >
                    <option value="Standard Retail">Standard Retail</option>
                    <option value="VIP Prestige">VIP Prestige</option>
                    <option value="Corporate Fleet">Corporate Fleet</option>
                    <option value="Verified Seller">Verified Seller</option>
                  </select>
                </div>
                <div className="am-field-wrap">
                  <label>Account Status</label>
                  <select
                    value={custForm.status}
                    onChange={e => setCustForm({ ...custForm, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending_kyc">Pending KYC</option>
                  </select>
                </div>
                <div className="am-field-wrap">
                  <label>Credit Balance ($)</label>
                  <input
                    type="number"
                    value={custForm.balance}
                    onChange={e => setCustForm({ ...custForm, balance: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-field-wrap">
                <label>Administrative Notes</label>
                <textarea
                  rows="2"
                  value={custForm.notes}
                  onChange={e => setCustForm({ ...custForm, notes: e.target.value })}
                />
              </div>

              <div className="am-modal-footer">
                <button type="button" className="am-btn-secondary" onClick={() => setShowEditCustomerModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="am-btn-primary">
                  ✓ Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELETE CUSTOMER                                              */}
      {/* ==================================================================== */}
      {showDeleteCustomerModal && activeCustomer && (
        <div className="am-modal-backdrop" onClick={() => setShowDeleteCustomerModal(false)}>
          <div className="am-modal-card danger" onClick={e => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3>⚠️ Revoke Customer Account</h3>
              <button className="am-modal-close" onClick={() => setShowDeleteCustomerModal(false)}>✕</button>
            </div>

            <div className="am-modal-body">
              <p>Are you sure you want to permanently delete the customer account for <b>{activeCustomer.name} (@{activeCustomer.username})</b>?</p>
              <div className="am-danger-alert">
                <span>⚠️ This action removes the user dossier from the directory and freezes their remaining escrow balance of <b>{fmtPrice(activeCustomer.balance)}</b>.</span>
              </div>
            </div>

            <div className="am-modal-footer">
              <button className="am-btn-secondary" onClick={() => setShowDeleteCustomerModal(false)}>
                Cancel
              </button>
              <button className="am-btn-primary danger" onClick={handleConfirmDeleteCustomer}>
                🗑️ Confirm Permanent Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: REGISTER DEALERSHIP                                          */}
      {/* ==================================================================== */}
      {showAddDealerModal && (
        <div className="am-modal-backdrop" onClick={() => setShowAddDealerModal(false)}>
          <div className="am-modal-card" onClick={e => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3>🏢 Register New Partner Dealership Franchise</h3>
              <button className="am-modal-close" onClick={() => setShowAddDealerModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveNewDealer} className="am-modal-form">
              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>Franchise ID *</label>
                  <input
                    type="text"
                    required
                    value={dealerForm.id}
                    onChange={e => setDealerForm({ ...dealerForm, id: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Dealership Franchise Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Luxury Motors Kolkata"
                    value={dealerForm.name}
                    onChange={e => setDealerForm({ ...dealerForm, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>Location & City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Park Street, Kolkata"
                    value={dealerForm.location}
                    onChange={e => setDealerForm({ ...dealerForm, location: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>General Manager *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Subhashish Roy"
                    value={dealerForm.manager}
                    onChange={e => setDealerForm({ ...dealerForm, manager: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>Corporate Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. sales@apexluxurykolkata.in"
                    value={dealerForm.email}
                    onChange={e => setDealerForm({ ...dealerForm, email: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Direct Phone</label>
                  <input
                    type="text"
                    value={dealerForm.phone}
                    onChange={e => setDealerForm({ ...dealerForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-3">
                <div className="am-field-wrap">
                  <label>Franchise Tier</label>
                  <select
                    value={dealerForm.tier}
                    onChange={e => setDealerForm({ ...dealerForm, tier: e.target.value })}
                  >
                    <option value="Platinum Franchise">Platinum Franchise</option>
                    <option value="Gold Partner">Gold Partner</option>
                    <option value="Silver Associate">Silver Associate</option>
                  </select>
                </div>
                <div className="am-field-wrap">
                  <label>Floorplan Facility ($)</label>
                  <input
                    type="number"
                    step="500000"
                    value={dealerForm.floorplanLimit}
                    onChange={e => setDealerForm({ ...dealerForm, floorplanLimit: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Initial Vehicles</label>
                  <input
                    type="number"
                    value={dealerForm.cars}
                    onChange={e => setDealerForm({ ...dealerForm, cars: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-modal-footer">
                <button type="button" className="am-btn-secondary" onClick={() => setShowAddDealerModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="am-btn-primary indigo">
                  ✓ Enroll Dealership
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT DEALERSHIP                                              */}
      {/* ==================================================================== */}
      {showEditDealerModal && activeDealer && (
        <div className="am-modal-backdrop" onClick={() => setShowEditDealerModal(false)}>
          <div className="am-modal-card" onClick={e => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3>✏️ Edit Dealership: {activeDealer.name}</h3>
              <button className="am-modal-close" onClick={() => setShowEditDealerModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveEditDealer} className="am-modal-form">
              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>Dealership Name *</label>
                  <input
                    type="text"
                    required
                    value={dealerForm.name}
                    onChange={e => setDealerForm({ ...dealerForm, name: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Location *</label>
                  <input
                    type="text"
                    required
                    value={dealerForm.location}
                    onChange={e => setDealerForm({ ...dealerForm, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-2">
                <div className="am-field-wrap">
                  <label>General Manager</label>
                  <input
                    type="text"
                    value={dealerForm.manager}
                    onChange={e => setDealerForm({ ...dealerForm, manager: e.target.value })}
                  />
                </div>
                <div className="am-field-wrap">
                  <label>Email</label>
                  <input
                    type="email"
                    value={dealerForm.email}
                    onChange={e => setDealerForm({ ...dealerForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-form-grid-3">
                <div className="am-field-wrap">
                  <label>Franchise Tier</label>
                  <select
                    value={dealerForm.tier}
                    onChange={e => setDealerForm({ ...dealerForm, tier: e.target.value })}
                  >
                    <option value="Platinum Franchise">Platinum Franchise</option>
                    <option value="Gold Partner">Gold Partner</option>
                    <option value="Silver Associate">Silver Associate</option>
                  </select>
                </div>
                <div className="am-field-wrap">
                  <label>Status</label>
                  <select
                    value={dealerForm.status}
                    onChange={e => setDealerForm({ ...dealerForm, status: e.target.value })}
                  >
                    <option value="verified">Verified Partner</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="am-field-wrap">
                  <label>Floorplan Facility ($)</label>
                  <input
                    type="number"
                    value={dealerForm.floorplanLimit}
                    onChange={e => setDealerForm({ ...dealerForm, floorplanLimit: e.target.value })}
                  />
                </div>
              </div>

              <div className="am-modal-footer">
                <button type="button" className="am-btn-secondary" onClick={() => setShowEditDealerModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="am-btn-primary">
                  ✓ Save Franchise Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELETE DEALERSHIP                                            */}
      {/* ==================================================================== */}
      {showDeleteDealerModal && activeDealer && (
        <div className="am-modal-backdrop" onClick={() => setShowDeleteDealerModal(false)}>
          <div className="am-modal-card danger" onClick={e => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3>⚠️ Revoke Partner Franchise License</h3>
              <button className="am-modal-close" onClick={() => setShowDeleteDealerModal(false)}>✕</button>
            </div>

            <div className="am-modal-body">
              <p>Are you sure you want to revoke the franchise license and delist <b>{activeDealer.name} ({activeDealer.id})</b>?</p>
              <div className="am-danger-alert">
                <span>⚠️ This action removes all <b>{activeDealer.cars}</b> vehicles consigned under this franchise and freezes the wholesale floorplan credit line of <b>{fmtPrice(activeDealer.floorplanLimit)}</b>.</span>
              </div>
            </div>

            <div className="am-modal-footer">
              <button className="am-btn-secondary" onClick={() => setShowDeleteDealerModal(false)}>
                Cancel
              </button>
              <button className="am-btn-primary danger" onClick={handleConfirmDeleteDealer}>
                🗑️ Confirm Franchise Revocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: VIEW DETAILS (CUSTOMER / DEALER DOSSIER)                      */}
      {/* ==================================================================== */}
      {viewDetailModal && (
        <div className="am-modal-backdrop" onClick={() => setViewDetailModal(null)}>
          <div className="am-modal-card" onClick={e => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3>
                {viewDetailModal.type === 'customer' ? '👤 Verified Customer Dossier' : '🏢 Franchise Facility Inspection'}
              </h3>
              <button className="am-modal-close" onClick={() => setViewDetailModal(null)}>✕</button>
            </div>

            <div className="am-modal-body">
              {viewDetailModal.type === 'customer' ? (
                <div className="am-dossier-wrap">
                  <div className="am-dossier-top">
                    <div className="am-dossier-avatar">
                      {viewDetailModal.data.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4>{viewDetailModal.data.name}</h4>
                      <p className="sub">@{viewDetailModal.data.username} • {viewDetailModal.data.tier}</p>
                      <span className={`am-status-badge ${viewDetailModal.data.status}`}>{viewDetailModal.data.status}</span>
                    </div>
                  </div>

                  <div className="am-dossier-grid">
                    <div className="item"><span className="lbl">Email:</span> <b>{viewDetailModal.data.email}</b></div>
                    <div className="item"><span className="lbl">Phone:</span> <b>{viewDetailModal.data.phone}</b></div>
                    <div className="item"><span className="lbl">Territory:</span> <b>{viewDetailModal.data.location || 'Metro'}</b></div>
                    <div className="item"><span className="lbl">Escrow Balance:</span> <b className="text-emerald">{fmtPrice(viewDetailModal.data.balance)}</b></div>
                    <div className="item"><span className="lbl">KYC Status:</span> <b>{viewDetailModal.data.kycLevel}</b></div>
                    <div className="item"><span className="lbl">Enrolled Date:</span> <b>{viewDetailModal.data.joinedDate}</b></div>
                    <div className="item"><span className="lbl">Total Orders:</span> <b>{viewDetailModal.data.totalOrders} Transactions</b></div>
                  </div>

                  <div className="am-dossier-notes">
                    <b>Compliance Notes:</b>
                    <p>{viewDetailModal.data.notes || 'No flags noted on account.'}</p>
                  </div>
                </div>
              ) : (
                <div className="am-dossier-wrap">
                  <div className="am-dossier-top">
                    <div className="am-dossier-avatar dealer">
                      {viewDetailModal.data.id.toUpperCase()}
                    </div>
                    <div>
                      <h4>{viewDetailModal.data.name}</h4>
                      <p className="sub">{viewDetailModal.data.tier} • {viewDetailModal.data.location}</p>
                      <span className={`am-status-badge ${viewDetailModal.data.status}`}>{viewDetailModal.data.status}</span>
                    </div>
                  </div>

                  <div className="am-dossier-grid">
                    <div className="item"><span className="lbl">General Manager:</span> <b>{viewDetailModal.data.manager}</b></div>
                    <div className="item"><span className="lbl">Corporate Email:</span> <b>{viewDetailModal.data.email}</b></div>
                    <div className="item"><span className="lbl">Operating License:</span> <b>{viewDetailModal.data.license}</b></div>
                    <div className="item"><span className="lbl">Floorplan Line:</span> <b className="text-emerald">{fmtPrice(viewDetailModal.data.floorplanLimit)}</b></div>
                    <div className="item"><span className="lbl">Showroom Vehicles:</span> <b>{viewDetailModal.data.cars} Units</b></div>
                    <div className="item"><span className="lbl">Facility Capacity:</span> <b>{viewDetailModal.data.capacity || 50} Stalls</b></div>
                    <div className="item"><span className="lbl">Customer CSAT:</span> <b className="text-amber">⭐ {Number(viewDetailModal.data.rating).toFixed(1)} / 5.0</b></div>
                  </div>
                </div>
              )}
            </div>

            <div className="am-modal-footer">
              <button className="am-btn-primary" onClick={() => setViewDetailModal(null)}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
