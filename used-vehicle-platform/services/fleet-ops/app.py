"""Fleet Ops Diagnostics - INTENTIONALLY VULNERABLE. LAB ONLY. Port 7000.
Container isolation boundary simulations: pid:host, core_pattern procfs,
release_agent cgroup escape, host device exposure, mount points.
"""
import os, re, json, subprocess, hashlib, time, socket
import requests
from flask import Flask, request, jsonify, Response

app = Flask(__name__)
PORT = int(os.environ.get("PORT", "7000"))
OOB_URL = os.environ.get("OOB_URL", "http://oob-collaborator:9000")
DOCKER_SOCKET = os.environ.get("DOCKER_SOCKET", "/var/run/docker.sock")
HOST_SHARED_DIR = os.environ.get("HOST_SHARED_DIR", "/host/shared")

# ---------- simulated host state ----------
HOST_PROCESSES = [
    {"pid": 1, "name": "systemd", "cmd": "/sbin/init", "user": "root"},
    {"pid": 42, "name": "dockerd", "cmd": "dockerd --host=unix:///var/run/docker.sock", "user": "root"},
    {"pid": 88, "name": "sshd", "cmd": "/usr/sbin/sshd -D", "user": "root"},
    {"pid": 101, "name": "postgres", "cmd": "postgres -D /var/lib/postgresql/data", "user": "postgres"},
    {"pid": 203, "name": "nginx", "cmd": "nginx: master process", "user": "root"},
    {"pid": 310, "name": "node", "cmd": "node /app/server.js", "root": "node"},
]
HOST_ENV = {
    "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "HOSTNAME": "prod-node-7",
    "DATABASE_URL": "postgres://dbadmin:S3cr3tP@ss@prod-node-7:5432/automarket",
    "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "SSH_AUTH_SOCK": "/tmp/ssh-agent.sock",
    "KUBERNETES_SERVICE_HOST": "10.96.0.1",
    "REDIS_URL": "redis://:RedisP@ss123@prod-node-7:6379/0",
}
CORE_PATTERN = "/usr/share/apport/apport -p%p -s%s -c%c -d%d -P%P -u%u -g%g -- %E"
CGROUP_RELEASE_AGENT = ""
MOUNT_POINTS = [
    {"src": "/", "dst": "/", "opts": "rw,relatime"},
    {"src": "proc", "dst": "/proc", "opts": "rw,nosuid,nodev,noexec,relatime"},
    {"src": "/dev/sda1", "dst": "/etc/hosts", "opts": "rw,relatime"},
    {"src": "/dev/sda1", "dst": "/root", "opts": "rw,relatime"},
    {"src": "tmpfs", "dst": "/tmp", "opts": "rw,nosuid,nodev"},
    {"src": "sysfs", "dst": "/sys", "opts": "rw,nosuid,nodev,noexec,relatime"},
    {"src": "/dev/sda1", "dst": "/var/lib/docker", "opts": "rw,relatime"},
]
SUID_BINARIES = [
    {"path": "/usr/bin/find", "owner": "root", "perms": "rwsr-xr-x"},
    {"path": "/usr/bin/vim.basic", "owner": "root", "perms": "rwsr-xr-x"},
    {"path": "/usr/bin/less", "owner": "root", "perms": "rwsr-xr-x"},
    {"path": "/usr/bin/nmap", "owner": "root", "perms": "rwsr-xr-x"},
]
CAPABILITIES = ["CAP_SYS_PTRACE", "CAP_SYS_ADMIN", "CAP_DAC_READ_SEARCH", "CAP_SETUID", "CAP_NET_RAW"]

def oob_log(note, url=None):
    try: requests.post(f"{OOB_URL}/log", json={"fleet_oob": note, "url": url}, timeout=2)
    except Exception: pass

@app.after_request
def _cors(resp):
    o = request.headers.get("Origin")
    resp.headers["Access-Control-Allow-Origin"] = o if o else "*"
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    return resp

@app.get("/health")
def health(): return jsonify(ok=True, service="fleet-ops", docker_socket_present=os.path.exists(DOCKER_SOCKET))

# ---------- pid: host simulation ----------
@app.get("/v1/diagnostics/process-table")
def process_table():
    """Simulates pid:host - container sees all host processes."""
    pid_filter = request.args.get("filter", "")
    procs = HOST_PROCESSES
    if pid_filter:
        procs = [p for p in procs if pid_filter.lower() in p["cmd"].lower() or pid_filter == str(p["pid"])]
    return jsonify(namespace="host", processes=procs, total=len(procs))

@app.get("/v1/diagnostics/process-environ")
def process_environ():
    """Read /proc/[pid]/environ of any host process."""
    pid = request.args.get("pid", "1")
    # simulate reading host process environment
    env = dict(HOST_ENV)
    if pid != "1":
        env["REQUESTED_PID"] = pid
    return jsonify(pid=pid, environ=env, flag="LAB{pid_host_environ}" if "AWS_SECRET" in json.dumps(env) else None)

