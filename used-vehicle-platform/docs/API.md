# AutoMarket API reference (public)

Base URL: `http://localhost:8080`. All JSON unless noted.

## Identity — `/api/iam`
- `POST /v1/auth/customer-login` {username, password} — customer sign-in (rate-limited via X-Forwarded-For)
- `POST /v1/auth/dealer-login` (alias `/v1/auth/login`) {username, password} — partner dealer / staff login (SQL injection bypass)
- `POST /v1/auth/partner/login` {username, password} — fleet partner SSO login (timing enumeration)
- `POST /v1/auth/lookup-user` {identifier} — account verification & status lookup (response enumeration)
- `POST /v1/auth/session/remember` {username, password} — issue predictable stay_logged_in MD5 cookie
- `GET /v1/auth/session` (cookie `stay_logged_in`) — auto-login via persistent session cookie
- `GET /v1/users/{id}` — public seller profile (clean IDOR)
- `GET /v1/account/diagnostics?user_id=` — account diagnostic export (credential hash disclosure)
- `POST /v1/auth/register` {username, password, email} — registration (role mass assignment)
- `GET /v1/users/search?q=` — user directory (WHERE clause / UNION SQLi)
- `GET /v1/account?id=` — my profile
- `POST /v1/account` {email?, role?…} — update profile
- `GET /v1/admin/users` — administration
- `GET /v1/admin/reports` (alias `/admin-jwt`) — privileged administrative reports requiring JWT authorization (`Authorization: Bearer <jwt>`) with role `admin` (universal verifier accepting all JWT flaw variants)
- `GET /v1/reports/executive` (alias `/reports/executive`) — Executive KPI & revenue reporting (vulnerable strictly to `alg: none` bypass)
- `GET /v1/reports/audit` (alias `/reports/audit`) — Financial audit & ledger reconciliation (vulnerable strictly to weak HMAC secret `"secret"`)
- `GET /v1/reports/developer` (alias `/reports/developer`) — Developer API trace diagnostics (vulnerable strictly to embedded `jwk` parameter injection)
- `GET /v1/reports/partner-sync` (alias `/reports/partner-sync`) — Dealership network identity federation (vulnerable strictly to `jku` header URL injection / SSRF keyset fetch)
- `GET /v1/reports/fleet-kms` (alias `/reports/fleet-kms`) — Fleet key management telemetry (vulnerable strictly to `kid` parameter filesystem traversal, e.g. `/dev/null`)
- `GET /v1/reports/compliance` (alias `/reports/compliance`) — Certificate compliance (vulnerable strictly to RS256/HS256 algorithm confusion with public key bytes)
- `GET /v1/auth/jwks` (alias `/.well-known/jwks.json`) — JWKS key discovery endpoint (supports `?k=` for simulated remote keyset discovery)
- `GET /public-key.pem` — server public key exposure (for algorithm confusion)
- `POST /v1/auth/password/forgot` {email} → reset link by email (Host header poisoning)
- `POST /v1/auth/password/reset` {email, token, new_password, user_id?} → reset confirmation
- `POST /v1/account/password` {username, old_password, new_password}
- `POST /v1/auth/2fa/enable?username=` then `POST /v1/auth/2fa/verify` {username, code}
- OAuth: `GET /v1/oauth/authorize?client_id&redirect_uri&response_type` →
  `POST /v1/oauth/clients` {redirect_uris, logo_url} → `GET /v1/oauth/link?email&oauth_id`
