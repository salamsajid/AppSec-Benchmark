import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API, session } from '../api.js';
import DealerDashboard from './DealerDashboard.jsx';

export default function Account() {
  const [me, setMe] = useState(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const user = session.user;
  const isDealer = user && (user.role === 'dealer' || user.role === 'admin' || user.role === 'partner');
  const [viewMode, setViewMode] = useState(isDealer ? 'executive' : 'garage');

  useEffect(() => {
    if (!user) return;
    api(`${API.iam}/v1/account?user_id=3`).then(r => setMe(r.data)).catch(() => {});
  }, []);

  const changeEmail = async (e) => {
    e.preventDefault();
    const r = await api(`${API.web}/account/email`, { method: 'POST', body: JSON.stringify({ email }) });
    setMsg(JSON.stringify(r.data).slice(0, 200));
  };

  return (
    <div>
      {/* View Mode Switcher for Dealer / Executive Roles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 4, borderRadius: 980, border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="am-btn"
            style={{
              padding: '6px 18px',
              borderRadius: 980,
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === 'garage' ? '#ffffff' : 'transparent',
              color: viewMode === 'garage' ? '#0f172a' : '#64748b',
              boxShadow: viewMode === 'garage' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => setViewMode('garage')}
          >
            🚗 Personal Garage
          </button>
          <button
            type="button"
            className="am-btn"
            style={{
              padding: '6px 18px',
              borderRadius: 980,
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === 'executive' ? '#0f172a' : 'transparent',
              color: viewMode === 'executive' ? '#ffffff' : '#64748b',
              boxShadow: viewMode === 'executive' ? '0 4px 12px rgba(15,23,42,0.2)' : 'none',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => setViewMode('executive')}
          >
            🏢 Executive & Dealer Dashboard
          </button>
        </div>

        {user && (
          <button
            className="am-btn secondary"
            style={{ fontSize: 13, padding: '8px 18px', borderRadius: 980 }}
            onClick={() => {
              session.user = null;
              window.location = '/login';
            }}
          >
            Sign Out
          </button>
        )}
      </div>

      {viewMode === 'executive' ? (
        <DealerDashboard />
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            {user?.picture && (
              <img
                src={user.picture}
                alt={user.username}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #0284c7', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}
              />
            )}
            <div>
              <h1 className="am-page-title" style={{ margin: 0 }}>
                My garage {user ? <span className="am-muted">· {user.username}</span> : <span className="am-muted">· guest, please sign in</span>}
              </h1>
              {user?.email && (
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  Verified Identity: <b>{user.email}</b>
                </div>
              )}
            </div>
          </div>
          {user?.sso && (
            <div style={{ marginBottom: 18, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 16px', borderRadius: 12, color: '#166534', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span>🔒</span> <b>Active Real SSO:</b> Authenticated via {user.sso} {user.realSSO ? '(OpenID Connect Verified)' : ''}
            </div>
          )}
          {me && <div className="am-panel"><h2>Profile</h2><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(me, null, 2).slice(0, 400)}</pre></div>}
          <div className="am-panel">
            <h2>Contact email</h2>
            <p className="am-muted">Dealers reply to this address. See also <Link to="/notes">garage notes</Link>.</p>
            <form className="am-row" onSubmit={changeEmail}>
              <input className="am-input" style={{ maxWidth: 300 }} placeholder="New email" value={email} onChange={e => setEmail(e.target.value)} />
              <button className="am-btn" type="submit">Update email</button>
            </form>
          </div>
          <div className="am-panel" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2>Privileged & Executive Reporting Terminals</h2>
                <p className="am-muted" style={{ margin: 0 }}>
                  Access real-time wholesale analytics, financial audit logs, and cryptographic JWT terminals.
                </p>
              </div>
              <button
                type="button"
                className="am-btn primary"
                style={{ padding: '8px 18px', borderRadius: 980, fontSize: 13 }}
                onClick={() => setViewMode('executive')}
              >
                Launch Executive Dashboard ↗
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && <div className="am-note" style={{ marginTop: 14 }}>{msg}</div>}
    </div>
  );
}
