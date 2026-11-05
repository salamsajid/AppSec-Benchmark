import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, API, fmtPrice, fmtKm, initialOf } from '../api.js';
import { getVehicleImages } from '../vehicleImages.js';

export default function Vehicle() {
  const { id } = useParams();
  const [car, setCar] = useState(null);
  const [photo, setPhoto] = useState(0);
  const [caption, setCaption] = useState('');
  const [site, setSite] = useState('');
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    api(`${API.catalog}/v1/vehicles/${id}`).then(r => setCar(r.data)).catch(() => {});
    const sync = () => {
      const m = (window.location.hash.match(/photo=(\d+)/) || [])[1];
      if (m) setPhoto(Number(m));
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [id]);
  useEffect(() => {
    fetch(`${API.web}/vehicles/${id}/reviews?website=${encodeURIComponent(site)}`)
      .then(r => r.text()).then(t => {
        const m = t.match(/<a href="([^"]*)">/);
        setCaption(m ? `Review site: <a href="${m[1]}">${m[1]}</a>` : '');
      }).catch(() => {});
  }, [id, site]);
  if (!car) return <p className="am-muted">Loading vehicle…</p>;
  const initial = initialOf(car);
  const images = getVehicleImages(car);
  const currentImg = images[photo] || images[0] || `/vehicles/${car.id}.jpg`;
  const similar = [];
  return (
    <div>
      <p className="am-breadcrumb"><Link to="/">Home</Link> / <Link to="/search">Used cars</Link> / {car.make} {car.model}</p>
      <div className="am-detail">
        <div>
          <div className="am-gallery">
            <img
              src={currentImg}
              alt={`${car.make} ${car.model} view ${photo + 1}`}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/vehicles/default.jpg';
              }}
            />
          </div>
          <div className="am-thumbs">
            {images.map((imgSrc, i) => (
              <button
                key={i}
                type="button"
                className={'am-thumb-btn' + (photo === i ? ' active' : '')}
                onClick={() => setPhoto(i)}
                aria-label={`View photo ${i + 1}`}
              >
                <img
                  src={imgSrc}
                  alt={`Angle ${i + 1}`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/vehicles/default.jpg';
                  }}
                />
              </button>
            ))}
          </div>
          <p className="am-muted">Photo {photo + 1} of 3 — <a href={`#photo=${(photo + 1) % 3}`}>next photo</a></p>
        </div>
        <div>
          <h1 className="am-page-title">{car.make} {car.model} ({car.year})</h1>
          <div className="am-row" style={{ gap: 12 }}>
            <span className="am-price">{fmtPrice(car.price)}</span>
            <span className="am-badge">{'★'.repeat(Math.round((car.reviews || []).reduce((a, r) => a + r.rating, 0) / Math.max(1, (car.reviews || []).length)))} {(car.reviews || []).length} reviews</span>
          </div>
          <table className="am-specs">
            <tbody>
              <tr><td>Make</td><td>{car.make}</td></tr>
              <tr><td>Model</td><td>{car.model}</td></tr>
              <tr><td>Year</td><td>{car.year}</td></tr>
              <tr><td>Mileage</td><td>{fmtKm(car.mileage)}</td></tr>
              <tr><td>Fuel</td><td>{car.fuel}</td></tr>
              <tr><td>Transmission</td><td>{car.transmission}</td></tr>
              <tr><td>Body type</td><td>{car.body}</td></tr>
              <tr><td>Color</td><td>{car.color}</td></tr>
              <tr><td>Location</td><td>{car.location}</td></tr>
              <tr><td>VIN</td><td>{car.vin}</td></tr>
            </tbody>
          </table>
          <div className="am-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Link className="am-btn primary" to={`/studio-360?id=${car.id}`} style={{ textDecoration: 'none', background: 'linear-gradient(135deg, #0071e3 0%, #00c7be 100%)' }}>
              🔄 360° Studio Inspection
            </Link>
            <Link className="am-btn" to={`/checkout?vehicle=${car.id}`} style={{ textDecoration: 'none' }}>Buy now</Link>
            <Link className="am-btn secondary" to={`/compare?a=${car.id}`} style={{ textDecoration: 'none' }}>Compare</Link>
            <Link className="am-btn secondary" to={`/support?vehicle=${car.id}`} style={{ textDecoration: 'none' }}>Concierge Desk</Link>
          </div>
          <div dangerouslySetInnerHTML={{ __html: caption }} />
        </div>
      </div>

      <div className="am-tabs">
        {[['overview', 'Overview'], ['features', 'Features'], ['reviews', 'Reviews'], ['similar', 'Similar cars']].map(([k, l]) => (
          <button key={k} className={'am-tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="am-panel">
          <h2>About this car</h2>
          <p>A well-maintained {car.year} {car.make} {car.model} in {car.color}, driven {fmtKm(car.mileage)}. {car.fuel} powered with {car.transmission} transmission. Located in {car.location}.</p>
        </div>
      )}
      {tab === 'features' && (
        <div className="am-panel">
          <h2>Features</h2>
          <div className="am-feature-grid">
            {(car.features || []).map(f => <span key={f} className="am-chip">✓ {f}</span>)}
          </div>
        </div>
      )}
      {tab === 'reviews' && (
        <div className="am-panel">
          <h2>Owner reviews</h2>
          {(car.reviews || []).map((r, i) => (
            <div className="am-review" key={i}>
              <div className="am-row" style={{ justifyContent: 'space-between' }}>
                <b>{r.user}</b>
                <span className="am-badge">{'★'.repeat(r.rating)}</span>
              </div>
              <p>{r.text}</p>
            </div>
          ))}
          {(car.reviews || []).length === 0 && <p className="am-muted">No reviews yet.</p>}
        </div>
      )}
      {tab === 'similar' && (
        <div className="am-panel">
          <h2>Similar cars</h2>
          <p className="am-muted">Compare with other {car.body.toLowerCase()}s in the same price range.</p>
          <div className="am-row">
            <Link className="am-btn secondary" to={`/compare?a=${car.id}`} style={{ textDecoration: 'none' }}>Compare now</Link>
          </div>
        </div>
      )}

      <div className="am-panel" style={{ marginTop: 18 }}>
        <h2>Buyer reviews</h2>
        <p className="am-muted">Bought here? Link your review site and preview it below.</p>
        <form className="am-row" onSubmit={e => { e.preventDefault(); setCaption(caption); }}>
          <input className="am-input" style={{ maxWidth: 320 }} placeholder="Your review site URL" value={site} onChange={e => setSite(e.target.value)} />
          <button className="am-btn secondary" type="submit">Preview review link</button>
        </form>
      </div>
    </div>
  );
}