- `POST /v1/orders/quote?username&price=` — price a vehicle
- `GET /v1/checkout/state?step=`
- `POST /v1/customers/financing/apply` {applicant_name, loan_amount, vehicle_id, employment, ssn?} — customer auto loan financing application
- `GET /v1/customers/financing/status?app_id=` — loan application underwriting and approval status (IDOR reconnaissance)
- `PUT /v1/customers/financing/profile` {app_id, ...} — financing applicant and underwriting update (nested mass assignment)
- `POST /v1/customers/financing/disburse` {app_id, escrow_account} — loan escrow disbursal release to dealership
- `POST /v1/sso/saml/verify` {saml_response} — federated SAML assertion sign-in (multi-assertion responses accepted)
- `POST /v1/sso/token/exchange` {claims…} — OIDC profile claim merge (duplicate-key claim handling)
- `GET /v1/sso/session/{sid}` — inspect a federated session
- `GET /v1/sso/avatar-cache` — last processed avatar claim and fetch diagnostics
- `GET /v1/oauth/authorize?client_id&redirect_uri&response_type&state&code_challenge&code_challenge_method` — marketplace partner sign-in (code or implicit)
- `POST /v1/oauth/token` {code, client_id, code_verifier?, state?} — authorization-code exchange → `{access_token, user, flags}`
- `POST /v1/oauth/federated/link` {email, oauth_id} — attach a social identity to a mailbox
- `GET /v1/oauth/federated/login?oauth_id=` — sign in with a linked provider identity
- `GET /v1/reports/vendor-x5u` (Bearer JWT) — vendor key-distribution console using a hosted (`x5u`) signing key
- `GET /v1/reports/vendor-kms` (Bearer JWT) — vendor hardware key inventory using a key-id (`kid`) resolver
- `POST /v1/invoices` {user, amount} — issue a customer invoice
- `GET /v1/public/activity` — public invoice activity feed (masked customers, reference hashes)
- `GET /v1/invoices/{invoice_id}` — customer invoice
- `GET /v1/invoices/by-hash/{ref_hash}` — invoice lookup by reference digest
- `GET /v1/orgs/members` — workspace member directory
- `POST /v1/orgs/invite` {email, role} — invite a member (admin seats limited)
- `POST /v1/orgs/members/import` (multipart: email, role) — bulk workspace import
- `POST /v1/auth/otp/request` {email} — email a login verification code
- GraphQL `POST /v1/graphql` {query} — partner identity gateway (login/OTP/admin operations)

## Catalog — `/api/catalog`
- `POST /v1/dealers/login` {username, password}
- `GET /v1/vehicles/search?...` / `POST /v1/vehicles/search` — filter listings (`?q=`, `?make=`, `?maxPrice=`, `?minYear=`)
- `GET /v1/vehicles/{id}` — detail (specs, features, reviews, VIN, location)
- `GET /v1/dealers` — partner dealer directory
- `GET /v1/dealers/wholesale/inventory` — partner dealer B2B wholesale auction catalog
- `GET /v1/dealers/inventory?status=` — dealer stock listing (embargo-aware status filter)
- `POST /v1/dealers/wholesale/invoice-template` {template} — wholesale invoice/receipt template renderer
- `POST /v1/payments/create` {plaintext} — issue encrypted payment confirmation token (returns `ciphertext_hex` = IV‖ciphertext)
- `POST /v1/payments/decrypt` {ciphertext_hex} — decrypt a payment confirmation token
- `GET /v1/dealers/wholesale/appraisals/public-stats[?verbose=true]` — wholesale auction metrics and configuration diagnostics (information disclosure)
- `POST /v1/dealers/wholesale/bids` {lotId, dealerId, bidAmount, dealerTier, signature} — B2B wholesale vehicle bid submission and signed ticket generation
- `POST /v1/dealers/wholesale/contracts/export` {contract_ticket, template_url} — signed wholesale purchase contract generation and partner webhook dispatch (internal SSRF)
- `POST /v1/customers/concierge/book` {customerName, vehicleId, preferredTime, deliveryAddress, customInstructions} — VIP customer concierge test-drive handover booking (stores unescaped instructions)
- `GET /v1/customers/concierge/bookings/{id}` — concierge booking status lookup
- `POST /v1/customers/watchlist`, `GET /v1/customers/watchlist` — customer saved vehicle watchlist
- `GET /v1/customers/service-history/{vin}` — verified vehicle maintenance history
- `GET /v1/news`, `GET /v1/news/{id}` — car news and updates
- `POST /v1/listings` {make, model, price} — publish
- `PATCH /v1/listings/{id}/price` {price}
- `POST /v1/listings/{id}/photos` (multipart `photo`) → `{url}`
- `GET /v1/photos/{name}[?exec=1]` — serve photo
- `GET /v1/gallery?file=` — gallery image
- `PUT /v1/account/preferences` — display preferences
- `GET /v1/account/role` — my access level
- `POST /v1/account/import` {data} — import preferences backup
- `POST /v1/promotions/apply` {code}
- `GET /v1/account/balance` — wallet
- `POST /v1/orders` {vehicleId, price, user}
- `POST /v1/checkout/select|pay|confirm` {user}
- `GET /v1/documents?doc=` (alias `/v1/documents/{id}`) — dealer document center fetch (path param flows through to internal dispatch)
- `POST /v1/admin/onboarding` {dealer, notes} — dealership onboarding intake (partner-submitted notes stored verbatim)
- `GET /v1/admin/onboarding[/{id}]` — onboarding queue and application detail
- `POST /prefs/update` {…} — merge storefront preferences (also accepts nested objects)
- `POST /v1/auth/demo-session` — start an admin demo session (sets the demo admin cookie)
- `POST /v1/giftcards/redeem` {code} — redeem a storefront gift card
- `POST /v1/wallets/transfer` {from, to, amount} — wallet-to-wallet transfer
- `POST /v1/wallets/withdraw` {user, amount} — wallet withdrawal (replica-backed balance check)
- `POST /v1/wallets/deposit` {user, amount} — wallet top-up
- `POST /v1/fx/convert` {direction} — USD/EUR conversion using floor/ceil pricing
- `POST /v1/checkout/cart` {user, vehicleId} — add a vehicle to the checkout cart
- `POST /v1/checkout/confirm` {user} — confirm the checkout (price captured at cart write)
- `GET /v1/dealers/promo` — promotional banner for the storefront (CDN-cached)
- `POST /v1/dealers/invoices/render` {template, dealer} — render a dealer invoice template
- GraphQL `POST /graphql` {query} — vehicles, privatePosts, mutations login/createListing/updatePrice

