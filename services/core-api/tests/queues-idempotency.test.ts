import { describe, it, expect } from 'vitest';
import { taskQueue } from '../src/queues/index.js';

describe('Assessment 07: Real-Time Updates, Job Retries, and Idempotency', () => {
  it('deduplicates jobs using idempotencyKey to prevent duplicate notification delivery', async () => {
    let callCount = 0;
    const testJobKey = `notif-test-${Date.now()}`;

    taskQueue.registerHandler('test_dedup_job', async (job) => {
      callCount++;
    });

    // Enqueue first job
    await taskQueue.add('test_dedup_job', { msg: 'first' }, { idempotencyKey: testJobKey });
    await new Promise((r) => setTimeout(r, 60));

    expect(callCount).toBe(1);

    // Enqueue retry / duplicate job with SAME idempotency key
    await taskQueue.add('test_dedup_job', { msg: 'duplicate' }, { idempotencyKey: testJobKey });
    await new Promise((r) => setTimeout(r, 60));

    // Execution count must remain 1!
    expect(callCount).toBe(1);
  });

  it('moves job to Dead Letter Queue (DLQ) after exceeding maximum retry attempts', async () => {
    taskQueue.clearDeadLetterQueue();

    taskQueue.registerHandler('failing_job', async (job) => {
      throw new Error('Unrecoverable third-party outage');
    });

    await taskQueue.add('failing_job', { payload: 'important' }, { maxRetries: 2 });

    // Wait for retries to exhaust
    await new Promise((r) => setTimeout(r, 150));

    const dlq = taskQueue.getDeadLetterQueue();
    expect(dlq.length).toBeGreaterThanOrEqual(1);
    const failedJob = dlq.find((j) => j.name === 'failing_job');
    expect(failedJob).toBeDefined();
    expect(failedJob?.status).toBe('dead_letter');
    expect(failedJob?.attempts).toBe(2);
    expect(failedJob?.error).toContain('Unrecoverable third-party outage');
  });
});
