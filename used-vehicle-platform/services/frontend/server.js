/* UVP Frontend - INTENTIONALLY VULNERABLE. LAB ONLY. Port 3001.
 * Sec 1.5: server XSS (contexts/filters/CSP/Angular/dangling) / DOM XSS sinks /
 * client proto pollution / CSRF variants / clickjacking / CORS.
 * No X-Frame-Options anywhere (clickjacking). Permissive CORS on /cors/*.
 */
'use strict';
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3001;
app.use(express.json()); app.use(express.urlencoded({ extended: true })); app.use(cookieParser());
// VULN: global CORS reflect (also per-endpoint below)
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
  next();
});

const encAngles = s => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encQuotes = s => String(s).replace(/"/g, '&quot;');
const storedHref = []; const storedComments = []; const stolen = [];
const CSRF = {}; const EMAILS = {}; // session -> token / email

const shell = (title, body, extraHeaders = {}) => {
  const h = `<html><head><title>${title}</title></head><body><h1>${title}</h1><p><a href="/">index</a></p>${body}</body></html>`;
  return h;
};

// ---------- index ----------
app.get('/health', (req, res) => res.json({ ok: true, service: 'frontend-lab' }));
app.get('/', (req, res) => res.send(shell('AutoMarket Web', `
<p>Storefront pages and account services.</p>
<ul><li><a href="/search?q=sedan">Search</a></li><li><a href="/vehicles/1">Sample vehicle</a></li><li><a href="/account/profile">Profile</a></li></ul>`)));

// ================= SERVER XSS =================
app.get('/xss/html', (req, res) => {
  const q = req.query.q || ''; // VULN: nothing encoded
  res.send(shell('XSS html', `<div>Results for ${q}</div>`));
});
app.get('/xss/html-filtered', (req, res) => {
  let q = req.query.q || '';
  // VULN: blocks script/iframe/onerror/onload only; allows <custom>, <svg>, onbegin/onfocus
  q = q.replace(/<script/gi, '').replace(/<iframe/gi, '').replace(/onerror/gi, '').replace(/onload/gi, '');
  res.send(shell('XSS filtered', `<div>${q}</div>`));
});
app.get('/xss/attribute', (req, res) => {
  const q = encAngles(req.query.q || ''); // VULN: <> encoded, " ' allowed + canonical
  res.send(`<html><head><link rel="canonical" href="/?q=${q}"></head><body><input value="${q}"></body></html>`);
});
app.get('/xss/href', (req, res) => {
  let q = req.query.q;
  if (typeof q === 'string') q = q.replace(/javascript:/, ''); // single-pass, case-sensitive scheme strip
  if (q !== undefined) storedHref.push(q); // stored
  const items = storedHref.map(h => `<a href="${encQuotes(h)}">car ${encAngles(h).slice(0,60)}</a>`).join('<br>');
  res.send(shell('XSS href stored', `<form><input name=q><button>add</button></form>${items}`));
});
app.get('/xss/js', (req, res) => {
  const q = encAngles(req.query.q || ''); // VULN: <> encoded, " ' \ allowed
  res.send(`<html><body><script>var q="${q}"; document.write("q="+q);</script></body></html>`);
});
app.get('/xss/template', (req, res) => {
  const q = req.query.q || '';
  res.send(`<html><body><script>var t=\`hello ${q}\`; document.write(t);</script></body></html>`);
});
app.get('/xss/onclick', (req, res) => {
  const c = req.query.comment;
  if (c !== undefined) storedComments.push(c);
  const items = storedComments.map(x => `<button onclick="show('${x}')">show</button>`).join(' ');
  res.send(shell('XSS onclick stored', `<form><input name=comment><button>add</button></form>${items}<script>function show(s){document.write(s)}</script>`));
});
app.get('/xss/steal-demo', (req, res) => res.send(`<html><body>
<input id=pw type=password><span id=csrf-token>tok123</span>
<script>fetch('/xss/steal?c='+encodeURIComponent(document.cookie));document.getElementById('pw').addEventListener('change',e=>fetch('/xss/steal?c=pw:'+e.target.value));fetch('/xss/steal?c=csrf:'+document.getElementById('csrf-token').textContent);</script>
</body></html>`));
app.get('/xss/steal', (req, res) => { stolen.push({ c: req.query.c, ip: req.ip }); res.send('1'); });
app.get('/xss/stolen', (req, res) => res.json({ stolen }));
app.get('/xss/angular', (req, res) => {
  const q = req.query.q || '{{7*7}}'; // VULN: AngularJS expression unsanitized
  res.send(`<html ng-app><body><div>${q}</div><script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.9/angular.min.js"></script></body></html>`);
});
app.get('/xss/event-blocked', (req, res) => {
  let q = req.query.q || '';
  q = q.replace(/on\w+\s*=/gi, '').replace(/href\s*=/gi, ''); // VULN: blocks handlers/href, allows svg animatetransform? actually blocked too; leaves formaction/xlink
  res.send(shell('event blocked', `<div>${q}</div>`));
});
app.get('/xss/jsurl', (req, res) => {
  let q = req.query.q || 'alert(1)';
  q = q.replace(/[();:]/g, ''); // VULN: chars blocked, allows &colon; &#40; entities
  res.send(shell('js url', `<a href="javascript:${q}">click</a>`));
});
app.get('/xss/dangling', (req, res) => {
  const x = req.query.x || 'x'; // VULN: unclosed attribute -> dangling markup steals token below
  res.send(`<html><body><img src='${x}'><span id=csrf>SECRET123</span></body></html>`);
});
app.get('/xss/csp', (req, res) => {
  const q = req.query.q || ''; // VULN: weak CSP self only + JSONP same-origin bypass
  res.setHeader('Content-Security-Policy', "script-src 'self'");
  res.send(`<html><body><div>${q}</div></body></html>`);
});

// ================= DOM XSS =================
const domPage = (name, js, extra = '') => `<html><head><title>dom-${name}</title><script src="https://code.jquery.com/jquery-3.6.0.min.js"></script></head><body><h1>dom-${name}</h1><div id=out></div><a id=lnk href="#">link</a><select id=sel></select>${extra}<script>${js}</script></body></html>`;
app.get('/dom/write', (req, res) => res.send(domPage('write', `document.write(location.search);`)));
app.get('/dom/innerhtml', (req, res) => res.send(domPage('innerhtml', `document.getElementById('out').innerHTML = location.hash.slice(1);`)));
app.get('/dom/jquery-href', (req, res) => res.send(domPage('jquery-href', `$('#lnk').attr('href', location.hash.slice(1));`)));
app.get('/dom/jquery-hash', (req, res) => res.send(domPage('jquery-hash', `$(window).on('hashchange',()=>{ $(location.hash.replace('#','.')||'.x'); });`)));
app.get('/dom/select', (req, res) => res.send(domPage('select', `document.write('<select><option>'+location.search.slice(1)+'</option></select>');`)));
app.get('/dom/angular', (req, res) => res.send(`<html ng-app><body><div>{{${''}location.hash}}</div><script>document.getElementById('out').innerHTML = decodeURIComponent(location.hash.slice(1));</script><script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.9/angular.min.js"></script></body></html>`));
app.get('/dom/reflected', (req, res) => res.send(domPage('reflected', `var x = new URLSearchParams(location.search).get('x'); document.getElementById('out').innerHTML = x;`)));
app.get('/dom/stored', (req, res) => res.send(domPage('stored', `if(location.search) localStorage.x = location.search.slice(1); document.getElementById('out').innerHTML = localStorage.x || '';`)));
app.get('/dom/postmessage', (req, res) => res.send(domPage('postmessage', `window.addEventListener('message', e => { document.getElementById('out').innerHTML = e.data; });`)));
app.get('/dom/json', (req, res) => res.send(domPage('json', `var d = JSON.parse(decodeURIComponent(location.hash.slice(1)||'{}')); document.getElementById('out').innerHTML = d.html;`)));
app.get('/dom/jsurl', (req, res) => res.send(domPage('jsurl', `document.getElementById('lnk').href = 'javascript:' + location.hash.slice(1);`)));
app.get('/dom/redirect', (req, res) => res.send(domPage('redirect', `location = new URLSearchParams(location.search).get('next');`)));
app.get('/dom/cookie', (req, res) => res.send(domPage('cookie', `document.cookie = location.search.slice(1);`)));
app.get('/dom/clobber', (req, res) => res.send(`<html><body><h1>dom-clobber</h1><div id=out></div><script>
if (window.config && window.config.admin) document.getElementById('out').innerHTML = 'admin-html:' + window.config.html;
else document.getElementById('out').innerHTML = location.hash.slice(1);
</script></body></html>`));
app.get('/dom/proto-xss', (req, res) => res.send(domPage('proto-xss', `
function merge(t,s){ for(const k of Object.keys(s||{})){ if(k==='__proto__') Object.assign(Object.prototype, s[k]); else t[k]=s[k]; } }
try { merge({}, JSON.parse(decodeURIComponent(location.hash.slice(1)||'{}'))); } catch(e){}
document.getElementById('out').innerHTML = ({}).html || 'pollute #{"__proto__":{"html":"<img src=x onerror=alert(1)>"}}';
`)));

// ================= CLIENT PROTO POLLUTION =================
app.get('/proto/browser', (req, res) => res.send(`<html><body><h1>proto-browser</h1><script>
// VULN: browser API query parsing assigns __proto__ without guard
function parse(q){ const o={}; q.replace(/^\\?/,'').split('&').forEach(p=>{ const [k,v]=p.split('='); const keys=k.split('.'); let t=o; keys.forEach((kk,i)=>{ if(i===keys.length-1) t[kk]=decodeURIComponent(v||''); else t=t[kk]||(t[kk]={}); }); }); return o; }
var prefs = parse(location.search); Object.assign({}, prefs);
document.write('isAdmin=' + ({}).isAdmin);
</script></body></html>`));
app.get('/proto/sanitize', (req, res) => res.send(`<html><body><h1>proto-sanitize</h1><script>
function merge(t,s){ for(const k of Object.keys(s)){ if(k==='__proto__') continue; t[k]=s[k]; } return t; } // VULN: blocks __proto__ only, not constructor.prototype
var data = JSON.parse(decodeURIComponent(location.hash.slice(1)||'{}')); merge({}, data);
</script></body></html>`));
app.get('/proto/lib', (req, res) => res.send(`<html><body><h1>proto-lib</h1><script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"></script><script>
var data = JSON.parse(decodeURIComponent(location.hash.slice(1)||'{}')); _.merge({}, data); // VULN: third-party lib merge
</script><p>lodash merge pollution vector</p></body></html>`));

// ================= CSRF =================
app.get('/csrf/token', (req, res) => {
  const sess = 's' + Math.random().toString(36).slice(2);
  const tok = 't' + Math.random().toString(36).slice(2);
  CSRF[sess] = tok;
  res.cookie('session', sess, { sameSite: 'Lax' });
  res.json({ session: sess, csrf: tok });
});
app.get('/csrf/demo', (req, res) => res.send(`<html><body><h1>csrf demo</h1><form method=POST action="/csrf/change-email"><input name=email value="a@b.c"><button>no-defense POST</button></form>
<form method=GET action="/csrf/change-email-method"><input name=email><button>update</button></form>
<script>fetch('/csrf/token').then(r=>r.json()).then(j=>{document.cookie='csrf='+j.csrf;});</script></body></html>`));
const setEmail = (req, res, ok, flag) => {
  const email = req.body.email || req.query.email;
  if (!ok) return res.status(403).json({ error: 'csrf blocked' });
  EMAILS[req.cookies.session || 'anon'] = email;
  const r = { ok: true, email };
  if (flag) r.flag = flag;
  res.json(r);
};
app.post('/csrf/change-email', (req, res) => setEmail(req, res, true, 'LAB{csrf_no_defense}')); // VULN: no defenses
app.all('/csrf/change-email-method', (req, res) => { // VULN: token only checked on POST
  if (req.method === 'GET') return setEmail(req, res, true, 'LAB{csrf_method_bypass}');
  const tok = req.body.csrf || req.query.csrf;
  if (CSRF[req.cookies.session] && tok === CSRF[req.cookies.session]) return setEmail(req, res, true);
  res.status(403).json({ error: 'token required' });
});
app.post('/csrf/change-email-present', (req, res) => setEmail(req, res, !!(req.body.csrf || req.query.csrf), 'LAB{csrf_present_bypass}')); // VULN: any non-empty
app.post('/csrf/change-email-session', (req, res) => { // VULN: token valid globally
  const tok = req.body.csrf;
  if (Object.values(CSRF).includes(tok)) return setEmail(req, res, true, 'LAB{csrf_session_bypass}');
  res.status(403).json({ error: 'bad token' });
});
app.post('/csrf/change-email-cookie', (req, res) => { // VULN: duplicated cookie (attacker-fixable), SameSite=None
  res.cookie('csrf', req.body.csrf || 'x', { sameSite: 'None', secure: false });
  if ((req.body.csrf || '') === (req.cookies.csrf || '') && req.body.csrf) return setEmail(req, res, true, 'LAB{csrf_cookie_dup}');
  res.status(403).json({ error: 'cookie must equal body (set both to same arbitrary value)' });
});
app.post('/csrf/change-email-lax', (req, res) => { // VULN: SameSite Lax + method override to GET
  res.cookie('session', req.cookies.session || 'x', { sameSite: 'Lax' });
  if ((req.body._method || req.headers['x-http-method-override'] || '').toUpperCase() === 'GET') return setEmail(req, res, true, 'LAB{csrf_lax_override}');
  const tok = req.body.csrf;
  if (tok === CSRF[req.cookies.session]) return setEmail(req, res, true);
  res.status(403).json({ error: 'need token (override _method=GET)' });
});
app.get('/csrf/redirect', (req, res) => { // VULN: Strict bypass via same-site redirect chain
  const to = req.query.to || '/csrf/change-email-strict?email=a@b.c';
  res.redirect(to);
});
app.all('/csrf/change-email-strict', (req, res) => {
  res.cookie('session', req.cookies.session || 'x', { sameSite: 'Strict' });
  return setEmail(req, res, true, 'LAB{csrf_strict_redirect}');
});
app.get('/csrf/sibling', (req, res) => { // VULN: sibling domain via Domain attribute
  res.cookie('session', 'sib', { domain: '.lab.local' });
  res.send(`<script>document.domain='lab.local';</script><p>sibling: cookie Domain=.lab.local</p>`);
});
app.post('/csrf/change-email-referer-present', (req, res) => { // VULN: only checks present
  if (req.headers.referer) return setEmail(req, res, true, 'LAB{csrf_referer_present}');
  res.status(403).json({ error: 'need Referer (any value passes)' });
});
app.post('/csrf/change-email-referer-broken', (req, res) => { // VULN: unanchored regex
  const r = req.headers.referer || '';
  if (/lab\.local/.test(r)) return setEmail(req, res, true, 'LAB{csrf_referer_broken}');
  res.status(403).json({ error: 'invalid referrer' });
});

// ================= CLICKJACKING (no frame headers anywhere) =================
app.get('/clickjack/basic', (req, res) => res.send(`<html><body><h1>delete account</h1><form method=POST action="/csrf/change-email"><input name=email value="attacker@evil"><button id=del>DELETE</button></form><p>no X-Frame-Options / frame-ancestors (basic)</p></body></html>`));
app.get('/clickjack/prefill', (req, res) => res.send(`<html><body><form><input id=email name=email value="${encAngles(req.query.email || '')}"><button>confirm</button></form><p>prefilled from URL param (overlay attack)</p></body></html>`));
app.get('/clickjack/buster', (req, res) => res.send(`<html><body><script>if(top!=self) top.location=self;</script><button>pay</button></body></html>`));
app.get('/clickjack/domxss', (req, res) => res.send(`<html><body><button id=b>claim $1000</button><div id=out></div><script>document.getElementById('b').onclick=()=>{ location.hash='#<img src=x onerror=alert(1)>'; document.getElementById('out').innerHTML = location.hash.slice(1); };</script><p>click triggers DOM XSS</p></body></html>`));
app.get('/clickjack/multi', (req, res) => res.send(`<html><body><button id=s1>like</button><button id=s2 style="display:none">confirm transfer</button><script>s1.onclick=()=>{s2.style.display='block'};</script><p>multistep clickjacking</p></body></html>`));

// ================= CORS =================
app.get('/cors/basic', (req, res) => {
  const o = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', o || '*'); // VULN: reflection
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.json({ origin: o, flag: o ? 'LAB{cors_basic}' : undefined });
});
app.get('/cors/null', (req, res) => {
  if (req.headers.origin === 'null') { res.setHeader('Access-Control-Allow-Origin', 'null'); res.setHeader('Access-Control-Allow-Credentials', 'true'); return res.json({ flag: 'LAB{cors_null}' }); }
  res.json({ error: 'origin not trusted' });
});
app.get('/cors/insecure', (req, res) => {
  const o = req.headers.origin || '';
  if (o.startsWith('http://')) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Access-Control-Allow-Credentials', 'true'); return res.json({ flag: 'LAB{cors_insecure}', origin: o }); }
  res.json({ error: 'use https' });
});
app.get('/cors/jsonp', (req, res) => {
  const cb = req.query.callback || 'cb'; // VULN: JSONP for CSP bypass
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`${cb}({"user":"wiener"})`);
});

