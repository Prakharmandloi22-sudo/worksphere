import { v4 as uuidv4 } from 'uuid';
import {
  inMemoryDb,
  UserRecord,
  OrgRecord,
  OrgMembershipRecord,
  ProjectRecord,
  MilestoneRecord,
  TaskRecord,
  CommentRecord,
  ActivityLogRecord,
  AuditEventRecord,
  RefreshTokenRecord,
  WebhookRecord,
  IdempotencyRecord,
} from './index.js';

// --- Users ---
export const usersRepo = {
  async create(user: Omit<UserRecord, 'id' | 'created_at' | 'updated_at'>): Promise<UserRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: UserRecord = {
      ...user,
      id,
      created_at: now,
      updated_at: now,
    };
    inMemoryDb.users.set(id, record);
    return record;
  },

  async findById(id: string): Promise<UserRecord | null> {
    return inMemoryDb.users.get(id) || null;
  },

  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const u of inMemoryDb.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  },
};

// --- Organizations & Memberships ---
export const orgsRepo = {
  async create(org: Omit<OrgRecord, 'id' | 'created_at' | 'updated_at'>): Promise<OrgRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: OrgRecord = {
      ...org,
      id,
      created_at: now,
      updated_at: now,
    };
    inMemoryDb.organizations.set(id, record);
    return record;
  },

  async findById(id: string): Promise<OrgRecord | null> {
    return inMemoryDb.organizations.get(id) || null;
  },

  async findBySlug(slug: string): Promise<OrgRecord | null> {
    for (const o of inMemoryDb.organizations.values()) {
      if (o.slug === slug) return o;
    }
    return null;
  },

  async list(): Promise<OrgRecord[]> {
    return Array.from(inMemoryDb.organizations.values());
  },

  async addMember(membership: Omit<OrgMembershipRecord, 'id' | 'joined_at'>): Promise<OrgMembershipRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: OrgMembershipRecord = {
      ...membership,
      id,
      joined_at: now,
    };
    inMemoryDb.memberships.set(id, record);
    return record;
  },

  async findMembership(orgId: string, userId: string): Promise<OrgMembershipRecord | null> {
    for (const m of inMemoryDb.memberships.values()) {
      if (m.organization_id === orgId && m.user_id === userId && m.status === 'active') {
        return m;
      }
    }
    return null;
  },

  async listMembers(orgId: string): Promise<OrgMembershipRecord[]> {
    return Array.from(inMemoryDb.memberships.values()).filter(
      (m) => m.organization_id === orgId && m.status === 'active'
    );
  },
};

// --- Projects & Milestones ---
export const projectsRepo = {
  async create(project: Omit<ProjectRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ProjectRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: ProjectRecord = {
      ...project,
      id,
      created_at: now,
      updated_at: now,
    };
    inMemoryDb.projects.set(id, record);
    return record;
  },

  async findById(id: string, orgId?: string): Promise<ProjectRecord | null> {
    const p = inMemoryDb.projects.get(id);
    if (!p) return null;
    if (orgId && p.organization_id !== orgId) return null;
    return p;
  },

  async listByOrg(orgId: string): Promise<ProjectRecord[]> {
    return Array.from(inMemoryDb.projects.values()).filter((p) => p.organization_id === orgId);
  },

  async createMilestone(milestone: Omit<MilestoneRecord, 'id' | 'created_at' | 'updated_at'>): Promise<MilestoneRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: MilestoneRecord = {
      ...milestone,
      id,
      created_at: now,
      updated_at: now,
    };
    inMemoryDb.milestones.set(id, record);
    return record;
  },

  async listMilestones(projectId: string, orgId: string): Promise<MilestoneRecord[]> {
    return Array.from(inMemoryDb.milestones.values()).filter(
      (m) => m.project_id === projectId && m.organization_id === orgId
    );
  },
};

// --- Tasks (Assessment 02, 03, 15: Optimistic Concurrency Control) ---
export class ConcurrencyConflictError extends Error {
  constructor(public currentTask: TaskRecord, message = 'Task was modified by another user concurrently') {
    super(message);
    this.name = 'ConcurrencyConflictError';
  }
}

export const tasksRepo = {
  async create(task: Omit<TaskRecord, 'id' | 'version' | 'created_at' | 'updated_at'>): Promise<TaskRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: TaskRecord = {
      ...task,
      id,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    inMemoryDb.tasks.set(id, record);
    return record;
  },

  async findById(id: string, orgId?: string): Promise<TaskRecord | null> {
    const t = inMemoryDb.tasks.get(id);
    if (!t) return null;
    if (orgId && t.organization_id !== orgId) return null;
    return t;
  },

  async listByProject(projectId: string, orgId: string): Promise<TaskRecord[]> {
    return Array.from(inMemoryDb.tasks.values()).filter(
      (t) => t.project_id === projectId && t.organization_id === orgId
    );
  },

  async listByOrg(orgId: string, filters?: { status?: string; assignee_id?: string }): Promise<TaskRecord[]> {
    let list = Array.from(inMemoryDb.tasks.values()).filter((t) => t.organization_id === orgId);
    if (filters?.status) {
      list = list.filter((t) => t.status === filters.status);
    }
    if (filters?.assignee_id) {
      list = list.filter((t) => t.assignee_id === filters.assignee_id);
    }
    return list;
  },

  /**
   * Atomic update with Optimistic Concurrency Control.
   * If expectedVersion is provided and does not match the current version,
   * a ConcurrencyConflictError is thrown with the fresh current state.
   */
  async updateWithConcurrencyCheck(
    id: string,
    orgId: string,
    expectedVersion: number,
    updates: Partial<Omit<TaskRecord, 'id' | 'organization_id' | 'created_at' | 'version'>>
  ): Promise<TaskRecord> {
    const existing = inMemoryDb.tasks.get(id);
    if (!existing || existing.organization_id !== orgId) {
      throw new Error('Task not found');
    }

    if (existing.version !== expectedVersion) {
      throw new ConcurrencyConflictError(
        existing,
        `Conflict: Task has been updated to version ${existing.version} by another transaction. Expected version ${expectedVersion}.`
      );
    }

    const now = new Date().toISOString();
    const updated: TaskRecord = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      updated_at: now,
    };

    inMemoryDb.tasks.set(id, updated);
    return updated;
  },

  async delete(id: string, orgId: string): Promise<boolean> {
    const existing = inMemoryDb.tasks.get(id);
    if (!existing || existing.organization_id !== orgId) return false;
    return inMemoryDb.tasks.delete(id);
  },
};

