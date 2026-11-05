"""Phase 9 IAM labs - INTENTIONALLY VULNERABLE. LAB ONLY.

OAuth code/PKCE handling, redirect validation differential, federated account
linking, x5u/kid key handling, invoice identifiers, organisation invites,
multipart imports and the partner GraphQL gateway.
"""
import base64
import difflib
import hashlib
import json
import os
import re
import secrets
import time
import urllib.parse
import uuid
from datetime import datetime, timezone
from typing import Optional

import requests
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from . import auth
from .db import get_conn

router = APIRouter()

UUID_EPOCH = 0x01B21DD213814000
UUID_NODE = 0xAABBCCDDEEFF
UUID_CLOCK_SEQ = 0x1F3A

REGISTERED_CLIENTS = {
    "storefront-app": {
        "redirect_uris": ["https://app.automarket.io/oauth/callback"],
        "public": True,
    },
    "federated-partner": {
        "redirect_uris": ["https://app.automarket.io/oauth/callback"],
        "public": False,
    },
}

OAUTH9 = {"codes": {}, "tokens": {}, "linked": {}, "counter": 0}
INVOICE9 = {"invoices": {}, "by_hash": {}, "counter": 0}
ORG9 = {"members": [], "admin_count": 1, "invites": []}
OTP9 = {"mailboxes": {}, "attempts": 0}
GRAPHQL_HISTORY = []


def _iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="microseconds")


def _uuid1_at(ts, clock_seq=UUID_CLOCK_SEQ, node=UUID_NODE):
    ns = int(ts * 10_000_000) + UUID_EPOCH
    time_low = ns & 0xFFFFFFFF
    time_mid = (ns >> 32) & 0xFFFF
    time_hi_version = ((ns >> 48) & 0x0FFF) | 0x1000
    seq_hi = ((clock_seq >> 8) & 0x3F) | 0x80
    seq_low = clock_seq & 0xFF
    return str(uuid.UUID(fields=(time_low, time_mid, time_hi_version, seq_hi, seq_low, node)))


def _new_invoice(user, amount, number, ts):
    inv_id = _uuid1_at(ts)
    record = {
        "id": inv_id,
        "number": number,
        "user": user,
        "customer_email": user if "@" in str(user) else f"{user}@used-vehicles.lab",
        "amount": float(amount),
        "created_at": _iso(ts),
        "created_ts": ts,
        "status": "issued",
    }
    INVOICE9["invoices"][inv_id] = record
    INVOICE9["by_hash"][hashlib.md5(number.encode()).hexdigest()] = inv_id
    return record


def _seed_invoice():
    ts = time.time()
    _new_invoice("carlos@used-vehicles.lab", 24999.0, "INV-2026-0417", ts)


def reset_state():
    OAUTH9["codes"].clear()
    OAUTH9["tokens"].clear()
    OAUTH9["linked"].clear()
    OAUTH9["counter"] = 0
    INVOICE9["invoices"].clear()
    INVOICE9["by_hash"].clear()
    INVOICE9["counter"] = 0
    ORG9["members"] = [{"email": "owner@automarket.io", "role": "owner", "status": "active"}]
    ORG9["admin_count"] = 1
    ORG9["invites"] = []
    OTP9["mailboxes"] = {
        "carlos@used-vehicles.lab": {"code": "4821", "attempts": 0, "verified": False},
    }
    OTP9["attempts"] = 0
    GRAPHQL_HISTORY.clear()
    _seed_invoice()


# ---------------------------------------------------------------- OAuth code flow
def _client(client_id):
    return REGISTERED_CLIENTS.get(client_id)


def _split_redirect(uri):
    try:
        u = urllib.parse.urlsplit(uri)
        return u.scheme, (u.hostname or ""), u.path, u.port
    except Exception:
        return "", "", "", None


