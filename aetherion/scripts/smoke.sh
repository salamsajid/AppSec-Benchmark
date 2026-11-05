#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:18080}"
LAB_URL="${LAB_URL:-http://127.0.0.1:18081}"

failures=0

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local actual
  actual="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)"
  if [[ "$actual" == "$expected" ]]; then
    printf 'ok   %-32s %s\n' "$label" "$actual"
  else
    printf 'FAIL %-32s expected %s, got %s\n' "$label" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

check "storefront" "$BASE_URL/" 200
check "stylesheet" "$BASE_URL/styles.css" 200
check "application bundle" "$BASE_URL/app.js" 200
check "support widget" "$BASE_URL/widget/chat.html" 200
check "api health" "$BASE_URL/api/health" 200

for asset in phone laptop buds watch tv speaker tablet camera mark fold phone-mini desktop dock headphones ring glasses lens air projector controller handheld; do
  check "asset $asset" "$BASE_URL/assets/$asset.svg" 200
done

products="$(curl -sS "$BASE_URL/api/catalog/products")"
if PRODUCT_COUNT="$(node -e 'const d=JSON.parse(process.argv[1]); if (!Array.isArray(d.products) || d.products.length < 20) process.exit(1); process.stdout.write(String(d.products.length))' "$products" 2>/dev/null)"; then
  printf 'ok   %-32s %s products\n' "catalog data" "$PRODUCT_COUNT"
else
  printf 'FAIL %-32s invalid or short catalog\n' "catalog data"
  failures=$((failures + 1))
fi

idp="$(curl -sS "$BASE_URL/idp/health")"
if node -e 'const d=JSON.parse(process.argv[1]); if (d.status !== "ok") process.exit(1)' "$idp" 2>/dev/null; then
  printf 'ok   %-32s healthy\n' "identity provider"
else
  printf 'FAIL %-32s unhealthy\n' "identity provider"
  failures=$((failures + 1))
fi

check "collaborator" "$LAB_URL/health" 200
check "capture feed" "$LAB_URL/captures" 200

if (( failures > 0 )); then
  echo
  echo "$failures smoke check(s) failed" >&2
  exit 1
fi

echo
echo "All smoke checks passed."
