import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, API } from '../api.js';
import { AppleCarCard } from './Home.jsx';

const BODIES = ['All', 'SUV', 'Sedan', 'Hatchback', 'MPV', 'Coupe'];
const FUELS = ['All', 'Petrol', 'Diesel', 'Electric', 'Hybrid'];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('relevance');
  const q = params.get('q') || '';
  const make = params.get('make') || 'All';
  const body = params.get('body') || 'All';
  const fuel = params.get('fuel') || 'All';
  const maxPrice = params.get('maxPrice') || '';
  const minYear = params.get('minYear') || '';

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (make && make !== 'All') qs.set('make', make);
    if (maxPrice) qs.set('maxPrice', maxPrice);
    if (minYear) qs.set('minYear', minYear);
    api(`${API.catalog}/v1/vehicles/search?${qs}`).then(r => {
      let list = r.data.results || [];
      if (body && body !== 'All') list = list.filter(c => c.body === body);
      if (fuel && fuel !== 'All') list = list.filter(c => c.fuel === fuel);
      if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
      if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
      if (sort === 'year-desc') list = [...list].sort((a, b) => b.year - a.year);
      if (sort === 'km-asc') list = [...list].sort((a, b) => a.mileage - b.mileage);
      setCars(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [q, make, body, fuel, maxPrice, minYear, sort]);

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v && v !== 'All') next.set(k, v); else next.delete(k);
    setParams(next);
  };

  return (
    <div>
      {/* Apple Store Style Search Header */}
      <div className="as-store-header">
        <div>
          <h1 className="as-headline">
            Browse Inventory. <span>Explore certified pre-owned vehicles.</span>
          </h1>
        </div>
      </div>

      <div className="am-search-layout">
        <aside className="am-filters">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <b style={{ fontSize: 14, color: '#1d1d1f' }}>Filter Results</b>
            {(q || make !== 'All' || body !== 'All' || fuel !== 'All' || maxPrice || minYear) && (
              <button
                type="button"
                onClick={() => setParams(new URLSearchParams())}
                style={{ background: 'none', border: 'none', color: '#0071e3', fontSize: 12, cursor: 'pointer', padding: 0 }}
              >
                Clear all
              </button>
            )}
          </div>

          <div className="am-filter-group">
            <label>Make</label>
            <select value={make} onChange={e => set('make', e.target.value)}>
              <option value="All">All makes</option>
              {['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Toyota', 'Honda', 'Kia', 'MG', 'Skoda', 'Volkswagen', 'Jeep', 'Nissan', 'Renault', 'BMW', 'Mercedes-Benz', 'Audi', 'Tesla', 'Ford'].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="am-filter-group">
            <label>Body style</label>
            <select value={body} onChange={e => set('body', e.target.value)}>
              {BODIES.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="am-filter-group">
            <label>Fuel type</label>
            <select value={fuel} onChange={e => set('fuel', e.target.value)}>
              {FUELS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="am-filter-group">
            <label>Max budget ($)</label>
            <input type="number" placeholder="e.g. 25000" value={maxPrice} onChange={e => set('maxPrice', e.target.value)} />
          </div>
          <div className="am-filter-group">
            <label>Min manufacturing year</label>
            <input type="number" placeholder="e.g. 2019" value={minYear} onChange={e => set('minYear', e.target.value)} />
          </div>
          <div className="am-filter-group">
            <label>Keywords</label>
            <input placeholder="e.g. sunroof, 4WD, cruise" value={q} onChange={e => set('q', e.target.value)} />
          </div>
        </aside>

        <div>
          <div className="am-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#6e6e73' }}>
              {loading ? 'Searching certified inventory…' : `${cars.length} verified vehicle(s) available`}
            </span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 980,
                border: '1px solid #d2d2d7',
                fontSize: 13,
                background: '#ffffff',
                color: '#1d1d1f'
              }}
            >
              <option value="relevance">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="year-desc">Newest Model Year</option>
              <option value="km-asc">Lowest Mileage</option>
            </select>
          </div>

          {loading && <p style={{ color: '#86868b' }}>Loading certified results…</p>}
          {!loading && cars.length === 0 && (
            <div className="am-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <h3 style={{ margin: '0 0 6px' }}>No matching vehicles found</h3>
              <p style={{ color: '#6e6e73', margin: '0 0 16px' }}>Try widening your price range or adjusting selected filters.</p>
              <button className="am-btn" onClick={() => setParams(new URLSearchParams())}>Reset all filters</button>
            </div>
          )}

          <div className="as-grid">
            {cars.map(c => (
              <AppleCarCard key={c.id} c={c} tag={c.fuel === 'Electric' ? '100% ELECTRIC' : (c.body === 'SUV' ? 'CERTIFIED SUV' : 'CERTIFIED CAR')} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
