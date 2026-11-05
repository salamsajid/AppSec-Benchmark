import React, { useState } from 'react';
import { api, API } from '../api.js';

export default function Register() {
  const [f, setF] = useState({ username: '', password: '', email: '' });
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const r = await api(`${API.iam}/v1/auth/register`, { method: 'POST', body: JSON.stringify(f) });
    setMsg(JSON.stringify(r.data).slice(0, 200));
  };
  return (
    <div className="am-panel" style={{ maxWidth: 440 }}>
      <h1 className="am-page-title">Join Stratos Motors</h1>
      <p className="am-muted">One account for buying, selling and dealer chat.</p>
      <form onSubmit={submit}>
        {['username', 'password', 'email'].map(k => (
          <div className="am-field" key={k}>
            <label style={{ textTransform: 'capitalize' }}>{k}</label>
            <input type={k === 'password' ? 'password' : 'text'} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
          </div>
        ))}
        <button className="am-btn" type="submit" style={{ width: '100%' }}>Create account</button>
      </form>
      {msg && <div className="am-note">{msg}</div>}
    </div>
  );
}
