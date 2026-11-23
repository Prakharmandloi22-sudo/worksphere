import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { inMemoryDb } from '../src/db/index.js';

describe('Assessment 04: Authentication & Authorization Flow', () => {
  const app = createApp();

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it('registers a new user and creates an organization with owner role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'owner@acme.com',
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Smith',
        organizationName: 'Acme Corp',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('owner@acme.com');
    expect(res.body.data.organization.name).toBe('Acme Corp');
    expect(res.body.data.organization.role).toBe('org_owner');
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('fails registration if email is already taken', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'duplicate@acme.com',
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Smith',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'duplicate@acme.com',
      password: 'AnotherPassword!',
      firstName: 'Bob',
      lastName: 'Smith',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_EXISTS');
  });

  it('successfully logs in with valid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'login@acme.com',
      password: 'ValidPassword123!',
      firstName: 'Charlie',
      lastName: 'Brown',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@acme.com',
      password: 'ValidPassword123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('rejects login with invalid password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'wrongpass@acme.com',
      password: 'ValidPassword123!',
      firstName: 'David',
      lastName: 'Miller',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'wrongpass@acme.com',
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates refresh tokens and revokes family on reuse attempt', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'rotation@acme.com',
      password: 'Password123!',
      firstName: 'Eve',
      lastName: 'Adams',
    });

    const token1 = regRes.body.data.tokens.refreshToken;

    // First rotation -> succeeds and provides token2
    const rotateRes1 = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: token1,
    });
    expect(rotateRes1.status).toBe(200);
    const token2 = rotateRes1.body.data.tokens.refreshToken;
    expect(token2).not.toBe(token1);

    // Reuse attempt: using old token1 again must trigger family revocation!
    const reuseRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: token1,
    });
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe('TOKEN_FAMILY_REVOKED');

    // Token2 should now also be revoked due to family compromise!
    const token2Res = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: token2,
    });
    expect(token2Res.status).toBe(401);
  });
});

