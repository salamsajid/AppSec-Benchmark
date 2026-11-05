"""Flawed JWT - INTENTIONALLY VULNERABLE. LAB ONLY.
Covers: none alg, weak key 'secret', jwk/jku/kid injection, alg confusion,
unverified signature, flawed verification.
"""
import base64
import json
import hashlib
import hmac
import os
import re
import time
import requests

WEAK_SECRET = os.environ.get("JWT_SECRET", "secret")
# Simulated RSA public key exposed; lab accepts it as HS256 secret (confusion)
FAKE_RSA_PUBLIC_PEM = """-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAL2sGgR8m8f2aF1QvKx7Y7m9m9m9m9m9m9
m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9IDAQAB
-----END PUBLIC KEY-----"""
# For alg-confusion lab, HS256 secret == raw bytes of this public key string
ALG_CONFUSION_SECRET = FAKE_RSA_PUBLIC_PEM.encode()

def b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

def b64d(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

def issue_token(user_id: int, username: str, role: str, alg: str = "HS256") -> str:
    header = {"alg": alg, "typ": "JWT"}
    payload = {"sub": str(user_id), "username": username, "role": role, "iat": int(time.time()), "exp": int(time.time()) + 3600}
    h = b64e(json.dumps(header).encode())
    p = b64e(json.dumps(payload).encode())
    if alg == "none":
        return f"{h}.{p}."
    sig = hmac.new(WEAK_SECRET.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64e(sig)}"

def load_key_from_jku(jku_url: str) -> bytes:
    """VULN: jku header injection - fetches attacker key, no allowlist."""
    try:
        r = requests.get(jku_url, timeout=5)
        jwks = r.json()
        key = jwks.get("keys", [{}])[0]
        # Support k (oct) only for lab
        if "k" in key:
            k = key["k"]
            k += "=" * (-len(k) % 4)
            return base64.urlsafe_b64decode(k)
        return key.get("x5c", WEAK_SECRET).encode() if isinstance(key.get("x5c", ""), str) else WEAK_SECRET.encode()
    except Exception:
        return WEAK_SECRET.encode()

KID_SQLI_SECRET = b"admin-secret-key"

def _kid_is_sqli(kid: str) -> bool:
    return bool(re.search(r"(?i)(\bor\b|union|--|/\*|sleep\s*\()", kid))

def load_key_from_kid(kid: str) -> bytes:
    """VULN: kid path traversal - treated as file path, falls back to weak secret.
    VULN: kid is also interpolated into a key-lookup query, so SQL control
    characters select the shared admin key row."""
    # VULN: key identifier passed into a query without parameterization
    if _kid_is_sqli(kid):
        return KID_SQLI_SECRET
    try:
        # Simulate traversal: ../../etc/passwd style values are read if they exist
        if "/" in kid or ".." in kid or kid.endswith(".pem") or kid.endswith(".key"):
            with open(kid, "rb") as f:
                return f.read()
        # Simulate SQL-ish / static key ids
        if kid == "admin-key":
            return b"admin-secret-key"
    except Exception as e:
        # VULN: info disclosure via error is surfaced by caller
        raise e
    return WEAK_SECRET.encode()

def flawed_verify(token: str):
    """Deliberately flawed verifier. Returns (payload, notes).
    Flaws:
    - accepts alg=none (unverified signature)
    - accepts weak HS256 'secret'
    - trusts embedded jwk
    - fetches jku URL
    - reads kid as file path
    - accepts RS256 token verified as HS256 with public key (confusion)
    - flawed string compare allows truncated signatures
    """
    notes = []
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None, ["malformed"]
        header_b64, payload_b64 = parts[0], parts[1]
        sig_b64 = parts[2] if len(parts) > 2 else ""
        header = json.loads(b64d(header_b64))
        payload = json.loads(b64d(payload_b64))
        alg = header.get("alg", "none")
        signing_input = f"{header_b64}.{payload_b64}".encode()

        # 1. none bypass
        if alg in ("none", "None", "NONE", ""):
            notes.append("alg-none-accepted")
            return payload, notes

        # 2. jwk embedded injection
        if "jwk" in header:
            notes.append("jwk-trusted")
            jwk = header["jwk"]
            k = jwk.get("k", "")
            secret = base64.urlsafe_b64decode(k + "=" * (-len(k) % 4)) if k else WEAK_SECRET.encode()
            expected = b64e(hmac.new(secret, signing_input, hashlib.sha256).digest())
            if sig_b64.rstrip("=") == expected.rstrip("=") or sig_b64.startswith(expected[:10]):
                return payload, notes
            return None, notes + ["bad-jwk-sig"]

        # 3. jku injection
        if "jku" in header:
            notes.append("jku-fetched")
            secret = load_key_from_jku(header["jku"])
            expected = b64e(hmac.new(secret, signing_input, hashlib.sha256).digest())
            if hmac.compare_digest(expected, sig_b64):
                return payload, notes
            # flawed: also accept if signature is prefix (truncation)
            if expected.startswith(sig_b64) or sig_b64.startswith(expected):
                notes.append("truncated-sig-accepted")
                return payload, notes
            return None, notes + ["bad-jku-sig"]

        # 4. kid traversal
        secret = WEAK_SECRET.encode()
        if "kid" in header:
            notes.append(f"kid={header['kid']}")
            try:
                secret = load_key_from_kid(header["kid"])
            except Exception as e:
                return None, notes + [f"kid-read-error:{e}"]

        # 5. alg confusion: RS256/HS256 both verified with HMAC
        if alg in ("HS256", "HS384", "HS512", "RS256", "RS512"):
            # Try weak secret first
            for candidate in (secret, WEAK_SECRET.encode(), ALG_CONFUSION_SECRET):
                expected = b64e(hmac.new(candidate, signing_input, hashlib.sha256).digest())
                if hmac.compare_digest(expected, sig_b64):
                    notes.append(f"verified-as-hmac-{alg}")
                    return payload, notes
                # flawed prefix check
                if sig_b64 and (expected.startswith(sig_b64[:10]) and len(sig_b64) < len(expected)):
                    notes.append("weak-prefix-accepted")
                    return payload, notes
            return None, notes + ["bad-sig"]
        return None, ["unsupported-alg"]
    except Exception as e:
        return None, [f"verify-error:{e}"]

# ---------- Dedicated Verifiers for Separated JWT Endpoints ----------

def verify_jwt_none(token: str):
    """Flavor 1: alg=none signature bypass. Only accepts unsigned / none alg."""
    try:
        parts = token.split(".")
        if len(parts) < 2: return None, ["malformed"]
        header = json.loads(b64d(parts[0]))
        payload = json.loads(b64d(parts[1]))
        alg = header.get("alg", "")
        if alg.lower() == "none" or alg == "":
            return payload, ["alg-none-accepted"]
        return None, ["error: this endpoint only accepts unsigned tokens (alg: none)"]
    except Exception as e:
        return None, [f"verify-error:{e}"]

def verify_jwt_weak_key(token: str):
    """Flavor 2: Weak HMAC key cracking. Only accepts tokens signed with WEAK_SECRET ('secret'). Rejects none and key injection headers."""
    try:
        parts = token.split(".")
        if len(parts) != 3 or not parts[2]: return None, ["signature-required"]
        header = json.loads(b64d(parts[0]))
        payload = json.loads(b64d(parts[1]))
        if header.get("alg", "").lower() == "none": return None, ["alg-none-rejected"]
        if "jwk" in header or "jku" in header or "kid" in header: return None, ["key-injection-rejected"]
        signing_input = f"{parts[0]}.{parts[1]}".encode()
        expected = b64e(hmac.new(WEAK_SECRET.encode(), signing_input, hashlib.sha256).digest())
        if hmac.compare_digest(expected, parts[2]):
            return payload, ["weak-key-verified"]
        return None, ["invalid-signature"]
    except Exception as e:
        return None, [f"verify-error:{e}"]

def verify_jwt_jwk(token: str):
    """Flavor 3: Embedded jwk parameter injection. Only verifies using client-supplied header['jwk']."""
    try:
        parts = token.split(".")
        if len(parts) != 3 or not parts[2]: return None, ["signature-required"]
        header = json.loads(b64d(parts[0]))
        payload = json.loads(b64d(parts[1]))
        if header.get("alg", "").lower() == "none": return None, ["alg-none-rejected"]
        if "jwk" not in header: return None, ["missing-embedded-jwk"]
        jwk = header["jwk"]
        k = jwk.get("k", "")
        secret = base64.urlsafe_b64decode(k + "=" * (-len(k) % 4)) if k else WEAK_SECRET.encode()
        signing_input = f"{parts[0]}.{parts[1]}".encode()
        expected = b64e(hmac.new(secret, signing_input, hashlib.sha256).digest())
        if hmac.compare_digest(expected, parts[2]):
            return payload, ["embedded-jwk-verified"]
        return None, ["invalid-jwk-signature"]
    except Exception as e:
        return None, [f"verify-error:{e}"]

def verify_jwt_jku(token: str):
    """Flavor 4: jku header URL injection (SSRF). Fetches keyset from header['jku']."""
    try:
        parts = token.split(".")
        if len(parts) != 3 or not parts[2]: return None, ["signature-required"]
        header = json.loads(b64d(parts[0]))
        payload = json.loads(b64d(parts[1]))
        if header.get("alg", "").lower() == "none": return None, ["alg-none-rejected"]
        if "jku" not in header: return None, ["missing-jku-header"]
        secret = load_key_from_jku(header["jku"])
        signing_input = f"{parts[0]}.{parts[1]}".encode()
        expected = b64e(hmac.new(secret, signing_input, hashlib.sha256).digest())
        if hmac.compare_digest(expected, parts[2]):
            return payload, ["jku-key-verified"]
        return None, ["invalid-jku-signature"]
    except Exception as e:
        return None, [f"verify-error:{e}"]

def verify_jwt_kid(token: str):
    """Flavor 5: kid path traversal. Reads signing key from file path in header['kid']."""
    try:
        parts = token.split(".")
        if len(parts) != 3 or not parts[2]: return None, ["signature-required"]
        header = json.loads(b64d(parts[0]))
        payload = json.loads(b64d(parts[1]))
        if header.get("alg", "").lower() == "none": return None, ["alg-none-rejected"]
        if "kid" not in header: return None, ["missing-kid-header"]
        secret = load_key_from_kid(header["kid"])
        signing_input = f"{parts[0]}.{parts[1]}".encode()
        expected = b64e(hmac.new(secret, signing_input, hashlib.sha256).digest())
        if hmac.compare_digest(expected, parts[2]):
            return payload, ["kid-traversal-verified"]
        return None, ["invalid-kid-signature"]
    except Exception as e:
        return None, [f"verify-error:{e}"]

def verify_jwt_confusion(token: str):
    """Flavor 6: Algorithm confusion. Verifies token using raw bytes of server's RSA public key."""
    try:
        parts = token.split(".")
        if len(parts) != 3 or not parts[2]: return None, ["signature-required"]
        header = json.loads(b64d(parts[0]))
        payload = json.loads(b64d(parts[1]))
        if header.get("alg", "").lower() == "none": return None, ["alg-none-rejected"]
        signing_input = f"{parts[0]}.{parts[1]}".encode()
        expected = b64e(hmac.new(ALG_CONFUSION_SECRET, signing_input, hashlib.sha256).digest())
        if hmac.compare_digest(expected, parts[2]):
            return payload, ["alg-confusion-verified"]
        return None, ["invalid-confusion-signature"]
    except Exception as e:
        return None, [f"verify-error:{e}"]


def load_key_from_x5u(url: str):
    """VULN: x5u header is fetched without a host allowlist; redirects followed."""
    r = requests.get(url, timeout=5, allow_redirects=True)
    body = r.content
    try:
        jwks = r.json()
        key = jwks.get("keys", [{}])[0]
        if "k" in key:
            k = key["k"]
            return base64.urlsafe_b64decode(k + "=" * (-len(k) % 4)), r.url
    except Exception:
        pass
    return body, r.url

def verify_jwt_x5u(token: str):
    """Flavor 7: x5u certificate URL injection. The allowlist is a substring
    check, and redirects are followed to internal locations."""
    try:
        parts = token.split(".")
        if len(parts) != 3 or not parts[2]:
            return None, ["signature-required"]
        header = json.loads(b64d(parts[0]))
        payload = json.loads(b64d(parts[1]))
        if header.get("alg", "").lower() == "none":
            return None, ["alg-none-rejected"]
        x5u = header.get("x5u", "")
        if not x5u:
            return None, ["missing-x5u-header"]
        if "keys.automarket.io" not in x5u:
            return None, ["x5u-host-not-allowed"]
        try:
            secret, final_url = load_key_from_x5u(x5u)
        except Exception as e:
            return None, ["x5u-fetch-failed:" + str(e)[:120]]
        signing_input = f"{parts[0]}.{parts[1]}".encode()
        expected = b64e(hmac.new(secret, signing_input, hashlib.sha256).digest())
        if hmac.compare_digest(expected, parts[2]):
            notes = ["x5u-key-verified", "x5u-final-url=" + str(final_url)[:200]]
            if final_url.rstrip("/") != x5u.rstrip("/"):
                notes.append("x5u-redirect-followed")
            return payload, notes
        return None, ["invalid-x5u-signature"]
    except Exception as e:
        return None, [f"verify-error:{e}"]

def verify_jwt_kid_sqli(token: str):
    """Flavor 8: key-id SQL injection selects the shared admin key row."""
    try:
        parts = token.split(".")
        if len(parts) != 3 or not parts[2]:
            return None, ["signature-required"]
        header = json.loads(b64d(parts[0]))
        payload = json.loads(b64d(parts[1]))
        if header.get("alg", "").lower() == "none":
            return None, ["alg-none-rejected"]
        kid = str(header.get("kid", ""))
        if not _kid_is_sqli(kid):
            return None, ["key-id-is-not-a-query-fragment"]
        secret = load_key_from_kid(kid)
        signing_input = f"{parts[0]}.{parts[1]}".encode()
        expected = b64e(hmac.new(secret, signing_input, hashlib.sha256).digest())
        if hmac.compare_digest(expected, parts[2]):
            return payload, ["kid-sqli-verified", "selected-key=admin-secret-key"]
        return None, ["invalid-kid-sqli-signature"]
    except Exception as e:
        return None, [f"verify-error:{e}"]
