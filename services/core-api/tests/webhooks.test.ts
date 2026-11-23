import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { signWebhookPayload } from '../src/integrations/index.js';
import { config } from '../src/config/index.js';

describe('Assessment 08: Third-Party Integrations & Secure Webhooks', () => {
  const app = createApp();

  it('accepts valid incoming webhook with valid HMAC-SHA256 signature', async () => {
    const payload = {
      id: 'evt_123456',
      event: 'payment.succeeded',
      timestamp: new Date().toISOString(),
      organizationId: 'org_123',
      data: { plan: 'enterprise', amount: 50000 },
    };

    const { signature, timestamp } = signWebhookPayload(payload, config.webhook.signingSecret);

    const res = await request(app)
      .post('/api/v1/webhooks/incoming')
      .set('X-WorkSphere-Signature', signature)
      .set('X-WorkSphere-Timestamp', timestamp)
      .set('X-Event-Id', 'evt_123456')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects tampered webhook signature with 403 Forbidden', async () => {
    const payload = {
      id: 'evt_tampered',
      event: 'user.escalated',
      timestamp: new Date().toISOString(),
      organizationId: 'org_123',
      data: { role: 'admin' },
    };

    const { timestamp } = signWebhookPayload(payload, config.webhook.signingSecret);

    const res = await request(app)
      .post('/api/v1/webhooks/incoming')
      .set('X-WorkSphere-Signature', 'v1=forged_invalid_signature_hex')
      .set('X-WorkSphere-Timestamp', timestamp)
      .set('X-Event-Id', 'evt_tampered')
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('rejects replayed webhook outside timestamp tolerance window', async () => {
    const payload = {
      id: 'evt_old',
      event: 'task.status_changed',
      timestamp: new Date().toISOString(),
      organizationId: 'org_123',
      data: {},
    };

    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
    const crypto = await import('crypto');
    const signature = `v1=${crypto.default
      .createHmac('sha256', config.webhook.signingSecret)
      .update(`${oldTimestamp}.${JSON.stringify(payload)}`)
      .digest('hex')}`;

    const res = await request(app)
      .post('/api/v1/webhooks/incoming')
      .set('X-WorkSphere-Signature', signature)
      .set('X-WorkSphere-Timestamp', oldTimestamp)
      .set('X-Event-Id', 'evt_old')
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('replay protection');
  });
});
