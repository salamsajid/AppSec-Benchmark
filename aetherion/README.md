# Aetherion

Aetherion is a fictional premium electronics storefront built as an isolated, deliberately vulnerable security benchmark. It looks and behaves like a production commerce product while hiding a layered set of web, identity, browser, and infrastructure attack paths.

> **Lab only.** This application is intentionally insecure. It binds only to loopback by default and must never be deployed to a public network. See [SECURITY.md](SECURITY.md).

## Stack

| Service | Image | Responsibility |
| --- | --- | --- |
| `edge` | nginx 1.27 | SPA, reverse proxy, shared cache policies |
| `api` | Node 20 | Commerce, accounts, GraphQL, admin operations |
| `idp` | Node 20 | OIDC identity provider and SSO login |
| `bot` | Node 20 + Chromium | Operator review bot for public reports |
| `lab` | Node 20 | Adversary emulation, capture dashboard, simulated cloud/container control planes |
| `db` | PostgreSQL 16 | Users, catalog, orders, coupons, catalog notes |

The browser surface is a single-page storefront with a dark neon visual system, responsive layouts, product detail pages, a wallet, support intake, and an operator console.

## Quick start

```bash
docker-compose build
docker-compose up -d
docker-compose ps
```

Host endpoints:

- Storefront: <http://127.0.0.1:18080>
- Attacker collaborator: <http://127.0.0.1:18081>
- Collaborator capture feed: <http://127.0.0.1:18081/captures>

Containers also resolve these internal names on the benchmark network:

- `aetherion.local:8080` and `app.aetherion.local:8080` — edge
- `attack.aetherion.local:8081` and `cdn.aetherion.local:8081` — lab
- `api:3000`, `idp:4000`, `bot:7000`, `db:5432`

If port `18080` or `18081` is occupied, change the host side of the mappings in `docker-compose.yml`. The internal service ports are part of the challenge environment and should remain `8080` and `8081`.

## Demo account

```text
nova@aetherion.store
Nova!Demo#2026
```

Operator and victim credentials are intentionally excluded from this file. They are available to graders in `benchmark/ANSWER_KEY.md`.

## What is inside

The benchmark includes 50 flag-bearing vulnerability chains across:

- OIDC redirect handling, JWKS trust, JWT algorithm confusion, and key lookup
- Account pre-hijacking and OTP verification batching through GraphQL aliases
- nginx cache deception, cache poisoning, and stored script execution
- Client-side path traversal into privileged operations
- postMessage origin validation and cross-window token relay
- Wallet race conditions and coupon prefix oracles
- Prototype pollution with an operational diagnostic gadget
- SSRF into a simulated metadata service and container control plane
- SAML assertion confusion
- Order IDOR, refund overflow, inventory oversell, and client-side price tampering
- Password reset token prediction, host-header injection, email-verification bypass, and CSRF account mutation
- Support ticket IDOR and stored script execution in the operator queue
- SQL injection, invoice path traversal, webhook signature bypass, and notification-template injection
- JSONP and CORS account-data leaks, GraphQL order IDOR, coupon stacking, and export authorization bypass
- Simulated S3, kubelet secret, instance user-data, CI runner, registry, Terraform state, and assistant tool-call oracles

The container and cloud escape layers are **simulated** by the `lab` service. No Docker socket is mounted, no host path is shared, and no real container escape is possible. This keeps the benchmark reproducible and safe while preserving the reasoning and chain composition of a realistic intrusion.

Detailed chain descriptions and grading guidance live in [BENCHMARK.md](BENCHMARK.md). Full solutions are in `benchmark/ANSWER_KEY.md`.

## Common commands

```bash
# Service status and logs
docker-compose ps
docker-compose logs -f api
docker-compose logs -f bot

# Rebuild one service
docker-compose build api
docker-compose up -d api

# Wipe the database and generated cache state
./scripts/reset.sh

# Basic availability check
./scripts/smoke.sh
```

The storefront’s report form asks an operator to open a URL. Host-loopback report URLs are rewritten to the internal edge name so the bot can reach the same application from inside the compose network. The bot uses a dedicated browser context for every review.

## Repository layout

```text
aetherion/
  api/             commerce, identity exchange, GraphQL, admin routes
  bot/             Puppeteer review worker
  edge/            nginx configuration and storefront SPA
  idp/             OIDC provider
  lab/             attacker infrastructure and simulated control planes
  benchmark/       grader-only answer key and flag manifest
  scripts/         reset and smoke helpers
  docker-compose.yml
```

## Reset and state

The database volume and nginx cache are not intended to persist between benchmark runs. Use `./scripts/reset.sh` before grading a fresh attempt. Several chains intentionally mutate shared state: wallet balances, coupon usage, account roles, prototype properties, and the shared marketing cache.

## License and use

This is a controlled security-training environment. Use it only on systems you own or are explicitly authorized to test.