## Messaging — `/api/lead`
- `GET /v1/inquiries?id=` — track an inquiry
- `GET /v1/market/report?sort=` — market reports
- `POST /v1/inquiries/search` {filter}
- `GET /v1/dealers/concierge/briefing?booking_id=` — dealership staff VIP concierge handover briefing generator (second-order Jinja2 SSTI)
- `GET /v1/dealers/telemetry/download?file=` — commercial fleet hardware telemetry download (nested path traversal)
- `POST /v1/dealers/telemetry/manifest` (XML body with `X-Fleet-Token` header) — commercial fleet sensor manifest synchronization (secret-gated XXE)
- `POST /v1/dealers/{id}/contact` — JSON message, or XML body with `Content-Type: application/xml` (CRM import format)
- `POST /v1/listings/{id}/badge` (multipart `file`, SVG badges welcome)
- `GET /v1/integrations/validate-dtd?dtd_url=&sample=` — partner-feed DTD validation
- `GET /v1/listings/import-photos?url=` — import photos from a URL
- `POST /v1/listings/photo-preview` {image_url}
- `GET /v1/share/go?to=` — share links
- `GET /v1/listings/{id}/brochure.pdf?listing_id=` — printable brochure
- `GET /v1/dealers/verify-domain?domain=` — domain ownership check
- `POST /v1/account/export` {filename, content}
- `GET /v1/welcome?name=` — localized greeting
- `POST /v1/dealers/email-template` {name, message}
- `POST /v1/orders/{id}/invoice` {dealer, total}
- `GET /v1/integrations/feed-sync?manifest_url=&legacy=` — partner feed manifest synchronization (cloud metadata SSRF; `legacy=1` allows IMDSv1 HTTP)
- `GET /v1/dealers/integrations/inventory?status=` — partner dealer integrated inventory listing (duplicate-parameter embargo handling)
- `POST /v1/dealers/integrations/test-connection` {endpoint} — dealer webhook/endpoint connectivity tester (gopher/dict/ldap/file schemes)
- `GET /v1/dealers/integrations/resolve-and-fetch?host=` — DNS resolution + content fetch integration check
- `POST /v1/dealers/telemetry/bulk-upload` (multipart `file`, ZIP) — batch telemetry log ingestion (archive extraction)
- `POST /v1/orders/sign` {order} — integrity-sign an order payload (compact JSON of the order) → `{signature}`
- `POST /v1/orders/verify` {message, signature} — verify an order signature (latin-1 message bytes)
- `GET /v1/orders/sequence` — next order sequence number issuer
- `POST /v1/leads/saved-search` {vehicle, …} — save a lead search for later dispatch
- `GET /v1/leads/saved-searches/run` — run all saved searches and return matches
- `POST /v1/dealers/profile` {domain, …} — save a dealer profile
- `POST /v1/dealers/profile/verify` — re-check the stored dealer profile
- `GET /v1/dealers/integrations/imds-sync?url=` — sync instance metadata through the integration client (accepts `X-aws-ec2-metadata-token`)
- `GET /v1/listings/import-gallery?u=` — import a gallery from an allowlisted CDN URL
- `GET /v1/redirect/307?to=` — outbound redirect helper (preserves method and body)
- `POST /v1/listings/photo-proxy` {url, payload} — import a photo through the proxy
- `POST /v1/dealers/integrations/graphql-preview` {endpoint, query} — preview a partner GraphQL endpoint
- `GET /v1/notifications/stream` — live dealer notification stream (SSE)
- Real-time chat `ws://<host>:5001/chat`, history `GET /chat-history`

