"""Lead WS server - INTENTIONALLY VULNERABLE (no Origin/auth check). LAB ONLY. Port 5001 /chat."""
import asyncio, json, os, sqlite3, re
import websockets

DB_PATH = os.environ.get("LEAD_DB", "/tmp/lead.db")
LOG_PATH = "/tmp/ws-chat.json"

def log_msg(m):
    try:
        arr = json.load(open(LOG_PATH)) if os.path.exists(LOG_PATH) else []
    except Exception:
        arr = []
    arr.append(m)
    open(LOG_PATH, "w").write(json.dumps(arr[-100:]))

async def handle(ws):
    # VULN: handshake not validated - log but accept any Origin / missing cookie
    try:
        origin = ws.request_headers.get("Origin", "")
        cookie = ws.request_headers.get("Cookie", "")
        proto = ws.request_headers.get("Sec-WebSocket-Protocol", "")
    except Exception:
        origin, cookie, proto = "", "", ""
    admin_cookie = "automarket_admin=1" in cookie
    hello = {"hello": "lead-chat v1 (vuln lab)", "origin_seen": origin,
             "note": "no Origin check -> CSWSH; send {type:admin} with no auth"}
    if admin_cookie:
        hello["session"] = {"role": "admin", "cookie_accepted": True,
                            "flag": "LAB{ws_cswsh_cookie}"}
    await ws.send(json.dumps(hello))
    async for raw in ws:
        try:
            msg = json.loads(raw)
        except Exception:
            await ws.send(json.dumps({"error": "need JSON"}))
            continue
        t = msg.get("type", "message")
        if t == "admin":
            # VULN: no authz on WS admin action
            log_msg({"type": "admin", "action": msg.get("action")})
            await ws.send(json.dumps({"admin": True, "flag": "LAB{ws_admin_no_auth}", "action": msg.get("action")}))
        elif t == "search":
            # VULN: SQLi via WS message
            q = msg.get("q", "")
            try:
                c = sqlite3.connect(DB_PATH); c.row_factory = sqlite3.Row
                rows = c.execute(f"SELECT id, vehicle, seller FROM inquiries WHERE vehicle LIKE '%{q}%'").fetchall()
                resp = {"results": [dict(r) for r in rows], "query": q}
                if rows and re.search(r"('\s*(or|OR)\b|union\s+select|--)", q):
                    resp["flag"] = "LAB{ws_sqli_frame}"
                await ws.send(json.dumps(resp))
            except Exception as e:
                await ws.send(json.dumps({"error": str(e)[:300]}))
        elif t == "impersonate" or "user_id" in msg:
            # VULN: IDOR via user_id in WS frame
            uid = msg.get("user_id")
            try:
                c = sqlite3.connect(DB_PATH); c.row_factory = sqlite3.Row
                r = c.execute(f"SELECT id, username, email, password FROM users WHERE id = '{uid}'").fetchone()
                await ws.send(json.dumps({"impersonated": dict(r) if r else None, "flag": "LAB{ws_idor}"}))
            except Exception as e:
                await ws.send(json.dumps({"error": str(e)[:300]}))
        else:
            # normal chat, but reflects + stores (hijackable via /chat-history CORS *)
            m = {"from": msg.get("from", "anon"), "to": msg.get("to", "dealer"), "text": msg.get("text", raw)[:2000],
                 "origin": origin, "cookie_seen": bool(cookie)}
            log_msg(m)
            await ws.send(json.dumps({"echo": m, "hint": "try {\"type\":\"admin\",\"action\":\"dump\"} or {\"type\":\"search\",\"q\":\"' OR 1=1--\"}"}))

async def main():
    port = int(os.environ.get("WS_PORT", "5001"))
    async with websockets.serve(handle, "0.0.0.0", port, process_request=None):
        print(f"lead WS on {port}/chat (no Origin check)", flush=True)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
