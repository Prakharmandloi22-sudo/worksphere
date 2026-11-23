# WorkSphere Production Deployment & Operations Guide (Assessment 14)

## 1. Production Architecture Overview

The production deployment of WorkSphere utilizes a containerized, defense-in-depth architecture:
- **Edge / Reverse Proxy**: Nginx with SSL/TLS termination, HTTP/2, gzip compression, rate limiting, and security headers (CSP, HSTS, X-Frame-Options).
- **Frontend App**: Next.js 15 App Router running standalone in non-root Node.js container (`node:22-alpine`).
- **Core Business API**: Express.js REST API with connection pooling to PostgreSQL and BullMQ queues to Redis.
- **Analytics Service**: Python 3.12 FastAPI microservice for high-throughput activity analytics.
- **Data Stores**: PostgreSQL 16 (system of record) and Redis 7 (caching, queues, idempotency store) configured on an isolated internal Docker bridge network (`worksphere_net`).

---

## 2. Environment Variables & Secrets Management

Secrets must never be committed to Git. The `.env.example` file contains sanitized placeholders. Production secrets should be injected via container runtime environments or vault managers (e.g., AWS Secrets Manager, HashiCorp Vault, or GitHub Secrets):

| Variable | Description | Production Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `DATABASE_URL` | PostgreSQL connection string | Dedicated user with least privileges, SSL enabled (`sslmode=require`) |
| `REDIS_URL` | Redis instance connection | Password-protected (`requirepass`) |
| `JWT_SECRET` | Secret key for signing JWT tokens | High-entropy string, minimum 32 characters |
| `ANALYTICS_SERVICE_API_KEY` | M2M authentication token | Shared secret between Core API and FastAPI service |
| `WEBHOOK_SIGNING_SECRET` | HMAC signing secret for outgoing/incoming webhooks | Unique cryptographic key |

---

## 3. Step-by-Step Deployment Instructions

### Prerequisites
- Docker Engine 24+ and Docker Compose v2.20+
- Valid domain names: `app.worksphere.io`, `api.worksphere.io`
- SSL certificates (via Let's Encrypt Certbot or Cloudflare Origin CA)

### Deployment Steps
```bash
# 1. Clone repository
git clone https://github.com/worksphere/worksphere.git /opt/worksphere
cd /opt/worksphere

# 2. Configure production environment
cp .env.example .env
chmod 600 .env
nano .env # Set secure production secrets

# 3. Build container images with multi-stage caching
docker compose build --pull

# 4. Initialize database schema & run migrations
docker compose up -d postgres redis
docker compose run --rm core-api npm run migrate

# 5. Launch all services
docker compose up -d

# 6. Verify health probes
curl -f http://localhost:4000/health/live
curl -f http://localhost:8000/health/live
curl -f http://localhost:3000
```

---

## 4. Disaster Recovery & Backup Runbook

### Automated Nightly Backups
Backups are triggered via cron executing `scripts/backup-db.sh` nightly at 02:00 UTC:
```bash
0 2 * * * /opt/worksphere/scripts/backup-db.sh >> /var/log/worksphere-backup.log 2>&1
```

### Manual Backup Verification
```bash
bash scripts/backup-db.sh
```

### Restore Procedure
In the event of database corruption or hardware failure:
```bash
# 1. Stop write traffic
docker compose stop core-api

# 2. Restore database from verified backup
bash scripts/restore-db.sh /backups/worksphere_20261123_020000.sql.gz

# 3. Restart application
docker compose start core-api
```

---

## 5. Observability & Health Monitoring

- **Core API Liveness**: `GET /health/live` (checks event loop & process uptime)
- **Core API Readiness**: `GET /health/ready` (validates database pool and Redis connection)
- **FastAPI Liveness**: `GET /health/live`
- **Prometheus Metrics**: `GET /metrics` (exposes heap memory, RSS, and process uptime)
