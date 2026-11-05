#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
C5_DIR="$ROOT/c5"
REGISTRY="$C5_DIR/registry.json"
FLAGS="$ROOT/shared/flags.json"
TEMPLATE="${C5_LIMA_TEMPLATE:-$C5_DIR/lima.yaml}"
INSTANCE="${C5_INSTANCE:-}"
GUEST_MOUNT="${C5_GUEST_MOUNT:-}"
ARTIFACT_DIR="${C5_ARTIFACT_DIR:-}"

usage() {
  cat <<'EOF'
Usage: c5/run.sh <command> [args]

Commands:
  validate          Validate Lima template, registry, and C5 flag mapping
  doctor            Check host prerequisites and chain readiness
  start             Create or start the disposable VM
  stop              Stop the VM
  destroy           Delete the VM and all guest state
  reset             Destroy then start a fresh VM
  provision         Re-run guest provisioning
  shell             Open a shell in the VM
  status            Show VM state and chain runner readiness
  list              List C5 chains
  run <id|slug>     Run a chain and require its exact flag
EOF
}

die() {
  printf 'c5: %s\n' "$*" >&2
  exit 1
}

info() {
  printf 'c5: %s\n' "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

validate_registry() {
  jq -e '.version == 1 and (.chains | length == 15)' "$REGISTRY" >/dev/null \
    || die "registry must contain 15 chains"
  jq -e '([.chains[].id] | length) == ([.chains[].id] | unique | length)' "$REGISTRY" >/dev/null \
    || die "registry contains duplicate ids"
  jq -e '([.chains[].slug] | length) == ([.chains[].slug] | unique | length)' "$REGISTRY" >/dev/null \
    || die "registry contains duplicate slugs"

  local registry_ids flags_ids
  registry_ids="$(jq -r '.chains[].id' "$REGISTRY" | sort -n | tr '\n' ' ')"
  flags_ids="$(jq -r '.chains[] | select(.category == "C5") | .id' "$FLAGS" | sort -n | tr '\n' ' ')"
  [[ "$registry_ids" == "$flags_ids" ]] || die "registry ids do not match C5 ids in shared/flags.json"

  local slug
  while IFS= read -r slug; do
    jq -e --arg slug "$slug" '.chains[] | select(.slug == $slug and .tier == "sim" and .category == "C5")' "$FLAGS" >/dev/null \
      || die "shared/flags.json is missing C5 sim chain: $slug"
  done < <(jq -r '.chains[].slug' "$REGISTRY")
}

vm_exists() {
  limactl list -q 2>/dev/null | grep -Fxq "$INSTANCE"
}

vm_status() {
  if vm_exists; then
    limactl list --format '{{.Status}}' "$INSTANCE" 2>/dev/null || true
  else
    printf 'NotCreated\n'
  fi
}

sync_guest() {
  limactl shell "$INSTANCE" rm -rf "$GUEST_MOUNT"
  limactl shell "$INSTANCE" mkdir -p "$GUEST_MOUNT"
  limactl copy "$C5_DIR/provision.sh" "$INSTANCE:$GUEST_MOUNT/provision.sh"
  limactl copy "$C5_DIR/registry.json" "$INSTANCE:$GUEST_MOUNT/registry.json"
  limactl copy -r "$C5_DIR/chains" "$INSTANCE:$GUEST_MOUNT/"
}

start_vm() {
  require_cmd limactl
  if vm_exists; then
    limactl start "$INSTANCE" --tty=false
  else
    info "creating $INSTANCE from $TEMPLATE"
    limactl start --name "$INSTANCE" --tty=false "$TEMPLATE"
  fi
  limactl shell "$INSTANCE" true
  sync_guest
}

ensure_kernel_headers() {
  local kernel
  kernel="$(limactl shell "$INSTANCE" uname -r)"
  if ! limactl shell "$INSTANCE" test -d "/lib/modules/$kernel/build"; then
    info "installing kernel headers for $kernel"
    limactl shell "$INSTANCE" sudo apt-get install -y --no-install-recommends "linux-headers-$kernel" \
      || limactl shell "$INSTANCE" sudo apt-get install -y --no-install-recommends linux-headers-generic
  fi
}

ensure_vm() {
  start_vm
  if ! limactl shell "$INSTANCE" test -f /var/lib/astralane-c5/base-installed; then
    info "running guest provisioning"
    limactl shell "$INSTANCE" sudo bash "$GUEST_MOUNT/provision.sh"
  fi
  ensure_kernel_headers
}

resolve_chain() {
  local query="$1" row
  row="$(jq -c --arg q "$query" '.chains[] | select((.id | tostring) == $q or .slug == $q)' "$REGISTRY")"
  [[ -n "$row" ]] || die "unknown chain: $query"
  printf '%s\n' "$row"
}

cmd_validate() {
  require_cmd limactl
  limactl validate "$TEMPLATE"
  validate_registry
  info "harness valid"
}

cmd_doctor() {
  require_cmd limactl
  require_cmd jq
  require_cmd rsync
  validate_registry
  limactl validate "$TEMPLATE" >/dev/null

  printf 'host: %s %s\n' "$(uname -s)" "$(uname -m)"
  printf 'limactl: %s\n' "$(limactl --version | awk '{print $3}')"
  printf 'vm template: %s\n' "$TEMPLATE"
  printf 'vm instance: %s (%s)\n' "$INSTANCE" "$(vm_status)"
  printf 'disk free: %s\n' "$(df -h "$C5_DIR" | awk 'NR == 2 {print $4}')"

  local total ready slug
  total="$(jq '.chains | length' "$REGISTRY")"
  ready=0
  while IFS= read -r slug; do
    if [[ -f "$C5_DIR/chains/$slug/run.sh" ]]; then
      ready=$((ready + 1))
    fi
  done < <(jq -r '.chains[].slug' "$REGISTRY")
  printf 'chain runners: %d/%d implemented\n' "$ready" "$total"

  if jq -e '.chains[] | select(.slug == "firecracker-vsock-spoof")' "$REGISTRY" >/dev/null; then
    local nested
    nested="$(limactl validate --fill "$TEMPLATE" 2>/dev/null | awk '/^nestedVirtualization:/ { print $2; exit }')"
    if [[ "$nested" != "true" ]]; then
      printf 'warning: nested virtualization is disabled; firecracker-vsock-spoof needs a nested profile\n'
    fi
  fi
}

cmd_start() {
  ensure_vm
  limactl shell "$INSTANCE" bash -c 'printf "guest: "; uname -a; printf "docker: "; docker --version 2>/dev/null || true'
}

cmd_stop() {
  if vm_exists; then
    limactl stop "$INSTANCE"
  else
    info "$INSTANCE is not created"
  fi
}

cmd_destroy() {
  if vm_exists; then
    limactl stop "$INSTANCE" >/dev/null 2>&1 || true
    limactl delete --force "$INSTANCE"
  else
    info "$INSTANCE is not created"
  fi
}

cmd_reset() {
  cmd_destroy
  cmd_start
}

cmd_provision() {
  start_vm
  limactl shell "$INSTANCE" sudo rm -f /var/lib/astralane-c5/base-installed
  limactl shell "$INSTANCE" sudo bash "$GUEST_MOUNT/provision.sh"
}

cmd_shell() {
  ensure_vm
  limactl shell "$INSTANCE"
}

cmd_status() {
  printf 'instance: %s\n' "$INSTANCE"
  printf 'status: %s\n' "$(vm_status)"
  if vm_exists; then
    limactl list "$INSTANCE"
  fi

  local total ready slug
  total="$(jq '.chains | length' "$REGISTRY")"
  ready=0
  while IFS= read -r slug; do
    if [[ -f "$C5_DIR/chains/$slug/run.sh" ]]; then
      ready=$((ready + 1))
    fi
  done < <(jq -r '.chains[].slug' "$REGISTRY")
  printf 'chain runners: %d/%d implemented\n' "$ready" "$total"
}

cmd_list() {
  printf '%-4s %-30s %-17s %-8s %s\n' ID SLUG PROFILE RUNNER STATUS
  local id slug profile status runner
  while IFS=$'\t' read -r id slug profile status; do
    if [[ -f "$C5_DIR/chains/$slug/run.sh" ]]; then
      runner=ready
    else
      runner=pending
    fi
    printf '%-4s %-30s %-17s %-8s %s\n' "$id" "$slug" "$profile" "$runner" "$status"
  done < <(jq -r '.chains[] | [.id, .slug, .profile, .status] | @tsv' "$REGISTRY")
}

cmd_run() {
  [[ $# -eq 1 ]] || die "usage: c5/run.sh run <id|slug>"
  validate_registry

  local row id slug expected runner guest_artifacts host_artifacts status output
  row="$(resolve_chain "$1")"
  id="$(jq -r '.id' <<<"$row")"
  slug="$(jq -r '.slug' <<<"$row")"
  runner="$C5_DIR/chains/$slug/run.sh"
  [[ -f "$runner" ]] || die "chain runner not implemented: c5/chains/$slug/run.sh"

  expected="$(jq -r --arg slug "$slug" '.chains[] | select(.slug == $slug) | .flag' "$FLAGS")"
  [[ -n "$expected" && "$expected" != "null" ]] || die "no expected flag for $slug"

  ensure_vm
  guest_artifacts="$ARTIFACT_DIR/$slug"
  host_artifacts="$C5_DIR/artifacts/$slug"
  limactl shell "$INSTANCE" sudo mkdir -p "$guest_artifacts"
  mkdir -p "$host_artifacts"

  info "running $slug ($id) in $INSTANCE"
  set +e
  output="$(limactl shell "$INSTANCE" sudo env \
    C5_SLUG="$slug" \
    C5_CHAIN_ID="$id" \
    C5_ARTIFACTS="$guest_artifacts" \
    C5_GUEST_MOUNT="$GUEST_MOUNT" \
    bash "$GUEST_MOUNT/chains/$slug/run.sh" 2>&1)"
  status=$?
  set -e
  printf '%s\n' "$output"
  printf '%s\n' "$output" > "$host_artifacts/run.log"

  rm -rf "$host_artifacts/guest"
  if limactl shell "$INSTANCE" test -d "$guest_artifacts"; then
    limactl copy --backend=rsync -r "$INSTANCE:$guest_artifacts" "$host_artifacts/guest" 2>/dev/null \
      || limactl copy --backend=scp -r "$INSTANCE:$guest_artifacts" "$host_artifacts/guest"
  fi

  [[ $status -eq 0 ]] || die "chain failed with status $status"
  grep -Fq -- "$expected" <<<"$output" || die "chain output did not contain expected flag"
  info "$slug ok"
}

main() {
  [[ $# -ge 1 ]] || { usage; exit 1; }
  require_cmd jq
  INSTANCE="${INSTANCE:-$(jq -r '.instance' "$REGISTRY")}"
  GUEST_MOUNT="${GUEST_MOUNT:-$(jq -r '.guestMount' "$REGISTRY")}"
  ARTIFACT_DIR="${ARTIFACT_DIR:-$(jq -r '.artifactDir' "$REGISTRY")}"

  local command="$1"
  shift

  case "$command" in
    validate) cmd_validate ;;
    doctor) cmd_doctor ;;
    start) cmd_start ;;
    stop) cmd_stop ;;
    destroy) cmd_destroy ;;
    reset) cmd_reset ;;
    provision) cmd_provision ;;
    shell) cmd_shell ;;
    status) cmd_status ;;
    list) cmd_list ;;
    run) cmd_run "$@" ;;
    help|-h|--help) usage ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
