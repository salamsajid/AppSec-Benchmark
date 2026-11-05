import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Vehicle from './pages/Vehicle.jsx';
import Compare from './pages/Compare.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Account from './pages/Account.jsx';
import Notes from './pages/Notes.jsx';
import Sell from './pages/Sell.jsx';
import Checkout from './pages/Checkout.jsx';
import Contact from './pages/Contact.jsx';
import Dealer from './pages/Dealer.jsx';
import News from './pages/News.jsx';
import Reviews from './pages/Reviews.jsx';
import Emi from './pages/Emi.jsx';
import Assistant from './pages/Assistant.jsx';
import Receipt from './pages/Receipt.jsx';
import DealerDashboard from './pages/DealerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import DocumentCenter from './pages/DocumentCenter.jsx';
import Launches from './pages/Launches.jsx';
import Studio360 from './pages/Studio360.jsx';
import Support from './pages/Support.jsx';
import Warranty from './pages/Warranty.jsx';

import { session } from './api.js';

// Embedded live-help widget: renders trusted partner messages as rich HTML.
function HelpWidget() {
  const [msg, setMsg] = React.useState('');
  useEffect(() => {
    const onMsg = (e) => setMsg(String(e.data).slice(0, 2000));
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  if (!msg) return null;
  return <div className="am-help" dangerouslySetInnerHTML={{ __html: msg }} />;
}

export default function App() {
  const user = session.user;
  const isDealer = user && (user.role === 'dealer' || user.role === 'admin' || user.role === 'partner');
  const isAdmin = user && (user.role === 'admin' || user.username === 'admin' || user.username === 'administrator');

  return (
    <BrowserRouter>
      {/* Apple Store Style Frosted Header */}
      <header className="am-header">
        <div className="am-header-inner">
          <Link className="am-brand" to="/">
            <img src="/stratos_logo.jpg" alt="Stratos Motors Emblem" className="am-brand-logo-img" />
            Stratos<span>Motors</span>
          </Link>

          <nav className="am-nav">
            <Link to="/">Store</Link>
            <Link to="/search">Browse</Link>
            <Link to="/launches" className="am-nav-highlight">
              Launches <span className="am-nav-dot" />
            </Link>
            <Link to="/studio-360">360° Studio</Link>
            <Link to="/compare">Compare</Link>
            <Link to="/sell">Trade-In</Link>
            <Link to="/warranty">Warranty</Link>
            <Link to="/support">Support</Link>
            <Link to="/assistant">AI Specialist</Link>
            {isDealer && (
              <Link to="/dealer-dashboard" className="am-dealer-nav-pill">
                🏢 Dealer Portal
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="am-admin-nav-pill">
                🛡️ Admin Console
              </Link>
            )}
            {user ? (
              <Link to="/account" className="am-user-pill">
                👤 {user.username}
              </Link>
            ) : (
              <Link to="/login" className="am-signin-btn">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="am-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/launches" element={<Launches />} />
          <Route path="/studio-360" element={<Studio360 />} />
          <Route path="/support" element={<Support />} />
          <Route path="/warranty" element={<Warranty />} />
          <Route path="/vehicles/:id" element={<Vehicle />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="/dealer-dashboard" element={<DealerDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin/documents" element={<DocumentCenter />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/dealers" element={<Dealer />} />
          <Route path="/dealers/:id/contact" element={<Contact />} />
          <Route path="/news" element={<News />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/emi" element={<Emi />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/receipt" element={<Receipt />} />
        </Routes>
      </main>

      {/* Apple Store Style Multi-Column Footer */}
      <footer className="am-footer">
        <div className="am-footer-inner">
          <div className="am-footer-footnotes">
            * 1. Listed vehicle prices are verified partner showroom prices inclusive of multi-point inspection fees.
            Monthly EMI calculations are estimates based on standard 10.5% p.a. banking rates.
            Trade-in valuations are subject to physical inspection.
            Single Sign-On (SSO) authentication is protected under Stratos IAM protocols.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24, marginBottom: 30 }}>
            <div>
              <b style={{ color: '#1d1d1f', display: 'block', marginBottom: 10 }}>Shop & Learn</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <Link to="/launches">2027 Upcoming Launches & Pre-Orders</Link>
                <Link to="/studio-360">Studio 360° Vehicle Inspection</Link>
                <Link to="/search">All Pre-Owned Vehicles</Link>
                <Link to="/search?body=SUV">Certified SUVs</Link>
                <Link to="/search?q=electric">Electric EVs</Link>
                <Link to="/compare">Vehicle Compare Matrix</Link>
              </div>
            </div>

            <div>
              <b style={{ color: '#1d1d1f', display: 'block', marginBottom: 10 }}>Account & IAM</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <Link to="/account">My Garage & Orders</Link>
                <Link to="/login">Single Sign-On (SSO)</Link>
                <Link to="/dealers">Partner Dealer Portal</Link>
                <Link to="/admin">Admin Governance Console</Link>
              </div>
            </div>

            <div>
              <b style={{ color: '#1d1d1f', display: 'block', marginBottom: 10 }}>Stratos Services</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <Link to="/warranty">Certified Shield™ Protection</Link>
                <Link to="/support">Concierge Customer Support & Desk</Link>
                <Link to="/sell">Instant Trade-In Valuation</Link>
                <Link to="/emi">EMI & Loan Calculator</Link>
                <Link to="/assistant">AI Buying Specialist</Link>
                <Link to="/reviews">Customer Reviews</Link>
              </div>
            </div>

            <div>
              <b style={{ color: '#1d1d1f', display: 'block', marginBottom: 10 }}>About Stratos Motors</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <Link to="/news">Automotive News</Link>
                <Link to="/dealers">Verified Partner Network</Link>
                <Link to="/support">Contact Concierge & Locations</Link>
                <a href="/docs/API.md" target="_blank" rel="noreferrer">Developer API Reference</a>
                <Link to="/notes">Garage Notes</Link>
              </div>
            </div>
          </div>

          <div className="am-footer-links">
            <span>Copyright © 2026 Stratos Motors Inc. All rights reserved.</span>
            <div className="am-footer-nav">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Use</a>
              <a href="#">Sales Policy</a>
              <a href="#">Site Map</a>
            </div>
          </div>
        </div>
      </footer>

      <HelpWidget />
    </BrowserRouter>
  );
}
