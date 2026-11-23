# WorkSphere: Multi-Tenant Project Management & Workflow Automation Platform

> **Version 1.0** | Advanced Engineering Capstone Platform | Prepared for Orion LMS Assessment

WorkSphere is a high-performance, multi-tenant SaaS platform built for organizations to plan projects, assign tasks, collaborate in real-time, automate workflows, and analyze team productivity. The platform guarantees strict tenant data isolation, optimistic concurrency control for concurrent edits, event-driven background processing, and streaming analytics.

---

## 🏛️ System Architecture

```
                                  [ Edge Layer: Nginx Reverse Proxy (:443) ]
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       ▼                              ▼                              ▼
            [ Next.js 15 App Router ]      [ Core Business REST API ]      [ FastAPI Analytics Service ]
                   Port 3000                      Port 4000                      Port 8000
           • Role-specific Layouts         • Auth & RBAC Middleware       • Streaming Activity Ingestion
           • Interactive Task Board        • Optimistic Concurrency (409) • Project Health Scores
           • Conflict Resolution Dialog    • SSE Real-time Updates        • Team Workload Capacity
           • Tailwind CSS & React Query    • Webhook Signatures (HMAC)    • O(1) Memory Engine
                       │                              │                              │
                       └──────────────────────────────┼──────────────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
           [ PostgreSQL 16 Database ]                                    [ Redis 7 Cache & Queue ]
            • 18 Normalized Tables                                        • BullMQ Background Jobs
            • Multi-Tenant Row Scoping                                    • Retries & Dead Letter Queue
            • B-Tree Composite Indexes                                    • Notification Deduplication
            • Immutable Activity Ledger                                   • Idempotency Key Store
```

---

## 🚀 Key Modules & Capabilities

1. **Role-Tailored Portals (Assessment 01)**: Next.js 15 App Router with distinct layouts for **Platform Administrators** (`/admin`), **Organization Owners** (`/owner`), **Project Managers** (`/manager`), **Team Members** (`/member`), and **Auditors** (`/auditor`).
2. **Core Business REST API (Assessment 02 & 03)**: Express.js layered architecture (routes, controllers, services, repositories) backed by a normalized PostgreSQL schema with multi-tenant row scoping.
3. **Enterprise Authentication & RBAC (Assessment 04)**: Short-lived JWT access tokens, refresh token rotation with token family revocation upon reuse, and record-level tenant protection.
4. **Advanced Python Processing (Assessment 05)**: Reusable `worksphere_analytics` package processing 20,000+ activity events in $O(1)$ memory (~35 MB peak) at over 10,000 events/sec.
5. **FastAPI Analytics Microservice (Assessment 06)**: Microservice computing delivery forecasts, project health scores, and overloaded sprint capacity.
6. **Real-Time Updates & Idempotent Queues (Assessment 07)**: Server-Sent Events (SSE) broadcasting task changes live; Redis background queue with exponential backoff, Dead Letter Queue (DLQ), and idempotency keys.
7. **Secure Integrations & Webhooks (Assessment 08)**: HMAC-SHA256 signature verification (`X-WorkSphere-Signature`), 300-second replay attack protection, and sandbox email adapter.
8. **Containerization & Environments (Assessment 09)**: Multi-stage Dockerfiles with non-root user execution (`node`, `appuser`, `nextjs`), health checks, and `docker-compose.yml`.
9. **Git Collaboration & CI/CD (Assessments 10 & 11)**: Branch protection guidelines, PR templates, issue templates, `.github/CODEOWNERS`, and GitHub Actions pipelines.
10. **Domain Capstone Challenge (Assessment 15)**: **Optimistic Concurrency Control (OCC)** preventing silent overwrites when two users edit the same task concurrently (returns HTTP 409 Conflict with server's current state), complete activity history preservation, and duplicate notification suppression.

---

## ⚡ Quick Start Guide

### Prerequisites
- Node.js 20+ (Node.js 22+ recommended)
- Python 3.10+
- Git

### 1. Clone & Configure Environment
```bash
git clone https://github.com/worksphere/worksphere.git
cd worksphere
cp .env.example .env
```

### 2. Start Services via Docker Compose
```bash
docker compose up -d
```
Once started:
- Frontend Application: [http://localhost:3000](http://localhost:3000)
- Core Business API: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- Core API Swagger Docs: [http://localhost:4000/api-docs/openapi.json](http://localhost:4000/api-docs/openapi.json)
- FastAPI Analytics Service Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Core API Prometheus Metrics: [http://localhost:4000/metrics](http://localhost:4000/metrics)

---

## 🧪 Automated Test Verification

WorkSphere features a multi-tiered test suite covering unit, API integration, tenant isolation, and concurrency conflict flows.

### Run Core API Test Suite (13 tests)
```bash
cd services/core-api
npm test
```
*Output: All 13 tests pass including multi-tenant barrier, RBAC role checks, refresh token rotation, and concurrency conflict.*

### Run Python Analytics Package & Benchmark
```bash
cd packages/python-analytics
python -m pytest
python -m worksphere_analytics.benchmark
```
*Output: 4 tests pass; streaming benchmark processes 20,000 events in ~1.9s with 35.59 MB peak memory.*

### Run FastAPI Analytics Service Tests
```bash
cd services/analytics-service
python -m pytest
```
*Output: 5 tests pass including M2M token authentication, project health score calculation, and workload analysis.*

### Run Frontend Architecture Tests
```bash
cd services/frontend
npm test
```
*Output: Frontend route role mapping and OCC state verification tests pass.*

---

## 🛡️ Assessment 15: Incident Response Drills & Capstone Verification

WorkSphere includes an automated incident drill runner that simulates production incidents and verifies recovery:
```bash
cd services/core-api
npm run drill
```

**Drill Results Output:**
- `[DRILL 1]` **Optimistic Concurrency Control**: Two users update same task. User 2 stale update intercepted with `HTTP 409 Conflict`. Task version bumped from 1 → 2 → 3.
- `[DRILL 2]` **Cross-Tenant Boundary**: Mallory from Tenant Beta blocked from reading Tenant Alpha tasks with `HTTP 403 Forbidden`.
- `[DRILL 3]` **External Provider Outage & DLQ**: Simulates 504 timeout on email provider. Job retried twice, then safely shifted to Dead Letter Queue.
- `[DRILL 4]` **Worker Idempotency**: Duplicate notification job dispatched with same idempotency key; duplicate safely dropped.
- `[DRILL 5]` **Webhook Tampering Defense**: Tampered HMAC-SHA256 signature rejected with `HTTP 403 Forbidden`.

---

## 📚 Documentation Index

- [Architecture & Sequence Diagrams](docs/ARCHITECTURE.md)
- [Database Schema & ER Diagram](docs/DATABASE.md)
- [Production Deployment & Runbooks](docs/DEPLOYMENT.md)
- [Incident Response & RCA Handbook](docs/INCIDENT_RESPONSE.md)
- [15 Hands-on Assessments Traceability Matrix](docs/ASSESSMENT_MAPPING.md)
- [OpenAPI Specification for Core API](docs/openapi/core-api-spec.json)
- [OpenAPI Specification for FastAPI](docs/openapi/fastapi-analytics-spec.json)
- [Postman API Collection](docs/openapi/WorkSphere.postman_collection.json)

---

## ⚖️ Responsible Use & Compliance Notice

This platform was developed as an educational advanced engineering capstone project for Orion LMS. Use synthetic data and sandbox credentials for testing. Real-world enterprise deployment requires domain-specific compliance (SOC 2, GDPR, HIPAA) and cryptographic review.