@app.post("/v1/diagnostics/process-signal")
def process_signal():
    """Send signal to any host process (pid:host breakout)."""
    data = request.get_json(force=True, silent=True) or {}
    pid = data.get("pid")
    sig = data.get("signal", 0)
    if not pid:
        return jsonify(error="pid required"), 400
    return jsonify(sent=True, pid=pid, signal=sig, flag="LAB{pid_host_signal}", note=f"signal {sig} sent to host pid {pid}")

# ---------- core_pattern / procfs ----------
@app.get("/v1/diagnostics/core-pattern")
def get_core_pattern():
    return jsonify(core_pattern=CORE_PATTERN, writable=True, flag=None)

@app.post("/v1/diagnostics/core-pattern")
def set_core_pattern():
    """Write to /proc/sys/kernel/core_pattern - kernel crash handler hijack."""
    data = request.get_json(force=True, silent=True) or {}
    pattern = data.get("pattern", "")
    if not pattern:
        return jsonify(error="pattern required"), 400
    global CORE_PATTERN
    CORE_PATTERN = pattern
    # simulate: if pattern starts with |, it's piped to a command
    if pattern.startswith("|"):
        cmd = pattern[1:].split()[0]
        oob_log(f"core_pattern_hijack:{cmd}")
        return jsonify(written=True, pattern=pattern, flag="LAB{core_pattern_rce}", note="kernel will pipe cores to attacker command on next crash")
    return jsonify(written=True, pattern=pattern)

@app.get("/v1/diagnostics/procfs-status")
def procfs_status():
    return jsonify(
        mounts=[m for m in MOUNT_POINTS if "proc" in m["dst"] or "sys" in m["dst"]],
        writable=[m for m in MOUNT_POINTS if "proc" in m["dst"] and "ro" not in m["opts"]],
        flag="LAB{procfs_writable}" if any("ro" not in m["opts"] for m in MOUNT_POINTS if "proc" in m["dst"]) else None,
    )

# ---------- release_agent / cgroup escape ----------
@app.post("/v1/diagnostics/cgroup-escape")
def cgroup_escape():
    """Simulates cgroup v1 release_agent escape via notify_on_release."""
    data = request.get_json(force=True, silent=True) or {}
    payload = data.get("payload", "")
    if not payload:
        return jsonify(error="payload required"), 400
    oob_log(f"release_agent:{payload[:100]}")
    return jsonify(
        escaped=True,
        cgroup="release_agent",
        payload=payload,
        flag="LAB{release_agent_escape}",
        note="attacker command executed as root on host via cgroup notify_on_release",
    )

# ---------- host devices / filesystem ----------
@app.get("/v1/diagnostics/block-devices")
def block_devices():
    """Simulates host block device exposure."""
    devs = [
        {"dev": "/dev/sda", "size": "500G", "model": "Samsung SSD 860", "mount": "/"},
        {"dev": "/dev/sda1", "size": "500G", "fstype": "ext4", "mount": "/"},
        {"dev": "/dev/sdb", "size": "2T", "model": "WD Blue", "mount": "/data"},
        {"dev": "/dev/sr0", "size": None, "model": "DVD-RW"},
    ]
    return jsonify(devices=devs, flag="LAB{host_device_exposure}")

@app.post("/v1/diagnostics/mount-device")
def mount_device():
    """Mount a host block device inside container."""
    data = request.get_json(force=True, silent=True) or {}
    dev = data.get("device", "")
    dst = data.get("mountpoint", "/mnt/host")
    if not dev.startswith("/dev/"):
        return jsonify(error="invalid device"), 400
    oob_log(f"host_mount:{dev}:{dst}")
    return jsonify(mounted=True, device=dev, mountpoint=dst, flag="LAB{host_device_mount}", note="host filesystem now accessible - read /etc/shadow, SSH keys")

@app.get("/v1/diagnostics/mounts")
def list_mounts():
    return jsonify(mounts=MOUNT_POINTS, writable=[m for m in MOUNT_POINTS if "ro" not in m["opts"]])

@app.get("/v1/diagnostics/suid-binaries")
def suid_binaries():
    return jsonify(suid=SUID_BINARIES, flag="LAB{suid_enum}")

@app.get("/v1/diagnostics/capabilities")
def capabilities():
    return jsonify(
        capabilities=CAPABILITIES,
        dangerous=[c for c in CAPABILITIES if c in ("CAP_SYS_PTRACE", "CAP_SYS_ADMIN", "CAP_DAC_READ_SEARCH")],
        flag="LAB{dangerous_caps}" if any(c in ("CAP_SYS_PTRACE", "CAP_SYS_ADMIN") for c in CAPABILITIES) else None,
    )

# ---------- seccomp / apparmor ----------
@app.get("/v1/diagnostics/security-profiles")
def security_profiles():
    return jsonify(
        seccomp="unconfined",
        apparmor="unconfined",
        selinux="permissive",
        read_only_rootfs=False,
        no_new_privs=False,
        flag="LAB{security_profiles_disabled}",
    )

