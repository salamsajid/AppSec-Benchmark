"""UVP Serialization Lab - INTENTIONALLY VULNERABLE. LAB ONLY. Port 8000.
Cross-language deserialization surface: Python pickle/YAML, PHP object injection
and phar metadata, Java SnakeYAML, .NET BinaryFormatter detection.
"""
import base64
import binascii
import json
import os
import pickle
import re
import requests
from flask import Flask, jsonify, request

import yaml

app = Flask(__name__)
OOB_URL = os.environ.get("OOB_URL", "http://oob-collaborator:9000")

MARKERS = {
    "pickle": "/tmp/ser_pickle_pwned",
    "yaml": "/tmp/ser_yaml_pwned",
    "php": "/tmp/ser_php_pwned",
    "phar": "/tmp/ser_phar_pwned",
    "dotnet": "/tmp/ser_dotnet_pwned",
}


def _cleanup():
    for p in MARKERS.values():
        try:
            os.remove(p)
        except Exception:
            pass


@app.get("/health")
def health():
    return jsonify(ok=True, service="serialization-lab", formats=["pickle", "yaml", "php", "phar", "snakeyaml", "dotnet-binaryformatter"])


@app.post("/v1/internal/reset")
def reset():
    _cleanup()
    return jsonify(ok=True)


@app.post("/v1/session/restore")
def session_restore():
    """VULN: untrusted session blob passed to pickle.loads (RCE)."""
    data = (request.get_json(force=True, silent=True) or {}).get("data", "")
    if not data:
        return jsonify(error="data (base64 or raw pickle) required"), 400
    raw = data
    try:
        raw = base64.b64decode(data)
    except Exception:
        raw = data.encode("latin-1")
    result, error = None, None
    try:
        result = pickle.loads(raw)
    except Exception as e:
        error = str(e)[:300]
    pwned = os.path.exists(MARKERS["pickle"])
    flag = "LAB{pickle_rce}" if (pwned or "SER9" in repr(result)) else None
    return jsonify(ok=True, restored=str(result)[:500], error=error, flag=flag,
                   note="pickle.loads executed on the session blob" if pwned else "no gadget side effects observed")


@app.post("/v1/profile/import")
def profile_import():
    """VULN: yaml.load with the unsafe loader (python/object/apply RCE)."""
    body = request.get_json(force=True, silent=True) or {}
    raw = body.get("yaml", body.get("data", ""))
    if not raw:
        return jsonify(error="yaml payload required"), 400
    result, error = None, None
    try:
        result = yaml.load(raw, Loader=yaml.Loader)
    except Exception as e:
        error = str(e)[:300]
    pwned = os.path.exists(MARKERS["yaml"])
    flag = "LAB{yaml_rce}" if (pwned or (result is not None and "SER9" in str(result))) else None
    return jsonify(ok=True, imported=str(result)[:500], error=error, flag=flag)


_PROP_RE = re.compile(r'(?:s|i):\d+:\s*(?::"([^"]*)";.*?"([^"]*)")?', re.S)


def _php_props(inner):
    props = {}
    for m in re.finditer(r's:\d+:"([^"]+)";s:\d+:"([^"]*)";', inner):
        props[m.group(1)] = m.group(2)
    for m in re.finditer(r's:\d+:"([^"]+)";i:(-?\d+);', inner):
        props[m.group(1)] = int(m.group(2))
    return props


@app.post("/v1/object/import")
def php_object_import():
    """VULN: PHP-unserialize style object import with a FileCache write gadget."""
    data = (request.get_json(force=True, silent=True) or {}).get("data", "")
    if not data:
        return jsonify(error="PHP serialized payload required"), 400
    m = re.match(r'O:(\d+):"([^"]+)":(\d+):\{(.*)\}\s*$', data.strip(), re.S)
    if not m:
        return jsonify(error="invalid PHP serialized object (expected O:<len>:\"Class\":n:{...})"), 400
    cls = m.group(2)
    props = _php_props(m.group(4))
    written = None
    if "FileCache" in cls and props.get("path"):
        try:
            with open(props["path"], "w") as f:
                f.write(props.get("data", "pwned"))
            written = props["path"]
        except Exception as e:
            written = "write-failed:" + str(e)[:120]
    flag = "LAB{php_object_injection}" if (written and "FileCache" in cls) else None
    return jsonify(ok=True, class_name=cls, properties=props, written=written,
                   flag=flag, note="gadget executed on object import" if flag else "no FileCache gadget detected")


