import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { API } from '../api.js';

export default function Contact() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const [message, setMessage] = useState(`Hi, is vehicle ${sp.get('vehicle') || ''} still available?`);
  const [xmlMode, setXmlMode] = useState(false);
  const [out, setOut] = useState('');
  const send = async (e) => {
    e.preventDefault();
    const url = `${API.lead}/v1/dealers/${id}/contact`;
    const r = xmlMode
      ? await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: message }).then(x => x.json())
      : await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }).then(x => x.json());
    setOut(JSON.stringify(r).slice(0, 300));
  };
  return (
    <div className="am-panel" style={{ maxWidth: 640 }}>
      <h1 className="am-page-title">Contact dealer #{id}</h1>
      <p className="am-muted">Typically replies within a few hours on business days.</p>
      <form onSubmit={send}>
        <div className="am-field">
          <label>Message</label>
          <textarea rows="4" value={message} onChange={e => setMessage(e.target.value)} />
        </div>
        <div className="am-field">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
            <input type="checkbox" checked={xmlMode} onChange={e => setXmlMode(e.target.checked)} style={{ width: 'auto' }} />
            Paste from CRM (XML)
          </label>
        </div>
        <button className="am-btn" type="submit">Send message</button>
      </form>
      {out && <div className="am-note">{out}</div>}
    </div>
  );
}