# ---------- Kubernetes token spillage ----------
@app.get("/v1/diagnostics/service-account")
def service_account():
    return jsonify(
        token="eyJhbGciOiJSUzI1NiIsImtpZCI6Imt1YmVybmV0ZXMuZGVmYXVsdC5zZWNyZXQifQ.eyJpc3MiOiJ1YmVybmV0ZXMvdmF1bHQiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L25hbWUiOiJmZWV0LW9wcy1hZG1pbiIsInN1YiI6InN5c3RlbTppbnN0YW5jZSJ9.SIGNATURE_PLACEHOLDER",
        namespace="default",
        secrets=["fleet-ops-token", "db-credentials", "tls-key"],
        rbac={"cluster-admin": True, "nodes": ["get", "list", "watch"], "pods": ["*"]},
        flag="LAB{k8s_token_spillage}",
    )

# ---------- supply chain ----------
@app.get("/v1/dependencies")
def dependencies():
    return jsonify(
        base_image="python:3.11-slim",
        packages=[
            {"name": "openssl", "version": "3.0.8", "cve": "CVE-2024-6119"},
            {"name": "libc", "version": "2.36", "cve": None},
            {"name": "curl", "version": "8.5.0", "cve": "CVE-2024-2398"},
        ],
        flag="LAB{supply_chain_cve}",
    )

@app.post("/v1/internal/reset")
def reset():
    global CORE_PATTERN
    CORE_PATTERN = "/usr/share/apport/apport -p%p -s%s -c%c -d%d -P%P -u%u -g%g -- %E"
    _reset_phase8()
    return jsonify(ok=True)

# ---------- Docker daemon socket exposure ----------
def query_docker_socket(path="/v1.41/containers/json"):
    if not os.path.exists(DOCKER_SOCKET):
        return None, f"Docker socket not found at {DOCKER_SOCKET}"
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(5.0)
        sock.connect(DOCKER_SOCKET)
        req = f"GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
        sock.sendall(req.encode())
        data = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            data += chunk
        sock.close()
        header, _, body = data.partition(b"\r\n\r\n")
        if b"Transfer-Encoding: chunked" in header:
            lines = body.split(b"\r\n")
            body_parts = []
            i = 0
            while i < len(lines):
                chunk_len_str = lines[i].strip()
                if not chunk_len_str:
                    break
                try:
                    chunk_len = int(chunk_len_str, 16)
                except ValueError:
                    break
                if chunk_len == 0:
                    break
                if i + 1 < len(lines):
                    body_parts.append(lines[i+1][:chunk_len])
                i += 2
            body = b"".join(body_parts)
        return json.loads(body.decode(errors="replace")), None
    except Exception as e:
        return None, str(e)

@app.get("/v1/docker/containers")
def docker_containers():
    pivot_source = request.args.get("pivot_source", "")
    data, err = query_docker_socket("/v1.41/containers/json")
    resp = {"ok": True, "flag": "LAB{docker_socket_daemon_exposure}"}
    if data is not None and isinstance(data, list):
        summary = [{"id": c.get("Id", "")[:12], "names": c.get("Names", []), "image": c.get("Image", "")} for c in data]
        resp.update({"daemon_source": "live_socket", "containers_count": len(data), "containers": summary})
    else:
        resp.update({
            "daemon_source": "simulated_probe",
            "socket_path": DOCKER_SOCKET,
            "socket_exists": os.path.exists(DOCKER_SOCKET),
            "error": err,
        })
    if pivot_source:
        resp["chain_flag"] = "LAB{docker_chain_socket_pivot_pwned}"
        resp["pivot_verified"] = True
    return jsonify(resp)

# ---------- CAP_SYS_PTRACE / CAP_DAC_OVERRIDE process inspection ----------
@app.post("/v1/diagnostics/process-inspect")
def process_inspect():
    data = request.get_json(force=True, silent=True) or {}
    pid = data.get("pid", 1)
    token = request.args.get("token", "")
    proc_status_path = f"/proc/{pid}/status"
    if not os.path.exists(proc_status_path):
        proc_status_path = "/proc/self/status"
    status_content = {}
    try:
        with open(proc_status_path, "r") as f:
            for line in f:
                parts = line.split(":", 1)
                if len(parts) == 2:
                    status_content[parts[0].strip()] = parts[1].strip()
    except Exception as e:
        status_content["error"] = str(e)

    cap_eff_hex = status_content.get("CapEff", "0")
    cap_eff_val = 0
    try:
        cap_eff_val = int(cap_eff_hex, 16)
    except Exception:
        pass
    has_sys_ptrace = bool(cap_eff_val & (1 << 19))
    has_dac_override = bool(cap_eff_val & (1 << 1))

    resp = {
        "ok": True,
        "target_pid": pid,
        "CapEff": cap_eff_hex,
        "has_sys_ptrace": has_sys_ptrace or True,
        "has_dac_override": has_dac_override or True,
        "flag": "LAB{docker_cap_sys_ptrace_abuse}",
    }
    if token == "LAB{docker_image_label_leak_token}":
        resp["chain_flag"] = "LAB{docker_chain_ptrace_memory_dump}"
        resp["memory_dump_status"] = "dumped_pid_1_environment"
        resp["dumped_secrets"] = {"INIT_KMS_KEY": "KMS-ROOT-9901-PROD"}
    return jsonify(resp)

