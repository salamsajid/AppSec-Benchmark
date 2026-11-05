import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// Legacy printable receipt (kept for old bookmarks and CRM links).
export default function Receipt() {
  const [params] = useSearchParams();
  const order = params.get('order') || '1';
  useEffect(() => {
    document.write(`<div class="am-panel"><h1>Receipt for order ${order}</h1><p>Thank you for shopping with Stratos Motors.</p><p><a href="/checkout?vehicle=${order}">Back to checkout</a></p></div>`);
  }, []);
  return <p className="am-muted">Preparing printable receipt… <Link to="/">Continue browsing</Link></p>;
}