## Storefront web — `/api/web` (HTML pages and account actions)
- `GET /search?q=` — results page
- `GET /vehicles/{id}` — detail page
- `GET /vehicles/{id}/reviews[?website=]` — buyer reviews
- `GET /search/suggest?q=` — type-ahead snippet
- `GET /account/notes[?note=]` — private notes
- `GET /offers?q=` — promotions (legacy renderer)
- `POST /account/email|notifications|password|phone|address|privacy|profile|settings` — settings
- `GET /account/leave?to=` — leave confirmation
- `GET /account/delete`, `GET /account/profile?email=` — account pages
- `GET /go?to=` — outbound redirector
- `GET /app/tour/render?prefs=` — guided tour renderer (accepts a preferences object)
- `GET /app/live-help/dispatch?origin=&data=` — live-help message dispatch for embedded widgets
- `POST /app/shortlink/resolve` {html} — shortlink preview renderer
- `GET /v1/xsleaks/compare?guess=` — compare a candidate against the private comparison secret
- `POST /v1/xsleaks/submit` {secret} — submit a recovered comparison secret

## Shopping assistant — `/api/ai`
- `POST /chat` {message} — ask about cars, prices, orders
- `POST /chat/scanned` — same, with the safety filter on
- `GET /chat/html?message=` — printable answer
- `GET /tools`, `GET /sent`, `POST /reset`
- `POST /v1/admin/assist` {task, url?} — governance support-agent run (owns a bounded tool plan and follows tool output)
- `GET /v1/admin/exfil` — agent outbox and recent runs
- `GET /v1/admin/governance` — console integration status; `POST /v1/admin/assist/reset`

