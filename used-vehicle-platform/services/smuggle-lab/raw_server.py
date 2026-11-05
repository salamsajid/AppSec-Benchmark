"""Raw TCP smuggling oracle - LAB ONLY. Listens 8082. Send raw HTTP bytes, get front/back parse diff.
Supports: CL.TE / TE.CL / TE.TE-obfuscated / 0.CL / CL.0 / H2.TE / H2.CL (simulated) / CRLF split.
Protocol: send raw request bytes ending with \\n\\nORACLE\\n (or just close write), server replies JSON + closes.
Example (python): s.sendall(b"POST / HTTP/1.1\\r\\nHost: x\\r\\nContent-Length: 6\\r\\nTransfer-Encoding: chunked\\r\\n\\r\\n0\\r\\n\\r\\nGET /admin HTTP/1.1\\r\\nHost: x\\r\\n\\r\\n")
"""
import socket, threading, json, re, os

PORT = int(os.environ.get("RAW_PORT", "8082"))

def parse_chunked(body: str):
    m = re.match(r"\s*([0-9a-fA-F]+)(?:;[^\r\n]*)?\s*\r?\n", body)
    if not m: return body, body  # not chunked -> whole
    try: n = int(m.group(1), 16)
    except: return body, body
    start = m.end()
    return body[start:start+n], body[start+n:]

def front_parse(headers: dict, body: str):
    """Front (gateway-like, strict): prefers CL unless TE exactly 'chunked'; ignores obfuscated TE."""
    te = headers.get("transfer-encoding", "")
    cl = headers.get("content-length")
    if te.strip().lower() == "chunked":
        data, _rest = parse_chunked(body)
        return data, "TE"
    if cl is not None:
        try: n = int(str(cl).strip().split(",")[0])
        except: n = len(body)
        return body[:n], "CL"
    return body, "none"

def back_parse(headers: dict, body: str):
    """Back (lenient): honors TE if contains 'chunked' anywhere (obfuscated), incl. xchunked/suffix/tab."""
    te = headers.get("transfer-encoding", "")
    cl = headers.get("content-length")
    low = te.lower()
    if "chunked" in low or "xchunked" in low:
        data, _rest = parse_chunked(body)
        return data, "TE-lenient"
    if cl is not None:
        # CL.0: back uses last CL if duplicated
        parts = str(cl).split(",")
        try: n = int(parts[-1].strip())
        except: n = len(body)
        # 0.CL: CL:0 with body -> back reads body as next request
        return body[:n], "CL"
    return body, "none"

def classify(front_how, back_how, headers):
    te = headers.get("transfer-encoding", "")
    cl = headers.get("content-length")
    obs = te and te.strip().lower() != "chunked" and "chunked" in te.lower()
    if cl == "0" or str(cl).strip() == "0":
        return "0.CL"
    if front_how == "CL" and back_how.startswith("TE"):
        return "CL.TE" + ("-obfuscated" if obs else "")
    if front_how.startswith("TE") and back_how == "CL":
        return "TE.CL"
    if obs:
        return "TE.TE-obfuscated"
    return "none"

def handle(conn):
    try:
        conn.settimeout(5)
        data = b""
        while True:
            try: chunk = conn.recv(65536)
            except: break
            if not chunk: break
            data += chunk
            if b"\nORACLE\n" in data or len(data) > 100000: break
            # heuristic: if we have headers + declared body, wait briefly for pipelined smuggled bytes
            if b"\r\n\r\n" in data:
                # wait 200ms for remainder
                conn.settimeout(0.3)
        text = data.decode(errors="replace")
        text = text.replace("\nORACLE\n", "")
        # split head/body at first double CRLF
        if "\r\n\r\n" in text:
            head, body = text.split("\r\n\r\n", 1)
        elif "\n\n" in text:
            head, body = text.split("\n\n", 1)
        else:
            head, body = text, ""
        lines = head.splitlines()
        headers = {}
        h2 = {}
        for ln in lines[1:]:
            if ln.startswith(":"):
                k, _, v = ln[1:].partition(":")
                h2[":"+k.strip().lower()] = v.strip()
                continue
            if ":" in ln:
                k, v = ln.split(":", 1)
                k = k.strip().lower()
                v = v.strip()
                # duplicate CL: keep comma-joined (front uses first, back uses last)
                if k in headers and k == "content-length":
                    headers[k] = headers[k] + "," + v
                else:
                    headers[k] = v
        # H2 simulation: :method/:path pseudo-headers present
        is_h2 = any(k.startswith(":") for k in h2) or "http2-settings" in headers or "http2" in text.lower()[:200]
        fb, fhow = front_parse(headers, body)
        bb, bhow = back_parse(headers, body)
        smuggled = body[len(fb):] if len(body) > len(fb) else ""
        typ = classify(fhow, bhow, headers)
        if is_h2:
            typ = ("H2." + ("TE" if "TE" in bhow or "TE" in fhow else "CL")) + ("-obfuscated" if "obfuscated" in typ else "")
        crlf = "\r\n" in body or "%0d%0a" in body.lower()
        out = {
            "front": {"how": fhow, "body": fb[:500]},
            "back": {"how": bhow, "body": bb[:500]},
            "smuggled": smuggled[:800],
            "type": typ,
            "h2": is_h2,
            "pseudo": h2,
            "crlf": crlf,
            "flag": ("LAB{raw_" + typ.lower().replace(".", "_").replace("-", "_") + "}") if smuggled or typ not in ("none",) else None,
        }
        conn.sendall(json.dumps(out).encode() + b"\n")
    except Exception as e:
        try: conn.sendall(json.dumps({"error": str(e)[:300]}).encode() + b"\n")
        except: pass
    finally:
        try: conn.close()
        except: pass

def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", PORT))
    s.listen(50)
    print(f"raw smuggle oracle on {PORT}", flush=True)
    while True:
        c, _ = s.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()

if __name__ == "__main__":
    main()