// --- Comments ---
export const commentsRepo = {
  async create(comment: Omit<CommentRecord, 'id' | 'created_at' | 'updated_at'>): Promise<CommentRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: CommentRecord = {
      ...comment,
      id,
      created_at: now,
      updated_at: now,
    };
    inMemoryDb.comments.set(id, record);
    return record;
  },

  async listByTask(taskId: string, orgId: string): Promise<CommentRecord[]> {
    return Array.from(inMemoryDb.comments.values()).filter(
      (c) => c.task_id === taskId && c.organization_id === orgId
    );
  },
};

// --- Activity Logs & Audit Events ---
export const activityRepo = {
  async log(entry: Omit<ActivityLogRecord, 'id' | 'created_at'>): Promise<ActivityLogRecord> {
    const id = uuidv4();
    const record: ActivityLogRecord = {
      ...entry,
      id,
      created_at: new Date().toISOString(),
    };
    inMemoryDb.activityLogs.push(record);
    return record;
  },

  async listByOrg(orgId: string, limit = 50): Promise<ActivityLogRecord[]> {
    return inMemoryDb.activityLogs
      .filter((a) => a.organization_id === orgId)
      .slice(-limit)
      .reverse();
  },

  async listByEntity(entityType: string, entityId: string): Promise<ActivityLogRecord[]> {
    return inMemoryDb.activityLogs
      .filter((a) => a.entity_type === entityType && a.entity_id === entityId)
      .reverse();
  },
};

export const auditRepo = {
  async log(event: Omit<AuditEventRecord, 'id' | 'created_at'>): Promise<AuditEventRecord> {
    const id = uuidv4();
    const record: AuditEventRecord = {
      ...event,
      id,
      created_at: new Date().toISOString(),
    };
    inMemoryDb.auditEvents.push(record);
    return record;
  },

  async list(orgId?: string, limit = 100): Promise<AuditEventRecord[]> {
    let list = inMemoryDb.auditEvents;
    if (orgId) {
      list = list.filter((e) => e.organization_id === orgId);
    }
    return list.slice(-limit).reverse();
  },
};

// --- Refresh Tokens (Token Family Revocation) ---
export const refreshTokensRepo = {
  async create(token: Omit<RefreshTokenRecord, 'id' | 'created_at'>): Promise<RefreshTokenRecord> {
    const id = uuidv4();
    const record: RefreshTokenRecord = {
      ...token,
      id,
      created_at: new Date().toISOString(),
    };
    inMemoryDb.refreshTokens.set(token.token_hash, record);
    return record;
  },

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return inMemoryDb.refreshTokens.get(tokenHash) || null;
  },

  async revokeToken(tokenHash: string): Promise<void> {
    const r = inMemoryDb.refreshTokens.get(tokenHash);
    if (r) {
      r.is_revoked = true;
    }
  },

  async revokeFamily(familyId: string): Promise<void> {
    for (const r of inMemoryDb.refreshTokens.values()) {
      if (r.token_family === familyId) {
        r.is_revoked = true;
      }
    }
  },
};

// --- Webhooks ---
export const webhooksRepo = {
  async create(webhook: Omit<WebhookRecord, 'id' | 'created_at' | 'updated_at'>): Promise<WebhookRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: WebhookRecord = {
      ...webhook,
      id,
      created_at: now,
      updated_at: now,
    };
    inMemoryDb.webhooks.set(id, record);
    return record;
  },

  async listByOrg(orgId: string): Promise<WebhookRecord[]> {
    return Array.from(inMemoryDb.webhooks.values()).filter((w) => w.organization_id === orgId && w.is_active);
  },
};

// --- Idempotency ---
export const idempotencyRepo = {
  async get(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const compositeKey = `${scope}:${key}`;
    const item = inMemoryDb.idempotencyKeys.get(compositeKey);
    if (!item) return null;
    if (new Date(item.expires_at).getTime() < Date.now()) {
      inMemoryDb.idempotencyKeys.delete(compositeKey);
      return null;
    }
    return item;
  },

  async set(record: Omit<IdempotencyRecord, 'id' | 'created_at'>): Promise<IdempotencyRecord> {
    const id = uuidv4();
    const fullRecord: IdempotencyRecord = {
      ...record,
      id,
      created_at: new Date().toISOString(),
    };
    const compositeKey = `${record.scope}:${record.key}`;
    inMemoryDb.idempotencyKeys.set(compositeKey, fullRecord);
    return fullRecord;
  },
};
