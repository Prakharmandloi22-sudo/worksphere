# WorkSphere Incident Response & RCA Handbook (Assessment 15)

This handbook documents root-cause analyses, reproduction procedures, recovery protocols, and regression test suites for critical production incidents.

---

## Incident 01: Stale Task Updates & Silent Overwrite (Domain Capstone)

### Summary & Impact
Two project collaborators (Alice and Bob) open the same task (`task-100`) at version 1. Alice updates the task status to `in_progress` (bumping version to 2). Milliseconds later, Bob updates priority to `critical` without refreshing his screen. In unversioned systems, Bob's write silently overwrites Alice's changes, corrupting project status and activity tracking.

### Root Cause Analysis (RCA)
- **Root Cause**: Lack of transaction concurrency verification allows the last write to blindly overwrite previous writes ("lost update" anomaly).
- **Remediation**: Implemented Optimistic Concurrency Control (OCC) using atomic version checking:
  ```sql
  UPDATE tasks
  SET priority = $1, version = version + 1, updated_at = NOW()
  WHERE id = $2 AND version = $expectedVersion;
  ```
- **Error Behavior**: When 0 rows are affected and the task exists, the API rejects the request with `HTTP 409 Conflict`, returning `currentVersion: 2` and `currentState`.
- **Regression Verification**: Verified by `services/core-api/tests/concurrency.test.ts` and interactive UI drill in `TaskBoard.tsx`.

---

## Incident 02: Attempted Cross-Tenant Data Access

### Summary & Impact
An authenticated user in Organization B attempts to craft HTTP requests targeting Organization A's project and task identifiers (`GET /api/v1/organizations/{orgA}/tasks`). Without record-level tenant boundaries, unauthorized users could inspect confidential roadmap data.

### Root Cause Analysis (RCA)
- **Root Cause**: Missing tenant membership check between JWT claims and requested route parameters.
- **Remediation**: Enforced `tenantMiddleware` on every tenant route. The middleware validates that the authenticated user possesses an active record in `organization_memberships` for the target tenant before passing control to controllers.
- **Defense-in-Depth**: All SQL repository queries explicitly bind `WHERE organization_id = $tenantId`.
- **Regression Verification**: Verified by `services/core-api/tests/tenant-isolation.test.ts`.

---

## Incident 03: External Email Service Network Outage & DLQ

### Summary & Impact
The external third-party transactional email provider experienced a 504 Gateway Timeout during peak hours. Background jobs failed repeatedly, threatening to saturate the worker process with infinite retries.

### Root Cause Analysis (RCA)
- **Root Cause**: Unbounded retry loop without dead-letter routing causes worker memory exhaustion and delayed processing of healthy jobs.
- **Remediation**:
  1. Configured exponential backoff with max 3 retry attempts.
  2. Jobs exceeding retry thresholds are automatically shifted to `dead_letter` status in the Dead Letter Queue (DLQ).
  3. Provided administrative re-drive command to inspect failed payloads and replay once the provider recovers.
- **Regression Verification**: Verified by `services/core-api/tests/queues-idempotency.test.ts`.

---

## Incident 04: Duplicate Notification Job Dispatch (Worker Retry Burst)

### Summary & Impact
When a network glitch causes worker ack delays, the message broker re-delivers the notification job. Without deduplication, assigned users receive duplicate emails for the same task modification.

### Root Cause Analysis (RCA)
- **Root Cause**: Lack of application-level idempotency keys on background jobs.
- **Remediation**: Every notification job enqueues with an immutable `idempotencyKey = "notif:task_update:<taskId>:v<version>"`. The worker maintains an idempotency store. If the key has already executed, the duplicate job is skipped and marked completed.
- **Regression Verification**: Verified by `services/core-api/tests/queues-idempotency.test.ts`.

---

## Incident 05: Webhook Signature Tampering & Replay Attacks

### Summary & Impact
An adversary attempts to replay old webhook payloads or forge incoming webhook status events to escalate user privileges or falsely mark invoices as paid.

### Root Cause Analysis (RCA)
- **Root Cause**: Missing payload signature verification and lack of timestamp freshness window checks.
- **Remediation**:
  1. Implemented HMAC-SHA256 signature verification (`X-WorkSphere-Signature: v1=<hash>`).
  2. Enforced 300-second timestamp tolerance (`X-WorkSphere-Timestamp`) to prevent replay attacks.
  3. Stored unique `X-Event-Id` in the idempotency store to prevent repeated event processing.
- **Regression Verification**: Verified by `services/core-api/tests/webhooks.test.ts`.

---

## Incident 06: Database Connection Pool Latency & Spikes

### Summary & Impact
During marketing campaigns, concurrent read traffic spikes caused pool exhaustion, leading to connection timeouts.

### Root Cause Analysis (RCA)
- **Root Cause**: Default pool size too low, lack of statement timeouts, and unindexed filter queries.
- **Remediation**:
  1. Configured `DB_POOL_MIN=2`, `DB_POOL_MAX=20`, and `statement_timeout = 5000ms`.
  2. Added composite B-Tree indexes on `(organization_id, status)` and `(organization_id, project_id)`.
  3. Integrated Prometheus `/metrics` endpoint to monitor pool utilization and trigger automated alerts at 80% saturation.