# ---------- sensitive host volume mount ----------
@app.get("/v1/diagnostics/host-mount")
def host_mount():
    file = request.args.get("file", "sync-manifest.json")
    partner_key = request.args.get("partner_key", "")
    clean_name = os.path.basename(file)
    target_path = os.path.join(HOST_SHARED_DIR, clean_name)
    if not os.path.exists(target_path):
        return jsonify(detail=f"Host mount file {clean_name} not found in {HOST_SHARED_DIR}"), 404
    try:
        with open(target_path, "r") as f:
            content = f.read()
        parsed = json.loads(content) if content.strip().startswith("{") else {"raw": content}
        resp = {
            "ok": True,
            "host_mount_path": target_path,
            "content": parsed,
            "flag": "LAB{docker_host_mount_sync_leak}",
        }
        if partner_key == "LAB{docker_multistage_staging_seed_leak}":
            resp["chain_flag"] = "LAB{docker_chain_host_manifest_takeover}"
            resp["vault_unlocked"] = True
        return jsonify(resp)
    except Exception as e:
        return jsonify(detail=str(e)), 500

# ---------- seccomp profile ----------
@app.get("/v1/diagnostics/seccomp-status")
def seccomp_status():
    seccomp_val = None
    try:
        with open("/proc/self/status", "r") as f:
            for line in f:
                if line.startswith("Seccomp:"):
                    seccomp_val = line.split(":", 1)[1].strip()
                    break
    except Exception as e:
        seccomp_val = str(e)
    is_unconfined = seccomp_val == "0"
    return jsonify(
        ok=True,
        seccomp_mode=seccomp_val,
        status="unconfined" if is_unconfined else "filtered",
        flag="LAB{docker_seccomp_unconfined_bypass}",
    )

# ---------- flat bridge network sniffing ----------
@app.get("/v1/diagnostics/network-bridge")
def network_bridge():
    cap_eff_val = 0
    try:
        with open("/proc/self/status", "r") as f:
            for line in f:
                if line.startswith("CapEff:"):
                    cap_eff_val = int(line.split(":", 1)[1].strip(), 16)
                    break
    except Exception:
        pass
    has_net_raw = bool(cap_eff_val & (1 << 13))
    interfaces = []
    try:
        with open("/proc/net/dev", "r") as f:
            for line in f:
                if ":" in line:
                    iface = line.split(":", 1)[0].strip()
                    if iface != "lo":
                        interfaces.append(iface)
    except Exception as e:
        interfaces.append(str(e))
    return jsonify(
        ok=True,
        network="uvp-net",
        has_net_raw=has_net_raw or True,
        active_interfaces=interfaces,
        sniffing_capability="promiscuous_raw_socket_enabled",
        flag="LAB{docker_bridge_unsegmented_sniffing}",
    )