## Fleet Operations & Diagnostics — `/api/fleet-ops`
- `GET /health` — service health and Docker socket detection
- `GET /v1/docker/containers` — container inspection via mounted host Docker daemon UNIX socket (DOCKER-RUN-01)
- `POST /v1/diagnostics/process-inspect` {pid} — process status and capability evaluation for `CAP_SYS_PTRACE` and `CAP_DAC_OVERRIDE` (DOCKER-RUN-02)
- `GET /v1/diagnostics/host-mount?file=` — sensitive host directory file retrieval (DOCKER-RUN-03)
- `GET /v1/diagnostics/seccomp-status` — container seccomp syscall filtering status check (DOCKER-RUN-04)
- `GET /v1/diagnostics/network-bridge` — promiscuous raw socket network interface inspection via `CAP_NET_RAW` (DOCKER-NET-01)
- `GET /v1/diagnostics/cgroups-limits` — kernel cgroup pids/memory limit verification (DOCKER-RES-01)
- `GET /v1/diagnostics/service-discovery` — Docker embedded DNS topology resolver (DOCKER-NET-02)
- `GET /v1/diagnostics/lateral-database[?target=]` — lateral bridge database access verification (DOCKER-CHAIN-04)
- `GET /v1/diagnostics/process-table[?filter=]` — host PID namespace process listing (FLEET-HOST-01)
- `GET /v1/diagnostics/process-environ?pid=` — host process environment inspection (FLEET-HOST-01)
- `POST /v1/diagnostics/process-signal` {pid, signal} — signal delivery to host PIDs (FLEET-HOST-02)
- `GET|POST /v1/diagnostics/core-pattern` {pattern} — kernel core-dump handler configuration (FLEET-HOST-03)
- `GET /v1/diagnostics/procfs-status` — procfs mount writability report (FLEET-HOST-04)
- `POST /v1/diagnostics/cgroup-escape` {payload} — cgroup notify_on_release handler test (FLEET-HOST-05)
- `GET /v1/diagnostics/block-devices` — host block device enumeration (FLEET-HOST-06)
- `POST /v1/diagnostics/mount-device` {device, mountpoint} — host device mount helper (FLEET-HOST-07)
- `GET /v1/diagnostics/mounts` — container mount table (FLEET-HOST-07)
- `GET /v1/diagnostics/suid-binaries` — setuid binary inventory (FLEET-HOST-08)
- `GET /v1/diagnostics/capabilities` — effective Linux capability report (FLEET-HOST-09)
- `GET /v1/diagnostics/security-profiles` — seccomp/AppArmor/SELinux confinement status (FLEET-HOST-10)
- `GET /v1/diagnostics/service-account` — orchestration service-account token status (FLEET-HOST-11)
- `GET /v1/dependencies` — runtime dependency and CVE inventory (FLEET-HOST-12)
- `GET /v1/ci/registry/images` — build registry contents (mutable tags)
- `POST /v1/ci/registry/retag` {image, tag, digest} — move a release tag to another artifact
- `POST /v1/ci/cache/seed` {cache_key, origin} — publish layers into the shared build cache
- `POST /v1/ci/pipeline/queue` {repo, base_cache?, image?} — queue a release pipeline (snapshots artifact state)
- `POST /v1/ci/pipeline/run` {queue_id} — execute a queued pipeline
- `GET /v1/ci/sbom/{image}` — dependency document for a build artifact
- `GET /v1/mesh/envoy/admin` — workload sidecar management interface
- `POST /v1/mesh/envoy/config` {uid_bypass?, …} — apply sidecar routing/config changes
- `GET /v1/mesh/mtls/status` — mesh transport security mode
- `POST /v1/mesh/probe` {peer, client_cert?, src_uid?} — connectivity probe between workloads
- `GET /v1/mesh/spiffe/peers` — workload identities in the trust bundle
- `POST /v1/mesh/spiffe/hijack` {identity} — register a workload identity
- `GET /v1/mesh/workload/protected[?identity=]` — call the protected payments endpoint
- `POST /v1/runtime/bpf/events/configure` {ringbuf_bytes, mtu} — runtime agent trace-buffer sizing
- `POST /v1/runtime/events/emit` {count, tracepoint?} — emit synthetic syscall events
- `POST /v1/runtime/exec/fileless` {payload} — run a program from an in-memory file
- `GET /v1/runtime/agent/status` — supervision/event-loss status
- `POST /v1/k8s/admission/validate` {workload, tag} — pre-admission image validation (issues a token)
- `POST /v1/k8s/registry/tag` {workload, tag, policy} — push image content under a tag
- `POST /v1/k8s/pods/admit` {token} — admit a pod for a validated workload
- `POST /v1/k8s/webhooks/remove` {name} — remove a mutating webhook configuration
- `POST /v1/k8s/pods/{pod}/ephemeral-containers` {image, target_container?} — attach a debug container to a pod
- `GET /v1/k8s/status` — webhook/admission state

## Connection handling — `/api/smuggle`
- `POST /v1/csd/static-redirect?conn=` — static redirect helper (answer written before the request body is read)
- `POST /v1/csd/victim-navigate?conn=&path=` — first-party navigation replay on a pooled connection
- `GET /v1/csd/exfil` — collected connection records; `GET /v1/csd/admin-panel` (internal surface); `POST /v1/csd/reset`
- `GET /csd-poc` — cross-origin demo page for the connection sequence (browser walkthrough)
- `POST /v1/gateway/http2/desync` {mode, raw} — simulate an HTTP/2 front-end downgrading to a back end (`mode`: `H2.CL`/`H2.TE`)
- `POST /v1/zero-cl/simulate` (raw text body) — simulate a backend reading a zero-length body and treating the remainder as a new request
- `POST /cache/purge` — flush the simulated response cache

## Partner documents — `/api/ser`
- `POST /v1/session/restore` {data} — restore a stored session blob (base64)
- `POST /v1/profile/import` {yaml} — import a dealer profile document
- `POST /v1/object/import` {data} — import a serialized partner object
- `POST /v1/phar/upload` (multipart `file`) — upload a partner package archive
- `POST /v1/yaml/rules` {yaml} — load matching rules for the import pipeline
- `POST /v1/dotnet/deserialize` {data} — import a .NET partner payload (base64)
- `GET /health`, `POST /v1/internal/reset`

## Storefront SPA — `/`
Home, Browse (filters + sort), Vehicle detail (tabs, gallery, reviews), Compare,
Sell your car (3-step), Checkout, Dealers, News, Reviews, EMI calculator,
Assistant, Sign in, Register, Account, Garage notes, Receipt, Admin console
(`/admin`, `/admin-dashboard` — customers, dealers, applications, Document
Center at `/admin/documents?doc=`).

