#!/usr/bin/env bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive
STATE_DIR=/var/lib/astralane-c5
mkdir -p "$STATE_DIR" /opt/astralane-c5 /tmp/astralane-c5-artifacts

if [[ ! -f "$STATE_DIR/base-installed" ]]; then
  apt-get update
  apt-get install -y --no-install-recommends \
    build-essential clang llvm lld ninja-build cmake pkg-config \
    libbpf-dev linux-tools-common linux-tools-generic linux-headers-generic \
    libelf-dev zlib1g-dev libssl-dev liburing-dev libseccomp-dev libcap-dev libkeyutils-dev \
    libmnl-dev libnftnl-dev libnl-3-dev libnl-route-3-dev libpcap-dev \
    protobuf-compiler libprotobuf-dev \
    curl ca-certificates jq git make file xxd binutils elfutils rsync \
    python3 python3-pip python3-venv golang-go \
    iproute2 nftables iptables kmod strace gdb keyutils \
    docker.io containerd runc skopeo umoci buildah podman \
    uidmap slirp4netns fuse-overlayfs fuse3 sysstat
  touch "$STATE_DIR/base-installed"
fi

if ! dpkg -s "linux-headers-$(uname -r)" >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends "linux-headers-$(uname -r)" \
    || apt-get install -y --no-install-recommends linux-headers-generic
fi

cat > /etc/sysctl.d/99-astralane-c5.conf <<'EOF'
kernel.unprivileged_userns_clone = 1
kernel.unprivileged_bpf_disabled = 0
net.ipv4.ip_forward = 1
fs.inotify.max_user_watches = 524288
EOF
sysctl --system >/dev/null 2>&1 || true

systemctl enable --now containerd >/dev/null 2>&1 || true
systemctl enable --now docker >/dev/null 2>&1 || true

while IFS= read -r user; do
  usermod -aG docker "$user" >/dev/null 2>&1 || true
done < <(awk -F: '$3 >= 1000 && $3 < 65534 { print $1 }' /etc/passwd)

chmod 1777 /tmp/astralane-c5-artifacts
uname -a
