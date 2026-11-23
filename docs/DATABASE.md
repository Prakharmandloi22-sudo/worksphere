# WorkSphere Database Architecture & ER Documentation

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : contains
    ORGANIZATIONS ||--o{ PROJECTS : owns
    ORGANIZATIONS ||--o{ TASKS : scopes
    ORGANIZATIONS ||--o{ ACTIVITY_LOGS : records
    ORGANIZATIONS ||--o{ AUDIT_EVENTS : tracks
    ORGANIZATIONS ||--o{ INVITATIONS : issues
    ORGANIZATIONS ||--o{ WEBHOOK_SUBSCRIPTIONS : registers

    USERS ||--o{ ORGANIZATION_MEMBERSHIPS : holds
    USERS ||--o{ REFRESH_TOKENS : owns
    USERS ||--o{ TASKS : assigns_or_creates
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ ACTIVITY_LOGS : performs

    PROJECTS ||--o{ MILESTONES : defines
    PROJECTS ||--o{ TASKS : contains

    TASKS ||--o{ SUBTASKS : breaks_into
    TASKS ||--o{ COMMENTS : receives
    TASKS ||--o{ ATTACHMENTS : stores

    ORGANIZATIONS {
        uuid id PK
        varchar name
        varchar slug UK
        varchar plan
        varchar status
        jsonb settings
        timestamptz created_at
    }

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar first_name
        varchar last_name
        boolean is_platform_admin
        boolean is_active
    }

    ORGANIZATION_MEMBERSHIPS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        varchar role "org_owner | project_manager | team_member | auditor"
        varchar status
        timestamptz joined_at
    }

    PROJECTS {
        uuid id PK
        uuid organization_id FK
        varchar name
        varchar key UK
        varchar status
        uuid owner_id FK
    }

    TASKS {
        uuid id PK
        uuid organization_id FK
        uuid project_id FK
        uuid milestone_id FK
        varchar title
        varchar status
        varchar priority
        uuid assignee_id FK
        integer version "Optimistic Concurrency Control Counter"
        numeric estimated_hours
        numeric actual_hours
    }

    ACTIVITY_LOGS {
        uuid id PK
        uuid organization_id FK
        varchar entity_type
        uuid entity_id
        uuid user_id FK
        varchar action
        jsonb diff_json
        timestamptz created_at
    }
```

---

## 2. Key Database Modeling Decisions

### A. Tenant Scoping (`organization_id`)
All core entities (`projects`, `tasks`, `milestones`, `comments`, `attachments`, `activity_logs`, `webhooks`) carry an explicit, non-nullable `organization_id` column indexed with foreign key cascades. This guarantees:
1. Fast tenant-filtered query access patterns.
2. Complete data isolation without relying exclusively on application memory filters.
3. Clean cross-tenant cascade cleanup if a tenant organization is purged or archived.

### B. Optimistic Concurrency Control Column (`version`)
The `tasks` table includes `version INTEGER NOT NULL DEFAULT 1`:
- Every update executes:
  ```sql
  UPDATE tasks
  SET title = $1, status = $2, version = version + 1, updated_at = NOW()
  WHERE id = $3 AND version = $4;
  ```
- If the version has already been incremented by a concurrent user transaction, 0 rows are updated. The application detects this and throws `ConcurrencyConflictError` (HTTP 409 Conflict), returning the server's current state.

### C. Immutable Activity History (`activity_logs`)
Instead of overwriting previous states without an audit trail, WorkSphere maintains an append-only `activity_logs` table recording:
- `diff_json`: Before and after values of modified fields.
- `user_id`: Actor responsible for the modification.
- `created_at`: Exact UTC timestamp.

---

## 3. Indexing Strategy & Query Optimization

| Table | Index Columns | Index Type | Purpose / Query Optimization |
| :--- | :--- | :--- | :--- |
| `organizations` | `(slug)` | B-Tree Unique | Subdomain & slug tenant lookups in O(1) time. |
| `organization_memberships` | `(organization_id, user_id)` | Composite Unique | Quick auth check to resolve tenant membership and role. |
| `tasks` | `(organization_id, project_id)` | Composite B-Tree | Accelerates project task boards. |
| `tasks` | `(organization_id, status)` | Composite B-Tree | Filters Kanban columns by status. |
| `tasks` | `(id, version)` | Composite B-Tree | High-speed atomic optimistic lock verification. |
| `tasks` | `(due_date)` | B-Tree | Overdue task identification queries. |
| `activity_logs` | `(organization_id, created_at DESC)` | Composite B-Tree | Activity timeline pagination for tenant audit stream. |
| `idempotency_keys` | `(scope, key)` | Composite Unique | Instant check for duplicate API requests and background jobs. |
| `refresh_tokens` | `(token_family)` | B-Tree | Instant family revocation upon refresh token reuse detection. |
