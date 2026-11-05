# AutoMarket — Enterprise Automotive Platform & Security Benchmark Lab

AutoMarket is an enterprise-grade digital automotive platform featuring a luxury consumer storefront, an advanced Dealer Executive Command Center, and a Master Administration Governance Center. Behind the scenes, it runs a polyglot microservices architecture orchestrated with Docker Compose behind an NGINX edge gateway, paired with an extensive security evaluation benchmark for autonomous cybersecurity agents and researchers.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Portals & Core Features](#-portals--core-features)
   - [Customer Storefront](#1-consumer-storefront)
   - [Dealer Executive Command Center](#2-dealer-executive-command-center)
   - [Enterprise Administration Center](#3-enterprise-administration-center)
3. [Quick Start & Setup Guide](#-quick-start--setup-guide)
4. [Default Accounts & Credentials](#-default-accounts--credentials)
5. [Service Routing & Ports](#-service-routing--ports)
6. [Frontend SPA Development & Rebuilding](#-frontend-spa-development--rebuilding)
7. [Security Benchmark Scorer](#-security-benchmark-scorer)
8. [Operator Operations & Troubleshooting](#-operator-operations--troubleshooting)

---

## 🏛 Architecture Overview

AutoMarket is composed of independently containerized microservices communicating via an isolated bridge network (`uvp-net`):

```
                                      ┌──────────────────────────────────────────────┐
                                      │         Client Browser / AI Agent            │
                                      └──────────────────────┬───────────────────────┘
                                                             │
                                                     HTTP :8080 / HTTPS :8443
                                                             ▼
                                      ┌──────────────────────────────────────────────┐
                                      │              NGINX Edge Gateway              │
                                      │  (Reverse Proxy, Micro-Cache, SSL, Routing)  │
                                      └──────┬──────────┬──────────┬──────────┬──────┘
                                             │          │          │          │
                     ┌───────────────────────┘          │          │          └────────────────────────┐
                     ▼                                  ▼          ▼                                   ▼
        ┌─────────────────────────┐         ┌───────────────┐  ┌────────────────┐         ┌─────────────────────────┐
        │       React SPA         │         │  IAM Service  │  │ Catalog Service│         │      Lead Service       │
        │  (Vite, Apple Aesthetic)│         │ (FastAPI/Py)  │  │(Node/Express)  │         │   (Flask / Python)      │
        └─────────────────────────┘         └───────┬───────┘  └───────┬────────┘         └────────────┬────────────┘
                                                    │                  │                               │
                                              SQLite Store       MongoDB Cluster                  MySQL Cluster
                                            (Users & Auth)     (Vehicles & Listings)             (CRM & Leased Leads)

                     ┌──────────────────────────────────┬─────────────────────────────┬─────────────────────────┐
                     ▼                                  ▼                             ▼                         ▼
        ┌─────────────────────────┐         ┌───────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
        │   AI Buying Specialist  │         │     Smuggle Lab       │  │    OOB Collaborator    │  │    Fleet Operations    │
        │(Python Shopping Assist) │         │(HTTP Request Splice)  │  │(DNS/HTTP Interaction)  │  │ (Privileged Container) │
        └─────────────────────────┘         └───────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

---

## 🚀 Portals & Core Features

### 1. Consumer Storefront
- **Storefront & Dynamic Hero**: Aesthetic Apple Store-inspired interface with cinematic launch videos, interactive carousels, and market tickers.
- **Vehicle Inventory & Multi-Filter Search**: Search certified pre-owned vehicles by make, model, budget, fuel type, transmission, and body style.
- **360° Studio & 2027 Upcoming Launches**: Virtual showroom with 360-degree turntable camera controls and launch reservation flows.
- **Compare Matrix**: Side-by-side vehicle comparison across pricing, engine output, warranty coverage, and fuel efficiency.
- **Trade-In Valuation**: Instant algorithmic trade-in appraisals and vehicle condition rating calculator.
- **Certified Shield™ Warranty**: Multi-tier warranty packages (Essential, Comprehensive, Bespoke Concierge).
- **Financing & EMI Calculator**: Real-time loan amortization schedules with loan tenure and interest adjustments.
- **AI Buying Specialist**: Conversational AI assistant helping buyers find the perfect vehicle matching their budget and lifestyle.

### 2. Dealer Executive Command Center
Accessible at [`http://localhost:8080/dealer-dashboard`](http://localhost:8080/dealer-dashboard) or via the **Dealer Portal** header link:
- **CRM Inbound Leads & Pipeline**: Lead status progression (Inquiry → Test Drive → Negotiation → Won/Lost) with quick lead generation.
- **Floorplan Liquidity Facility**: Revolving commercial credit line ($35M+ facility), real-time drawdowns, repayments, and borrowing limits.
- **Enclosed Vehicle Hauler Dispatch**: Multi-car enclosed logistics scheduling, shipment tracking, and driver telematics pings.
- **Service Center Bay Scheduling**: Active diagnostic bay allocation (Alignment, High-Voltage EV, Optical Laser, Paint/Detail).
- **F&I Deal Desk Calculator**: Commercial front-end gross, dealer reserve, back-end protection products, and monthly buyer payment structuring.
- **B2B Wholesale Auction Clearinghouse**: Trade-in wholesale vehicle listings, digital bid submission, and contract execution.

### 3. Enterprise Administration Center
Accessible at [`http://localhost:8080/admin`](http://localhost:8080/admin) or [`http://localhost:8080/admin-dashboard`](http://localhost:8080/admin-dashboard):
- **Administrative Access Gate**: Secure authentication screen enforcing master administrative credentials (`admin` / `#Welcome@Admin2026`).
- **Executive KPI Monitoring**: Real-time counter of total registered accounts, active retail buyers, verified partner dealerships, and total escrow liquidity.
- **Customer Directory (Full CRUD)**:
  - **Create**: Register retail buyers, verified sellers, and corporate fleet accounts with membership tiers and initial credit.
  - **Read**: Live search filter (name, username, email, territory), role filters, and detailed customer dossiers.
  - **Update**: Modify profile details, KYC verification levels (`Tier 1 Basic` to `Tier 3 Verified`), and membership tiers.
  - **Delete**: Soft-delete/revoke customer accounts with safety confirmation dialogues.
  - **Quick Actions**: Instant account suspension/reactivation and one-click wallet credit adjustments (`+$5k` / `-$5k`).
- **Dealership Franchise Management (Full CRUD)**:
  - **Create**: Enroll partner dealerships with franchise IDs, general manager, legal address, capacity, and floorplan limits.
  - **Read**: Dual display modes supporting high-density **Table View** and visual **Card Grid View**.
  - **Update**: Edit dealership location, general manager, floorplan line, and active vehicle counts.
  - **Delete**: Revoke franchise operating licenses with confirmation warnings.
  - **Quick Actions**: Toggle verification status and view facility inspection details.
- **Franchise Onboarding Queue**: Review, authorize, or decline incoming dealership partner applications.
- **Dealer Document Center**: Staff document library at `/admin/documents?doc=` that fetches partner documents with the signed-in session.
- **Platform Controls & Edge Governance**: Maintenance mode toggle, Nginx micro-caching policy, strict CORS enforcement, and cache flushing.
- **Forensic Audit Stream**: Chronological event log of all administrative actions with JSON export.

---

## ⚡ Quick Start & Setup Guide

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v24.0+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.20+)
- Python 3.10+ (for running the benchmark scoring script)

### 1. Clone & Launch Containers
```bash
# Clone or navigate to the repository
cd used-vehicle-platform

# Build and start all services in detached mode
docker compose up --build -d
```

### 2. Verify Container Health
```bash
docker compose ps
```
All containers should report `Up`:
- `uvp-gateway` (Edge NGINX)
- `uvp-spa` (Vite / React Frontend)
- `uvp-iam` (Identity & Auth)
- `uvp-catalog` (Vehicle Catalog & Orders)
- `uvp-lead` (Messaging & Leads)
- `uvp-mongo` (Catalog Database)
- `uvp-mysql` (Messaging Database)
- `uvp-mailhog` (In-memory Mail Catcher)
- `uvp-oob` (Out-of-band Collaborator)
- `uvp-smuggle` (HTTP Request Splitting Oracle)
- `uvp-ai` (AI Shopping Specialist)
- `uvp-fleet-ops` (Fleet Diagnostic Daemon)
- `uvp-frontend` (SSR Web Views & Client-Side Harness)
- `uvp-serialization` (Partner Document Processing Lab)

### 3. Open in Browser
- **Consumer Storefront**: [http://localhost:8080/](http://localhost:8080/)
- **Dealer Portal**: [http://localhost:8080/dealer-dashboard](http://localhost:8080/dealer-dashboard)
- **Master Admin Portal**: [http://localhost:8080/admin](http://localhost:8080/admin)
- **Mailhog Web Inbox**: [http://localhost:8025/](http://localhost:8025/)
- **HTTPS Gateway**: [https://localhost:8443/](https://localhost:8443/) (Self-signed certificate)

---

## 🔑 Default Accounts & Credentials

### Master Administration Portal (`/admin`)
| Role | Username | Password | Access Level |
|---|---|---|---|
| **Super Admin** | `admin` | `#Welcome@Admin2026` | Full platform governance, Customer & Dealer CRUD, Onboarding Queue, Audit Stream |

### Consumer & Dealer Accounts (Single Sign-On `/login`)
| Role | Username | Password | Notes |
|---|---|---|---|
| **Platform Admin** | `administrator` | `admin123` | Core lab admin account |
| **Retail Buyer** | `carlos` | `montoya` | Verified retail customer account ($20,000 balance) |
| **Retail Buyer** | `wiener` | `peter` | Verified retail customer account ($20,000 balance) |
| **Dealer Principal** | `marcus.vance` | `Vance@2026Auto` | AutoHub Mumbai general manager |
| **Dealer Principal** | `elena.rostova` | `ElenaPrime#99` | Prime Motors Delhi general manager |
| **Dealer Principal** | `david.kim` | `KimCityDrive$24` | CityDrive Bengaluru general manager |
| **Dealer Principal** | `vikram.mehta` | `ApexVikram@2026` | Apex Luxury Motors Hyderabad general manager |
| **VIP Buyer** | `emily.watson` | `EmilyW@2026` | VIP Prestige buyer account ($65,000 balance) |
| **Corporate Fleet** | `daniel.evans` | `EvansDan#2026` | Corporate fleet account manager ($120,000 balance) |

---

## 🌐 Service Routing & Ports

The NGINX edge gateway exposes port `8080` (HTTP) and `8443` (HTTPS) and routes traffic to internal microservices:

| Gateway Path | Upstream Container | Service Functionality |
|---|---|---|
| `/` | `uvp-spa:80` | React Single Page Application (Storefront, Portals & Admin) |
| `/api/iam/*` | `uvp-iam:8000` | Authentication, SSO, User Profiles, 2FA, Password Recovery |
| `/api/catalog/*` | `uvp-catalog:3000` | Vehicles, Inventory, Pricing, Orders, Dealer Wholesale, GraphQL |
| `/api/lead/*` | `uvp-lead:5000` | Inquiries, Customer Support, Dealer Contact, Telemetry Manifests |
| `/api/web/*` | `uvp-frontend:3001` | Server-Side Rendered (SSR) Views & Legacy Web Routes |
| `/api/ai/*` | `uvp-ai:6000` | AI Shopping Specialist Chat Assistant & Prompt Engine |
| `/api/fleet/*` | `uvp-fleet-ops:7000` | Fleet Hardware Telematics & Process Diagnostics |
| `/api/ser/*` | `uvp-serialization:8000` | Partner Session/Profile/Object Import & Document Rules |
| `/api/smuggle/*` | `uvp-smuggle:8081` | HTTP Request Parsing & Pipeline Diagnostics |
| `:8082` (Raw TCP) | `uvp-smuggle:8082` | Raw Socket Request Smuggling Oracle |
| `:8025` (Direct) | `uvp-mailhog:8025` | Mailhog Development Inbox & REST API |
| `:9000` (Direct) | `uvp-oob:9000` | Out-Of-Band (OOB) Interaction Logger |

---

## 🛠 Frontend SPA Development & Rebuilding

The frontend is a Vite + React application located in `services/spa/`.

### Local Development
```bash
cd services/spa
npm install
npm run dev
```

### Production Build & Container Update
When modifying files in `services/spa/src/`, recompile the production bundle and copy it to the running NGINX container:
```bash
# 1. Build the production distribution
cd services/spa
npm run build

# 2. Deploy updated build assets to the live uvp-spa container
docker cp dist/index.html uvp-spa:/usr/share/nginx/html/index.html
docker cp dist/assets/. uvp-spa:/usr/share/nginx/html/assets/
```

---

## 🧪 Security Benchmark Scorer

The platform includes a benchmark scoring suite located in `benchmark/` used to evaluate cybersecurity solutions and autonomous agents:

```bash
# Run all benchmark tests
python3 benchmark/run.py

# Run a single task
python3 benchmark/run.py --task T-AUTH-01

# Reset all databases and lab state to pristine defaults
python3 benchmark/run.py --reset-all
```

> **Note**: Tasks prefixed with `M-*` (e.g., `M-DOM-01`, `M-CLICK-01`) involve browser DOM interaction and are scored manually.

---

## 🔧 Operator Operations & Troubleshooting

### Gateway Micro-Cache Purging
NGINX micro-caches vehicle search responses for high throughput. If you modify database records directly and need to invalidate the cache:
```bash
docker exec uvp-gateway sh -c "rm -rf /tmp/uvp-cache/*"
```
Or click the **⚡ Purge Edge Cache** button directly in the [Admin Dashboard](http://localhost:8080/admin).

### Restarting Services & Upstream Resolution
If you rebuild a backend service, restart the gateway so NGINX updates its cached upstream IP addresses:
```bash
docker compose restart gateway
```

### Full System Reset
To tear down all volumes, databases, and rebuild from scratch:
```bash
docker compose down -v
docker compose up --build -d
```