def oauth_authorize(client_id, redirect_uri, response_type, scope, state, code_challenge,
                    code_challenge_method, sid):
    client = _client(client_id)
    if not client:
        return JSONResponse({"error": "unknown client_id"}, status_code=400)
    if not redirect_uri:
        return JSONResponse({"error": "redirect_uri required"}, status_code=400)

    reg = client["redirect_uris"]
    exact = redirect_uri in reg
    host_prefix = "https://app.automarket.io"
    prefix_pass = redirect_uri.startswith(host_prefix)
    if not (exact or prefix_pass):
        return JSONResponse({"error": "redirect_uri is not registered"}, status_code=400)

    flags = []
    if prefix_pass and not exact:
        scheme, host, path, port = _split_redirect(redirect_uri)
        if host != "app.automarket.io":
            flags.append("LAB{oauth_redirect_diff}")

    parsed_uri = urllib.parse.urlsplit(redirect_uri)
    if parsed_uri.path in ("/v1/go", "/api/iam/v1/go") and "url=" in (parsed_uri.query or ""):
        flags.append("LAB{oauth_redirect_chain}")

    if response_type == "token":
        token = secrets.token_urlsafe(12)
        OAUTH9["tokens"][token] = {"client_id": client_id, "user": "wiener", "redirect_uri": redirect_uri}
        loc = redirect_uri + ("&" if "?" in redirect_uri else "#") + "access_token=" + token
        return {"ok": True, "flow": "implicit", "redirect": loc, "flags": flags}

    if response_type != "code":
        return JSONResponse({"error": "unsupported response_type"}, status_code=400)
    if code_challenge_method not in (None, "", "plain", "S256"):
        return JSONResponse({"error": "unsupported code_challenge_method"}, status_code=400)

    code = "code-" + secrets.token_urlsafe(10)
    OAUTH9["counter"] += 1
    OAUTH9["codes"][code] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "challenge": code_challenge,
        "method": code_challenge_method,
        "session_user": sid or "wiener",
        "created": time.time(),
    }
    loc = redirect_uri + ("&" if "?" in redirect_uri else "?") + "code=" + code
    if state:
        loc += "&state=" + urllib.parse.quote(state)
    return {"ok": True, "flow": "code", "code": code, "redirect": loc, "flags": flags,
            "state_echo": state}


async def _request_payload(request):
    raw = (await request.body()).decode("latin-1")
    ctype = request.headers.get("content-type", "")
    if "json" in ctype:
        try:
            return json.loads(raw)
        except Exception:
            return {}
    parsed = urllib.parse.parse_qs(raw)
    return {k: v[-1] for k, v in parsed.items()}


@router.post("/v1/oauth/token")
async def oauth_token(request: Request, response: Response):
    """Authorization-code exchange. Public clients may omit or mismatch the verifier,
    and the state parameter is informative only."""
    response.headers["Cache-Control"] = "no-store"
    d = await _request_payload(request)
    code = str(d.get("code", ""))
    verifier = d.get("code_verifier")
    state = d.get("state")
    record = OAUTH9["codes"].get(code)
    if not record:
        return JSONResponse({"error": "invalid_grant"}, status_code=400)
    client = _client(record["client_id"]) or {}
    if record["client_id"] and d.get("client_id") and d["client_id"] != record["client_id"]:
        return JSONResponse({"error": "invalid_client"}, status_code=400)
    flags = []
    if record.get("challenge"):
        accept = True
        if record.get("method") == "S256" and verifier:
            calc = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
            if calc != record["challenge"]:
                accept = True
                flags.append("LAB{oauth_pkce_downgrade}")
        elif verifier is None:
            flags.append("LAB{oauth_pkce_downgrade}")
        elif record.get("method") == "plain" and verifier != record["challenge"]:
            flags.append("LAB{oauth_pkce_downgrade}")
        if not accept:
            return JSONResponse({"error": "invalid_grant"}, status_code=400)
    if record.get("state") and (state is None or str(state) != str(record["state"])):
        flags.append("LAB{oauth_state_fixation}")
    user = record.get("session_user") or "wiener"
    token = auth.issue_token(2 if user == "carlos" else 3, user, "user")
    OAUTH9["tokens"][token] = {"client_id": record["client_id"], "user": user,
                               "scope": d.get("scope", "openid")}
    del OAUTH9["codes"][code]
    return {"ok": True, "access_token": token, "token_type": "Bearer", "user": user,
            "flags": flags}


@router.post("/v1/oauth/federated/link")
async def federated_link(request: Request):
    d = await request.json()
    email = str(d.get("email", "")).strip().lower()
    oauth_id = str(d.get("oauth_id", "")).strip()
    if not email or not oauth_id:
        return JSONResponse({"error": "email and oauth_id required"}, status_code=400)
    OAUTH9["linked"][oauth_id] = {"email": email, "verified": False}
    return {"ok": True, "linked": {"email": email, "oauth_id": oauth_id, "verified": False},
            "note": "provider identity attached to the mailbox without confirmation"}