app.listen(PORT, () => console.log(`frontend lab on ${PORT}`));

/* ============================================================================
 * Production façade (public benchmark surface). Realistic storefront paths.
 * Legacy /xss/*, /dom/*, /csrf/*, /clickjack/*, /cors/* keep working but are
 * undocumented (regression only).
 * ========================================================================== */
const _httpF = require('http');
const FPORT = process.env.PORT || 3001;
function fwd(target) {
  return (req, res) => {
    const to = typeof target === 'function' ? target(req) : target;
    const qi = req.url.indexOf('?');
    const extra = qi >= 0 ? req.url.slice(qi + 1) : '';
    let path = to;
    if (extra && !to.includes('?')) path += '?' + extra;
    else if (extra) path += '&' + extra;
    let payload = Buffer.alloc(0);
    const ct = String(req.headers['content-type'] || '');
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length &&
        (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      payload = ct.includes('x-www-form-urlencoded')
        ? Buffer.from(new URLSearchParams(req.body).toString())
        : Buffer.from(JSON.stringify(req.body));
    }
    const headers = { ...req.headers, host: `127.0.0.1:${FPORT}` };
    delete headers['content-length'];
    const preq = _httpF.request({ host: '127.0.0.1', port: FPORT, path, method: req.method,
      headers: { ...headers, 'content-length': payload.length } }, pres => {
      res.status(pres.statusCode);
      for (const [k, v] of Object.entries(pres.headers)) { try { res.set(k, v); } catch {} }
      pres.pipe(res);
    });
    preq.on('error', e => { if (!res.headersSent) res.status(502).json({ error: 'facade:' + e.message }); });
    preq.end(payload);
  };
}
// search + vehicle pages (reflected / stored content surface)
app.get('/search', fwd('/xss/html'));
app.get('/vehicles/:id', (req, res) => fwd(`/xss/attribute?q=${encodeURIComponent(req.params.id)}`)(req, res));
app.all('/vehicles/:id/reviews', (req, res) => {
  const site = req.query.website || (req.body || {}).website || req.query.q || '';
  return fwd(`/xss/href?q=${encodeURIComponent(site)}`)(req, res);
});
app.get('/search/suggest', fwd('/xss/js'));
app.all('/account/notes', (req, res) => {
  const note = req.query.note || (req.body || {}).note || '';
  return fwd(`/xss/onclick?comment=${encodeURIComponent(note)}`)(req, res);
});
app.get('/offers', fwd('/xss/angular'));
// account settings (state-changing surface)
app.post('/account/email', fwd('/csrf/change-email'));
app.all('/account/notifications', fwd('/csrf/change-email-method'));
app.post('/account/password', fwd('/csrf/change-email-present'));
app.post('/account/phone', fwd('/csrf/change-email-session'));
app.post('/account/address', fwd('/csrf/change-email-cookie'));
app.post('/account/privacy', fwd('/csrf/change-email-lax'));
app.all('/account/close/confirm', fwd('/csrf/change-email-strict'));
app.get('/account/leave', fwd('/csrf/redirect'));
app.post('/account/profile', fwd('/csrf/change-email-referer-present'));
app.post('/account/settings', fwd('/csrf/change-email-referer-broken'));
// sensitive pages (framing surface)
app.get('/account/delete', fwd('/clickjack/basic'));
app.get('/account/profile', (req, res) => {
  if (req.query.email !== undefined || req.method === 'GET' && Object.keys(req.query).length)
    return fwd(`/clickjack/prefill?email=${encodeURIComponent(req.query.email || '')}`)(req, res);
  res.send('<html><body><h1>profile</h1></body></html>');
});
// share-link redirector
app.get('/go', (req, res) => res.redirect(req.query.to || '/'));

