export const API = {
  iam: '/api/iam',
  catalog: '/api/catalog',
  lead: '/api/lead',
  web: '/api/web',
  ai: '/api/ai',
};

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text), headers: res.headers }; }
  catch { return { status: res.status, data: text, headers: res.headers }; }
}

export const session = {
  get user() { try { return JSON.parse(localStorage.getItem('am_user') || 'null'); } catch { return null; } },
  set user(u) { localStorage.setItem('am_user', JSON.stringify(u)); },
};

export const fmtPrice = (p) => {
  if (p == null || isNaN(p)) return '—';
  const n = Number(p);
  if (n < 0) return '-$' + Math.abs(n).toLocaleString('en-US');
  return '$' + n.toLocaleString('en-US');
};
export const fmtKm = (m) => Number(m).toLocaleString('en-US') + ' mi';
export const initialOf = (c) => ((c.make || '?') + '').charAt(0).toUpperCase();
