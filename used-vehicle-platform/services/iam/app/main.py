"""UVP IAM Service - INTENTIONALLY VULNERABLE. LAB ONLY. DO NOT DEPLOY PUBLICLY.

Covers PortSwigger-style IAM labs (Sec 1.1):
 SQLi login bypass / WHERE hidden data / blind conditional+time,
 enum via responses/timing/lock, 2FA bypass/logic/bruteforce,
 reset logic/poisoning, brute-force IP block / multi-creds / stay-login cookie /
 offline cracking (MD5) / password-change bruteforce,
 IDOR / role-param / user-id param / unpredictable IDs / referer/method/URL bypasses /
 multistep missing check, OAuth implicit/SSRF-registration/forced-linking/
 redirect_uri hijack/open-redirect token steal, JWT none/weak/jwk/jku/kid/confusion,
 business-logic state machine / email parsing / encryption oracle.
"""
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
import urllib.parse
from typing import Optional

import requests
from fastapi import FastAPI, Request, Response, Cookie, Header, Query
from fastapi.responses import JSONResponse, PlainTextResponse, RedirectResponse
from pydantic import BaseModel

from .db import get_conn, init_db, raw_login_query, raw_user_lookup, normalize_email_loose
from . import auth, phase9

init_db()
app = FastAPI(title="UVP IAM (vulnerable lab)", debug=True)
app.include_router(phase9.router)

# --- VULN: permissive CORS (reflects any Origin incl. null) for Sec 1.5 labs ---
@app.middleware("http")
async def permissive_cors(request: Request, call_next):
    resp = await call_next(request)
    origin = request.headers.get("origin")
    if origin is not None:
        resp.headers["Access-Control-Allow-Origin"] = origin  # reflect + null trusted
        resp.headers["Access-Control-Allow-Credentials"] = "true"
    else:
        resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    return resp

# ---------- helpers ----------
FAILED = {}  # ip -> count (flawed: trusts X-Forwarded-For, easily bypassed)
RESET_TOKENS = {}

def client_ip(request: Request) -> str:
    # VULN: trusts X-Forwarded-For -> IP block bypass by rotating header
    return request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown").split(",")[0].strip()

def effective_host(request: Request) -> str:
    # VULN: password-reset poisoning via middleware - prefers X-Forwarded-Host
    return request.headers.get("X-Forwarded-Host") or request.headers.get("Host", "localhost:8080")

def simulate_blind_sqli(username: str, password: str):
    """Emulate conditional + time-delay behaviours so blind payloads observable.
    Real SQLite has no SLEEP/pg_sleep; we simulate for lab determinism."""
    combined = f"{username} {password}"
    # Time-delay simulation: SLEEP(5), pg_sleep(5), WAITFOR DELAY, DBMS_LOCK
    m = re.search(r"SLEEP\s*\(\s*(\d+)", combined, re.I) or re.search(r"pg_sleep\s*\(\s*(\d+)", combined, re.I)
    if m:
        time.sleep(min(int(m.group(1)), 5))
    if re.search(r"WAITFOR\s+DELAY", combined, re.I):
        time.sleep(3)
    # Conditional simulation is handled in login by checking SUBSTR/CASE patterns
    return combined

# ---------- basic ----------
@app.get("/health")
def health():
    return {"ok": True, "service": "iam-lab"}

@app.get("/version")
def version():
    # VULN: info disclosure
    return {"version": "iam-0.1.0", "service": "iam"}

@app.get("/debug")
def debug():
    # VULN: debug page + stack/error disclosure
    import sys, platform
    return {"env": dict(os.environ), "platform": platform.platform(), "argv": sys.argv, "db": os.environ.get("IAM_DB", "/tmp/iam.db")}

@app.get("/backup")
def backup():
    # VULN: backup file disclosure
    return {"files": ["users.sql.bak", ".git/HEAD", "/tmp/iam.db"]}

@app.get("/.git/HEAD")
def git_head():
    return PlainTextResponse("ref: refs/heads/main\n# lab repo a1b2c3d - backup exposes history\n")

# ---------- register / login ----------
class RegisterIn(BaseModel):
    username: str
    password: str
    email: str
    role: Optional[str] = None

BLOCKED_ATTRS = {"role", "is_admin", "isadmin", "admin", "privilege", "privileges"}

@app.post("/register")
def register(data: dict):
    # naive filter: exact lowercase attribute names are stripped.
    clean = {k: v for k, v in data.items() if k not in BLOCKED_ATTRS}
    username, password, email = clean.get("username", ""), clean.get("password", ""), clean.get("email", "")
    # ...but the ORM-style binder below still honors case variants the filter misses.
    role = "user"
    for variant in ("Role", "ROLE", "rOle", "roLe"):
        if variant in data:
            role = data[variant]
            break
    conn = get_conn()
    md5 = hashlib.md5(password.encode()).hexdigest()  # VULN: weak hash -> offline cracking
    try:
        # VULN: raw insert (second-order SQLi surface)
        q = f"INSERT INTO users (username, password, password_md5, email, role, fa_code) VALUES ('{username}','{password}','{md5}','{email}','{role}','1234')"
        conn.execute(q)
        conn.commit()
    except sqlite3.IntegrityError:
        return JSONResponse({"error": "registration failed"}, status_code=400)
    except Exception:
        return JSONResponse({"error": "registration failed"}, status_code=500)
    return {"ok": True, "user": username, "role": role, "normalized_email": normalize_email_loose(email)}

class LoginIn(BaseModel):
    username: str
    password: str

@app.post("/login")
def login(data: LoginIn, request: Request, response: Response):
    ip = client_ip(request)
    # VULN: flawed brute-force protection - counts per IP but IP is spoofable; lock easily bypassed
    row_lock = FAILED.get(ip, 0)
    if row_lock >= 10:
        return JSONResponse({"error": "request blocked, try again later"}, status_code=429)
    q = raw_login_query(data.username, data.password)
    simulate_blind_sqli(data.username, data.password)
    conn = get_conn()
    try:
        cur = conn.execute(q)
        rows = cur.fetchall()
    except Exception:
        # generic failure: no query reflection (blind inference only)
        return JSONResponse({"error": "authentication failed"}, status_code=500)
    # VULN: blind conditional - different responses for user-not-found vs bad-password
    # Probe without password to enumerate:
    try:
        probe = conn.execute(raw_user_lookup(data.username)).fetchall()
    except Exception:
        probe = []
    if rows:
        r = rows[0]
        token = auth.issue_token(r["id"], r["username"], r["role"])
        # VULN: stay-logged-in weak cookie (base64 user:md5) brute-forceable
        stay = f"{r['username']}:{hashlib.md5(r['password'].encode()).hexdigest()}"
        import base64
        stay_b64 = base64.b64encode(stay.encode()).decode()
        response.set_cookie("stay_logged_in", stay_b64, httponly=False)  # VULN: not httponly + predictable
        response.set_cookie("session", token, httponly=False)
        return {"ok": True, "token": token, "user": r["username"], "role": r["role"], "stay_logged_in": stay_b64}
    else:
        FAILED[ip] = row_lock + 1
        # Conditional enumeration: subtly different messages + timing difference
        if probe:
            time.sleep(0.05)  # VULN: timing enumeration - valid user slightly slower
            return JSONResponse({"error": "Invalid password"}, status_code=401)
        # Simulate conditional-error blind: payload with CASE/SUBSTR gets different error
        combined = f"{data.username}{data.password}"
        if re.search(r"CASE\s+WHEN|SUBSTR|ASCII|LIKE", combined, re.I):
            return JSONResponse({"error": "Conditional error: query false"}, status_code=401)
        return JSONResponse({"error": "User not found"}, status_code=404)