// Internal test helper (not part of the public storefront surface).
app.post('/v1/internal/reset', (req, res) => {
  storedHref.length = 0; storedComments.length = 0; stolen.length = 0;
  for (const k of Object.keys(EMAILS)) delete EMAILS[k];
  for (const k of Object.keys(CSRF)) delete CSRF[k];
  XS9.attempts = 0; XS9.solved = false;
  res.json({ ok: true });
});

/* ==================== Phase 9: client-side exploitation harness ==================== */
function unsafeMerge9(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (k === '__proto__' && v && typeof v === 'object') { Object.assign(Object.prototype, v); continue; }
    if (k === 'constructor' && v && typeof v === 'object' && v.prototype) { Object.assign(Object.prototype, v.prototype); continue; }
    if (v && typeof v === 'object' && target[k] && typeof target[k] === 'object') { unsafeMerge9(target[k], v); continue; }
    target[k] = v;
  }
  return target;
}

// Client-side prototype pollution -> DOM XSS in the guided tour widget.
app.get('/app/tour/render', (req, res) => {
  let prefs = {};
  try { prefs = JSON.parse(req.query.prefs || '{}'); } catch (e) { return res.status(400).json({ error: 'prefs must be JSON' }); }
  const state = { greeting: 'Welcome to the AutoMarket guided tour' };
  const raw = JSON.stringify(prefs);
  const suspicious = raw.includes('__proto__') || raw.includes('constructor');
  unsafeMerge9(state, prefs);
  const rendered = String(state.template || '<p>Tour step 1 of 5</p>');
  const sink = /<img|<svg|<script|onerror|onload/i.test(rendered);
  res.json({
    ok: true,
    rendered,
    inherited_preference: ({}).template || null,
    polluted: ({}).template !== undefined,
    flag: suspicious && sink && ({}).template ? 'LAB{client_pp_dom_xss}' : undefined,
    sink: 'tourWidget.innerHTML = prefs.template'
  });
});

