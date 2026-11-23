import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { inMemoryDb } from '../src/db/index.js';

describe('Assessment 04: Multi-Tenant Isolation & RBAC Enforcement', () => {
  const app = createApp();
  let orgAToken: string;
  let orgAId: string;
  let orgBToken: string;
  let orgBId: string;

  beforeEach(async () => {
    inMemoryDb.reset();

    // User A in Organization A
    const resA = await request(app).post('/api/v1/auth/register').send({
      email: 'userA@tenant-alpha.com',
      password: 'Password123!',
      firstName: 'Alpha',
      lastName: 'Owner',
      organizationName: 'Tenant Alpha',
    });
    orgAToken = resA.body.data.tokens.accessToken;
    orgAId = resA.body.data.organization.id;

    // User B in Organization B
    const resB = await request(app).post('/api/v1/auth/register').send({
      email: 'userB@tenant-beta.com',
      password: 'Password123!',
      firstName: 'Beta',
      lastName: 'Owner',
      organizationName: 'Tenant Beta',
    });
    orgBToken = resB.body.data.tokens.accessToken;
    orgBId = resB.body.data.organization.id;
  });

  it('prevents User B from accessing Organization A projects (Tenant Barrier)', async () => {
    // Org A creates a confidential project
    const projRes = await request(app)
      .post(`/api/v1/organizations/${orgAId}/projects`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        name: 'Alpha Secret Roadmap',
        key: 'ALPHA',
      });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // User B attempts to access Org A project list
    const crossListRes = await request(app)
      .get(`/api/v1/organizations/${orgAId}/projects`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossListRes.status).toBe(403);
    expect(crossListRes.body.error.code).toBe('FORBIDDEN_CROSS_TENANT');

    // User B attempts to fetch single project of Org A
    const crossProjRes = await request(app)
      .get(`/api/v1/organizations/${orgAId}/projects/${projectId}`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossProjRes.status).toBe(403);
    expect(crossProjRes.body.error.code).toBe('FORBIDDEN_CROSS_TENANT');
  });

  it('enforces RBAC: team member cannot invite members but can create tasks', async () => {
    // Org A invites a team member
    const inviteRes = await request(app)
      .post(`/api/v1/organizations/${orgAId}/invitations`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        email: 'member@tenant-alpha.com',
        role: 'team_member',
      });
    expect(inviteRes.status).toBe(201);

    // Login as team member
    const memberLoginRes = await request(app).post('/api/v1/auth/register').send({
      email: 'member@tenant-alpha.com',
      password: 'Password123!',
      firstName: 'Tom',
      lastName: 'Member',
    });
    // Add membership for this user
    const memberUser = await (await import('../src/db/repositories.js')).usersRepo.findByEmail('member@tenant-alpha.com');
    await (await import('../src/db/repositories.js')).orgsRepo.addMember({
      organization_id: orgAId,
      user_id: memberUser!.id,
      role: 'team_member',
      status: 'active',
    });

    const memberToken = (await import('jsonwebtoken')).default.sign(
      { userId: memberUser!.id, email: memberUser!.email },
      (await import('../src/config/index.js')).config.jwt.secret
    );

    // Team member attempts to invite another user -> 403 Forbidden
    const forbiddenInvite = await request(app)
      .post(`/api/v1/organizations/${orgAId}/invitations`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        email: 'unauthorized@tenant-alpha.com',
        role: 'team_member',
      });
    expect(forbiddenInvite.status).toBe(403);
    expect(forbiddenInvite.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });
});