class BatchLoginIn(BaseModel):
    credentials: list[dict]

@app.post("/login-batch")
def login_batch(data: BatchLoginIn):
    """VULN: multiple credentials per request - brute-force protection bypass."""
    conn = get_conn()
    for cred in data.credentials[:50]:
        u, p = cred.get("username", ""), cred.get("password", "")
        q = raw_login_query(u, p)
        try:
            rows = conn.execute(q).fetchall()
        except Exception:
            continue
        if rows:
            r = rows[0]
            return {"ok": True, "found": {"username": r["username"], "role": r["role"]}, "token": auth.issue_token(r["id"], r["username"], r["role"])}
    return JSONResponse({"error": "no match in batch"}, status_code=401)

@app.get("/users/search")
def user_search(q: str = ""):
    """VULN: WHERE-clause hidden-data retrieval + UNION + error-based."""
    query = raw_user_lookup(q)
    conn = get_conn()
    try:
        rows = conn.execute(query).fetchall()
    except Exception:
        return JSONResponse({"error": "lookup failed"}, status_code=500)
    return {"query": query, "results": [dict(r) for r in rows]}

# ---------- access control / IDOR ----------
@app.get("/profile")
def profile(id: Optional[str] = None, user_id: Optional[str] = None, role: Optional[str] = None, verbose: Optional[str] = None):
    """VULN: user ID controlled by param, role controlled by param, verbose-gated hash disclosure."""
    target = id or user_id or "1"
    verbose = (verbose == "true")
    conn = get_conn()
    # VULN: direct object reference, no authz
    q = f"SELECT id, username, email, password_md5, role FROM users WHERE id = '{target}'"
    try:
        rows = conn.execute(q).fetchall()
    except Exception:
        return JSONResponse({"error": "lookup failed"}, status_code=500)
    if not rows:
        return JSONResponse({"error": "not found"}, status_code=404)
    r = dict(rows[0])
    # VULN: role param overrides displayed role (and is trusted downstream in some flows)
    if role:
        r["role_param_override"] = role
    if not verbose:
        # credential hash only surfaces through the undocumented verbose view
        r.pop("password_md5", None)
        return r
    # VULN: offline-crackable hash disclosure via verbose IDOR view
    return r

@app.get("/users/{uid}")
def user_by_id(uid: str, verbose: Optional[str] = None):
    conn = get_conn()
    verbose = (verbose == "true")
    q = f"SELECT id, username, email, role, password_md5 FROM users WHERE id = '{uid}'"
    try:
        rows = conn.execute(q).fetchall()
    except Exception:
        return JSONResponse({"error": "lookup failed"}, status_code=500)
    if not rows:
        return JSONResponse({"error": "not found"}, status_code=404)
    r = dict(rows[0])
    if not verbose:
        r.pop("password_md5", None)
    return r

class ProfileUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    username: Optional[str] = None

@app.post("/profile/update")
def profile_update(data: dict, request: Request, authorization: Optional[str] = Header(None)):
    """VULN: IDOR write + mass assignment, gated only by a (flaw-fully verified) bearer token."""
    # session check uses the same broken JWT verifier as the admin endpoints:
    # any token it accepts (weak secret, none-alg, confused key...) passes here
    raw = (authorization or "").removeprefix("Bearer ").strip()
    payload, _ = auth.flawed_verify(raw) if raw else (None, None)
    if not payload:
        return JSONResponse({"error": "authentication required"}, status_code=401)
    # Accept any fields incl. role, is_admin
    uid = request.headers.get("X-User-Id", "3")  # VULN: caller-chosen identity, no binding to token
    # SSPP: if query has duplicate ?role=user&role=admin, take last (Express-style)
    qs_role = request.query_params.get_list("role") if hasattr(request.query_params, "get_list") else []
    if qs_role:
        data["role"] = qs_role[-1]
    cols = ", ".join([f"{k} = '{v}'" for k, v in data.items()])
    q = f"UPDATE users SET {cols} WHERE id = '{uid}'"
    conn = get_conn()
    try:
        conn.execute(q)
        conn.commit()
    except Exception:
        return JSONResponse({"error": "update failed"}, status_code=500)
    return {"ok": True, "updated": [k for k in data.keys()]}

@app.get("/admin")
def admin_no_auth():
    """VULN: unprotected admin functionality."""
    conn = get_conn()
    users = [dict(r) for r in conn.execute("SELECT id, username, email, role FROM users").fetchall()]
    return {"admin": True, "flag": "LAB{unprotected_admin}", "users": users}

@app.get("/admin-9f3a2bd1e8")
def admin_hidden():
    """VULN: unprotected admin with unpredictable URL (security-by-obscurity)."""
    return {"admin": True, "flag": "LAB{hidden_url_admin}", "note": "URL was meant to be secret"}

@app.get("/admin-referer")
def admin_referer(request: Request):
    """VULN: Referer-based bypass - only checks header contains /admin."""
    ref = request.headers.get("Referer", "")
    if "/admin" in ref:
        return {"admin": True, "flag": "LAB{referer_bypass}"}
    return JSONResponse({"error": "forbidden"}, status_code=403)