// postMessage handler validates sender with an unanchored regex.
app.get('/app/live-help/dispatch', (req, res) => {
  const origin = String(req.query.origin || '');
  const data = String(req.query.data || '');
  const accepted = /autmarket\./i.test(origin);
  const spoofed = accepted && !/^https:\/\/app\.automarket\.io$/i.test(origin);
  const injects = /<img|<svg|<script|onerror|onload|javascript:/i.test(data);
  res.json({
    ok: true,
    accepted_origin: origin,
    trusted: accepted,
    spoofed,
    handler: "window.addEventListener('message', e => { if (/autmarket\\./.test(e.origin)) out.innerHTML = e.data; })",
    flag: spoofed && injects ? 'LAB{postmessage_origin_regex}' : undefined
  });
});

// DOM clobbering through the shortlink preview.
app.post('/app/shortlink/resolve', (req, res) => {
  const html = String((req.body || {}).html || '');
  const clobbers = /id\s*=\s*['"]?config/i.test(html) && /(name\s*=|href\s*=|src\s*=)/i.test(html);
  const injected = /javascript:|onerror|onload|<script|<img|<svg/i.test(html);
  res.json({
    ok: true,
    preview_html: html.slice(0, 2000),
    clobbered_global: clobbers,
    consumer: 'const url = config.href || config.url || "/"; location = url;',
    flag: clobbers && injected ? 'LAB{dom_clobbering}' : undefined
  });
});

// XS-Leaks: prefix oracle over a short secret + submit endpoint.
const XS9 = { secret: 'A7Q2', attempts: 0, solved: false };
app.get('/v1/xsleaks/compare', (req, res) => {
  const guess = String(req.query.guess || '');
  XS9.attempts++;
  const won = guess.length > 0 && guess.length <= XS9.secret.length && XS9.secret.startsWith(guess);
  res.json({ guess, won, attempts: XS9.attempts });
});
app.post('/v1/xsleaks/submit', (req, res) => {
  const secret = String((req.body || {}).secret || '');
  const ok = secret === XS9.secret;
  if (ok) XS9.solved = true;
  res.json({ ok, attempts_used: XS9.attempts, flag: ok ? 'LAB{xsleaks_oracle}' : undefined });
});
