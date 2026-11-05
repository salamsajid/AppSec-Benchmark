"""IAM SQLite store - INTENTIONALLY VULNERABLE (raw string SQL). LAB ONLY."""
import os
import sqlite3
import hashlib
import time

DB_PATH = os.environ.get("IAM_DB", "/tmp/iam.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  password_md5 TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  reset_token TEXT,
  fa_code TEXT,
  failed_logins INTEGER DEFAULT 0,
  locked_until INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  redirect_uris TEXT,
  logo_url TEXT
);
CREATE TABLE IF NOT EXISTS linked_accounts (
  email TEXT PRIMARY KEY,
  oauth_id TEXT
);
"""

SEED = [
    # Core lab users (MUST retain exact credentials and order)
    ("administrator", "admin123", "admin@used-vehicles.lab", "admin"),
    ("carlos", "montoya", "carlos@used-vehicles.lab", "user"),
    ("wiener", "peter", "wiener@used-vehicles.lab", "user"),

    # Dealership Principals & General Managers
    ("marcus.vance", "Vance@2026Auto", "marcus.vance@autohub.in", "dealer"),
    ("elena.rostova", "ElenaPrime#99", "elena.rostova@primemotors.in", "dealer"),
    ("david.kim", "KimCityDrive$24", "david.kim@citydrive.in", "dealer"),
    ("sarah.jenkins", "SunriseSarah!1", "sarah.jenkins@sunrisecars.in", "dealer"),
    ("raj.patel", "GalaxyRaj*88", "raj.patel@galaxyauto.in", "dealer"),
    ("vikram.mehta", "ApexVikram@2026", "vikram.mehta@apexluxury.in", "dealer"),
    ("priya.deshmukh", "DeccanPriya#44", "priya.deshmukh@deccancertified.com", "dealer"),
    ("anand.verma", "HeritageAnand!9", "anand.verma@heritageclassics.in", "dealer"),

    # Corporate & Executive Leadership
    ("jordan.hayes", "HayesExec!2026", "jordan.hayes@used-vehicles.lab", "executive"),
    ("claire.redfield", "RedfieldAudit#1", "claire.redfield@used-vehicles.lab", "auditor"),
    ("alex.chen", "ChenFinance$77", "alex.chen@uvpcapital.com", "executive"),
    ("sophia.martinez", "SophiaPricing%23", "sophia.martinez@used-vehicles.lab", "analyst"),
    ("kevin.mitnick", "GhostInWire#88", "kevin.mitnick@security.lab", "auditor"),

    # Verified Retail Buyers & Automotive Enthusiasts
    ("emily.watson", "EmilyW@2026", "emily.watson@gmail.com", "user"),
    ("michael.chang", "ChangTech#12", "michael.chang@outlook.com", "user"),
    ("olivia.taylor", "OliviaT$99", "olivia.taylor@icloud.com", "user"),
    ("lucas.silva", "LucasSilva!7", "lucas.silva@techcorp.io", "user"),
    ("arjun.sharma", "ArjunS@Drive", "arjun.sharma99@gmail.com", "user"),
    ("daniel.evans", "EvansDan#2026", "devans@mobilitypartners.com", "user"),
    ("hannah.baker", "HannahB$33", "hbaker@designstudio.net", "user"),
    ("samuel.green", "GreenCap*44", "sam.green@greencapital.com", "user"),
    ("zack.morris", "ZackMorris!Bayside", "zack.m@pacificventures.com", "user"),
    ("natalie.portman", "NatalieP#Creative", "natalie.p@hollywoodcreative.com", "user"),
    ("rohit.malhotra", "RohitM@Delhi", "rohit.malhotra@delhitech.in", "user"),
    ("kavya.nair", "KavyaN#Kochi", "kavya.nair@keralabio.org", "user"),
    ("sanjay.singh", "SanjayS$Pune", "sanjay.singh@puneglobal.com", "user"),
    ("meera.joshi", "MeeraJ!Ahmedabad", "meera.joshi@ahmedabadtextiles.com", "user"),
]

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)
    for username, password, email, role in SEED:
        md5 = hashlib.md5(password.encode()).hexdigest()
        try:
            conn.execute(
                "INSERT INTO users (username, password, password_md5, email, role, fa_code) VALUES (?,?,?,?,?,?)",
                (username, password, md5, email, role, "1234"),
            )
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    conn.close()

def reset_db():
    """Internal test helper: restore seeded users."""
    conn = get_conn()
    conn.execute("DELETE FROM users")
    try:
        conn.execute("DELETE FROM sqlite_sequence WHERE name='users'")
    except Exception:
        pass
    conn.commit()
    conn.close()
    init_db()

# --- VULN helpers: raw interpolation, no parameterization ---

def raw_login_query(username: str, password: str):
    """Deliberately injectable: WHERE clause + UNION + stacked-query surface."""
    return f"SELECT id, username, password, email, role FROM users WHERE username = '{username}' AND password = '{password}'"

def raw_user_lookup(user_input: str):
    return f"SELECT id, username, email, role FROM users WHERE username = '{user_input}' OR email = '{user_input}'"

def normalize_email_loose(email: str) -> str:
    """VULN: parsing discrepancy - register/login/reset normalize differently.
    Strips +tags, dots for gmail-like domains, lowercases. Attacker can register
    victim+evil@... or with different case to collide / bypass."""
    e = email.strip().lower()
    if "@" in e:
        local, domain = e.split("@", 1)
        if "+" in local:
            local = local.split("+", 1)[0]
        if domain in ("gmail.com", "googlemail.com", "used-vehicles.lab"):
            local = local.replace(".", "")
        return f"{local}@{domain}"
    return e
