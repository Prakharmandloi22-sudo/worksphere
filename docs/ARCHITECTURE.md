# WorkSphere Architecture & System Design Documentation

## 1. System Overview & Component Topology

WorkSphere is an enterprise-grade multi-tenant project planning, real-time collaboration, and workflow automation platform. The platform is designed around strict tenant boundary isolation, optimistic concurrency control for concurrent edits, event-driven background processing, and streaming analytics.

```mermaid
flowchart TD
    subgraph Clients["User Personas & Endpoints"]
        AdminUser["Platform Admin (/admin)"]
        OwnerUser["Org Owner (/owner)"]
        ManagerUser["Project Manager (/manager)"]
        MemberUser["Team Member (/member)"]
        AuditorUser["Auditor (/auditor)"]
        WebhookSender["External Webhook Emitters"]
    end

    subgraph ReverseProxy["Edge Layer (Nginx)"]
        Nginx["Nginx Reverse Proxy:443\nSSL/TLS, Gzip, Rate Limiter\nSecurity Headers, Path Router"]
    end

    subgraph AppTier["Application Services Tier"]
        Frontend["Next.js 15 App Router:3000\nTypeScript, Tailwind CSS\nRole-Specific Protected Layouts"]
        CoreAPI["Core Business REST API (Express):4000\nAuth, RBAC, Multi-Tenant Barrier\nTasks OCC, Webhooks, SSE Broker"]
        FastAPIService["Analytics Microservice (FastAPI):8000\nProject Health, Workload Forecasts\nM2M Auth, Streaming Ingestion"]
        Worker["Background Job Worker (BullMQ/Redis)\nIdempotent Retries & DLQ"]
    end

    subgraph DataTier["System of Record & State Tier"]
        Postgres[("PostgreSQL 16 (System of Record)\nMulti-Tenant Isolated Rows\nIndexes, Foreign Keys, Audit Ledger")]
        RedisStore[("Redis 7 (In-Memory Cache & Queues)\nIdempotency Keys, Job DLQ, SSE Channel")]
        Storage[("Object Storage (S3 / MinIO / Local)\nPresigned URLs, Task Attachments")]
    end

    AdminUser --> Nginx
    OwnerUser --> Nginx
    ManagerUser --> Nginx
    MemberUser --> Nginx
    AuditorUser --> Nginx
    WebhookSender --> Nginx

    Nginx -->|/| Frontend
    Nginx -->|/api/v1/| CoreAPI
    Nginx -->|/analytics/| FastAPIService

    Frontend -->|REST APIs| CoreAPI
    Frontend -->|Analytics Queries| FastAPIService
    CoreAPI -->|M2M Ingestion| FastAPIService

    CoreAPI --> Postgres
    CoreAPI --> RedisStore
    CoreAPI --> Storage
    Worker --> RedisStore
    Worker --> Postgres
```

---

## 2. Domain Data-Flow & Concurrency Sequence Diagram

### Assessment 15 Capstone: Optimistic Concurrency Control (OCC)
When two users attempt to update the same task at nearly the same time, WorkSphere prevents silent overwrites using atomic version verification and preserves complete activity history:

```mermaid
sequenceDiagram
    autonumber
    actor Alice as User 1 (Alice)
    actor Bob as User 2 (Bob)
    participant API as Core Business API
    participant DB as PostgreSQL
    participant Queue as Redis Queue (BullMQ)
    participant Worker as Background Worker

    Note over Alice, Bob: Both Alice and Bob fetch Task (id: "task-100", version: 1)
    Alice->>API: PATCH /tasks/task-100 { version: 1, status: "in_progress" }
    API->>DB: UPDATE tasks SET status='in_progress', version=2 WHERE id='task-100' AND version=1
    DB-->>API: 1 row affected (version becomes 2)
    API->>DB: INSERT INTO activity_logs (diff, author: Alice, version: 2)
    API->>Queue: Enqueue notification (idempotencyKey: "notif:task_update:task-100:v2")
    API-->>Alice: HTTP 200 OK (Task version: 2)

    Note over Bob: Bob submits update with stale version 1
    Bob->>API: PATCH /tasks/task-100 { version: 1, priority: "critical" }
    API->>DB: UPDATE tasks SET priority='critical', version=2 WHERE id='task-100' AND version=1
    DB-->>API: 0 rows affected (version mismatch!)
    API->>DB: SELECT * FROM tasks WHERE id='task-100'
    DB-->>API: Returns current task state (version: 2, status: "in_progress")
    API-->>Bob: HTTP 409 Conflict { error: "CONCURRENCY_CONFLICT", currentVersion: 2, currentState }
    
    Note over Bob: UI displays conflict resolution dialog. Bob merges changes.
    Bob->>API: PATCH /tasks/task-100 { version: 2, priority: "critical" }
    API->>DB: UPDATE tasks SET priority='critical', version=3 WHERE id='task-100' AND version=2
    DB-->>API: 1 row affected (version becomes 3)
    API->>DB: INSERT INTO activity_logs (diff, author: Bob, version: 3)
    API->>Queue: Enqueue notification (idempotencyKey: "notif:task_update:task-100:v3")
    API-->>Bob: HTTP 200 OK (Task version: 3)

    Note over Queue, Worker: Worker processes background job with automatic deduplication
    Queue->>Worker: Dispatch notification job
    Worker->>Worker: Check idempotency key store -> Process -> Mark completed
    Note over Worker: Even if worker retries, idempotency key prevents duplicate notification!
```

---

## 3. Service Boundaries & Entity Ownership

| Entity | Owning Service | Authoritative Store | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Organizations & Memberships** | Core API (`core-api`) | PostgreSQL (`organizations`, `organization_memberships`) | Tenant lifecycle, RBAC enforcement, user invitations |
| **Users & Credentials** | Core API (`core-api`) | PostgreSQL (`users`, `refresh_tokens`) | Password hashing (bcrypt), JWT generation, token family rotation |
| **Projects & Milestones** | Core API (`core-api`) | PostgreSQL (`projects`, `milestones`) | Scoped to tenant organization |
| **Tasks & Subtasks** | Core API (`core-api`) | PostgreSQL (`tasks`, `subtasks`) | Version column tracking, optimistic locking, real-time broadcasts |
| **Activity History** | Core API (`core-api`) | PostgreSQL (`activity_logs`) | Append-only immutable ledger of all field diffs |
| **Security Audits** | Core API (`core-api`) | PostgreSQL (`audit_events`) | Platform logins, role changes, blocked cross-tenant attempts |
| **Job Queue & Retries** | Background Worker | Redis (`task_queue`, `dlq_queue`) | Notification delivery, retries, idempotency deduplication |
| **Analytics & Health** | FastAPI Analytics | Python Engine / Memory | Streaming computation of throughput, cycle time, workload capacity |

---

## 4. Multi-Tenant Isolation Strategy

WorkSphere enforces tenant security at the HTTP middleware and database query layer:
1. **Request Identification**: Every incoming request to tenant resources must provide `x-organization-id` header or URL parameter.
2. **Session Verification**: The user's active memberships are checked against the requested organization. Platform admins can optionally access across tenants.
3. **Defense in Depth**: Every SQL query and repository method incorporates `WHERE organization_id = $tenantId`. A user from Organization A cannot view, query, or mutate records in Organization B (returns `403 Forbidden`).
4. **Automated Verification**: Verified by automated test suite `tests/tenant-isolation.test.ts`.

