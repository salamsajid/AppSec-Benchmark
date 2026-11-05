"""UVP Lead & Communication - INTENTIONALLY VULNERABLE. LAB ONLY.
Sec 1.3: adv-SQLi (UNION/OOB) / XXE / SSRF / CMDi / SSTI / WebSockets (via ws_server.py:5001).
"""
import os, re, sqlite3, time, subprocess, html, urllib.parse, base64, hashlib, hmac, json
import requests
from flask import Flask, request, jsonify, Response, send_file

app = Flask(__name__)
DB_PATH = os.environ.get("LEAD_DB", "/tmp/lead.db")
OOB_URL = os.environ.get("OOB_URL", "http://oob-collaborator:9000")

# VULN: permissive CORS
@app.after_request
def _cors(resp):
    o = request.headers.get("Origin")
    resp.headers["Access-Control-Allow-Origin"] = o if o else "*"
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    return resp

def get_conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    c = get_conn()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS inquiries (id INTEGER PRIMARY KEY, vehicle TEXT, message TEXT, seller TEXT, price REAL);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, email TEXT);
    CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY, title TEXT, body TEXT);
    """)
    if c.execute("SELECT COUNT(*) c FROM inquiries").fetchone()["c"] == 0:
        c.executemany("INSERT INTO inquiries (vehicle,message,seller,price) VALUES (?,?,?,?)", [
            ("Toyota Corolla", "Is this available?", "dealer1@lab.local", 12000),
            ("Honda Civic", "Best price?", "dealer2@lab.local", 16000),
            ("Ford Mustang", "Private sale", "private@lab.local", 45000),
            ("Porsche 911 GT3", "Interested in scheduling an appointment for certified mechanical inspection on Tuesday.", "marcus.vance@autohub.in", 185000),
            ("BMW M4 Competition", "Can we confirm clean Carfax and if the carbon ceramic package is included?", "elena.rostova@primemotors.in", 78500),
            ("Mercedes-AMG C63 S", "Is the vehicle eligible for 36-month UVP Premier Certified warranty?", "david.kim@citydrive.in", 69000),
            ("Tesla Model S Plaid", "Has the battery degradation health check been performed recently? What is the current range capacity?", "sarah.jenkins@sunrisecars.in", 86000),
            ("Audi RS5 Sportback", "Would you accept trade-in credit for a 2021 BMW M340i with 22k miles?", "raj.patel@galaxyauto.in", 72500),
            ("Toyota Fortuner 4x4", "Requesting doorstep concierge delivery to Bandra West, Mumbai.", "dealer1@lab.local", 32000),
            ("Hyundai Creta SX(O)", "Is the 100% money-back guarantee applicable if financed via Chase Premier?", "dealer3@lab.local", 14500),
            ("Tata Nexon EV Max", "Can you provide the home fast-charger installation voucher along with handover?", "dealer6@lab.local", 16500),
            ("Mahindra Thar 4x4", "Looking for hard-top variant with convertible swap kit. Any units in stock in Pune?", "dealer5@lab.local", 15500),
            ("BMW 3 Series M-Sport", "Customer pre-approved at 5.4% APR via UVP Capital. Ready to wire down payment.", "dealer19@lab.local", 38000),
            ("Mercedes-Benz C-Class", "Are all showroom service records stamped by authorized dealership?", "dealer20@lab.local", 42000),
            ("Audi A4 Technology", "Inquiring about corporate lease scheme and GST input tax credit invoice.", "dealer21@lab.local", 36000),
            ("Toyota Innova Crysta", "Looking for 7-seater luxury captain seat layout for VIP executive transport.", "dealer22@lab.local", 21000),
            ("Mahindra XUV700 AX7L", "Does this unit have the Sony 3D surround sound system and blind-view monitors?", "dealer23@lab.local", 18500),
            ("Skoda Kushaq Style", "What is the remaining factory warranty on the DSG dual-clutch transmission?", "dealer14@lab.local", 13500),
            ("Volkswagen Virtus GT", "Interested in test driving on the Western Express Highway tomorrow morning.", "dealer15@lab.local", 11500),
            ("Jeep Compass Model S", "Need confirmation on 4x4 low range gearbox servicing status.", "dealer16@lab.local", 18500),
            ("Honda City ZX CVT", "Looking to finalize purchase before month end to take advantage of dealer rebate.", "dealer9@lab.local", 9500),
            ("Kia Seltos GTX Plus", "Requesting trade-in quote for 2019 Maruti Suzuki Swift VXi.", "dealer7@lab.local", 13500),
            ("MG Hector Sharp Pro", "Can we arrange video walkaround inspection via WhatsApp or Zoom?", "dealer13@lab.local", 15500),
            ("Tesla Model 3 Performance", "Inquiring about Autopilot hardware version 4 and winter tire package.", "vip@lab.local", 35000),
            ("Ford Mustang 1967 Fastback", "Is the matching-numbers 289 V8 engine documented by Marti Report?", "private@lab.local", 45000),
            ("Maruti Suzuki Baleno Alpha", "Is zero-down financing available for IT professionals in Bengaluru?", "dealer10@lab.local", 7800),
            ("Hyundai Verna Turbo DCT", "Are matte black factory alloy wheels included in the displayed showroom price?", "dealer11@lab.local", 11500)
        ])
        c.executemany("INSERT INTO users (username,password,email) VALUES (?,?,?)", [
            ("administrator", "admin123", "admin@used-vehicles.lab"),
            ("carlos", "montoya", "carlos@used-vehicles.lab"),
            ("wiener", "peter", "wiener@used-vehicles.lab"),
            ("marcus.vance", "Vance@2026Auto", "marcus.vance@autohub.in"),
            ("elena.rostova", "ElenaPrime#99", "elena.rostova@primemotors.in"),
            ("david.kim", "KimCityDrive$24", "david.kim@citydrive.in"),
            ("sarah.jenkins", "SunriseSarah!1", "sarah.jenkins@sunrisecars.in"),
            ("raj.patel", "GalaxyRaj*88", "raj.patel@galaxyauto.in"),
            ("vikram.mehta", "ApexVikram@2026", "vikram.mehta@apexluxury.in"),
            ("priya.deshmukh", "DeccanPriya#44", "priya.deshmukh@deccancertified.com"),
            ("anand.verma", "HeritageAnand!9", "anand.verma@heritageclassics.in"),
            ("jordan.hayes", "HayesExec!2026", "jordan.hayes@used-vehicles.lab"),
            ("claire.redfield", "RedfieldAudit#1", "claire.redfield@used-vehicles.lab"),
            ("alex.chen", "ChenFinance$77", "alex.chen@uvpcapital.com"),
            ("sophia.martinez", "SophiaPricing%23", "sophia.martinez@used-vehicles.lab"),
            ("kevin.mitnick", "GhostInWire#88", "kevin.mitnick@security.lab"),
            ("emily.watson", "EmilyW@2026", "emily.watson@gmail.com"),
            ("michael.chang", "ChangTech#12", "michael.chang@outlook.com"),
            ("olivia.taylor", "OliviaT$99", "olivia.taylor@icloud.com"),
            ("lucas.silva", "LucasSilva!7", "lucas.silva@techcorp.io"),
            ("arjun.sharma", "ArjunS@Drive", "arjun.sharma99@gmail.com"),
            ("daniel.evans", "EvansDan#2026", "devans@mobilitypartners.com"),
            ("hannah.baker", "HannahB$33", "hbaker@designstudio.net"),
            ("samuel.green", "GreenCap*44", "sam.green@greencapital.com"),
            ("zack.morris", "ZackMorris!Bayside", "zack.m@pacificventures.com"),
            ("natalie.portman", "NatalieP#Creative", "natalie.p@hollywoodcreative.com"),
            ("rohit.malhotra", "RohitM@Delhi", "rohit.malhotra@delhitech.in"),
            ("kavya.nair", "KavyaN#Kochi", "kavya.nair@keralabio.org"),
            ("sanjay.singh", "SanjayS$Pune", "sanjay.singh@puneglobal.com"),
            ("meera.joshi", "MeeraJ!Ahmedabad", "meera.joshi@ahmedabadtextiles.com")
        ])
        c.executemany("INSERT INTO reports (title,body) VALUES (?,?)", [
            ("Q3 margins", "confidential"),
            ("Repo list", "confidential repos"),
            ("Q3 Regional Inventory Liquidity & Residual Index", "Quarterly residual retention improved by 4.2% across luxury German marques. EV inventory turnover averaged 19 days in tier-1 metro areas."),
            ("Luxury EV Fleet Depreciation Forecast 2026-2027", "Analysis indicates high demand for tri-motor electric sedans with battery health exceeding 94%. Projected 3-year depreciation capped at 28%."),
            ("Automated Title Transfer & Escrow Audit Findings", "100% digital title transfers verified across 280 participating dealerships with zero lien discrepancies detected by registry webhooks."),
            ("Wholesale Tier-1 Dealership Settlement Ledger", "Consignment auction volumes reached $4.8M this cycle. B2B settlement turnaround averaged under 4 hours via automated ACH rails."),
            ("Floorplan Lending Risk & Repo Valuation Audit", "Low delinquency index maintained at 0.18%. Floorplan credit lines expanded for top performing dealerships in Western and Northern zones."),
            ("Doorstep Concierge Test-Drive Logistics Metric Report", "98.4% customer satisfaction rating recorded across 1,420 home test-drive appointments with average delivery lead time under 90 minutes.")
        ])
    c.commit(); c.close()
init_db()

FLEET_SECRET_PATH = "/tmp/fleet-secret.key"
try:
    with open(FLEET_SECRET_PATH, "w") as _fk:
        _fk.write("FLEET-TOKEN-7729-ALPHA\n")
except Exception:
    pass

def oob_log(note, url=None):
    try:
        requests.post(f"{OOB_URL}/log", json={"lead_oob": note, "url": url}, timeout=2)
    except Exception:
        pass

def emulate_version(payload):
    p = payload.lower()
    if "v$version" in p or "oracle" in p:
        return {"db": "Oracle 19c (emulated)", "version": "Oracle Database 19c Enterprise Edition Release 19.0.0.0.0"}
    if "@@version" in p and ("microsoft" in p or "mssql" in p or "xp_" in p):
        return {"db": "Microsoft SQL Server 2019 (emulated)", "version": "Microsoft SQL Server 2019 - 15.0.2000.5"}
    if "@@version" in p or "information_schema" in p or "mysql" in p:
        return {"db": "MySQL 8.0 (emulated)", "version": "8.0.36-0ubuntu0.22.04.1"}
    if "sqlite_version" in p:
        return {"db": "SQLite (real)", "version": sqlite3.sqlite_version}
    return None

# ---------- basic ----------
@app.get("/health")
def health(): return jsonify(ok=True, service="lead-lab")

@app.get("/version")
def version():
    return jsonify(db="SQLite + MySQL/Oracle/MSSQL emulated", sqlite=sqlite3.sqlite_version,
                   hint="try ?id=1 UNION SELECT @@version-- / v$version / sqlite_version()")

# ---------- Advanced SQLi ----------
def run_raw(query, fetch=True):
    """VULN: executes raw query, verbose errors, UNION/OOB/timeout simulation."""
    # OOB simulation: if payload references http/oob/collaborator, fetch it server-side
    for m in re.findall(r"https?://[^\s'\"<>]+", query):
        if "oob" in m or "collaborator" in m or "9000" in m or "evil" in m or "attacker" in m:
            try: requests.get(m, timeout=3)
            except Exception: pass
            oob_log(f"sql-oob:{m[:120]}", m)
    # XML-encoding bypass: decode &#x..; then re-check (filter bypass lab)
    if "&#x" in query or "&#" in query:
        try:
            dec = html.unescape(query)
            if dec != query:
                for m in re.findall(r"https?://[^\s'\"<>]+", dec):
                    try: requests.get(m, timeout=3)
                    except Exception: pass
        except Exception: pass
    # Time-delay simulation for WAITFOR/SLEEP/pg_sleep/DBMS_LOCK
    mm = re.search(r"SLEEP\s*\(\s*(\d+)", query, re.I) or re.search(r"pg_sleep\s*\(\s*(\d+)", query, re.I)
    if mm: time.sleep(min(int(mm.group(1)), 5))
    if re.search(r"WAITFOR\s+DELAY", query, re.I): time.sleep(3)
    if re.search(r"DBMS_LOCK\.SLEEP|DBMS_PIPE", query, re.I): time.sleep(3)
    # Stacked-query simulation: sqlite execute only runs first; emulate second via executescript note
    c = get_conn()
    try:
        if fetch:
            rows = c.execute(query).fetchall()
            return [dict(r) for r in rows], None
        else:
            c.executescript(query)
            c.commit()
            return [], None
    except Exception as e:
        return None, str(e)

@app.get("/inquiry")
def inquiry():
    iid = request.args.get("id", "1")
    q = f"SELECT id, vehicle, message, seller FROM inquiries WHERE id = '{iid}'"
    # information_schema emulation first (MySQL listing) - before version fingerprint
    if "information_schema" in iid.lower():
        # try real UNION if it parses, else emulated listing
        rows, err = run_raw(q)
        if not err and rows:
            return jsonify(query=q, count=len(rows), results=rows, tables=["inquiries", "users", "reports"],
                           note="UNION over information_schema (emulated listing + real rows)")
        return jsonify(query=q, tables=["inquiries", "users", "reports"],
                       note="MySQL info_schema emulated; try UNION SELECT table_name,2,3,4 FROM information_schema.tables--")
    # version/type fingerprint emulation
    em = emulate_version(iid)
    if em: return jsonify(query=q, fingerprint=em, note="UNION SELECT @@version / v$version / sqlite_version()")
    # UNION column-count helper: try ORDER BY / UNION NULLs, return real rows or error
    rows, err = run_raw(q)
    if err: return jsonify(error="inquiry lookup failed"), 500
    return jsonify(query=q, count=len(rows), results=rows)

@app.get("/report")
def report():
    sort = request.args.get("sort", "id")
    # VULN: ORDER BY injection (determine columns via ORDER BY n--, UNION)
    q = f"SELECT id, title, body FROM reports ORDER BY {sort}"
    rows, err = run_raw(q)
    if err: return jsonify(error="report generation failed"), 500
    return jsonify(query=q, results=rows)

@app.post("/search-advanced")
def search_adv():
    data = request.get_json(force=True, silent=True) or {}
    f = data.get("filter", "")
    q = f"SELECT id, vehicle, message, seller, price FROM inquiries WHERE vehicle LIKE '%{f}%'"
    # GROUP_CONCAT / multi-value single-column demo
    if "group_concat" in f.lower():
        q2 = "SELECT GROUP_CONCAT(username || ':' || password, ', ') v FROM users"
        rows, err = run_raw(q2)
        if not err: return jsonify(query=q2, exfiltrated=rows, flag="LAB{sqli_multi_value}")
    rows, err = run_raw(q)
    if err: return jsonify(error=err, query=q), 500
    return jsonify(query=q, results=rows)

@app.get("/oob-sql")
def oob_sql():
    p = request.args.get("payload", "")
    # Simulate Oracle UTL_HTTP / MSSQL xp_dirtree / MySQL LOAD_FILE OOB exfil
    urls = re.findall(r"https?://[^\s'\"<>]+", p) + re.findall(r"https?://[^\s'\"<>]+", html.unescape(p))
    fetched = []
    for u in urls:
        try:
            r = requests.get(u, timeout=4)
            fetched.append({"url": u, "status": r.status_code, "len": len(r.content)})
        except Exception as e:
            fetched.append({"url": u, "error": str(e)[:150]})
        oob_log(f"oob-sql:{u[:120]}", u)
    # LOAD_FILE / data exfil simulation
    exfil = None
    if "load_file" in p.lower() or "utl_http" in p.lower() or "xp_dirtree" in p.lower():
        try:
            exfil = open("/secret.txt").read()[:200]
        except Exception:
            exfil = open("secret.txt").read()[:200] if os.path.exists("secret.txt") else "no-secret"
    return jsonify(payload=p, fetched=fetched, exfiltrated_file=exfil,
                   flag="LAB{sqli_oob}" if fetched else None)

# ---------- XXE ----------
def parse_xxe(xml_raw):
    """VULN XXE: lxml resolve_entities + network + XInclude + manual file/SSRF/OOB fallback."""
    # Manual OOB fetch for blind parameter-entity / external DTD cases (even if lxml blocked)
    for m in re.findall(r'SYSTEM\s+"(https?://[^"]+)"', xml_raw):
        try: requests.get(m, timeout=3)
        except Exception: pass
        oob_log(f"xxe-oob-dtd:{m[:120]}", m)
    # Manual file read simulation for <!ENTITY xxe SYSTEM "file://...">
    manual_file = None
    fm = re.search(r'SYSTEM\s+"file://([^"]+)"', xml_raw)
    if fm:
        fp = fm.group(1)
        for cand in (fp, "/" + fp.lstrip("/"), os.path.join("/", fp.lstrip("/"))):
            try:
                manual_file = open(cand).read()[:2000]
                if manual_file: break
            except Exception: continue
    # Try lxml real parse
    parsed = {}
    lxml_out = None
    try:
        from lxml import etree
        parser = etree.XMLParser(resolve_entities=True, no_network=False, load_dtd=True, dtd_validation=False)
        root = etree.fromstring(xml_raw.encode(), parser=parser)
        # XInclude processing (vuln)
        try: root.xinclude()
        except Exception: pass
        parsed = {c.tag.split("}")[-1]: (c.text or "") for c in root}
        # lxml already expanded file entities into text if resolvable
        lxml_out = {k: (v[:2000] if isinstance(v, str) else v) for k, v in parsed.items()}
    except Exception as e:
        lxml_out = {"parser_error": str(e)[:500]}  # error-based XXE disclosure
    # XInclude fallback: <xi:include href="file:///etc/passwd" parse="text"/>
    if "xi:include" in xml_raw or "XInclude" in xml_raw:
        hm = re.search(r'href="file://([^"]+)"', xml_raw)
        if hm and not manual_file:
            try: manual_file = open("/" + hm.group(1).lstrip("/")).read()[:2000]
            except Exception as e: manual_file = f"xinclude-error:{e}"
    return parsed, lxml_out, manual_file

@app.post("/contact-xml")
def contact_xml():
    raw = request.get_data(as_text=True) or ""
    if not raw: return jsonify(error="send XML body"), 400
    parsed, lxml_out, manual_file = parse_xxe(raw)
    # SSRF via XXE: fetch http entities server-side (already done for OOB, also for 169.254)
    ssrf = None
    hm = re.search(r'SYSTEM\s+"(http://[^"]+)"', raw)
    if hm:
        try:
            r = requests.get(hm.group(1), timeout=4)
            ssrf = {"url": hm.group(1), "status": r.status_code, "body_head": r.text[:500]}
        except Exception as e:
            ssrf = {"url": hm.group(1), "error": str(e)[:200]}
    resp = {"parsed": parsed, "lxml": lxml_out}
    if manual_file: resp["file_content"] = manual_file; resp["flag"] = "LAB{xxe_file_read}"
    if ssrf: resp["ssrf"] = ssrf; resp["flag"] = "LAB{xxe_ssrf}"
    if "oob" in raw or "collaborator" in raw or "%" in raw and "ENTITY" in raw:
        resp["oob_note"] = "external DTD / param entity fetched (check /oob/logs or :9000/logs)"
        resp["flag"] = resp.get("flag", "LAB{xxe_oob}")
    return jsonify(resp)

@app.post("/upload-svg")
def upload_svg():
    f = request.files.get("file")
    if not f: return jsonify(error="multipart file field required"), 400
    raw = f.read().decode(errors="replace")
    parsed, lxml_out, manual_file = parse_xxe(raw)
    r = {"filename": f.filename, "parsed": parsed, "lxml": lxml_out}
    if manual_file: r["file_content"] = manual_file; r["flag"] = "LAB{xxe_svg_upload}"
    return jsonify(r)

@app.get("/dtd/evil.dtd")
def evil_dtd():
    try: return Response(open("evil.dtd").read(), mimetype="application/xml-dtd")
    except Exception: return Response(open("/code/evil.dtd").read(), mimetype="application/xml-dtd")

@app.get("/dtd/local")
def local_dtd():
    return jsonify(local_files=["/usr/share/xml/docbook/4.5/docbookx.dtd", "/secret.txt", "/etc/passwd"])

@app.get("/v1/integrations/validate-dtd")
def validate_dtd():
    """Partner-feed onboarding: validates a sample document against a caller-supplied DTD."""
    dtd_url = request.args.get("dtd_url", "")
    sample = request.args.get("sample", "<feed><item>demo</item></feed>")
    if not dtd_url:
        return jsonify(error="missing dtd_url"), 400
    try:
        dtd_text = requests.get(dtd_url, timeout=5).text[:5000]
    except Exception as e:
        return jsonify(error=f"could not fetch DTD: {str(e)[:120]}"), 400
    oob_log(f"xxe-oob-dtd:{dtd_url[:120]}", dtd_url)
    # VULN: the fetched DTD is trusted blindly - external parameter entities
    # are resolved server-side with no allowlist (blind OOB channel)
    wrapper = f'<?xml version="1.0"?><!DOCTYPE r [<!ENTITY % ext SYSTEM "{dtd_url}"> %ext;]><r><sample>{sample}</sample></r>'
    parsed, lxml_out, manual_file = parse_xxe(wrapper)
    out = {"dtd_bytes": len(dtd_text), "parsed": parsed, "lxml": lxml_out}
    if manual_file:
        out["file_content"] = manual_file
    return jsonify(out)

# ---------- SSRF ----------
def ssrf_fetch(url, label=""):
    if url.startswith("file://"):
        fp = url[7:]
        try: return {"url": url, "file_content": open(fp).read()[:2000], "flag": "LAB{ssrf_file}"}
        except Exception as e: return {"url": url, "error": str(e)[:200]}
    try:
        r = requests.get(url, timeout=5, allow_redirects=True)
        oob_log(f"ssrf-{label}:{url[:120]}", url)
        return {"url": url, "final_url": r.url, "status": r.status_code, "len": len(r.content), "body_head": r.text[:800]}
    except Exception as e:
        return {"url": url, "error": str(e)[:300]}

@app.get("/fetch")
def fetch():
    url = request.args.get("url", "")
    if not url: return jsonify(error="missing url parameter"), 400
    out = ssrf_fetch(url, "basic")
    if out.get("status") == 200: out["flag"] = out.get("flag", "LAB{ssrf_basic}")
    return jsonify(out)

@app.post("/preview")
def preview():
    data = request.get_json(force=True, silent=True) or {}
    url = data.get("image_url", "") or data.get("url", "")
    if not url: return jsonify(error="need image_url"), 400
    out = ssrf_fetch(url, "blind")
    # blind: only status/len (attacker infers via OOB logs at :9000/logs)
    return jsonify(status=out.get("status"), len=out.get("len"), final_url=out.get("final_url"),
                   error=out.get("error"), oob="check OOB logs for blind detection", flag="LAB{ssrf_blind}" if out.get("status") else None)

@app.get("/fetch-filtered")
def fetch_filtered():
    url = request.args.get("url", "")
    # allowlist: only the storefront CDN may be fetched (anchored at start only)
    import re as _re
    if not _re.match(r"https?://cdn\.autmarket\.", url):
        return jsonify(error="only official CDN links (cdn.autmarket.*) may be imported"), 403
    out = ssrf_fetch(url, "filtered-bypass")
    if out.get("status") == 200 or out.get("file_content"): out["flag"] = "LAB{ssrf_filter_bypass}"
    return jsonify(out)

@app.get("/redirect")
def open_redirect():
    to = request.args.get("to", request.args.get("url", "/"))
    return Response(status=302, headers={"Location": to})

@app.get("/shellshock")
def shellshock():
    url = request.args.get("url", "")
    if not url: return jsonify(error="missing url parameter"), 400
    headers = {"User-Agent": "() { :; }; echo; /bin/id", "Referer": "() { :; }; /bin/cat /etc/passwd"}
    try:
        r = requests.get(url, timeout=5, headers=headers)
        return jsonify(sent_headers=headers, status=r.status_code, body_head=r.text[:500], flag="LAB{ssrf_shellshock}")
    except Exception as e:
        return jsonify(sent_headers=headers, error=str(e)[:300]), 500

# ---------- OS command injection ----------
def strip_metachars(s):
    """Naive input filter: strips command separators but misses newline injection."""
    s = (s or "").replace("\r", "")
    for bad in (";", "&&", "||", "|", "&", "`", "$(", "$"):
        s = s.replace(bad, "")
    return s

def run_cmd(template_label, user_input):
    """VULN: shell=True with user input interpolated."""
    # OOB simulation for curl/wget/nslookup/dig/ping to attacker
    for m in re.findall(r"https?://[^\s;'\"`$()|&]+", user_input):
        try: requests.get(m, timeout=3)
        except Exception: pass
        oob_log(f"cmdi-oob:{m[:120]}", m)
    return user_input

@app.get("/pdf")
def pdf():
    return pdf_for(request.args.get("vehicle_id", "1"))

def pdf_for(vid):
    vid = strip_metachars(vid)
    run_cmd("pdf", vid)
    # VULN: filtered interpolation, but newline still splits commands
    cmd = f"echo 'Invoice for vehicle {vid}' > /tmp/invoice.txt && cat /tmp/invoice.txt"
    try:
        out = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=8)
        return jsonify(cmd=cmd, stdout=out.stdout[:2000], stderr=out.stderr[:500],
                       flag="LAB{cmdi_simple}" if ("uid=" in out.stdout or "pwn" in out.stdout.lower() or "\n" in vid) else None)
    except subprocess.TimeoutExpired:
        return jsonify(cmd=cmd, note="timeout (blind time-delay?)", flag="LAB{cmdi_blind_time}")
    except Exception as e:
        return jsonify(error=str(e)[:300]), 500

@app.get("/ping")
def ping():
    return ping_host(request.args.get("host", "127.0.0.1"))

def ping_host(host):
    host = strip_metachars(host)
    run_cmd("ping", host)
    cmd = f"ping -c1 {host}"
    try:
        out = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        combined = (out.stdout + out.stderr)[:2000]
        # output-redirection detection
        redirected = ">" in host
        return jsonify(cmd=cmd, output=combined,
                       flag="LAB{cmdi_blind}" if ("uid=" in combined or "PING" in combined) else None,
                       redirect_note="/tmp/pwned? check output redirection" if redirected else None)
    except subprocess.TimeoutExpired:
        return jsonify(cmd=cmd, note="timeout -> blind time-delay success?", flag="LAB{cmdi_time}"), 200
    except Exception as e:
        return jsonify(error=str(e)[:300]), 500

@app.post("/export")
def export():
    data = request.get_json(force=True, silent=True) or {}
    filename = strip_metachars(data.get("filename", "leads.csv"))
    content = strip_metachars(data.get("content", "id,vehicle"))
    run_cmd("export", filename + " " + content)
    # VULN: filtered interpolation, but newline still splits commands
    cmd = f"echo '{content}' > exports/{filename} && ls -l exports/ | head"
    try:
        out = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=8)
        return jsonify(cmd=cmd, stdout=out.stdout[:2000], stderr=out.stderr[:500], flag="LAB{cmdi_export}")
    except Exception as e:
        return jsonify(error=str(e)[:300]), 500

# ---------- SSTI ----------
# Naive template filter: blocks the obvious expression syntax and well-known
# object-graph words. Statement tags ({% %}) are still evaluated.
SSTI_BLOCKED = ["{{", "}}", "__", "config", "os.", "popen", "subprocess",
                "system", "eval", "import", "class", "mro", "request", "self",
                "lipsum", "cycler", "joiner", "namespace", "attr", "chr"]
def ssti_check(*parts):
    blob = " ".join(str(p) for p in parts)
    low = blob.lower()
    return next((b for b in SSTI_BLOCKED if b in low), None)

@app.get("/greet")
def greet():
    from jinja2 import Template
    name = request.args.get("name", "guest")
    hit = ssti_check(name)
    if hit:
        return jsonify(error=f"invalid characters in name"), 400
    # VULN: direct string concat into template; statement tags still evaluate
    try:
        out = Template(f"Hello {name}!").render()
        return jsonify(template=f"Hello {name}!", rendered=out,
                       flag="LAB{ssti_basic}" if "PWNED" in out else None)
    except Exception:
        return jsonify(error="template rendering failed"), 500  # no detail leak

@app.post("/email-template")
def email_template():
    from jinja2 import Template
    data = request.get_json(force=True, silent=True) or {}
    name = data.get("name", "dealer")
    message = data.get("message", "new lead")
    hit = ssti_check(name, message)
    if hit:
        return jsonify(error="invalid characters in template"), 400
    # VULN: code-context SSTI (inside {% if %}); statement tags still evaluate
    tpl = "{% if user %}Dear " + name + ", " + message + "{% endif %}"
    try:
        out = Template(tpl).render(user=True)
        r = {"template": tpl[:300], "rendered": out[:2000]}
        if "PWNED" in out:
            r["flag"] = "LAB{ssti_code_context}"
        return jsonify(r)
    except Exception:
        return jsonify(error="template rendering failed"), 500

@app.post("/invoice-render")
def invoice_render():
    from jinja2 import Template
    data = request.get_json(force=True, silent=True) or {}
    dealer = data.get("dealer", "dealer")
    total = data.get("total", "100")
    hit = ssti_check(dealer, total)
    if hit:
        return jsonify(error="invalid characters in invoice"), 400
    # VULN: unsandboxed render; statement tags still evaluate
    tpl = f"Invoice for {dealer}: total {total}"
    try:
        out = Template(tpl).render()
        r = {"rendered": out[:2000]}
        if "PWNED" in out:
            r["flag"] = "LAB{ssti_sandbox_escape}"
        return jsonify(r)
    except Exception:
        return jsonify(error="template rendering failed"), 500

# ---------- WS info + history (real WS in ws_server.py:5001) ----------
CHAT_LOG = []

@app.get("/ws-info")
def ws_info():
    return jsonify(ws_url="ws://lead:5001/chat (gateway: ws://localhost:8080/api/lead/ws/)",
                   http_history="/chat-history",
                   protocol="JSON messages: {type, text, to} / {type:admin, action} / {type:search, q} / {user_id}")

@app.get("/chat-history")
def chat_history():
    try:
        import json as _j
        rows = _j.load(open("/tmp/ws-chat.json")) if os.path.exists("/tmp/ws-chat.json") else []
    except Exception:
        rows = []
    return jsonify(messages=rows + CHAT_LOG)

@app.get("/api/docs")
def docs():
    return jsonify(service="lead-messaging", version="1.9.0",
                   endpoints=["GET /inquiry", "GET /report", "POST /inquiries/search",
                              "POST /contact", "GET /fetch", "GET /brochure", "GET /greet",
                              "POST /email-template", "GET /chat-history"])


# ============================================================================
# Production façade (public benchmark surface). Realistic marketplace routes.
# Legacy paths keep working but are undocumented (regression only).
# ============================================================================

@app.get("/v1/inquiries")
def v1_inquiry():
    return inquiry()

@app.get("/v1/market/report")
def v1_report():
    return report()

@app.post("/v1/inquiries/search")
def v1_search_adv():
    return search_adv()

@app.post("/v1/dealers/<int:dealer_id>/contact")
def v1_dealer_contact(dealer_id):
    """Buyer → dealer message. Accepts JSON normally; XML bodies (CRM import
    format) go through the document parser."""
    ctype = request.headers.get("Content-Type", "")
    if "xml" in ctype or (request.get_data() or b"").lstrip().startswith(b"<"):
        return contact_xml()
    data = request.get_json(force=True, silent=True) or {}
    return jsonify(ok=True, dealer=dealer_id, message=data.get("message", ""))

@app.post("/v1/listings/<vid>/badge")
def v1_badge(vid):
    """Dealer badge/SVG logo upload for a listing."""
    return upload_svg()

@app.get("/v1/listings/import-photos")
def v1_import_photos():
    """Import listing photos from a URL."""
    return fetch_filtered()

@app.post("/v1/listings/photo-preview")
def v1_photo_preview():
    return preview()

@app.get("/v1/share/go")
def v1_share_go():
    to = request.args.get("to", request.args.get("url", "/"))
    return Response(status=302, headers={"Location": to})

@app.get("/v1/listings/<vid>/brochure.pdf")
def v1_brochure(vid):
    return pdf_for(request.args.get("listing_id", request.args.get("vehicle_id", vid)))

@app.get("/v1/dealers/verify-domain")
def v1_verify_domain():
    return ping_host(request.args.get("domain", request.args.get("host", "127.0.0.1")))

@app.post("/v1/account/export")
def v1_export():
    return export()

@app.get("/v1/welcome")
def v1_welcome():
    return greet()

@app.post("/v1/dealers/email-template")
def v1_email_template():
    return email_template()

@app.post("/v1/orders/<oid>/invoice")
def v1_invoice(oid):
    return invoice_render()

# ---------- Chain 3: Customer Concierge -> Dealer Briefing SSTI ----------
@app.get("/v1/dealers/concierge/briefing")
def v1_dealer_briefing():
    """Dealer dispatch briefing generator. Pulls customer concierge notes and renders dispatcher briefing template."""
    from jinja2 import Template
    booking_id = request.args.get("booking_id", "BK-101")
    dealer_id = request.args.get("dealer_id", "7")
    instructions = request.args.get("custom_instructions")
    
    vehicle_id = "4"
    customer_name = "VIP Customer"
    if not instructions:
        try:
            r = requests.get(f"http://catalog:3000/v1/customers/concierge/bookings/{booking_id}", timeout=3)
            if r.status_code == 200:
                b = r.json().get("booking", {})
                instructions = b.get("customInstructions", "")
                vehicle_id = b.get("vehicleId", "4")
                customer_name = b.get("customerName", "VIP Customer")
        except Exception:
            instructions = "Standard white-glove inspection & battery charge check."
            
    instructions = instructions or "Standard concierge test-drive briefing"
    
    # VULN (Chain 3 Step 2): Second-Order SSTI - renders unsanitized instructions stored from customer booking
    tpl = f"""
    <div class="briefing-sheet">
      <h1>VIP Test-Drive Concierge Briefing</h1>
      <p><b>Dealer Assigned:</b> {dealer_id}</p>
      <p><b>Booking Reference:</b> {booking_id}</p>
      <p><b>Target Vehicle:</b> {vehicle_id}</p>
      <p><b>Customer:</b> {customer_name}</p>
      <div class="customer-instructions">
        <h3>Special Customer Request:</h3>
        <blockquote>{instructions}</blockquote>
      </div>
    </div>
    """
    try:
        rendered = Template(tpl).render(
            dealer_id=dealer_id,
            booking_id=booking_id,
            vehicle_id=vehicle_id,
            customer_name=customer_name
        )
    except Exception as e:
        rendered = f"Briefing generation error: {e}"
        
    res = {
        "ok": True,
        "booking_id": booking_id,
        "rendered_briefing": rendered
    }
    # Award flag when template expressions are evaluated
    if "{{" in instructions and ("49" in rendered or "secret" in rendered.lower() or "flag" in rendered.lower() or "root" in rendered.lower() or "automarket" in rendered.lower()):
        res["flag"] = "LAB{customer_dealer_second_order_ssti_chain}"
    return jsonify(res)

# ---------- Chain 4: Dealer Fleet Telemetry & Manifest Ingestion ----------
@app.get("/v1/dealers/telemetry/download")
def v1_telemetry_download():
    """VULN (Chain 4 Step 1): Path traversal allows downloading internal fleet secret key."""
    raw_file = request.args.get("file", "sample-telemetry.csv")
    
    target = raw_file
    if "...." in target:
        target = target.replace("....//", "../").replace("..../", "../")
    elif "%25" in target:
        target = urllib.parse.unquote(urllib.parse.unquote(target))
    else:
        target = target.replace("../", "")
        
    full_path = target if target.startswith("/") else os.path.join("/tmp", target)
    try:
        with open(full_path, "r", errors="ignore") as f:
            content = f.read()
        return jsonify(ok=True, file=raw_file, content=content[:2000])
    except Exception as e:
        return jsonify(error=f"Telemetry file not found: {e}"), 404

@app.post("/v1/dealers/telemetry/manifest")
def v1_telemetry_manifest():
    """VULN (Chain 4 Step 2): Fleet manifest ingestion gated by discovered X-Fleet-Token; vulnerable to XXE."""
    token = request.headers.get("X-Fleet-Token", "")
    
    expected_token = "FLEET-TOKEN-7729-ALPHA"
    if os.path.exists(FLEET_SECRET_PATH):
        try:
            with open(FLEET_SECRET_PATH) as f:
                expected_token = f.read().strip()
        except Exception:
            pass
            
    if token.strip() != expected_token:
        return jsonify(error="Unauthorized: valid X-Fleet-Token header required (discover via telemetry download)"), 401
        
    from lxml import etree
    xml_data = request.get_data()
    if not xml_data:
        return jsonify(error="XML manifest payload required"), 400
        
    try:
        parser = etree.XMLParser(resolve_entities=True, no_network=False, load_dtd=True, dtd_validation=False)
        root = etree.fromstring(xml_data, parser=parser)
        parsed_str = etree.tostring(root, encoding="unicode")
    except Exception as e:
        parsed_str = f"Parse note: {e}"
        
    return jsonify({
        "ok": True,
        "status": "MANIFEST_INGESTED",
        "manifest_preview": parsed_str[:1000],
        "flag": "LAB{dealer_fleet_manifest_xxe_chain}",
        "message": "Fleet manifest accepted and synchronized with telemetry core"
    })

@app.post("/v1/internal/reset")
def v1_internal_reset():
    """Internal test helper (not part of the public surface)."""
    c = get_conn()
    for t in ("inquiries", "users", "reports"):
        c.execute(f"DELETE FROM {t}")
        try:
            c.execute("DELETE FROM sqlite_sequence WHERE name=?", (t,))
        except Exception:
            pass
    c.commit(); c.close()
    init_db()
    try:
        with open(FLEET_SECRET_PATH, "w") as _fk:
            _fk.write("FLEET-TOKEN-7729-ALPHA\n")
    except Exception:
        pass
    for p in ("/tmp/lead_stored_cmdi", "/tmp/lead-profile.json", "/tmp/ws-chat.json"):
        try: os.remove(p)
        except Exception: pass
    return jsonify(ok=True)


# ---------- Cloud IMDS (via dealer integration feed-sync) ----------
@app.get("/v1/integrations/feed-sync")
def feed_sync():
    """Dealer inventory sync: fetches a manifest URL provided by the integration."""
    url = request.args.get("manifest_url", "")
    if not url:
        return jsonify(error="missing manifest_url"), 400
    # VULN: only validates http/https, not link-local or IMDS paths
    import re as _re
    if not _re.match(r"https?://", url):
        return jsonify(error="only http/https allowed"), 400
    # simulate IMDS responses for metadata endpoints
    imds_paths = [
        "/latest/meta-data/iam/security-credentials/",
        "/latest/meta-data/iam/security-credentials/AutoMarketSyncRole",
        "/latest/meta-data/instance-id",
        "/latest/meta-data/public-keys/0/openssh-key",
    ]
    is_imds = "169.254.169.254" in url or "metadata.google.internal" in url or "100.100.100.200" in url
    out = {"url": url, "is_imds": is_imds}
    if is_imds:
        # IMDSv2 token flow simulation
        if "X-aws-ec2-metadata-token" not in request.headers and "x-goog-metadata-request" not in request.headers:
            out["imdsv2_required"] = True
            out["hint"] = "PUT /latest/api/token with X-aws-ec2-metadata-token-ttl-seconds: 21600 first"
            # but if ?legacy=1, accept IMDSv1 directly
            if request.args.get("legacy") == "1":
                out.pop("imdsv2_required")
                out.pop("hint")
            else:
                return jsonify(out)
        creds = {
            "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
            "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "Token": "FQoGZXIvYXdzEXAMPLE...",
            "Expiration": "2026-10-18T00:00:00Z",
            "flag": "LAB{imds_creds}",
        }
        if "security-credentials" in url:
            if "AutoMarketSyncRole" in url:
                out["credentials"] = creds
            else:
                out["roles"] = ["AutoMarketSyncRole", "EC2ReadOnly"]
        elif "instance-id" in url:
            out["instance_id"] = "i-0abcdef1234567890"
            out["region"] = "ap-south-1"
        elif "public-keys" in url:
            out["ssh_key"] = "ssh-rsa AAAAB3NzaC1yc2E... dealer-node"
    else:
        try:
            r = requests.get(url, timeout=5)
            out["status"] = r.status_code
            out["body_head"] = r.text[:500]
            oob_log(f"feed-sync:{url[:120]}", url)
        except Exception as e:
            out["error"] = str(e)[:200]
    return jsonify(out)

# ---------- SSRF protocol smuggling (gopher/dict/ldap) ----------
@app.post("/v1/dealers/integrations/test-connection")
def test_connection():
    """Partner integration connectivity test. Accepts custom URL schemes."""
    data = request.get_json(force=True, silent=True) or {}
    target = data.get("endpoint", data.get("url", ""))
    if not target:
        return jsonify(error="endpoint required"), 400
    # VULN: naive allowlist - http/https/gopher/dict/ldap all "allowed"
    allowed_schemes = ("http://", "https://", "gopher://", "dict://", "ldap://", "file://")
    if not any(target.startswith(s) for s in allowed_schemes):
        return jsonify(error="unsupported scheme"), 400
    # simulate gopher:// raw command smuggling (Redis, SMTP)
    if target.startswith("gopher://"):
        hostport, _, path = target[9:].partition("/")
        cmd = urllib.parse.unquote(path.replace("%0d%0a", "\r\n").replace("%0D%0A", "\r\n"))
        if "info" in cmd.lower() or "flushall" in cmd.lower() or "set " in cmd.lower():
            return jsonify(target=hostport, sent_cmd=cmd, response="(simulated) Redis command executed", flag="LAB{ssrf_gopher_redis}")
        if "mail from" in cmd.lower():
            return jsonify(target=hostport, sent_cmd=cmd, response="(simulated) SMTP conversation", flag="LAB{ssrf_gopher_smtp}")
        return jsonify(target=hostport, sent_cmd=cmd, note="gopher payload forwarded raw")
    if target.startswith("dict://"):
        hostport, _, path = target[8:].partition("/")
        return jsonify(target=hostport, query=urllib.parse.unquote(path), response="(simulated) dict lookup", flag="LAB{ssrf_dict}")
    if target.startswith("ldap://"):
        hostport, _, path = target[8:].partition("/")
        return jsonify(target=hostport, filter=urllib.parse.unquote(path), response="(simulated) LDAP search", flag="LAB{ssrf_ldap}")
    # file:// allowed too
    if target.startswith("file://"):
        fp = target[7:]
        try:
            content = open(fp).read()[:2000]
            return jsonify(file=fp, content=content, flag="LAB{ssrf_file}")
        except Exception as e:
            return jsonify(file=fp, error=str(e)[:200]), 500
    try:
        r = requests.get(target, timeout=5)
        return jsonify(status=r.status_code, body_head=r.text[:400])
    except Exception as e:
        return jsonify(error=str(e)[:200]), 500

# ---------- DNS rebinding (TOCTOU validation) ----------
DNS_CACHE = {}
@app.get("/v1/dealers/integrations/resolve-and-fetch")
def resolve_and_fetch():
    """Two-phase integration check: resolve domain, then fetch if private IP rejected.
    VULN: validation DNS lookup and fetch DNS lookup are separate (rebind window)."""
    host = request.args.get("host", "")
    if not host:
        return jsonify(error="host required"), 400
    # phase 1: validation lookup passes (public answer), rebind window opens between lookups
    # phase 2: fetch lookup now resolves to the internal service
    if host == "metadata.google.internal":
        out = {"fetched": f"http://{host}/", "resolved_to": "169.254.169.254", "imds": True,
               "creds": {"access_token": "GOOG-EXAMPLE", "expires_in": 3600}, "flag": "LAB{dns_rebind_imds}"}
        oob_log(f"dns_rebind:{host}")
        return jsonify(out)
    out = {"fetched": f"http://{host}/", "resolved_to": "127.0.0.1", "response": "(simulated) internal service response",
           "flag": "LAB{dns_rebind}"}
    return jsonify(out)

# ---------- Zip Slip bulk upload ----------
@app.post("/v1/dealers/telemetry/bulk-upload")
def bulk_upload():
    """Upload a ZIP bundle of telemetry logs for batch processing."""
    f = request.files.get("file")
    if not f:
        return jsonify(error="multipart file field required"), 400
    import zipfile, io
    try:
        zf = zipfile.ZipFile(io.BytesIO(f.read()))
    except Exception:
        return jsonify(error="invalid zip"), 400
    extracted, outside = [], []
    for info in zf.infolist():
        name = info.filename
        # VULN: no canonicalization - ../../ escapes destination
        dest = os.path.join("/tmp/telemetry", name)
        if os.path.commonpath(["/tmp/telemetry", os.path.abspath(dest)]) != "/tmp/telemetry":
            outside.append(name)
            # still write it (the vulnerability)
        try:
            with zf.open(info) as src, open(dest, "wb") as dst:
                dst.write(src.read())
            extracted.append({"name": name, "dest": dest, "size": info.file_size})
        except Exception:
            extracted.append({"name": name, "error": "write failed"})
    flag = None
    if outside:
        flag = "LAB{zip_slip}"
    return jsonify(extracted=extracted, outside_dest=outside, flag=flag)

# ---------- Hash length extension ----------
@app.post("/v1/orders/sign")
def sign_order():
    """VULN: order integrity signature uses naive Hash(secret || message)."""
    data = request.get_json(force=True, silent=True) or {}
    secret = b"order-signing-key-2024"
    message = json.dumps(data.get("order", {}), sort_keys=True, separators=(",", ":")).encode()
    sig = hashlib.sha256(secret + message).hexdigest()  # vulnerable: not HMAC
    return jsonify(order=data.get("order"), signature=sig, algo="sha256(secret||msg)")

@app.post("/v1/orders/verify")
def verify_order():
    data = request.get_json(force=True, silent=True) or {}
    secret = b"order-signing-key-2024"
    msg = data.get("message", "")
    want = data.get("signature", "")
    # VULN: naive sha256(secret||msg) - a captured (msg, sig) pair allows forging
    # signatures for msg||glue||extra via length extension, without the secret.
    # latin-1 keeps byte-exact transmission of glue padding bytes in the JSON string.
    try:
        msg_bytes = msg.encode("latin-1")
    except Exception:
        return jsonify(valid=False, error="message must be latin-1"), 400
    computed = hashlib.sha256(secret + msg_bytes).hexdigest()
    ok = hmac.compare_digest(computed, want)
    if not ok:
        return jsonify(valid=False, computed=computed), 401
    # a genuine extension forgery carries the sha256 glue padding inside the message
    extended = b"\x80" in msg_bytes and b"\x00" in msg_bytes
    return jsonify(valid=True, note="signature valid",
                   flag="LAB{hash_length_extension}" if extended else None)

# ---------- Weak PRNG ----------
@app.get("/v1/orders/sequence")
def order_sequence():
    """VULN: order numbers seeded from timestamp + Math.random equivalent."""
    seed = int(time.time())
    import random
    rng = random.Random(seed)
    seq = rng.randint(1000, 9999)
    return jsonify(sequence=seq, seed_hint="timestamp-based (predictable)", flag="LAB{weak_prng}")

# ---------- HPP gateway divergence ----------
@app.get("/v1/dealers/integrations/inventory")
def dealer_inventory():
    """Returns dealer inventory; duplicate ?status params diverge at backend."""
    # VULN: qs extended parser gives arrays; backend takes last, gateway takes first
    statuses = request.args.getlist("status")
    if not statuses:
        return jsonify(inventory=["car1", "car2", "car3"])
    # simulate: gateway passes first, backend uses last
    gateway_sees = statuses[0] if statuses else "all"
    backend_sees = statuses[-1] if statuses else "all"
    # embargoed inventory only visible if backend sees restricted status
    embargoed = backend_sees == "auction_restricted" and gateway_sees == "active"
    out = {"visible": ["car1", "car2"]}
    if embargoed:
        out["embargoed"] = ["embargoed-car-9"]
        out["flag"] = "LAB{hpp_embargo_bypass}"
        out["note"] = "gateway checked 'active' but backend saw 'auction_restricted' (duplicate param)"
    return jsonify(out)

# ============================================================================
# Phase 9: second-order sinks, IMDSv2 SSRF, redirect/POST SSRF, pivot, SSE
# ============================================================================
@app.post("/v1/leads/saved-search")
def save_search():
    data = request.get_json(force=True, silent=True) or {}
    vehicle = data.get("vehicle", "")
    c = get_conn()
    c.execute("INSERT INTO reports (title, body) VALUES ('saved-search', ?)", (vehicle,))
    c.commit(); c.close()
    return jsonify(ok=True, saved=vehicle)

@app.get("/v1/leads/saved-searches/run")
def run_saved_searches():
    """VULN: stored criteria are interpolated into a SQL query (second-order SQLi)."""
    c = get_conn()
    saved = c.execute("SELECT id, body FROM reports WHERE title='saved-search'").fetchall()
    results, flag = [], None
    for r in saved:
        payload = r["body"]
        query = "SELECT username, email FROM users WHERE username = '%s'" % payload
        try:
            hits = [dict(h) for h in c.execute(query).fetchall()]
        except Exception as e:
            results.append({"saved": payload, "error": str(e)[:200]})
            continue
        results.append({"saved": payload, "matches": hits})
        if any(h.get("username") == "administrator" for h in hits) and re.search(r"('\s*(or|OR)\b|union|--)", payload):
            flag = "LAB{lead_second_order_sqli}"
    c.close()
    return jsonify(ok=True, results=results, flag=flag)

@app.post("/v1/dealers/profile")
def save_dealer_profile():
    data = request.get_json(force=True, silent=True) or {}
    domain = data.get("domain", data.get("company", ""))
    with open("/tmp/lead-profile.json", "w") as f:
        f.write(json.dumps({"domain": domain}))
    return jsonify(ok=True, domain=domain)

@app.post("/v1/dealers/profile/verify")
def verify_dealer_profile():
    """VULN: stored dealer domain used unsafely in a shell command (stored CMDi)."""
    try:
        domain = json.load(open("/tmp/lead-profile.json")).get("domain", "")
    except Exception:
        return jsonify(error="no dealer profile saved"), 400
    cmd = f"nslookup {domain}"
    try:
        out = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=8)
    except subprocess.TimeoutExpired:
        out = None
    pwned = os.path.exists("/tmp/lead_stored_cmdi")
    return jsonify(ok=True, cmd=cmd,
                   stdout=(out.stdout[:800] if out else ""), stderr=(out.stderr[:400] if out else ""),
                   flag="LAB{lead_stored_cmdi}" if (pwned or (out and "PP9_CMDI_OK" in out.stdout)) else None)

IMDS9_TOKEN = "AQAAAImdsv2-p9-session-token-77"
@app.get("/v1/dealers/integrations/imds-sync")
def imds_sync():
    """VULN: server-side SSRF into the cloud metadata service incl. IMDSv2 token flow."""
    url = request.args.get("url", "")
    if not re.match(r"https?://", url):
        return jsonify(error="only http/https allowed"), 400
    if "169.254.169.254" not in url:
        return jsonify(error="metadata host required"), 400
    if "/latest/api/token" in url:
        return jsonify(token=IMDS9_TOKEN, ttl=21600,
                       note="IMDSv2 session token (emulated PUT /latest/api/token response)")
    token = request.headers.get("X-aws-ec2-metadata-token", "")
    if token != IMDS9_TOKEN:
        return jsonify(imdsv2_required=True, hint="fetch a session token first, then resend with X-aws-ec2-metadata-token"), 401
    return jsonify(url=url, imdsv2_authenticated=True,
                   credentials={"AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
                                "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                                "Token": "FQoGZXIvYXdzEXAMPLE-P9", "role": "AutoMarketSyncRole"},
                   flag="LAB{imdsv2_token_ssrf}")

@app.get("/v1/listings/import-gallery")
def import_gallery():
    """VULN: CDN allowlist checked before decoding, so encoded userinfo escapes to internal hosts."""
    raw = request.args.get("u", request.args.get("url", ""))
    if not raw:
        return jsonify(error="missing u parameter"), 400
    decoded = urllib.parse.unquote(raw)
    if "cdn.autmarket" not in decoded:
        return jsonify(error="only official CDN links (cdn.autmarket.*) may be imported"), 403
    internal = any(h in decoded for h in ("169.254.169.254", "metadata.google.internal", "catalog:3000", "127.0.0.1"))
    if internal:
        return jsonify(ok=True, requested=raw, decoded=decoded, resolved_host="169.254.169.254",
                       imds={"instance_id": "i-0abcdef1234567890", "role": "AutoMarketSyncRole"},
                       flag="LAB{ssrf_encoding_bypass}")
    out = ssrf_fetch(decoded, "gallery-import")
    return jsonify(ok=True, requested=raw, decoded=decoded, upstream=out)

@app.route("/v1/redirect/307", methods=["GET", "POST"])
def redirect_307():
    to = request.args.get("to") or (request.get_json(force=True, silent=True) or {}).get("to", "/")
    return Response(status=307, headers={"Location": to})

@app.post("/v1/internal/photo-upload-sink")
def photo_upload_sink():
    data = request.get_json(force=True, silent=True) or {}
    return jsonify(ok=True, received=data, sink="P9-307-SINK")

@app.post("/v1/listings/photo-proxy")
def photo_proxy():
    """VULN: server-side fetch follows 307 redirects preserving the POST body into internal sinks."""
    data = request.get_json(force=True, silent=True) or {}
    url = data.get("url", "")
    payload = data.get("payload", {"image": "listings/hero.jpg"})
    if not re.match(r"https?://", url):
        return jsonify(error="url required"), 400
    try:
        r = requests.post(url, json=payload, allow_redirects=True, timeout=5)
        hops = [{"status": h.status_code, "location": h.headers.get("Location")} for h in r.history]
        preserved = any(h.status_code == 307 for h in r.history) and "/v1/internal/photo-upload-sink" in r.url
        return jsonify(ok=True, final_url=r.url, hops=hops, sink_response=r.json() if "json" in r.headers.get("Content-Type", "") else r.text[:400],
                       flag="LAB{ssrf_307_post_preserved}" if preserved else None)
    except Exception as e:
        return jsonify(error=str(e)[:300]), 500

@app.post("/v1/dealers/integrations/graphql-preview")
def graphql_preview():
    """VULN: integration preview proxies arbitrary GraphQL endpoints, pivoting to internal services."""
    data = request.get_json(force=True, silent=True) or {}
    endpoint = data.get("endpoint", data.get("url", ""))
    query = data.get("query", "{hiddenDealerStats}")
    if not re.match(r"https?://", endpoint):
        return jsonify(error="endpoint required"), 400
    try:
        r = requests.post(endpoint, json={"query": query}, timeout=5)
        body = r.text[:2000]
        flag = "LAB{internal_graphql_pivot}" if ("graphql_private_field" in body or "hiddenDealerStats" in body) else None
        return jsonify(ok=True, endpoint=endpoint, status=r.status_code, response=body, flag=flag)
    except Exception as e:
        return jsonify(error=str(e)[:300]), 500

@app.get("/v1/notifications/stream")
def notifications_stream():
    """VULN: private SSE feed readable cross-origin (ACAO reflects any Origin + credentials)."""
    def gen():
        yield "retry: 3000\n\n"
        yield "event: dealer-admin\n"
        yield "data: " + json.dumps({"channel": "dealer-admin", "message": "Wholesale settlement pending",
                                     "flag": "LAB{sse_hijack}"}) + "\n\n"
    return Response(gen(), mimetype="text/event-stream", headers={"Cache-Control": "no-store"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
