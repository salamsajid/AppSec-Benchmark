# Security policy

## This is an intentionally vulnerable target

AstraLane exists to be broken. It contains deliberate authentication bypasses, cryptographic weaknesses, parser differentials, injection flaws, denial-of-service paths, live vulnerable target services, and a temporary legacy proof-lab surface that is being replaced. It is **not** a template, a hardened reference, or a production system.

Run it only on a machine you control, with the published ports bound to loopback. Do not deploy it to a cloud VM, a shared host, a corporate network, or the public internet. Do not connect it to real identity providers, payment processors, email, or data stores.

## Safety boundaries

The stack is designed so that the realistic-looking attacks stay inside the lab:

- All host-published ports bind `127.0.0.1` only.
- PostgreSQL, Redis, the API, IdP, authz service, federation subgraph, and all live target services are loopback-only where published.
- No service is privileged, no container mounts a host filesystem, and the Docker socket is never mounted.
- Node services drop all Linux capabilities and set `no-new-privileges`.
- The 28 `real` chains run in dedicated Node, Python, HTTP/2, Go, QPACK, Java, TURN, WASI, Kafka, Playwright browser, WebTransport, and S3-compatible target containers. They are actual vulnerable code paths, but they are not host kernel exploits and cannot escape their containers.
- The 15 remaining chains are **legacy migration entries** in the `lab` service, not part of the real-only target design. All 15 are C5 kernel/container/control-plane chains and will move to a disposable VM harness. The legacy lab checks proof contracts and does not execute exploits or grant host access.
- The SAML key and certificate are throwaway lab material, mounted read-only.
- All members, bookings, inventories, and partner records are synthetic seed data. The admin password is random per boot.

The application-tier `concierge` SSRF is intentionally able to reach internal service names such as `subgraph` and `lab`. It refuses link-local cloud metadata endpoints (`169.254.0.0/16`, `metadata.google.internal`, `metadata.goog`, `fd00:ec2::254`) so a careless cloud deployment cannot use it to fetch real instance credentials. Do not rely on that check as a production SSRF defense.

## Known intentional weaknesses

The application and real-target tiers include, among others:

- A custom P-256 signer with a biased nonce.
- An assertion-order SAML validation flaw.
- An unauthenticated CBC cursor format with a padding oracle.
- A clock-independent secret comparison that leaks a prefix through CPU burn.
- A Lua wallet transaction that can partially commit.
- A fail-open authorization timeout under event-loop starvation.
- An unrestricted internal `fetch` reachable by authenticated members.
- DPoP replay protection keyed by non-canonical JWK JSON.
- A CBOR parser that applies policy to the first duplicate key and authorization to the last.
- UTF-8/cp037 charset parser disagreement, chunked trailer trust, ESI fragment cache poisoning, Python template evaluation, a PostgreSQL ICU collation authorization bypass, AsyncLocalStorage context loss through a native callback, WASI fd-table truncation, unsafe Kafka DLQ deserialization, zk bit-range underconstraint, WebTransport capsule origin/stream confusion, RSC closure cycles, browser DOM XSS/keylogging, and AI memory poisoning.

Do not reuse any of this code. Do not remove the loopback bindings or the lab sandbox to make the benchmark "more realistic."

## Secrets

All secrets in this repository are lab constants: database password, Redis (no auth), client secret, cursor key, lab token, SAML private key, and flags. They are public by design. The SAML keypair is not trusted by any real system. If you fork this project, generate a new keypair and change every static secret before running it anywhere non-local.

The grader-only answer key (`benchmark/ANSWER_KEY.md`, `benchmark/answer-key.json`) must not be served by the edge, copied into a container, or handed to the agent under test.

## Data and reset

State lives in the `astralane_db` Docker volume and in Redis. `./scripts/reset.sh` removes both and reseeds. Treat those volumes as disposable synthetic data.

## Reporting

This is a training artifact, not a real service, so there is no coordinated vulnerability disclosure process for the intentional flaws. If you discover a defect that escapes the intended safety boundary — for example, something in the lab that actually reaches the host, or a way for the published surface to affect systems outside the Compose network — stop the stack and report it privately to the maintainer of your copy.

If you are running a benchmark evaluation, keep the target isolated from the grading harness. A successful flag is not authorization to access the host, the Docker daemon, or unrelated services.
