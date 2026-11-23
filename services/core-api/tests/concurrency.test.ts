import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { inMemoryDb } from '../src/db/index.js';

describe('Assessment 15: Capstone Challenge - Optimistic Concurrency Control & Activity History', () => {
  const app = createApp();
  let tokenUser1: string;
  let tokenUser2: string;
  let orgId: string;
  let projectId: string;

  beforeEach(async () => {
    inMemoryDb.reset();

    // Register User 1 as Org Owner
    const regRes1 = await request(app).post('/api/v1/auth/register').send({
      email: 'user1@acme.com',
      password: 'Password123!',
      firstName: 'Alice',
      lastName: 'Smith',
      organizationName: 'Acme Software',
    });
    tokenUser1 = regRes1.body.data.tokens.accessToken;
    orgId = regRes1.body.data.organization.id;

    // Register User 2 and add as member
    const regRes2 = await request(app).post('/api/v1/auth/register').send({
      email: 'user2@acme.com',
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Jones',
    });
    tokenUser2 = regRes2.body.data.tokens.accessToken;
    const user2Id = regRes2.body.data.user.id;

    await (await import('../src/db/repositories.js')).orgsRepo.addMember({
      organization_id: orgId,
      user_id: user2Id,
      role: 'project_manager',
      status: 'active',
    });

    // Create a project
    const projRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/projects`)
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({
        name: 'Core Platform v2',
        key: 'PLAT',
      });
    projectId = projRes.body.data.id;
  });

  it('prevents silent overwrite when two users attempt concurrent edits on the same task', async () => {
    // 1. Create a task (starts at version: 1)
    const taskRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/tasks`)
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({
        projectId,
        title: 'Implement database connection pooling',
        status: 'todo',
        priority: 'medium',
      });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.data.id;
    expect(taskRes.body.data.version).toBe(1);

    // 2. Both User 1 and User 2 read the task (both hold version 1)
    const getTaskUser1 = await request(app)
      .get(`/api/v1/organizations/${orgId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenUser1}`);
    const getTaskUser2 = await request(app)
      .get(`/api/v1/organizations/${orgId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenUser2}`);

    expect(getTaskUser1.body.data.version).toBe(1);
    expect(getTaskUser2.body.data.version).toBe(1);

    // 3. User 1 updates status to 'in_progress' with version: 1
    const user1Update = await request(app)
      .patch(`/api/v1/organizations/${orgId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({
        version: 1,
        status: 'in_progress',
      });
    expect(user1Update.status).toBe(200);
    expect(user1Update.body.data.version).toBe(2);
    expect(user1Update.body.data.status).toBe('in_progress');

    // 4. User 2 now submits update with stale version: 1 (concurrent collision!)
    const user2UpdateConflict = await request(app)
      .patch(`/api/v1/organizations/${orgId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenUser2}`)
      .send({
        version: 1,
        priority: 'critical',
      });

    // MUST be rejected with HTTP 409 Conflict
    expect(user2UpdateConflict.status).toBe(409);
    expect(user2UpdateConflict.body.success).toBe(false);
    expect(user2UpdateConflict.body.error.code).toBe('CONCURRENCY_CONFLICT');
    expect(user2UpdateConflict.body.error.currentVersion).toBe(2);
    expect(user2UpdateConflict.body.error.currentState.status).toBe('in_progress');

    // 5. User 2 fetches fresh state, merges, and submits with updated version: 2
    const user2UpdateResolved = await request(app)
      .patch(`/api/v1/organizations/${orgId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenUser2}`)
      .send({
        version: 2,
        priority: 'critical',
      });
    expect(user2UpdateResolved.status).toBe(200);
    expect(user2UpdateResolved.body.data.version).toBe(3);
    expect(user2UpdateResolved.body.data.priority).toBe('critical');
    expect(user2UpdateResolved.body.data.status).toBe('in_progress');

    // 6. Verify complete, immutable activity timeline was preserved
    const activityRes = await request(app)
      .get(`/api/v1/organizations/${orgId}/activities`)
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(activityRes.status).toBe(200);
    const taskActivities = activityRes.body.data.filter((a: any) => a.entity_id === taskId);
    expect(taskActivities.length).toBeGreaterThanOrEqual(3); // created, user1 update, user2 update
  });
});