@app.api_route("/admin-method", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def admin_method(request: Request):
    """VULN: method-based bypass - GET requires auth, other methods don't."""
    if request.method == "GET":
        authz = request.headers.get("Authorization", "")
        if authz != "Bearer admin-secret":
            return JSONResponse({"error": "GET requires Authorization"}, status_code=403)
        return {"admin": True}
    return {"admin": True, "flag": f"LAB{{method_bypass_{request.method}}}"}

# Multi-step: step2 has no access control
@app.get("/multistep/step1")
def ms1(request: Request):
    if request.headers.get("X-User-Id") is None:
        return JSONResponse({"error": "login required for step1"}, status_code=401)
    return {"step": 1, "next": "/multistep/step2"}

@app.get("/multistep/step2")
def ms2():
    # VULN: no access control on this step
    return {"step": 2, "flag": "LAB{multistep_no_authz}", "next": "/multistep/step3"}

@app.get("/multistep/step3")
def ms3(request: Request):
    if request.headers.get("X-User-Id") is None:
        return JSONResponse({"error": "login required"}, status_code=401)
    return {"step": 3, "done": True}

# ---------- password reset / change / stay-login ----------
class ResetReq(BaseModel):
    email: str

@app.post("/password-reset")
def password_reset(data: ResetReq, request: Request):
    """VULN: Host-header poisoning + dangling-markup + middleware X-Forwarded-Host trust."""
    host = effective_host(request)
    conn = get_conn()
    # Loose lookup demonstrates email-parsing discrepancy (attacker+tag collides)
    norm = normalize_email_loose(data.email)
    q = f"SELECT id, username, email FROM users WHERE email = '{data.email}'"
    try:
        rows = conn.execute(q).fetchall()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    if not rows:
        # Try loose match -> discrepancy bypass
        rows2 = [dict(r) for r in conn.execute("SELECT id, username, email FROM users").fetchall()]
        match = [r for r in rows2 if normalize_email_loose(r["email"]) == norm]
        if match:
            rows = match
    if not rows:
        return JSONResponse({"error": "email not found (enumeration)"}, status_code=404)
    import secrets
    token = secrets.token_hex(16)  # long random token: guessing/brute force infeasible
    RESET_TOKENS[data.email] = token
    RESET_TOKENS[norm] = token
    try:
        conn.execute(f"UPDATE users SET reset_token = '{token}' WHERE email = '{rows[0]['email']}'")
        conn.commit()
    except Exception:
        pass
    # VULN: reset link uses attacker Host; dangling markup variant via `next` param
    link = f"http://{host}/password-reset/confirm?token={token}&email={urllib.parse.quote(data.email)}"
    dangling = f"http://{host}/password-reset/confirm?token={token}<img src='x'"
    # Best-effort send to MailHog (ignore failures in lab)
    try:
        import smtplib
        from email.message import EmailMessage
        msg = EmailMessage()
        msg["To"] = data.email
        msg["From"] = "noreply@used-vehicles.lab"
        msg["Subject"] = "Reset"
        msg.set_content(link)
        s = smtplib.SMTP(os.environ.get("MAILHOG_HOST", "mailhog"), int(os.environ.get("MAILHOG_PORT", "1025")), timeout=3)
        s.send_message(msg)
        s.quit()
    except Exception:
        pass
    return {"ok": True, "reset_link": link, "dangling_variant": dangling, "note": "check MailHog :8025"}

class ResetConfirm(BaseModel):
    email: str
    token: str
    new_password: str
    user_id: Optional[str] = None  # VULN: user_id controlled -> reset other account

@app.post("/password-reset/confirm")
def password_reset_confirm(data: ResetConfirm):
    """VULN: broken logic - empty-token state confusion, user_id override, email discrepancy."""
    stored = RESET_TOKENS.get(data.email) or RESET_TOKENS.get(normalize_email_loose(data.email))
    # No recovery without a token that was actually issued for this address...
    if data.token == "" and stored is None:
        pass  # ...unless no token was ever issued (flawed state check)
    elif stored is None or not hmac.compare_digest(str(stored), str(data.token)):
        return JSONResponse({"error": "invalid token"}, status_code=400)
    conn = get_conn()
    target_email = data.email
    if data.user_id:
        # VULN: ID-controlled reset
        try:
            r = conn.execute(f"SELECT email FROM users WHERE id = '{data.user_id}'").fetchone()
            if r:
                target_email = r["email"]
        except Exception:
            return JSONResponse({"error": "reset failed"}, status_code=500)
    md5 = hashlib.md5(data.new_password.encode()).hexdigest()
    conn.execute(f"UPDATE users SET password = '{data.new_password}', password_md5 = '{md5}' WHERE email = '{target_email}'")
    conn.commit()
    return {"ok": True, "reset_for": target_email, "flag": "LAB{broken_reset_logic}"}

class ChangePw(BaseModel):
    username: str
    old_password: str
    new_password: str

@app.post("/change-password")
def change_password(data: ChangePw):
    """VULN: password brute-force via change - no rate limit, verbose, offline MD5 available via /profile."""
    conn = get_conn()
    q = f"SELECT id FROM users WHERE username = '{data.username}' AND password = '{data.old_password}'"
    try:
        row = conn.execute(q).fetchone()
    except Exception:
        return JSONResponse({"error": "change failed"}, status_code=500)
    if not row:
        return JSONResponse({"error": "current password incorrect"}, status_code=401)
    md5 = hashlib.md5(data.new_password.encode()).hexdigest()
    conn.execute(f"UPDATE users SET password = '{data.new_password}', password_md5 = '{md5}' WHERE username = '{data.username}'")
    conn.commit()
    return {"ok": True}

@app.get("/stay-login")
def stay_login(stay_logged_in: Optional[str] = Cookie(None)):
    """VULN: brute-forceable stay-logged-in cookie (predictable base64 user:md5)."""
    if not stay_logged_in:
        return JSONResponse({"error": "no cookie"}, status_code=401)
    import base64
    try:
        raw = base64.b64decode(stay_logged_in).decode()
        username, want_md5 = raw.split(":", 1)
    except Exception as e:
        return JSONResponse({"error": f"bad cookie: {e}"}, status_code=400)
    conn = get_conn()
    # VULN: raw lookup allows SQLi in cookie too
    q = f"SELECT username, password FROM users WHERE username = '{username}'"
    try:
        r = conn.execute(q).fetchone()
    except Exception:
        return JSONResponse({"error": "session lookup failed"}, status_code=500)
    if not r:
        return JSONResponse({"error": "unknown user"}, status_code=401)
    real_md5 = hashlib.md5(r["password"].encode()).hexdigest()
    # VULN: non-constant compare + short MD5 prefix accepted? keep simple == but offline-crackable
    if hmac.compare_digest(real_md5, want_md5):
        return {"ok": True, "user": username, "flag": "LAB{stay_cookie}"}
    return JSONResponse({"error": "bad stay cookie (offline-crack MD5 from /profile leak)"}, status_code=401)

# ---------- 2FA ----------
@app.post("/2fa/enable")
def fa_enable(username: str = Query(...)):
    conn = get_conn()
    conn.execute(f"UPDATE users SET fa_code = '1234' WHERE username = '{username}'")
    conn.commit()
    return {"ok": True, "note": "2FA code set to 1234 (predictable for lab)", "qr": "otpauth://totp/lab?secret=JBSWY3DPEHPK3PXP"}

@app.post("/2fa/verify")
async def fa_verify(request: Request):
    """VULN matrix: broken logic on missing code, brute-forceable 4-digit code (no rate limit), flawed state machine."""
    qs = dict(request.query_params)
    try:
        body = await request.json()
    except Exception:
        body = {}
    username = body.get("username") or qs.get("username", "")
    code = body.get("code", qs.get("code", "__missing__"))
    # VULN: broken logic - missing/null code passes verification
    if code is None or code == "" or (code == "__missing__" and "code" not in body and "code" not in qs):
        return {"ok": True, "flag": "LAB{2fa_broken_logic}", "via": "empty code"}
    conn = get_conn()
    q = f"SELECT fa_code FROM users WHERE username = '{username}'"
    try:
        r = conn.execute(q).fetchone()
    except Exception:
        return JSONResponse({"error": "verification unavailable"}, status_code=500)
    if r and str(code) == str(r["fa_code"]):
        return {"ok": True, "user": username}
    return JSONResponse({"error": "invalid code"}, status_code=401)

@app.get("/2fa/success")
def fa_success():
    """VULN: flawed state machine - reachable without verifying."""
    return {"ok": True, "flag": "LAB{2fa_state_machine}", "note": "accessed success without verify"}

# ---------- JWT ----------
@app.get("/public-key.pem")
def pubkey():
    return PlainTextResponse(auth.FAKE_RSA_PUBLIC_PEM)

@app.get("/.well-known/jwks.json")
def jwks(k: Optional[str] = None):
    # key set intentionally not published; verification still trusts
    # weak secrets, embedded jwk, jku URLs, kid paths and alg confusion
    if k:
        return {"keys": [{"kty": "oct", "k": k, "alg": "HS256"}]}
    return {"keys": []}

@app.get("/admin-jwt")
def admin_jwt(request: Request):
    """Requires admin role, but uses flawed_verify."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "") or request.query_params.get("token", "")
    payload, notes = auth.flawed_verify(token)
    if not payload:
        return JSONResponse({"error": "invalid jwt", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "not admin", "payload": payload, "notes": notes}, status_code=403)
    return {"admin": True, "flag": "LAB{jwt_bypass}", "notes": notes, "payload": payload}

# NOTE: the former /token/issue minting helper was removed. Tokens must now
# be forged by hand (unsigned, weak-secret, or key-confusion) instead of
# minted by the server.

# Encryption oracle (business-logic lab)
STATIC_KEY = b"LABSTATICKEY1234"  # 16 bytes, ECB, static -> oracle

@app.get("/crypto/encrypt")
def enc(data: str = ""):
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
    # PKCS7 pad
    pad = 16 - len(data.encode()) % 16
    raw = data.encode() + bytes([pad]) * pad
    cipher = Cipher(algorithms.AES(STATIC_KEY), modes.ECB(default_backend()))
    ct = cipher.encryptor().update(raw)
    return {"ciphertext_hex": ct.hex()}

@app.get("/crypto/decrypt")
def dec(ct_hex: str = ""):
    """VULN: encryption oracle - returns padding errors vs plaintext (for state-machine/key-recovery labs)."""
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
    try:
        ct = bytes.fromhex(ct_hex)
        cipher = Cipher(algorithms.AES(STATIC_KEY), modes.ECB(default_backend()))
        pt = cipher.decryptor().update(ct)
        pad = pt[-1]
        if pad < 1 or pad > 16 or pt[-pad:] != bytes([pad]) * pad:
            return JSONResponse({"error": "padding error (oracle)"}, status_code=400)
        return {"plaintext": pt[:-pad].decode(errors="replace")}
    except Exception as e:
        return JSONResponse({"error": f"decrypt failed: {e}"}, status_code=500)

# ---------- OAuth ----------
OAUTH_CODES = {}

@app.get("/oauth/authorize")
def oauth_authorize(client_id: str = "", redirect_uri: str = "", response_type: str = "token", scope: str = "openid"):
    """VULN: implicit flow + redirect_uri not validated + open redirect token leak."""
    import secrets
    token = secrets.token_hex(8)
    OAUTH_CODES[token] = client_id
    if not redirect_uri:
        return {"access_token": token, "token_type": "Bearer"}
    # VULN: no allowlist - any redirect_uri accepted (hijack via redirect_uri)
    sep = "&" if "#" not in redirect_uri and "?" in redirect_uri else "#"
    # implicit flow puts token in fragment
    loc = f"{redirect_uri}{sep}access_token={token}&token_type=Bearer" if response_type == "token" else f"{redirect_uri}?code={token}"
    return RedirectResponse(loc, status_code=302)

class ClientReg(BaseModel):
    redirect_uris: list[str] = []
    logo_url: Optional[str] = None
    client_name: Optional[str] = None

@app.post("/oauth/register-client")
def oauth_register(data: ClientReg, request: Request):
    """VULN: OpenID dynamic registration SSRF - fetches logo_url server-side, logs to OOB."""
    import uuid
    cid = f"client-{uuid.uuid4().hex[:8]}"
    fetched = None
    if data.logo_url:
        # VULN: SSRF with no allowlist; supports blacklist-bypass lab via redirect/open-redirect
        try:
            oob = os.environ.get("OOB_URL", "http://oob-collaborator:9000")
            r = requests.get(data.logo_url, timeout=5, allow_redirects=True)
            fetched = {"status": r.status_code, "len": len(r.content), "head": r.text[:200]}
            try:
                requests.post(f"{oob}/log", json={"ssrf": data.logo_url, "status": r.status_code}, timeout=3)
            except Exception:
                pass
        except Exception as e:
            fetched = {"error": str(e)}
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO oauth_clients (client_id, redirect_uris, logo_url) VALUES (?,?,?)",
                 (cid, ",".join(data.redirect_uris), data.logo_url))
    conn.commit()
    return {"client_id": cid, "fetched_logo": fetched, "note": "logo_url fetched server-side (SSRF lab)"}

@app.get("/oauth/link")
def oauth_link(email: str = "", oauth_id: str = ""):
    """VULN: forced profile linking - no verification that requester owns email."""
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO linked_accounts (email, oauth_id) VALUES (?,?)", (email, oauth_id))
    conn.commit()
    return {"ok": True, "flag": "LAB{forced_oauth_linking}", "linked": {"email": email, "oauth_id": oauth_id}}

@app.get("/oauth/proxy")
def oauth_proxy(url: str = ""):
    """VULN: proxy page that attaches current Authorization header -> token steal via open redirect."""
    try:
        r = requests.get(url, timeout=5)
        return {"fetched": url, "status": r.status_code, "body_head": r.text[:500]}
    except Exception as e:
        return JSONResponse({"error": str(e), "url": url}, status_code=500)

@app.get("/redirect")
def open_redirect(url: str = "/"):
    """VULN: open redirect for OAuth token theft / SSRF-filter bypass."""
    return RedirectResponse(url, status_code=302)

# ---------- business logic ----------
BALANCES = {"wiener": 1000}

@app.post("/business/buy-car")
def buy_car(username: str = Query("wiener"), price: float = Query(...)):
    """VULN: infinite money - negative price crédited; weak isolation dual-use endpoint."""
    bal = BALANCES.get(username, 1000)
    # VULN: no validation price > 0; flawed enforcement
    bal = bal - price  # negative price increases balance
    BALANCES[username] = bal
    flag = "LAB{infinite_money}" if bal > 1000 else None
    return {"username": username, "price": price, "balance": bal, "flag": flag}

@app.get("/business/state")
def biz_state(step: str = "start", completed: Optional[str] = None):
    """VULN: auth bypass via flawed state machine - jumps allowed."""
    if step == "pay" and completed != "checkout":
        # Flawed: only warns, still processes (insufficient workflow validation)
        return {"warn": "should complete checkout first, but continuing (flaw)", "flag": "LAB{state_machine}", "step": step}
    if step == "admin-action" and completed == "yes":
        return {"admin": True, "flag": "LAB{workflow_bypass}"}
    return {"step": step}

@app.get("/business/email-discrepancy")
def email_disc(email: str = ""):
    return {"raw": email, "normalized": normalize_email_loose(email)}

# ---------- API testing surface ----------
@app.get("/api/unused")
def api_unused():
    return {"hidden": True, "flag": "LAB{unused_api}", "endpoints": ["/api/v1/internal", "/console"]}

@app.get("/api/v1/internal")
def api_internal():
    return {"internal": True, "users": "see /admin"}

@app.get("/api/pollute")
def api_pollute(request: Request):
    # Server-side parameter pollution: ?a=1&a=2 handling demo (takes last)
    raw_qs = str(request.url.query)
    return {"raw_query": raw_qs, "parsed_role": request.query_params.get("role"), "note": "duplicate params: last wins (SSPP lab)"}

@app.get("/console")
def console():
    return {"console": "debug console exposed (info disclosure)", "flag": "LAB{debug_console}"}

# Models for domain-separated authentication endpoints
class LookupIn(BaseModel):
    identifier: str

class RememberIn(BaseModel):
    username: str
    password: str

CUSTOMER_FAILED = {}

# ============================================================================
# Production façade (public benchmark surface) - Domain-Driven Feature Separation.
# Each vulnerability flavor is strictly mapped to a dedicated marketplace endpoint:
#  - /v1/auth/dealer-login & /v1/auth/login: SQLi Login Bypass ONLY
#  - /v1/auth/customer-login: Flawed Rate Limiting / IP Block Lockout ONLY
#  - /v1/auth/partner/login: Username Enumeration via Timing Difference ONLY
#  - /v1/auth/lookup-user: Username Enumeration via Response Discrepancy ONLY
#  - /v1/auth/session/remember & /v1/auth/session: Predictable Session Cookie ONLY
#  - /v1/users/{uid}: Public Seller Profile (Clean IDOR)
#  - /v1/account/diagnostics: Account Diagnostics (Sensitive Credential Hash Disclosure)
# Legacy paths (/login, /profile) remain functional for backwards compatibility.
# ============================================================================

@app.post("/v1/auth/register")
def v1_register(data: dict):
    return register(data)

@app.post("/v1/auth/dealer-login")
@app.post("/v1/auth/login")
def v1_login(data: LoginIn, response: Response):
    """Market Feature: Partner Dealer & Staff Portal Login.
    VULN: SQLi login bypass ONLY. No timing side-channels, no user enumeration, no rate-limiting lock."""
    q = raw_login_query(data.username, data.password)
    conn = get_conn()
    try:
        cur = conn.execute(q)
        rows = cur.fetchall()
    except Exception:
        return JSONResponse({"error": "Authentication failed"}, status_code=401)
    if rows:
        r = rows[0]
        token = auth.issue_token(r["id"], r["username"], r["role"])
        response.set_cookie("session", token, httponly=True)
        return {"ok": True, "token": token, "user": r["username"], "role": r["role"]}
    return JSONResponse({"error": "Authentication failed"}, status_code=401)

@app.post("/v1/auth/customer-login")
def v1_customer_login(data: LoginIn, request: Request, response: Response):
    """Market Feature: Customer Account Sign-In.
    VULN: Flawed brute-force protection using spoofable X-Forwarded-For header ONLY.
    Safe parameterized query, uniform error responses."""
    ip = client_ip(request)
    row_lock = CUSTOMER_FAILED.get(ip, 0)
    if row_lock >= 10:
        return JSONResponse({"error": "request blocked, try again later"}, status_code=429)
    conn = get_conn()
    try:
        row = conn.execute("SELECT id, username, role, password FROM users WHERE username = ?", (data.username,)).fetchone()
    except Exception:
        return JSONResponse({"error": "Invalid credentials"}, status_code=401)
    if row and row["password"] == data.password:
        CUSTOMER_FAILED.pop(ip, None)
        token = auth.issue_token(row["id"], row["username"], row["role"])
        response.set_cookie("session", token, httponly=True)
        return {"ok": True, "token": token, "user": row["username"], "role": row["role"]}
    CUSTOMER_FAILED[ip] = row_lock + 1
    return JSONResponse({"error": "Invalid credentials"}, status_code=401)

@app.post("/v1/auth/partner/login")
def v1_partner_login(data: LoginIn):
    """Market Feature: Commercial Fleet Partner Portal SSO.
    VULN: Timing-based username enumeration ONLY.
    Valid partner usernames simulate cryptographic HSM verification delay (80ms).
    Safe parameterized query, uniform error responses."""
    conn = get_conn()
    try:
        user = conn.execute("SELECT id, username, password, role FROM users WHERE username = ?", (data.username,)).fetchone()
    except Exception:
        return JSONResponse({"error": "Authentication failed"}, status_code=401)
    if user:
        time.sleep(0.08)
        if user["password"] == data.password:
            token = auth.issue_token(user["id"], user["username"], user["role"])
            return {"ok": True, "token": token, "user": user["username"], "role": user["role"]}
    return JSONResponse({"error": "Authentication failed"}, status_code=401)

@app.post("/v1/auth/lookup-user")
def v1_lookup_user(data: LookupIn):
    """Market Feature: Self-Service Account Status Verification & Lookup.
    VULN: Username enumeration via response differences ONLY. Safe parameterized query."""
    conn = get_conn()
    try:
        row = conn.execute("SELECT id, username, email FROM users WHERE username = ? OR email = ?", (data.identifier, data.identifier)).fetchone()
    except Exception:
        return JSONResponse({"error": "Lookup failed"}, status_code=500)
    if row:
        return {"ok": True, "status": "active", "user": row["username"], "message": "Account verified."}
    return JSONResponse({"error": "User not found"}, status_code=404)

@app.post("/v1/auth/session/remember")
def v1_remember_me(data: RememberIn, response: Response):
    """Market Feature: 'Remember Me' Persistent Session Issuance.
    VULN: Predictable MD5 Session Cookie issuance ONLY."""
    conn = get_conn()
    try:
        row = conn.execute("SELECT id, username, password FROM users WHERE username = ? AND password = ?", (data.username, data.password)).fetchone()
    except Exception:
        return JSONResponse({"error": "Authentication failed"}, status_code=401)
    if not row:
        return JSONResponse({"error": "Invalid credentials"}, status_code=401)
    stay = f"{row['username']}:{hashlib.md5(row['password'].encode()).hexdigest()}"
    import base64
    stay_b64 = base64.b64encode(stay.encode()).decode()
    response.set_cookie("stay_logged_in", stay_b64, httponly=False)
    return {"ok": True, "stay_logged_in": stay_b64}

@app.get("/v1/account/diagnostics")
def v1_account_diagnostics(user_id: str = "1"):
    """Market Feature: Technical Support Account Diagnostics.
    VULN: Sensitive credential hash disclosure for offline cracking ONLY."""
    conn = get_conn()
    try:
        row = conn.execute("SELECT id, username, email, role, password_md5 FROM users WHERE id = ?", (user_id,)).fetchone()
    except Exception:
        return JSONResponse({"error": "diagnostics query failed"}, status_code=500)
    if not row:
        return JSONResponse({"error": "user not found"}, status_code=404)
    return {"diagnostics": True, "account": dict(row)}

@app.post("/v1/auth/batch-login")
def v1_batch_login(data: BatchLoginIn):
    return login_batch(data)

@app.get("/v1/users/search")
def v1_user_search(q: str = ""):
    return user_search(q)

@app.get("/v1/users/{uid}")
def v1_user_by_id(uid: str, verbose: Optional[str] = None):
    return user_by_id(uid, verbose)

@app.get("/v1/account")
def v1_account(id: Optional[str] = None, user_id: Optional[str] = None, verbose: Optional[str] = None):
    return profile(id, user_id, verbose=verbose)

@app.post("/v1/account")
def v1_account_update(data: dict, request: Request, authorization: Optional[str] = Header(None)):
    return profile_update(data, request, authorization)

@app.get("/v1/admin/users")
def v1_admin_users():
    return admin_no_auth()

@app.post("/v1/auth/password/forgot")
def v1_forgot(data: ResetReq, request: Request):
    return password_reset(data, request)

@app.post("/v1/auth/password/reset")
def v1_reset(data: ResetConfirm):
    return password_reset_confirm(data)

@app.post("/v1/account/password")
def v1_change_pw(data: ChangePw):
    return change_password(data)

@app.get("/v1/auth/session")
def v1_stay(stay_logged_in: Optional[str] = Cookie(None)):
    return stay_login(stay_logged_in)

@app.post("/v1/auth/2fa/enable")
def v1_fa_enable(username: str = Query(...)):
    return fa_enable(username)

@app.post("/v1/auth/2fa/verify")
async def v1_fa_verify(request: Request):
    return await fa_verify(request)

@app.get("/v1/auth/2fa/success")
def v1_fa_success():
    return fa_success()

@app.get("/v1/auth/jwks")
def v1_jwks(k: Optional[str] = None):
    return jwks(k)

@app.get("/v1/admin/reports")
def v1_admin_reports(request: Request):
    return admin_jwt(request)

def _extract_token(request: Request) -> str:
    auth_h = request.headers.get("Authorization", "")
    if auth_h.startswith("Bearer "):
        return auth_h[7:].strip()
    return request.query_params.get("token", "").strip()

# ---------- Domain-Driven Feature Separation: Dedicated JWT Endpoints ----------

@app.get("/v1/reports/executive")
@app.get("/reports/executive")
def report_executive(request: Request):
    """Marketplace Domain: Executive KPI & Revenue Reporting.
    VULN: alg=none signature bypass ONLY. Rejects signed tokens or invalid algs."""
    token = _extract_token(request)
    payload, notes = auth.verify_jwt_none(token)
    if not payload:
        return JSONResponse({"error": "Unauthorized: invalid executive token", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "Forbidden: executive admin role required", "payload": payload, "notes": notes}, status_code=403)
    return {
        "ok": True,
        "terminal": "Executive KPI & Quarterly Revenue",
        "flag": "LAB{jwt_none_bypass}",
        "access": "Granted (alg: none signature bypass)",
        "payload": payload,
        "notes": notes
    }

@app.get("/v1/reports/audit")
@app.get("/reports/audit")
def report_audit(request: Request):
    """Marketplace Domain: Financial Audit & Ledger Reconciliation.
    VULN: Weak HMAC secret ('secret') cracking ONLY. Rejects unsigned/none tokens."""
    token = _extract_token(request)
    payload, notes = auth.verify_jwt_weak_key(token)
    if not payload:
        return JSONResponse({"error": "Unauthorized: invalid audit signature", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "Forbidden: audit admin role required", "payload": payload, "notes": notes}, status_code=403)
    return {
        "ok": True,
        "terminal": "Financial Audit & Regulatory Ledger",
        "flag": "LAB{jwt_weak_key}",
        "access": "Granted (weak HMAC secret cracked)",
        "payload": payload,
        "notes": notes
    }

@app.get("/v1/reports/developer")
@app.get("/reports/developer")
def report_developer(request: Request):
    """Marketplace Domain: Developer API Integration & Trace Diagnostics.
    VULN: Embedded jwk header parameter injection ONLY. Rejects none tokens."""
    token = _extract_token(request)
    payload, notes = auth.verify_jwt_jwk(token)
    if not payload:
        return JSONResponse({"error": "Unauthorized: invalid jwk signature", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "Forbidden: developer admin role required", "payload": payload, "notes": notes}, status_code=403)
    return {
        "ok": True,
        "terminal": "Developer API Metrics & Trace Diagnostics",
        "flag": "LAB{jwt_jwk_injection}",
        "access": "Granted (embedded jwk parameter accepted)",
        "payload": payload,
        "notes": notes
    }

@app.get("/v1/reports/partner-sync")
@app.get("/reports/partner-sync")
def report_partner_sync(request: Request):
    """Marketplace Domain: Dealership Network Identity Federation & Sync.
    VULN: jku header URL injection / SSRF keyset fetch ONLY. Rejects none tokens."""
    token = _extract_token(request)
    payload, notes = auth.verify_jwt_jku(token)
    if not payload:
        return JSONResponse({"error": "Unauthorized: invalid jku signature", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "Forbidden: partner sync admin role required", "payload": payload, "notes": notes}, status_code=403)
    return {
        "ok": True,
        "terminal": "Dealership Network Synchronization Terminal",
        "flag": "LAB{jwt_jku_injection}",
        "access": "Granted (jku keyset URL fetched)",
        "payload": payload,
        "notes": notes
    }

@app.get("/v1/reports/fleet-kms")
@app.get("/reports/fleet-kms")
def report_fleet_kms(request: Request):
    """Marketplace Domain: Commercial Fleet Key Management Service (KMS).
    VULN: kid header parameter filesystem path traversal ONLY. Rejects none tokens."""
    token = _extract_token(request)
    payload, notes = auth.verify_jwt_kid(token)
    if not payload:
        return JSONResponse({"error": "Unauthorized: invalid kid signature", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "Forbidden: fleet admin role required", "payload": payload, "notes": notes}, status_code=403)
    return {
        "ok": True,
        "terminal": "Commercial Fleet Hardware KMS Telemetry",
        "flag": "LAB{jwt_kid_traversal}",
        "access": "Granted (kid filesystem key traversal)",
        "payload": payload,
        "notes": notes
    }

@app.get("/v1/reports/compliance")
@app.get("/reports/compliance")
def report_compliance(request: Request):
    """Marketplace Domain: Enterprise Security Certificate Compliance.
    VULN: Algorithm confusion (RS256 verified as HS256 with public key bytes) ONLY."""
    token = _extract_token(request)
    payload, notes = auth.verify_jwt_confusion(token)
    if not payload:
        return JSONResponse({"error": "Unauthorized: invalid confusion signature", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "Forbidden: compliance admin role required", "payload": payload, "notes": notes}, status_code=403)
    return {
        "ok": True,
        "terminal": "Enterprise Security Certificate Compliance",
        "flag": "LAB{jwt_alg_confusion}",
        "access": "Granted (RS256 verified as HMAC with public key)",
        "payload": payload,
        "notes": notes
    }

@app.get("/v1/oauth/authorize")
def v1_oauth_authorize(client_id: str = "", redirect_uri: str = "", response_type: str = "token",
                       scope: str = "openid", state: Optional[str] = None,
                       code_challenge: Optional[str] = None,
                       code_challenge_method: Optional[str] = None,
                       sid: Optional[str] = None):
    # New authorization-code/PKCE facade for registered marketplace clients.
    if response_type == "code" or code_challenge is not None or client_id in phase9.REGISTERED_CLIENTS:
        return phase9.oauth_authorize(client_id, redirect_uri, response_type, scope,
                                      state, code_challenge, code_challenge_method, sid)
    return oauth_authorize(client_id, redirect_uri, response_type, scope)

@app.post("/v1/oauth/clients")
def v1_oauth_register(data: ClientReg, request: Request):
    return oauth_register(data, request)

@app.get("/v1/oauth/link")
def v1_oauth_link(email: str = "", oauth_id: str = ""):
    return oauth_link(email, oauth_id)

@app.get("/v1/oauth/proxy")
def v1_oauth_proxy(url: str = ""):
    return oauth_proxy(url)

@app.get("/v1/go")
def v1_go(url: str = "/"):
    return open_redirect(url)

@app.post("/v1/orders/quote")
def v1_quote(username: str = Query("wiener"), price: float = Query(...)):
    return buy_car(username, price)

@app.get("/v1/checkout/state")
def v1_state(step: str = "start", completed: Optional[str] = None):
    return biz_state(step, completed)

# ---------- Customer Financing & Auto Loan Underwriting Chain (Chain 2) ----------
INITIAL_FINANCING_APPLICATIONS = {
    "LOAN-9001": {
        "app_id": "LOAN-9001",
        "username": "carlos",
        "vehicle_id": "2",
        "requested_amount": 25000.0,
        "annual_income": 85000.0,
        "status": "PENDING_MANUAL_REVIEW",
        "applicant": {
            "employer": "Fleet Logistics Ltd",
            "employment_years": 3,
            "address": "42 Ring Road, Delhi"
        },
        "underwriting": {
            "risk_tier": "High_Risk_Manual",
            "credit_score": 580,
            "manager_approved": False,
            "kyc_verified": False,
            "escrow_clearance_limit": 0.0
        },
        "escrow_token": "ESCROW-SECRET-9001",
        "created_at": "2026-10-17T12:00:00Z"
    }
}
FINANCING_APPLICATIONS = json.loads(json.dumps(INITIAL_FINANCING_APPLICATIONS))

class LoanApplicationIn(BaseModel):
    username: str = "wiener"
    vehicle_id: str = "1"
    requested_amount: float = 12000.0
    annual_income: float = 65000.0

@app.post("/v1/customers/financing/apply")
@app.post("/customers/financing/apply")
def financing_apply(data: LoanApplicationIn):
    """Customer submits financing pre-approval application."""
    app_id = f"LOAN-{len(FINANCING_APPLICATIONS) + 9002}"
    record = {
        "app_id": app_id,
        "username": data.username,
        "vehicle_id": data.vehicle_id,
        "requested_amount": data.requested_amount,
        "annual_income": data.annual_income,
        "status": "UNDER_AUTOMATED_REVIEW",
        "applicant": {
            "employer": "Pending Verification",
            "employment_years": 1,
            "address": "Default Customer Address"
        },
        "underwriting": {
            "risk_tier": "Standard_Pending",
            "credit_score": 620,
            "manager_approved": False,
            "kyc_verified": False,
            "escrow_clearance_limit": 5000.0
        },
        "escrow_token": hashlib.sha256(f"{app_id}:escrow".encode()).hexdigest()[:16],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }
    FINANCING_APPLICATIONS[app_id] = record
    return {
        "ok": True,
        "app_id": app_id,
        "status": "UNDER_AUTOMATED_REVIEW",
        "message": "Loan application registered for credit scoring."
    }

@app.get("/v1/customers/financing/status")
@app.get("/customers/financing/status")
def financing_status(app_id: str = Query("LOAN-9001")):
    """VULN (Step 1 IDOR): Unauthenticated / unowned status lookup leaks full underwriting record."""
    record = FINANCING_APPLICATIONS.get(app_id)
    if not record:
        return JSONResponse({"error": "Application not found"}, status_code=404)
    return {
        "ok": True,
        "application": record,
        "audit_note": "Confidential underwriting metadata (manager override requires Tier1_Executive/VIP_PREAPPROVED risk_tier)"
    }

def _deep_update(target: dict, source: dict):
    for k, v in source.items():
        if isinstance(v, dict) and isinstance(target.get(k), dict):
            _deep_update(target[k], v)
        else:
            target[k] = v

@app.put("/v1/customers/financing/profile")
@app.put("/customers/financing/profile")
def financing_update_profile(data: dict):
    """VULN (Step 2 Nested Mass Assignment): Deep dict merge allows modifying underwriting controls."""
    app_id = data.get("app_id")
    if not app_id or app_id not in FINANCING_APPLICATIONS:
        return JSONResponse({"error": "Valid app_id required"}, status_code=400)
    record = FINANCING_APPLICATIONS[app_id]
    
    clean_data = {k: v for k, v in data.items() if k != "app_id"}
    _deep_update(record, clean_data)
    
    return {
        "ok": True,
        "app_id": app_id,
        "updated_fields": list(clean_data.keys()),
        "status": record.get("status"),
        "underwriting_summary": record.get("underwriting")
    }

class DisburseIn(BaseModel):
    app_id: str
    escrow_account: str = "DEALER-ESCROW-001"

@app.post("/v1/customers/financing/disburse")
@app.post("/customers/financing/disburse")
def financing_disburse(data: DisburseIn):
    """VULN (Step 3 State Machine Bypass): Enforces underwriting constraints that were manipulated in Step 2."""
    record = FINANCING_APPLICATIONS.get(data.app_id)
    if not record:
        return JSONResponse({"error": "Application record not found"}, status_code=404)
    
    uw = record.get("underwriting", {})
    tier = uw.get("risk_tier", "")
    is_approved = uw.get("manager_approved", False)
    is_kyc = uw.get("kyc_verified", False)
    
    if not is_approved or tier not in ("VIP_PREAPPROVED", "Tier1_Executive") or not is_kyc:
        return JSONResponse({
            "error": "Escrow disbursement declined: Underwriting approval criteria not met",
            "current_underwriting": uw,
            "required": {"risk_tier": "VIP_PREAPPROVED", "manager_approved": True, "kyc_verified": True}
        }, status_code=403)
    
    record["status"] = "DISBURSED_TO_ESCROW"
    return {
        "ok": True,
        "status": "DISBURSED_TO_ESCROW",
        "app_id": data.app_id,
        "amount_disbursed": record.get("requested_amount"),
        "escrow_account": data.escrow_account,
        "clearing_ref": "TX-CLR-" + hashlib.md5(data.app_id.encode()).hexdigest()[:12].upper(),
        "flag": "LAB{customer_chain_loan_disbursal_pwned}",
        "message": "Auto loan successfully disbursed into dealer escrow account!"
    }

# ============ Phase 8: SSO federation (SAML + OIDC profile claim merge) ============
SSO_STATE = {"sessions": {}, "counter": 0, "avatar_cache": None, "xml_log": []}
SSO_DIRECTORY = {
    "admin@automarket.io": {"user_id": "admin-9f3a2bd1e8", "role": "admin", "display_name": "Governance Admin (SSO)"},
    "demo.exec": {"user_id": "exec-7c21b44f", "role": "customer", "display_name": "Demo Executive"},
    "ops@automarket.io": {"user_id": "ops-3f81ad02", "role": "engineer", "display_name": "Ops Engineer"},
}

def _sso_new_session(subject_claim: str, via: str):
    SSO_STATE["counter"] += 1
    sid = "sso-sess-%d" % SSO_STATE["counter"]
    profile = SSO_DIRECTORY.get(subject_claim, {})
    sess = {"session_id": sid, "subject": subject_claim,
            "role": profile.get("role", "customer"),
            "user_id": profile.get("user_id", "u-guest-" + hashlib.md5(subject_claim.encode()).hexdigest()[:6]),
            "via": via}
    SSO_STATE["sessions"][sid] = sess
    return sess

@app.post("/v1/sso/saml/verify")
async def sso_saml_verify(request: Request):
    """SAML assertion consumer used by the storefront SSO login."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid JSON body"}, status_code=400)
    xml = str(body.get("saml_response", ""))
    if not xml:
        return JSONResponse({"error": "saml_response required"}, status_code=400)
    SSO_STATE["xml_log"].append(xml[:2000])
    if "<!DOCTYPE" in xml or "<!ENTITY" in xml:
        return JSONResponse({"error": "DTD processing disabled"}, status_code=400)
    if "<ds:Signature" not in xml:
        return JSONResponse({"error": "response signature missing (trusted IdP only)"}, status_code=403)
    # VULN: the signature scope and the identity parser disagree. The signer
    # ignores comments and foreign namespaces; this consumer does not.
    id_pattern = r'<(?:([A-Za-z_][\w.-]*):)?NameID\b[^>]*>\s*([^<\s]+)\s*</(?:[A-Za-z_][\w.-]*:)?NameID>'
    raw_ids = [(m.group(1) or "", m.group(2)) for m in re.finditer(id_pattern, xml)]
    if not raw_ids:
        return JSONResponse({"error": "no NameID claim found"}, status_code=400)
    comments = re.findall(r"<!--(.*?)-->", xml, re.S)
    comment_ids = []
    for c in comments:
        comment_ids.extend(m.group(2) for m in re.finditer(id_pattern, c))
    stripped = re.sub(r"<!--.*?-->", "", xml, flags=re.S)
    canonical_ids = [m.group(2) for m in re.finditer(id_pattern, stripped) if not m.group(1)]
    prefixed_ids = [(p, v) for p, v in raw_ids if p]
    nameids = [v for _, v in raw_ids]
    signed_subject = canonical_ids[0] if canonical_ids else (prefixed_ids[0][1] if prefixed_ids else nameids[0])
    effective_subject = nameids[-1]
    flags = []
    if effective_subject != signed_subject and len(nameids) > 1:
        flags.append("LAB{saml_xsw_bypass}")
    if comment_ids and (effective_subject in comment_ids or any(c != signed_subject for c in comment_ids)):
        flags.append("LAB{saml_comment_truncation}")
    if prefixed_ids and effective_subject in [v for _, v in prefixed_ids] and effective_subject not in canonical_ids:
        flags.append("LAB{saml_namespace_confusion}")
    sess = _sso_new_session(effective_subject, "saml")
    out = {"ok": True, "signed_subject": signed_subject, "effective_subject": effective_subject,
           "session": sess, "login_url": "/admin", "flags": flags}
    if flags:
        out["flag"] = flags[0]
    if sess["role"] == "admin":
        out["admin_flag"] = "LAB{sso_admin_takeover}"
        out["admin_session"] = sess["session_id"]
    return out