@app.post("/v1/phar/upload")
def phar_upload():
    """VULN: phar metadata deserialized when the uploaded archive is processed."""
    f = request.files.get("file")
    if not f:
        return jsonify(error="multipart field 'file' required"), 400
    blob = f.read()
    text = blob.decode("latin-1", errors="ignore")
    m = re.search(r'O:\d+:"([^"]+)":\d+:\{(.*?)\}', text, re.S)
    written = None
    if m and "FileCache" in m.group(1):
        props = _php_props(m.group(2))
        path = props.get("path") or MARKERS["phar"]
        try:
            with open(path, "w") as fh:
                fh.write(props.get("data", "pwned"))
            written = path
        except Exception as e:
            written = "write-failed:" + str(e)[:120]
    flag = "LAB{phar_deserialization}" if written else None
    return jsonify(ok=True, size=len(blob), metadata_class=(m.group(1) if m else None), written=written, flag=flag)


JAVA_GADGET_RE = re.compile(r"!!(?:javax\.|java\.|com\.sun\.)|jndi:(?:ldap|rmi|dns|http)s?://", re.I)


@app.post("/v1/yaml/rules")
def snakeyaml_rules():
    """VULN: SnakeYAML-style type instantiation from untrusted rule files (JNDI/OOB egress)."""
    body = request.get_json(force=True, silent=True) or {}
    raw = body.get("yaml", body.get("data", ""))
    if not raw:
        return jsonify(error="yaml rules payload required"), 400
    hit = JAVA_GADGET_RE.search(raw)
    egress = None
    if hit:
        for m in re.finditer(r'https?://[^\s"\'\]]+', raw):
            try:
                requests.post(OOB_URL + "/log", json={"serialization_oob": m.group(0)}, timeout=2)
                egress = m.group(0)
                break
            except Exception:
                pass
    return jsonify(ok=True, gadget=hit.group(0) if hit else None, oob_egress=egress,
                   flag="LAB{java_snakeyaml_rce}" if hit else None,
                   note="rule file instantiated arbitrary classes / triggered remote lookup" if hit else "no Java type tags found")


@app.post("/v1/dotnet/deserialize")
def dotnet_deserialize():
    """VULN: BinaryFormatter detection endpooint processing untrusted .NET payloads."""
    body = request.get_json(force=True, silent=True) or {}
    data = body.get("data", "")
    if not data:
        return jsonify(error="base64 BinaryFormatter payload required"), 400
    try:
        blob = base64.b64decode(data)
    except (binascii.Error, ValueError):
        return jsonify(error="data must be base64"), 400
    header = blob[:8] == b"\x00\x01\x00\x00\x00\xff\xff\xff\xff" or blob[:4] == b"\x00\x01\x00\x00"
    text = blob.decode("latin-1", errors="ignore")
    gadget = any(g in text for g in ("ObjectDataProvider", "TypeConfuseDelegate", "ProcessStartInfo", "System.Diagnostics.Process"))
    if header and gadget:
        try:
            open(MARKERS["dotnet"], "w").write("pwned")
        except Exception:
            pass
    return jsonify(ok=True, binaryformatter_header=header, gadget_tokens=gadget,
                   flag="LAB{dotnet_binaryformatter_rce}" if (header and gadget) else None,
                   note="BinaryFormatter payload with known gadget chain accepted" if (header and gadget) else "payload rejected as non-gadget")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
