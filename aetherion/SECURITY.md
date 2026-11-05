# Security and isolation

## Intended use

Aetherion is an intentionally vulnerable application for local security research, benchmark evaluation, and agent training. It is not a production application and must not be exposed to the internet, a shared LAN, or any environment containing real user data.

Binding is limited to `127.0.0.1` for the two host-facing services. No service publishes an unauthenticated port on all interfaces.

## Deliberate weaknesses

The repository contains real application-layer vulnerabilities:

- Broken JWT validation and key-selection logic
- OIDC redirect validation and account-linking flaws
- Shared-cache deception and cache poisoning
- Stored script injection through a marketing fragment
- Client-side path traversal into an admin endpoint
- postMessage origin bypass and token relay
- Race conditions, prototype pollution, OTP brute-force batching
- XS-Leaks via an authenticated image oracle
- SSRF into attacker-controlled internal services
- SAML assertion confusion
- Order and refund object-level authorization failures
- Inventory and checkout price-integrity races
- Password reset token prediction and host-header injection
- Email verification bypass and cross-site account mutation
- Support ticket IDOR and stored script execution
- SQL injection, path traversal, webhook verification bypass, and template injection
- JSONP/CORS data leaks, GraphQL object IDOR, coupon stacking, and export authorization bypass
- Simulated secret stores for S3, kubelet, instance user-data, CI, registry, and Terraform state

Grading and solution material is kept in `benchmark/`.

## Safety boundaries

The environment does not include any of the following:

- A mounted Docker socket
- Host filesystem mounts
- Privileged containers
- Host PID, host network, or added Linux capabilities
- Kernel exploits
- Real cloud credentials or live metadata endpoints
- Real Kubernetes, Envoy, CI, or containerd administrative interfaces

The `lab` service emulates those layers with deterministic HTTP oracles. Calls to the fake Docker, kubelet, Envoy, CI, containerd, S3, registry, Terraform, and assistant endpoints stay inside the Compose network and return fictional evidence and flags. The benchmark measures whether an agent can follow a chain and recognize privileged infrastructure, not whether it can break out of a real host.

## Network model

- `edge` is reachable from the host at `127.0.0.1:18080` and from the benchmark network as `aetherion.local:8080`.
- `lab` is reachable from the host at `127.0.0.1:18081` and from the benchmark network as `attack.aetherion.local:8081` and `cdn.aetherion.local:8081`.
- `api`, `idp`, `bot`, and `db` are not published to the host.
- All services run on a dedicated bridge network named `aetherion-net`.

The review bot runs Chromium with `--no-sandbox` because it operates inside an unprivileged container. The bot is only reachable by the API over the internal network using a shared review token.

## Credentials and secrets

All credentials and signing keys in this repository are fictional and committed on purpose so the environment is reproducible. They grant access only to this lab. Do not reuse them anywhere else.

## Reset before real evaluation

Shared mutable state is part of the benchmark. Use `./scripts/reset.sh` to remove the database volume and restart all services. The nginx cache is also cleared during reset.

## Reporting

This project is not an upstream product. If you discover an unintended safety issue, such as a path that reaches a real host resource rather than a lab oracle, stop the stack and document the reproduction. Do not run the benchmark against third-party systems.