@app.post("/v1/sso/token/exchange")
async def sso_token_exchange(request: Request):
    """OIDC profile claim merge. The request gate inspects the FIRST occurrence of
    each claim; the backend JSON parser keeps the LAST duplicate key."""
    raw = (await request.body()).decode("latin-1")
    try:
        parsed = json.loads(raw)
    except Exception:
        return JSONResponse({"error": "invalid JSON body"}, status_code=400)
    m = re.search(r'"avatar_url"\s*:\s*"([^"]*)"', raw)
    first_seen = m.group(1) if m else None
    backend_url = parsed.get("avatar_url")

    def _is_public(u):
        return bool(u) and u.startswith("https://") and "cdn." in u

    if first_seen is not None and not _is_public(first_seen):
        return JSONResponse({"error": "avatar_url must point to the public asset CDN (gate check)",
                             "checked": first_seen}, status_code=403)
    result = {"ok": True, "claim_seen_by_gate": first_seen, "claim_used_by_backend": backend_url}
    if backend_url:
        try:
            from anyio import to_thread
            r = await to_thread.run_sync(lambda: requests.get(backend_url, timeout=3))
            status, body_head = r.status_code, r.text[:300]
        except Exception as e:
            status, body_head = 0, "fetch failed: " + str(e)[:120]
        SSO_STATE["avatar_cache"] = {"url": backend_url, "status": status, "body_head": body_head}
        result["avatar"] = {"status": status, "body_head": body_head}
        host = urllib.parse.urlsplit(backend_url).hostname or ""
        internal = host in ("127.0.0.1", "localhost") or host.endswith(".internal") or \
            host.startswith("10.") or host.startswith("192.168.") or host.startswith("169.254.")
        if internal and first_seen != backend_url and _is_public(first_seen):
            result["flag"] = "LAB{json_dupkey_bypass}"
    return result

@app.get("/v1/sso/session/{sid}")
def sso_session(sid: str):
    sess = SSO_STATE["sessions"].get(sid)
    if not sess:
        return JSONResponse({"error": "session not found"}, status_code=404)
    return {"session": sess}

@app.get("/v1/sso/avatar-cache")
def sso_avatar_cache():
    return {"avatar_cache": SSO_STATE["avatar_cache"], "assertions_seen": len(SSO_STATE["xml_log"])}

@app.post("/v1/internal/reset")
def v1_internal_reset():
    """Internal test helper (not part of the public surface)."""
    global FINANCING_APPLICATIONS
    from .db import reset_db
    FAILED.clear()
    CUSTOMER_FAILED.clear()
    SSO_STATE["sessions"].clear()
    SSO_STATE["counter"] = 0
    SSO_STATE["avatar_cache"] = None
    SSO_STATE["xml_log"].clear()
    FINANCING_APPLICATIONS.clear()
    FINANCING_APPLICATIONS.update(json.loads(json.dumps(INITIAL_FINANCING_APPLICATIONS)))
    phase9.reset_state()
    reset_db()
    return {"ok": True}
