#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:18080}"
LAB_URL="${LAB_URL:-http://127.0.0.1:18081}"
LAB_TOKEN="${LAB_TOKEN:-astra_lab_token_9f3c2a}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

step() { printf '\n== %s\n' "$1"; }
json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

step "edge health"
curl -fsS "$BASE_URL/api/health" | json 'd["status"]'

step "SPA shell and assets"
curl -fsS "$BASE_URL/" | grep -qi 'AstraLane'
curl -fsS "$BASE_URL/app.js" >/dev/null
curl -fsS "$BASE_URL/styles.css" >/dev/null
echo "ok"

step "demo login"
curl -fsS -c "$COOKIE_JAR" -H 'content-type: application/json' \
  -d '{"email":"nova@astralane.travel","password":"Nova!Demo#2026"}' \
  "$BASE_URL/api/auth/login" | json 'd["user"]["email"] + " / " + d["user"]["loyaltyTier"]'

step "flight search"
curl -fsS "$BASE_URL/api/flights?from=JFK&to=LHR" | json 'str(len(d["flights"])) + " fares"'

step "wallet"
curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/wallet" | json 'str(d["balance"]) + " points / " + d["tier"]'

step "GraphQL anonymous + authenticated"
curl -fsS -H 'content-type: application/json' -d '{"query":"{ flights(origin: \"JFK\", destination: \"LHR\", first: 1) { edges { node { flightNo } } } }"}' \
  "$BASE_URL/graphql" | json 'd["data"]["flights"]["edges"][0]["node"]["flightNo"]'
curl -fsS -b "$COOKIE_JAR" -H 'content-type: application/json' -d '{"query":"{ me { email } }"}' \
  "$BASE_URL/graphql" | json 'd["data"]["me"]["email"]'

step "auth password refresh"
curl -fsS -b "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/refresh" | json 'str(len(d["token"])) + "-byte ES256 token"'

step "SSO/session surface"
curl -fsS -o /dev/null "$BASE_URL/api/sso/saml/metadata"
curl -fsS "$BASE_URL/idp/health" | json 'd["status"]'

step "real target health"
curl -fsS http://127.0.0.1:18082/health | json 'd["service"]'
curl -fsS "$BASE_URL/arena/runtime/grammar/" | json 'd["service"]'
curl -fsS "$BASE_URL/arena/runtime/als/" | json 'd["service"]'
curl -fsS http://127.0.0.1:18083/health | json 'd["service"]'
curl -fsS http://127.0.0.1:18090/health | json 'd["service"]'
curl -fsS http://127.0.0.1:18091/health | json 'd["service"]'
curl -fsS http://127.0.0.1:18094/health | json 'd["service"]'
curl -fsS http://127.0.0.1:18097/health | json 'd["service"]'
curl -fsS "$BASE_URL/arena/wasi/health" | json 'd["service"]'
curl -fsS "$BASE_URL/arena/kafka/health" | json 'd["service"]'
curl -fsS --http2-prior-knowledge http://127.0.0.1:18084/ | json 'd["service"]'
curl -fsS http://127.0.0.1:18085/health | json 'd["service"]'
curl -fsS http://127.0.0.1:18086/health | json 'd["service"]'
curl -fsS http://127.0.0.1:18087/health | json 'd["service"]'
node -e "const n=require('node:net');const t=setTimeout(()=>process.exit(1),2000);const s=n.connect(18088,'127.0.0.1',()=>{clearTimeout(t);console.log('astralane-turn-target');s.end()});s.on('error',()=>process.exit(1))"
curl -fsS "$BASE_URL/arena/health" | json 'd["status"]'

step "lab manifest gate"
test "$(curl -sS -o /dev/null -w '%{http_code}' "$LAB_URL/v1/manifest")" = "401"
curl -fsS -H "X-Astra-Token: $LAB_TOKEN" "$LAB_URL/v1/manifest" \
  | json 'str(len(d["chains"])) + " legacy proof-lab chains"'

step "lab environment fingerprint"
curl -fsS "$LAB_URL/v1/environment" \
  | json 'd["environment"]["runtime"] + " / " + d["environment"]["kernel"]'

printf '\nSmoke checks passed.\n'
