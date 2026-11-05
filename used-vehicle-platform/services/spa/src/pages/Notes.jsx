import React, { useState } from 'react';
import { API } from '../api.js';

export default function Notes() {
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const save = async (e) => {
    e.preventDefault();
    const r = await fetch(`${API.web}/account/notes?note=${encodeURIComponent(note)}`).then(x => x.text());
    setMsg(r.slice(0, 200));
  };
  return (
    <div className="am-panel" style={{ maxWidth: 560 }}>
      <h1 className="am-page-title">Garage notes</h1>
      <p className="am-muted">Private notebook for your search. Only you can see these.</p>
      <form className="am-row" onSubmit={save}>
        <input className="am-input" style={{ maxWidth: 320 }} placeholder="Note" value={note} onChange={e => setNote(e.target.value)} />
        <button className="am-btn" type="submit">Save note</button>
      </form>
      {msg && <div className="am-note">{msg}</div>}
    </div>
  );
}
