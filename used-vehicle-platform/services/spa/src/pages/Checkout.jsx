import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API } from '../api.js';

export default function Checkout() {
  const [params] = useSearchParams();
  const vehicle = params.get('vehicle') || '1';
  const [coupon, setCoupon] = useState('WELCOME10');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const call = async (step) => {
    const r = await fetch(`${API.catalog}/v1/checkout/${step}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'wiener', vehicleId: vehicle }),
    }).then(x => x.json());
    setMsg(JSON.stringify(r).slice(0, 300));
    if (step === 'confirm') setDone(true);
  };
  const applyCoupon = async () => {
    const r = await fetch(`${API.catalog}/v1/promotions/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: coupon }),
    }).then(x => x.json());
    setMsg(JSON.stringify(r).slice(0, 300));
  };
  return (
    <div className="am-panel" style={{ maxWidth: 720 }}>
      <h1 className="am-page-title">Checkout — vehicle #{vehicle}</h1>
      <p className="am-muted">Reserve below, pay at the showroom or online.</p>
      <div className="am-steps">
        <button className="am-step" onClick={() => call('select')}>1 · Select</button>
        <button className="am-step" onClick={() => call('pay')}>2 · Pay</button>
        <button className="am-step" onClick={() => call('confirm')}>3 · Confirm</button>
      </div>
      <div className="am-row">
        <input className="am-input" style={{ maxWidth: 220 }} value={coupon} onChange={e => setCoupon(e.target.value)} />
        <button className="am-btn secondary" onClick={applyCoupon}>Apply promotion</button>
      </div>
      {done && <div className="am-note">🎉 Order confirmed! <Link to={`/receipt?order=${vehicle}`}>View receipt</Link></div>}
      <p><Link to={`/receipt?order=${vehicle}`}>View printable receipt</Link></p>
      {msg && <div className="am-note">{msg}</div>}
    </div>
  );
}
