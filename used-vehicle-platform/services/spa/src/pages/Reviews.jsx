import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API, fmtKm } from '../api.js';

export default function Reviews() {
  const [cars, setCars] = useState([]);
  useEffect(() => { api(`${API.catalog}/v1/vehicles/search`).then(r => setCars(r.data.results || [])).catch(() => {}); }, []);
  const withReviews = cars.filter(c => (c.reviews || []).length > 0);
  return (
    <div>
      <h1 className="am-page-title">Owner reviews</h1>
      <p className="am-muted">Real feedback from verified owners.</p>
      {withReviews.map(c => (
        <div className="am-panel" key={c.id} style={{ marginBottom: 14 }}>
          <div className="am-row" style={{ justifyContent: 'space-between' }}>
            <h3><Link to={`/vehicles/${c.id}`}>{c.make} {c.model} ({c.year})</Link></h3>
            <span className="am-muted">{fmtKm(c.mileage)} · {c.fuel}</span>
          </div>
          {c.reviews.map((r, i) => (
            <div className="am-review" key={i}>
              <div className="am-row" style={{ justifyContent: 'space-between' }}>
                <b>{r.user}</b>
                <span className="am-badge">{'★'.repeat(r.rating)}</span>
              </div>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