# ---------- cgroup resource limits ----------
@app.get("/v1/diagnostics/cgroups-limits")
def cgroups_limits():
    pids_limit = "unlimited"
    memory_limit = "unlimited"
    if os.path.exists("/sys/fs/cgroup/pids.max"):
        try:
            with open("/sys/fs/cgroup/pids.max", "r") as f:
                pids_limit = f.read().strip()
        except Exception:
            pass
    elif os.path.exists("/sys/fs/cgroup/pids/pids.max"):
        try:
            with open("/sys/fs/cgroup/pids/pids.max", "r") as f:
                pids_limit = f.read().strip()
        except Exception:
            pass
    if os.path.exists("/sys/fs/cgroup/memory.max"):
        try:
            with open("/sys/fs/cgroup/memory.max", "r") as f:
                memory_limit = f.read().strip()
        except Exception:
            pass
    elif os.path.exists("/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        try:
            with open("/sys/fs/cgroup/memory/memory.limit_in_bytes", "r") as f:
                val = int(f.read().strip())
                if val > 10**12:
                    memory_limit = "max"
        except Exception:
            pass
    return jsonify(
        ok=True,
        pids_max=pids_limit,
        memory_max=memory_limit,
        status="unconstrained",
        flag="LAB{docker_cgroups_unconstrained_dos}",
    )

# ---------- internal DNS / topology discovery ----------
@app.get("/v1/diagnostics/service-discovery")
def service_discovery():
    dns_server = "127.0.0.11"
    try:
        with open("/etc/resolv.conf", "r") as f:
            for line in f:
                if line.startswith("nameserver"):
                    dns_server = line.split()[1].strip()
                    break
    except Exception:
        pass
    known_peers = ["iam", "catalog", "lead", "mysql", "mongo", "smuggle-lab", "frontend"]
    resolved = []
    for peer in known_peers:
        try:
            ip = socket.gethostbyname(peer)
            resolved.append({"name": peer, "ip": ip})
        except Exception:
            resolved.append({"name": peer, "status": "present_on_uvp_net"})
    return jsonify(
        ok=True,
        embedded_dns=dns_server,
        network_peers=resolved,
        flag="LAB{docker_internal_dns_topology_leak}",
    )

# ---------- lateral movement to database ----------
@app.get("/v1/diagnostics/lateral-database")
def lateral_database():
    target = request.args.get("target", "mongo")
    return jsonify(
        ok=True,
        target=target,
        lateral_path=f"uvp-fleet-ops -> {target}:27017 (uvp-net unsegmented bridge)",
        connection_verdict="direct_bridge_access_unrestricted",
        flag="LAB{docker_chain_network_lateral_pwned}",
    )

# ================== Phase 8: CI / mesh / runtime / admission chains ==================
CI_STATE = {"images": {}, "cache": {}, "queued": {}, "queue_counter": 0, "flagged": {}}
CI_IMAGE_SEED = {
    "release-signer": {"tags": {"prod": "sha256:4444dddd3333aaaa", "main": "sha256:4444eeee2222bbbb"},
                       "critical": True,
                       "secrets": {"CI_SIGNING_KEY": "ci-sign-key-44ab", "REGISTRY_PUSH_TOKEN": "reg-push-9f21bd"}},
    "automarket-api": {"tags": {"prod": "sha256:1111aaaa0000ffff", "main": "sha256:2222bbbb1111eeee"},
                       "critical": False, "secrets": {}},
    "helper-cache-warmer": {"tags": {"v2": "sha256:3333cccc2222dddd"}, "critical": False, "secrets": {}},
}
CI_CACHE_SEED = {"golang-deps": {"digest": "sha256:cafe0000deps0001", "origin": "ci"},
                 "npm-modules": {"digest": "sha256:cafe0000mods0002", "origin": "ci"}}

MESH_STATE = {"mode": "permissive", "identities_held": ["spiffe://uvp/ns/default/sa/fleet-ops"],
              "spare_identities": ["spiffe://uvp/ns/default/sa/payments", "spiffe://uvp/ns/default/sa/catalog"],
              "uid_excludes": [1337], "route_uid_bypass": False}

RUNTIME_STATE = {"bpf": {"ringbuf_bytes": 262144, "mtu": 1500}, "events": {"emitted": 0, "captured": 0, "lost": 0},
                 "fileless": [], "detection": {"alerts": []}}

K8S_STATE = {"registry": {}, "validated": {}, "admitted": [], "webhooks": {"sidecar-injector": True},
             "ephemeral": [], "pod_counter": 0, "race_admitted": False}
K8S_REGISTRY_SEED = {"payments-api": {"1.4.2": {"policy": "allowlisted"}, "1.4.3": {"policy": "quarantined"}},
                     "checkout-web": {"2.1.0": {"policy": "allowlisted"}}}

def _reset_phase8():
    CI_STATE["images"] = json.loads(json.dumps(CI_IMAGE_SEED))
    CI_STATE["cache"] = json.loads(json.dumps(CI_CACHE_SEED))
    CI_STATE["queued"].clear(); CI_STATE["queue_counter"] = 0; CI_STATE["flagged"].clear()
    MESH_STATE["mode"] = "permissive"
    MESH_STATE["identities_held"] = ["spiffe://uvp/ns/default/sa/fleet-ops"]
    MESH_STATE["uid_excludes"] = [1337]; MESH_STATE["route_uid_bypass"] = False
    RUNTIME_STATE["bpf"] = {"ringbuf_bytes": 262144, "mtu": 1500}
    RUNTIME_STATE["events"] = {"emitted": 0, "captured": 0, "lost": 0}
    RUNTIME_STATE["fileless"].clear(); RUNTIME_STATE["detection"]["alerts"].clear()
    K8S_STATE["registry"] = json.loads(json.dumps(K8S_REGISTRY_SEED))
    K8S_STATE["validated"].clear(); K8S_STATE["admitted"].clear()
    K8S_STATE["webhooks"] = {"sidecar-injector": True}
    K8S_STATE["ephemeral"].clear(); K8S_STATE["pod_counter"] = 0; K8S_STATE["race_admitted"] = False

_reset_phase8()

# ---------- Chain 5: CI registry cache poisoning (BuildKit TOCTOU) ----------
@app.get("/v1/ci/registry/images")
def ci_registry_images():
    out = [{"image": k, "tags": v["tags"], "critical": v.get("critical", False)} for k, v in CI_STATE["images"].items()]
    return jsonify(images=out, mutable_tags=True, note="tags are mutable references; digests pin content")

@app.post("/v1/ci/registry/retag")
def ci_retag():
    d = request.get_json(force=True, silent=True) or {}
    image, tag = str(d.get("image", "")), str(d.get("tag", ""))
    digest = str(d.get("digest", "sha256:6666evildead"))
    if image not in CI_STATE["images"]:
        return jsonify(error="unknown image"), 404
    old = CI_STATE["images"][image]["tags"].get(tag)
    CI_STATE["images"][image]["tags"][tag] = digest
    resp = {"ok": True, "image": image, "tag": tag, "old_digest": old, "new_digest": digest, "mutable": True}
    if old and old != digest:
        CI_STATE["flagged"]["tag_race"] = True
        resp["flag"] = "LAB{ci_tag_race}"
        resp["note"] = "mutable tag now resolves to attacker content; consumers that validated the old digest keep trusting the tag"
    return jsonify(resp)

@app.post("/v1/ci/cache/seed")
def ci_cache_seed():
    d = request.get_json(force=True, silent=True) or {}
    key = str(d.get("cache_key", "golang-deps"))
    origin = str(d.get("origin", "attacker"))
    CI_STATE["cache"][key] = {"digest": "sha256:666badc0de0" + str(len(key)), "origin": origin,
                              "poisoned": origin == "attacker"}
    resp = {"ok": True, "cache_key": key, "entry": CI_STATE["cache"][key], "shared_cache": True}
    if origin == "attacker":
        CI_STATE["flagged"]["cache_poison"] = True
        resp["flag"] = "LAB{ci_cache_poison}"
        resp["note"] = "shared BuildKit cache now serves attacker layers to every future build"
    return jsonify(resp)

@app.post("/v1/ci/pipeline/queue")
def ci_queue():
    d = request.get_json(force=True, silent=True) or {}
    repo = str(d.get("repo", "automarket/checkout"))
    base = str(d.get("base_cache", "golang-deps"))
    image = str(d.get("image", "release-signer"))
    CI_STATE["queue_counter"] += 1
    qid = "q-%d" % CI_STATE["queue_counter"]
    snap = {"repo": repo, "base_cache": base,
            "cache_digest_at_queue": CI_STATE["cache"].get(base, {}).get("digest"),
            "image": image,
            "image_digest_at_queue": CI_STATE["images"].get(image, {}).get("tags", {}).get("prod")}
    CI_STATE["queued"][qid] = snap
    return jsonify(queue_id=qid, snapshot=snap, note="queued; artifact validation happens at queue time (TOCTOU window)")

@app.post("/v1/ci/pipeline/run")
def ci_run():
    d = request.get_json(force=True, silent=True) or {}
    qid = str(d.get("queue_id", ""))
    q = CI_STATE["queued"].get(qid)
    if not q:
        return jsonify(error="unknown queue_id (queue the pipeline first)"), 404
    cache_now = CI_STATE["cache"].get(q["base_cache"], {})
    tag_now = CI_STATE["images"].get(q["image"], {}).get("tags", {}).get("prod")
    cache_poisoned = bool(cache_now.get("poisoned")) and cache_now.get("digest") != q["cache_digest_at_queue"]
    tag_drift = tag_now != q["image_digest_at_queue"]
    resp = {"ok": True, "queue_id": qid, "repo": q["repo"], "cache_poisoned_at_run": cache_poisoned,
            "image_tag_drifted_at_run": tag_drift, "steps": ["checkout", "restore-cache", "build", "test"]}
    if cache_poisoned or tag_drift:
        resp["steps"] = resp["steps"] + ["postbuild: attacker-controlled layer executed"]
        resp["executed_image_digest"] = tag_now
        resp["runner_env"] = {"GITHUB_TOKEN": "ghp_lab0runner7f3a2bd1",
                              "CI_DEPLOY_KEY": "deploy-key-lab-44ab",
                              "AWS_ROLE": "arn:aws:iam::111122223333:role/ci-deploy"}
        resp["flag"] = "LAB{ci_runner_takeover}"
        resp["note"] = "TOCTOU: artifact validated at queue time, content swapped before the run"
        CI_STATE["flagged"]["runner_takeover"] = True
        if cache_poisoned and tag_drift:
            resp["chain_flag"] = "LAB{buildkit_chain_pwned}"
            CI_STATE["flagged"]["chain"] = True
    return jsonify(resp)

@app.get("/v1/ci/sbom/<image>")
def ci_sbom(image):
    snap = None
    for q in CI_STATE["queued"].values():
        if q["image"] == image:
            snap = q
    current = CI_STATE["images"].get(image, {}).get("tags", {}).get("prod")
    resp = {"image": image, "sbom_source": "queue-time snapshot" if snap else "latest scan",
            "documented_digest": snap["image_digest_at_queue"] if snap else current,
            "current_tag_digest": current,
            "packages": ["base:python:3.11-slim", "openssl:3.0.8", "curl:8.5.0"]}
    if snap and snap["image_digest_at_queue"] != current:
        resp["flag"] = "LAB{sbom_blindspot}"
        resp["note"] = "SBOM documents the pipeline that was queued, not the artifact that actually ran"
    return jsonify(resp)

# ---------- Chain 6: service mesh sidecar bypass ----------
@app.get("/v1/mesh/envoy/admin")
def mesh_envoy_admin():
    return jsonify(admin={"bound": "0.0.0.0:9901", "auth": "none"},
                   clusters=["payments-svc", "catalog-svc", "iam-svc"],
                   uid_excludes=MESH_STATE["uid_excludes"],
                   flag="LAB{mesh_envoy_admin}",
                   note="sidecar admin console reachable from the workload network without authentication")

@app.post("/v1/mesh/envoy/config")
def mesh_envoy_config():
    d = request.get_json(force=True, silent=True) or {}
    if bool(d.get("uid_bypass", False)):
        MESH_STATE["route_uid_bypass"] = True
    return jsonify(ok=True, admin_accepted=True, applied=d,
                   route_uid_bypass=MESH_STATE["route_uid_bypass"],
                   note="admin API has no auth; routes and UID policy can be rewritten by any peer")

@app.get("/v1/mesh/mtls/status")
def mesh_mtls_status():
    return jsonify(mode=MESH_STATE["mode"], peer_auth="OPTIONAL", plaintext_workloads=["payments-svc"],
                   note="STRICT rejects plaintext; permissive accepts traffic without client certificates")

@app.post("/v1/mesh/probe")
def mesh_probe():
    d = request.get_json(force=True, silent=True) or {}
    peer = str(d.get("peer", "payments-svc"))
    client_cert = bool(d.get("client_cert", False))
    src_uid = d.get("src_uid")
    allowed = MESH_STATE["mode"] != "strict" or client_cert
    out = {"peer": peer, "client_cert_present": client_cert, "mesh_mode": MESH_STATE["mode"], "reached": bool(allowed)}
    if allowed and not client_cert:
        out["flag"] = "LAB{mesh_mtls_bypass}"
        out["note"] = "protected workload accepted plaintext from a peer with no client certificate"
    if src_uid is not None:
        try:
            if int(src_uid) in MESH_STATE["uid_excludes"]:
                out["uid_flag"] = "LAB{mesh_uid_iptables_bypass}"
                out["uid_note"] = "iptables owner-match excludes this UID from sidecar redirection; traffic reached the backend directly"
        except (TypeError, ValueError):
            pass
    return jsonify(out)

@app.get("/v1/mesh/spiffe/peers")
def mesh_spiffe_peers():
    return jsonify(own_identities=MESH_STATE["identities_held"],
                   registerable=MESH_STATE["spare_identities"], bundle_endpoint="/v1/mesh/spiffe/bundle")

@app.post("/v1/mesh/spiffe/hijack")
def mesh_spiffe_hijack():
    d = request.get_json(force=True, silent=True) or {}
    identity = str(d.get("identity", MESH_STATE["spare_identities"][0]))
    MESH_STATE["identities_held"].append(identity)
    return jsonify(ok=True, assumed=identity, verified=False,
                   flag="LAB{mesh_spiffe_hijack}",
                   note="SA token not validated; SPIFFE identity registered for this workload")

@app.get("/v1/mesh/workload/protected")
def mesh_protected():
    identity = request.headers.get("X-SPIFFE-Identity") or request.args.get("identity", "")
    if identity not in MESH_STATE["identities_held"]:
        return jsonify(error="mTLS/SPIFFE identity required", presented=identity), 403
    out = {"ok": True, "identity": identity, "peer_call": "payments-svc/v1/transfers/pending -> 200",
           "transfers_visible": 3}
    if identity != "spiffe://uvp/ns/default/sa/fleet-ops":
        out["chain_flag"] = "LAB{mesh_sidecar_chain}"
        out["chain_note"] = "borrowed SPIFFE identity accepted by the peer workload"
    return jsonify(out)

# ---------- Chain 7: eBPF ring-buffer evasion ----------
@app.post("/v1/runtime/bpf/events/configure")
def runtime_bpf_configure():
    d = request.get_json(force=True, silent=True) or {}
    ringbuf_bytes = int(d.get("ringbuf_bytes", 262144))
    mtu = int(d.get("mtu", 1500))
    RUNTIME_STATE["bpf"] = {"ringbuf_bytes": ringbuf_bytes, "mtu": mtu}
    return jsonify(ok=True, ringbuf={"ringbuf_bytes": ringbuf_bytes, "event_slot": 64,
                                     "capacity": max(ringbuf_bytes // 64, 1), "mtu": mtu})

@app.post("/v1/runtime/events/emit")
def runtime_events_emit():
    d = request.get_json(force=True, silent=True) or {}
    count = int(d.get("count", 1000))
    capacity = max(RUNTIME_STATE["bpf"].get("ringbuf_bytes", 262144) // 64, 1)
    lost = max(0, count - capacity)
    RUNTIME_STATE["events"] = {"emitted": RUNTIME_STATE["events"]["emitted"] + count,
                               "captured": RUNTIME_STATE["events"]["captured"] + (count - lost),
                               "lost": RUNTIME_STATE["events"]["lost"] + lost}
    resp = {"ok": True, "emitted": count, "capacity": capacity, "captured": count - lost, "lost": lost,
            "tracepoint": str(d.get("tracepoint", "sys_enter_execve"))}
    if lost > 0:
        RUNTIME_STATE["detection"]["alerts"].append("execve dropout: %d events lost in ring buffer" % lost)
        resp["flag"] = "LAB{ebpf_ring_overflow}"
        resp["note"] = "ring-buffer pressure dropped execve events; a short-lived in-memory binary never gets reported"
    return jsonify(resp)

@app.post("/v1/runtime/exec/fileless")
def runtime_fileless_exec():
    d = request.get_json(force=True, silent=True) or {}
    payload = str(d.get("payload", "whoami"))
    RUNTIME_STATE["fileless"].append({"payload": payload[:100], "path": "/memfd:runner (deleted)", "on_disk": False})
    return jsonify(executed=True, pid=9000 + len(RUNTIME_STATE["fileless"]),
                   inode="/memfd:runner (deleted)", on_disk=False,
                   flag="LAB{memfd_fileless_exec}",
                   note="binary executed from memfd via fexecve; nothing on disk for integrity scanners")

@app.get("/v1/runtime/agent/status")
def runtime_agent_status():
    out = {"supervisor": "runtime-agent-1.4",
           "trace_sources": ["tracepoint/sys_enter_execve", "kprobe/security_bprm_check"],
           "events": RUNTIME_STATE["events"],
           "detection_alerts": RUNTIME_STATE["detection"]["alerts"],
           "fileless_execs": len(RUNTIME_STATE["fileless"]),
           "artifact_scan": "clean"}
    if RUNTIME_STATE["fileless"] and RUNTIME_STATE["events"]["lost"] > 0:
        out["chain_flag"] = "LAB{runtime_evasion_chain}"
        out["note"] = "memfd exec never reported: ring-buffer loss hid the execve from the agent"
    return jsonify(out)

# ---------- Chain 8: K8s admission webhook TOCTOU + ephemeral containers ----------
@app.post("/v1/k8s/admission/validate")
def k8s_admission_validate():
    d = request.get_json(force=True, silent=True) or {}
    workload = str(d.get("workload", "payments-api"))
    tag = str(d.get("tag", "1.4.2"))
    pol = K8S_STATE["registry"].get(workload, {}).get(tag, {}).get("policy", "unscanned")
    if pol != "allowlisted":
        return jsonify(valid=False, error="image policy is not allowlisted", policy=pol), 403
    token = "adm-" + hashlib.md5(("%s:%s" % (workload, tag)).encode()).hexdigest()[:10]
    K8S_STATE["validated"][token] = {"workload": workload, "tag": tag, "policy_at_validation": pol, "at": time.time()}
    return jsonify(valid=True, token=token, policy_at_validation=pol,
                   note="validation snapshot recorded; admission will trust this token")

@app.post("/v1/k8s/registry/tag")
def k8s_registry_tag():
    d = request.get_json(force=True, silent=True) or {}
    workload = str(d.get("workload", "payments-api"))
    tag = str(d.get("tag", "1.4.2"))
    policy = str(d.get("policy", "private-unscanned"))
    K8S_STATE["registry"].setdefault(workload, {})[tag] = {"policy": policy, "pushed_at": time.time()}
    return jsonify(ok=True, workload=workload, tag=tag, registry_policy=policy,
                   note="content re-pushed under the same tag after validation")

@app.post("/v1/k8s/pods/admit")
def k8s_pods_admit():
    d = request.get_json(force=True, silent=True) or {}
    token = str(d.get("token", ""))
    v = K8S_STATE["validated"].get(token)
    if not v:
        return jsonify(admitted=False, error="no admission token (run /v1/k8s/admission/validate first)"), 403
    sidecar = K8S_STATE["webhooks"].get("sidecar-injector", False)
    current_policy = K8S_STATE["registry"].get(v["workload"], {}).get(v["tag"], {}).get("policy")
    K8S_STATE["pod_counter"] += 1
    pod = "%s-%d" % (v["workload"], K8S_STATE["pod_counter"])
    out = {"admitted": True, "pod": pod, "workload": v["workload"], "tag": v["tag"],
           "sidecar_injected": sidecar, "policy_seen_at_validation": v["policy_at_validation"],
           "registry_policy_now": current_policy}
    if current_policy != v["policy_at_validation"]:
        out["flag"] = "LAB{k8s_tag_race}"
        out["note"] = "registry content changed after webhook validation (tag race admitted)"
        K8S_STATE["race_admitted"] = True
    if not sidecar:
        out["webhook_flag"] = "LAB{k8s_webhook_reinject}"
        out["webhook_note"] = "mutating webhook removed; pod admitted without the injected sidecar"
    K8S_STATE["admitted"].append(out)
    return jsonify(out)

@app.post("/v1/k8s/webhooks/remove")
def k8s_webhooks_remove():
    d = request.get_json(force=True, silent=True) or {}
    name = str(d.get("name", "sidecar-injector"))
    K8S_STATE["webhooks"][name] = False
    return jsonify(ok=True, removed=name,
                   mutating_webhooks_now=[k for k, val in K8S_STATE["webhooks"].items() if val],
                   note="namespace admins can delete mutating webhook configurations; future pods admit without injection")

@app.post("/v1/k8s/pods/<pod>/ephemeral-containers")
def k8s_ephemeral(pod):
    d = request.get_json(force=True, silent=True) or {}
    image = str(d.get("image", "debug-tools:latest"))
    target = str(d.get("target_container", "app"))
    K8S_STATE["ephemeral"].append({"pod": pod, "image": image, "target": target})
    out = {"ok": True, "pod": pod,
           "ephemeral": {"name": "debugger-%d" % len(K8S_STATE["ephemeral"]), "image": image,
                         "privileged": True, "run_as": "root", "target_container": target},
           "flag": "LAB{k8s_ephemeral_abuse}",
           "note": "ephemeral containers skip most admission policy checks (privileged root + host access)"}
    race_pods = [a for a in K8S_STATE["admitted"] if a.get("flag")]
    if race_pods and pod == race_pods[-1]["pod"]:
        out["chain_flag"] = "LAB{k8s_admission_chain}"
        out["chain_note"] = "race-admitted pod now hosts a privileged ephemeral container"
    return jsonify(out)

@app.get("/v1/k8s/status")
def k8s_status():
    return jsonify(webhooks=K8S_STATE["webhooks"], admitted=K8S_STATE["admitted"][-5:],
                   ephemeral=K8S_STATE["ephemeral"][-5:], race_admitted=K8S_STATE["race_admitted"])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
