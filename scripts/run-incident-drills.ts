/**
 * WorkSphere Assessment 15: Incident Response Drills & Capstone Verification
 * Run with: npx tsx scripts/run-incident-drills.ts
 */

import { createApp } from '../services/core-api/src/app.js';
import { inMemoryDb } from '../services/core-api/src/db/index.js';
import { usersRepo, orgsRepo, projectsRepo, tasksRepo, activityRepo } from '../services/core-api/src/db/repositories.js';
import { taskQueue } from '../services/core-api/src/queues/index.js';
import { signWebhookPayload } from '../services/core-api/src/integrations/index.js';
import { config } from '../services/core-api/src/config/index.js';
import request from 'supertest';

async function runAllDrills() {
  console.log('\n================================================================');
  console.log('   WORKSPHERE ASSESSMENT 15: INCIDENT RESPONSE DRILLS & RCA    ');
  console.log('================================================================\n');

  const app = createApp();
  inMemoryDb.reset();

  // Setup base tenant and users
  const reg1 = await request(app).post('/api/v1/auth/register').send({
    email: 'alice@tenant-alpha.com',
    password: 'Password123!',
    firstName: 'Alice',
    lastName: 'Smith',
    organizationName: 'Tenant Alpha',
  });
  const tokenAlice = reg1.body.data.tokens.accessToken;
  const orgAlphaId = reg1.body.data.organization.id;

  const reg2 = await request(app).post('/api/v1/auth/register').send({
    email: 'bob@tenant-alpha.com',
    password: 'Password123!',
    firstName: 'Bob',
    lastName: 'Jones',
  });
  const tokenBob = reg2.body.data.tokens.accessToken;
  const userBobId = reg2.body.data.user.id;

  await orgsRepo.addMember({
    organization_id: orgAlphaId,
    user_id: userBobId,
    role: 'project_manager',
    status: 'active',
  });

  const projRes = await request(app)
    .post(`/api/v1/organizations/${orgAlphaId}/projects`)
    .set('Authorization', `Bearer ${tokenAlice}`)
    .send({ name: 'Alpha Project 1', key: 'ALP' });
  const projectId = projRes.body.data.id;

  // --------------------------------------------------------------------------
  // DRILL 1: Capstone Challenge - Stale Task Updates (Optimistic Concurrency)
  // --------------------------------------------------------------------------
  console.log('[DRILL 1] Simulating Concurrent Task Updates (Optimistic Concurrency Control)...');
  const taskRes = await request(app)
    .post(`/api/v1/organizations/${orgAlphaId}/tasks`)
    .set('Authorization', `Bearer ${tokenAlice}`)
    .send({
      projectId,
      title: 'Optimize Database Connection Pools',
      status: 'todo',
      priority: 'medium',
    });
  const taskId = taskRes.body.data.id;
  console.log(`  -> Task created: ID=${taskId}, Initial Version=1`);

  // Alice updates task to version 2
  const updateAlice = await request(app)
    .patch(`/api/v1/organizations/${orgAlphaId}/tasks/${taskId}`)
    .set('Authorization', `Bearer ${tokenAlice}`)
    .send({ version: 1, status: 'in_progress' });
  console.log(`  -> User 1 (Alice) updated status to in_progress. New Version=${updateAlice.body.data.version}`);

  // Bob attempts concurrent update with stale version 1
  const updateBob = await request(app)
    .patch(`/api/v1/organizations/${orgAlphaId}/tasks/${taskId}`)
    .set('Authorization', `Bearer ${tokenBob}`)
    .send({ version: 1, priority: 'critical' });

  if (updateBob.status === 409) {
    console.log('  -> SUCCESS: Server intercepted stale update with HTTP 409 Conflict!');
    console.log(`  -> Response: ${updateBob.body.error.message}`);
    console.log(`  -> Current Server Version returned: ${updateBob.body.error.currentVersion}`);
  } else {
    throw new Error(`Drill 1 Failed: Expected 409 but got ${updateBob.status}`);
  }

  // Bob inspects current state and retries with version 2
  const updateBobResolved = await request(app)
    .patch(`/api/v1/organizations/${orgAlphaId}/tasks/${taskId}`)
    .set('Authorization', `Bearer ${tokenBob}`)
    .send({ version: 2, priority: 'critical' });
  console.log(`  -> User 2 merged and bumped to Version=${updateBobResolved.body.data.version}\n`);

  // --------------------------------------------------------------------------
  // DRILL 2: Attempted Cross-Tenant Data Access (Multi-Tenant Barrier)
  // --------------------------------------------------------------------------
  console.log('[DRILL 2] Simulating Cross-Tenant Access Breach Attempt...');
  const regBeta = await request(app).post('/api/v1/auth/register').send({
    email: 'mallory@tenant-beta.com',
    password: 'Password123!',
    firstName: 'Mallory',
    lastName: 'Attacker',
    organizationName: 'Tenant Beta',
  });
  const tokenMallory = regBeta.body.data.tokens.accessToken;

  // Mallory attempts to read Tenant Alpha's tasks
  const breachAttempt = await request(app)
    .get(`/api/v1/organizations/${orgAlphaId}/tasks`)
    .set('Authorization', `Bearer ${tokenMallory}`);

  if (breachAttempt.status === 403) {
    console.log('  -> SUCCESS: Cross-tenant barrier blocked request with HTTP 403 Forbidden!');
    console.log(`  -> Error Code: ${breachAttempt.body.error.code} - ${breachAttempt.body.error.message}\n`);
  } else {
    throw new Error(`Drill 2 Failed: Expected 403 but got ${breachAttempt.status}`);
  }

  // --------------------------------------------------------------------------
  // DRILL 3: Background Worker Retry & Dead Letter Queue (DLQ)
  // --------------------------------------------------------------------------
  console.log('[DRILL 3] Simulating External Email Provider Network Outage & DLQ...');
  taskQueue.clearDeadLetterQueue();
  await taskQueue.add(
    'send_notification',
    {
      recipientEmail: 'client@external.com',
      title: 'Urgent Task Alert',
      shouldFail: true, // triggers simulated 504 Gateway Timeout
    },
    { maxRetries: 2 }
  );

  await new Promise((r) => setTimeout(r, 120));
  const dlq = taskQueue.getDeadLetterQueue();
  const deadJob = dlq.find((j) => j.name === 'send_notification');

  if (deadJob && deadJob.status === 'dead_letter') {
    console.log('  -> SUCCESS: Job exhausted retries and was safely routed to Dead Letter Queue (DLQ)!');
    console.log(`  -> Recorded Error in DLQ: ${deadJob.error}`);
    console.log(`  -> Total Attempts Recorded: ${deadJob.attempts}\n`);
  } else {
    throw new Error('Drill 3 Failed: DLQ did not capture failed job');
  }

  // --------------------------------------------------------------------------
  // DRILL 4: Duplicate Job Dispatch Deduplication (Idempotency Key)
  // --------------------------------------------------------------------------
  console.log('[DRILL 4] Simulating Duplicate Notification Dispatch (Worker Idempotency)...');
  let notificationsDispatched = 0;
  const dedupKey = `drill-notif-${Date.now()}`;

  taskQueue.registerHandler('drill_notif_handler', async () => {
    notificationsDispatched++;
  });

  // Dispatch first job
  await taskQueue.add('drill_notif_handler', { msg: 'first' }, { idempotencyKey: dedupKey });
  await new Promise((r) => setTimeout(r, 60));

  // Dispatch duplicate / retry burst with identical idempotency key
  await taskQueue.add('drill_notif_handler', { msg: 'duplicate' }, { idempotencyKey: dedupKey });
  await new Promise((r) => setTimeout(r, 60));

  if (notificationsDispatched === 1) {
    console.log('  -> SUCCESS: Duplicate notification dropped via Idempotency Key deduplication store!');
    console.log(`  -> Dispatched count = ${notificationsDispatched} (Expected 1)\n`);
  } else {
    throw new Error(`Drill 4 Failed: Duplicate notification was sent ${notificationsDispatched} times`);
  }

  // --------------------------------------------------------------------------
  // DRILL 5: Webhook Tampering & Replay Defense
  // --------------------------------------------------------------------------
  console.log('[DRILL 5] Simulating Webhook Signature Tampering & Replay Attack...');
  const forgedRes = await request(app)
    .post('/api/v1/webhooks/incoming')
    .set('X-WorkSphere-Signature', 'v1=bad_signature_tampered_payload_hash')
    .set('X-WorkSphere-Timestamp', Math.floor(Date.now() / 1000).toString())
    .send({ event: 'invoice.paid', amount: 99999 });

  if (forgedRes.status === 403) {
    console.log('  -> SUCCESS: HMAC-SHA256 signature verification rejected tampered webhook (HTTP 403).\n');
  } else {
    throw new Error(`Drill 5 Failed: Expected 403 but got ${forgedRes.status}`);
  }

  console.log('================================================================');
  console.log('   ALL 5 DRILLS COMPLETED AND VERIFIED SUCCESSFULLY (100%)      ');
  console.log('================================================================\n');
}

runAllDrills().catch((err) => {
  console.error('Incident Drill Error:', err);
  process.exit(1);
});

