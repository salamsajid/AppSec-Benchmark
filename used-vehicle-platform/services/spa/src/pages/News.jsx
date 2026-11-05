import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API } from '../api.js';

export default function News() {
  const [articles, setArticles] = useState([]);
  useEffect(() => { api(`${API.catalog}/v1/news`).then(r => setArticles(r.data.articles || [])).catch(() => {}); }, []);
  return (
    <div>
      <h1 className="am-page-title">Car news & updates</h1>
      <p className="am-muted">Launches, price changes and industry trends.</p>
      <div className="am-grid">
        {articles.map(a => (
          <article className="am-card" key={a.id}>
            <div className="am-card-body">
              <span className="am-tag">{a.tag}</span>
              <h3 style={{ marginTop: 6 }}>{a.title}</h3>
              <div className="am-muted">{a.date}</div>
              <p>{a.body}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
