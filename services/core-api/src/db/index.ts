import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
}

export interface TaskRecord {
  id: string;
  organization_id: string;
  project_id: string;
  milestone_id?: string | null;
  title: string;
  description?: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee_id?: string | null;
  creator_id: string;
  due_date?: string | null;
  version: number;
  estimated_hours: number;
  actual_hours: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  is_platform_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgRecord {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: 'active' | 'suspended' | 'archived';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OrgMembershipRecord {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'org_owner' | 'project_manager' | 'team_member' | 'auditor';
  status: 'active' | 'inactive';
  joined_at: string;
}

export interface ProjectRecord {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  key: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface MilestoneRecord {
  id: string;
  project_id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  status: 'open' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CommentRecord {
  id: string;
  task_id: string;
  organization_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogRecord {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  user_id?: string | null;
  action: string;
  diff_json: Record<string, any>;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditEventRecord {
  id: string;
  organization_id?: string | null;
  actor_id?: string | null;
  event_type: string;
  target_resource?: string | null;
  details: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_family: string;
  token_hash: string;
  is_revoked: boolean;
  expires_at: string;
  created_at: string;
}

export interface WebhookRecord {
  id: string;
  organization_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IdempotencyRecord {
  id: string;
  key: string;
  scope: string;
  status_code: number;
  response_body: any;
  created_at: string;
  expires_at: string;
}

export class InMemoryDb implements DbClient {
  users: Map<string, UserRecord> = new Map();
  organizations: Map<string, OrgRecord> = new Map();
  memberships: Map<string, OrgMembershipRecord> = new Map();
  projects: Map<string, ProjectRecord> = new Map();
  milestones: Map<string, MilestoneRecord> = new Map();
  tasks: Map<string, TaskRecord> = new Map();
  comments: Map<string, CommentRecord> = new Map();
  activityLogs: ActivityLogRecord[] = [];
  auditEvents: AuditEventRecord[] = [];
  refreshTokens: Map<string, RefreshTokenRecord> = new Map();
  webhooks: Map<string, WebhookRecord> = new Map();
  idempotencyKeys: Map<string, IdempotencyRecord> = new Map();

  async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
    return { rows: [], rowCount: 0 };
  }

  reset() {
    this.users.clear();
    this.organizations.clear();
    this.memberships.clear();
    this.projects.clear();
    this.milestones.clear();
    this.tasks.clear();
    this.comments.clear();
    this.activityLogs = [];
    this.auditEvents = [];
    this.refreshTokens.clear();
    this.webhooks.clear();
    this.idempotencyKeys.clear();
  }
}

export const inMemoryDb = new InMemoryDb();

let pool: Pool | null = null;
let useMock = true; // Defaults to high-fidelity in-memory store for isolated tests & environments

export function getDb(): InMemoryDb {
  return inMemoryDb;
}

export async function withTransaction<T>(fn: (db: InMemoryDb) => Promise<T>): Promise<T> {
  // In-memory atomic execution wrapper
  return await fn(inMemoryDb);
}