@router.get("/v1/oauth/federated/login")
def federated_login(oauth_id: str, response: Response):
    response.headers["Cache-Control"] = "no-store"
    link = OAUTH9["linked"].get(oauth_id)
    if not link:
        return JSONResponse({"error": "unknown federated identity"}, status_code=404)
    conn = get_conn()
    row = conn.execute("SELECT id, username, role FROM users WHERE lower(email) = ?",
                       (link["email"],)).fetchone()
    if not row:
        return JSONResponse({"error": "linked account not found"}, status_code=404)
    token = auth.issue_token(row["id"], row["username"], row["role"])
    return {"ok": True, "user": row["username"], "role": row["role"], "token": token,
            "email": link["email"], "verified_link": link["verified"],
            "flag": "LAB{oauth_prehijack_link}"}


# ---------------------------------------------------------------- key handling
def _extract_token(request):
    auth_h = request.headers.get("Authorization", "")
    if auth_h.startswith("Bearer "):
        return auth_h[7:].strip()
    return request.query_params.get("token", "").strip()


@router.get("/v1/reports/vendor-x5u")
def report_vendor_x5u(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    payload, notes = auth.verify_jwt_x5u(_extract_token(request))
    if not payload:
        return JSONResponse({"error": "invalid vendor key signature", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "vendor admin role required", "payload": payload}, status_code=403)
    out = {"ok": True, "terminal": "Vendor Key Distribution Console", "payload": payload, "notes": notes}
    if any(str(n).startswith("x5u-key-verified") for n in notes):
        out["flag"] = "LAB{jwt_x5u_chain}"
    return out


@router.get("/v1/reports/vendor-kms")
def report_vendor_kms(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    payload, notes = auth.verify_jwt_kid_sqli(_extract_token(request))
    if not payload:
        return JSONResponse({"error": "invalid vendor key id", "notes": notes}, status_code=401)
    if payload.get("role") != "admin":
        return JSONResponse({"error": "vendor admin role required", "payload": payload}, status_code=403)
    return {"ok": True, "terminal": "Vendor Hardware Key Inventory", "payload": payload,
            "notes": notes, "flag": "LAB{jwt_kid_sqli}"}


# ---------------------------------------------------------------- invoices
@router.post("/v1/invoices")
async def invoice_create(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    d = await request.json()
    user = str(d.get("user", "wiener"))
    amount = float(d.get("amount", 100))
    INVOICE9["counter"] += 1
    number = "INV-2026-%04d" % (417 + INVOICE9["counter"])
    rec = _new_invoice(user, amount, number, time.time())
    return {"ok": True, "invoice": {"id": rec["id"], "number": number,
                                    "created_at": rec["created_at"], "amount": amount}}


@router.get("/v1/public/activity")
def public_activity(response: Response):
    response.headers["Cache-Control"] = "no-store"
    entries = []
    for rec in sorted(INVOICE9["invoices"].values(), key=lambda r: r["created_ts"], reverse=True):
        email = rec["customer_email"]
        local = email.split("@")[0]
        masked = (local[0] + "***" + local[-1]) if len(local) > 2 else "***"
        entries.append({
            "kind": "invoice.created",
            "invoice_ref_hash": hashlib.md5(rec["number"].encode()).hexdigest(),
            "customer": masked + "@" + email.split("@")[-1],
            "amount": rec["amount"],
            "created_at": rec["created_at"],
        })
    return {"ok": True, "activity": entries[:50]}


@router.get("/v1/invoices/by-hash/{ref_hash}")
def invoice_by_hash(ref_hash: str, response: Response):
    response.headers["Cache-Control"] = "no-store"
    inv_id = INVOICE9["by_hash"].get(ref_hash)
    if not inv_id:
        return JSONResponse({"error": "invoice reference not found"}, status_code=404)
    rec = dict(INVOICE9["invoices"][inv_id])
    out = {"ok": True, "invoice": rec}
    if rec["number"] == "INV-2026-0417":
        out["flag"] = "LAB{invoice_hash_enum}"
    return out


@router.get("/v1/invoices/{invoice_id}")
def invoice_by_id(invoice_id: str, response: Response):
    response.headers["Cache-Control"] = "no-store"
    rec = INVOICE9["invoices"].get(invoice_id)
    if not rec:
        return JSONResponse({"error": "invoice not found"}, status_code=404)
    out = {"ok": True, "invoice": rec}
    if rec["number"] == "INV-2026-0417":
        out["flag"] = "LAB{uuidv1_invoice_bola}"
    return out


# ---------------------------------------------------------------- organisation
@router.post("/v1/orgs/invite")
async def org_invite(request: Request):
    d = await request.json()
    email = str(d.get("email", "")).strip().lower()
    role = str(d.get("role", "member")).lower()
    if not email:
        return JSONResponse({"error": "email required"}, status_code=400)
    if role not in ("member", "admin"):
        return JSONResponse({"error": "role must be member or admin"}, status_code=400)
    snapshot = ORG9["admin_count"]
    import asyncio
    await asyncio.sleep(0.4)
    if role == "admin" and snapshot >= 2:
        return JSONResponse({"error": "administrator seat limit reached"},
                            status_code=409)
    ORG9["members"].append({"email": email, "role": role, "status": "invited"})
    ORG9["invites"].append({"email": email, "role": role})
    if role == "admin":
        ORG9["admin_count"] += 1
    out = {"ok": True, "invited": email, "role": role, "admin_count": ORG9["admin_count"]}
    if ORG9["admin_count"] > 2:
        out["flag"] = "LAB{org_invite_race}"
    return out


async def _multipart_parts(request):
    ctype = request.headers.get("content-type", "")
    m = re.search(r'boundary="?([^";]+)"?', ctype)
    raw = await request.body()
    if not m:
        return []
    boundary = ("--" + m.group(1)).encode()
    parts = []
    for chunk in raw.split(boundary)[1:]:
        if chunk.startswith(b"--"):
            break
        chunk = chunk.lstrip(b"\r\n")
        if b"\r\n\r\n" not in chunk:
            continue
        head, data = chunk.split(b"\r\n\r\n", 1)
        data = data.rstrip(b"\r\n")
        nm = re.search(rb'name="([^"]+)"', head)
        name = nm.group(1).decode(errors="replace") if nm else ""
        parts.append((name, data.decode(errors="replace")))
    return parts


@router.post("/v1/orgs/members/import")
async def org_members_import(request: Request):
    parts = await _multipart_parts(request)
    roles = [v for k, v in parts if k == "role"]
    emails = [v for k, v in parts if k == "email"]
    if not roles or not emails:
        return JSONResponse({"error": "multipart fields role and email required"}, status_code=400)
    gate_role = roles[0].strip().lower()
    if gate_role != "member":
        return JSONResponse({"error": "bulk import is limited to member accounts"}, status_code=403)
    effective_role = roles[-1].strip().lower()
    if effective_role not in ("member", "admin"):
        return JSONResponse({"error": "invalid role"}, status_code=400)
    email = emails[-1].strip().lower()
    ORG9["members"].append({"email": email, "role": effective_role, "status": "active"})
    if effective_role == "admin":
        ORG9["admin_count"] += 1
    out = {"ok": True, "imported": email, "gate_role": gate_role,
           "effective_role": effective_role, "admin_count": ORG9["admin_count"]}
    if effective_role == "admin" and gate_role == "member":
        out["flag"] = "LAB{multipart_role_smuggling}"
    return out


@router.get("/v1/orgs/members")
def org_members(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"ok": True, "members": ORG9["members"], "admin_count": ORG9["admin_count"]}


# ---------------------------------------------------------------- OTP + GraphQL
def _send_otp(email, code):
    try:
        import smtplib
        from email.message import EmailMessage
        msg = EmailMessage()
        msg["To"] = email
        msg["From"] = "security@used-vehicles.lab"
        msg["Subject"] = "Your verification code"
        msg.set_content("Verification code: " + code)
        s = smtplib.SMTP(os.environ.get("MAILHOG_HOST", "mailhog"),
                         int(os.environ.get("MAILHOG_PORT", "1025")), timeout=3)
        s.send_message(msg)
        s.quit()
    except Exception:
        pass


@router.post("/v1/auth/otp/request")
async def otp_request(request: Request):
    d = await request.json()
    email = str(d.get("email", "")).strip().lower()
    box = OTP9["mailboxes"].get(email)
    if not box:
        return JSONResponse({"error": "account not found"}, status_code=404)
    _send_otp(email, box["code"])
    return {"ok": True, "sent_to": email, "hint": "retrieve the code from the mailbox"}


def _query_fields(query):
    start = query.find("{")
    if start < 0:
        return []
    n = len(query)

    def skip(j):
        while j < n and query[j] in " \t\r\n,":
            j += 1
        return j

    def ident(j):
        m = re.match(r"[A-Za-z_]\w*", query[j:])
        return (m.group(0), j + m.end()) if m else (None, j)

    def balanced(j, open_ch, close_ch):
        depth, in_str, esc = 0, False, False
        while j < n:
            ch = query[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == open_ch:
                    depth += 1
                elif ch == close_ch:
                    depth -= 1
                    if depth == 0:
                        return j + 1
            j += 1
        return j

    fields, i = [], start + 1
    while True:
        i = skip(i)
        if i >= n or query[i] == "}":
            break
        seg_start = i
        name, j = ident(i)
        if not name:
            return []
        j2 = skip(j)
        if j2 < n and query[j2] == ":":
            j = skip(j2 + 1)
            name, j = ident(j)
            if not name:
                return []
        else:
            j = j2
        if j < n and query[j] == "(":
            j = balanced(j, "(", ")")
        j2 = skip(j)
        if j2 < n and query[j2] == "{":
            j = balanced(j2, "{", "}")
        seg = query[seg_start:j].strip()
        if seg:
            fields.append(seg)
        i = j
    return fields


def _parse_field(text):
    text = re.sub(r"\{.*$", "", text, flags=re.S).strip()
    m = re.match(r'(?:(?P<alias>[A-Za-z_]\w*)\s*:\s*)?(?P<name>[A-Za-z_]\w*)\s*(?:\((?P<args>.*)\))?\s*$',
                 text, re.S)
    if not m:
        return None
    args = {}
    if m.group("args"):
        for am in re.finditer(r'([A-Za-z_]\w*)\s*:\s*"((?:[^"\\]|\\.)*)"', m.group("args")):
            args[am.group(1)] = am.group(2).replace('\\"', '"')
        for am in re.finditer(r'([A-Za-z_]\w*)\s*:\s*(-?\d+)', m.group("args")):
            args.setdefault(am.group(1), int(am.group(2)))
    return (m.group("alias") or m.group("name")), m.group("name"), args


def _graphql_execute(query, context):
    known = ["me", "verifyOtp", "adminLogin", "__typename"]
    if "__schema" in query:
        return {"errors": [{"message": "Introspection is disabled on the partner gateway."}]}
    fields = _query_fields(query)
    if not fields:
        return {"errors": [{"message": "Syntax Error: expected a selection set."}]}
    data = {}
    flags = []
    alias_count = len(fields)
    for raw in fields:
        parsed = _parse_field(raw)
        if not parsed:
            return {"errors": [{"message": "Syntax Error: unexpected field"}]}
        alias, name, args = parsed
        if name == "__typename":
            data[alias] = "Query"
        elif name == "me":
            data[alias] = {"username": context.get("user", "guest"), "role": "user"}
        elif name == "verifyOtp":
            email = str(args.get("email", "")).lower()
            code = str(args.get("code", ""))
            box = OTP9["mailboxes"].get(email)
            OTP9["attempts"] += 1
            if box and code == box["code"]:
                box["verified"] = True
                token = auth.issue_token(2, "carlos", "user")
                val = {"ok": True, "token": token}
                if alias_count > 100:
                    flags.append("LAB{graphql_alias_otp}")
                data[alias] = val
            else:
                if box:
                    box["attempts"] = box.get("attempts", 0) + 1
                data[alias] = {"ok": False}
        elif name == "adminLogin":
            if str(args.get("password", "")) == "admin123":
                data[alias] = {"ok": True, "token": auth.issue_token(1, "administrator", "admin"),
                               "flag": "LAB{graphql_hidden_field}"}
            else:
                data[alias] = {"ok": False}
        else:
            close = difflib.get_close_matches(name, known, n=1, cutoff=0.35)
            msg = f'Cannot query field "{name}" on type "Query".'
            if close:
                msg += f' Did you mean "{close[0]}"?'
            GRAPHQL_HISTORY.append({"field": name, "suggestion": close[0] if close else None})
            if not close:
                return {"errors": [{"message": msg}]}
            return {"errors": [{"message": msg}]}
    out = {"data": data}
    if flags:
        out["flags"] = flags
    return out


@router.post("/v1/graphql")
async def partner_graphql(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    raw = (await request.body()).decode("latin-1")
    try:
        body = json.loads(raw)
    except Exception:
        body = {}
    query = str(body.get("query", ""))
    if not query:
        return JSONResponse({"errors": [{"message": "query required"}]}, status_code=400)
    return _graphql_execute(query, {"user": "guest"})


reset_state()
