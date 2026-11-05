import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API, api, session } from '../api.js';

// Dealer Document Center: renders partner documents fetched from the storefront API.
// The document id comes from the URL (?doc=) so links are shareable between staff.
export default function DocumentCenter() {
  const [params] = useSearchParams();
  const doc = params.get('doc') || 'Q4-market-report';
  const [state, setState] = useState({ loading: true });
  const user = session.user;

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ loading: true });
      // Front-end builds the API path from the query param and sends the staff session.
      const path = API.catalog + '/v1/documents?doc=' + encodeURIComponent(doc);
      const r = await api(path);
      if (alive) setState({ loading: false, status: r.status, data: r.data, path });
    })();
    return () => { alive = false; };
  }, [doc]);

  return (
    <div className="am-page" style={{ maxWidth: 900 }}>
      <h2>Document Center</h2>
      <p style={{ color: '#6e6e73', fontSize: 13 }}>
        Signed in as <b>{user ? user.username : 'guest'}</b> — documents are fetched with your staff session.
      </p>
      <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
        {['Q4-market-report', 'dealer-agreement-template', 'warranty-policy-2026'].map(d => (
          <Link key={d} className="am-chip" to={'/admin/documents?doc=' + encodeURIComponent(d)}>{d}</Link>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#86868b', marginBottom: 8 }}>
        request path: <code>{state.path}</code>
      </div>
      {state.loading ? (
        <p>Loading…</p>
      ) : (
        <pre style={{ background: '#f5f5f7', padding: 16, borderRadius: 12, overflow: 'auto', fontSize: 12 }}>
          {typeof state.data === 'string' ? state.data : JSON.stringify(state.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
