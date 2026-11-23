import { v4 as uuidv4 } from 'uuid';
import { idempotencyRepo } from '../db/repositories.js';

export interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  idempotencyKey?: string;
  attempts: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  error?: string;
  createdAt: string;
  processedAt?: string;
}

export type JobHandler<T = any> = (job: Job<T>) => Promise<void>;

export class InProcessJobQueue {
  private queue: Job[] = [];
  private deadLetterQueue: Job[] = [];
  private handlers: Map<string, JobHandler> = new Map();
  private isProcessing = false;
  private isShuttingDown = false;
  private processedNotifications: Set<string> = new Set(); // In-memory deduplication set

  registerHandler<T>(jobName: string, handler: JobHandler<T>) {
    this.handlers.set(jobName, handler);
  }

  async add<T>(
    jobName: string,
    data: T,
    options: { idempotencyKey?: string; maxRetries?: number } = {}
  ): Promise<Job<T>> {
    const job: Job<T> = {
      id: uuidv4(),
      name: jobName,
      data,
      idempotencyKey: options.idempotencyKey,
      attempts: 0,
      maxRetries: options.maxRetries ?? 3,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.queue.push(job);
    this.processNext();
    return job;
  }

  private async processNext() {
    if (this.isProcessing || this.isShuttingDown || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift();

    if (!job) {
      this.isProcessing = false;
      return;
    }

    // Check job idempotency to prevent duplicate notifications during retries
    if (job.idempotencyKey && this.processedNotifications.has(job.idempotencyKey)) {
      job.status = 'completed';
      job.processedAt = new Date().toISOString();
      this.isProcessing = false;
      this.processNext();
      return;
    }

    const handler = this.handlers.get(job.name);
    if (!handler) {
      job.status = 'failed';
      job.error = `No registered handler for job type: ${job.name}`;
      this.deadLetterQueue.push(job);
      this.isProcessing = false;
      this.processNext();
      return;
    }

    job.status = 'processing';
    job.attempts++;

    try {
      await handler(job);
      job.status = 'completed';
      job.processedAt = new Date().toISOString();

      if (job.idempotencyKey) {
        this.processedNotifications.add(job.idempotencyKey);
      }
    } catch (err: any) {
      job.error = err.message || 'Job processing failed';

      if (job.attempts < job.maxRetries) {
        // Exponential backoff retry simulation: push back to pending queue
        job.status = 'pending';
        this.queue.push(job);
      } else {
        // Max retries exceeded -> Dead Letter Queue (DLQ)
        job.status = 'dead_letter';
        this.deadLetterQueue.push(job);
      }
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.processNext(), 10);
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  getDeadLetterQueue(): Job[] {
    return [...this.deadLetterQueue];
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    while (this.isProcessing) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

export const taskQueue = new InProcessJobQueue();

// Register background handlers
taskQueue.registerHandler('send_notification', async (job) => {
  const { recipientEmail, title, taskId, organizationId } = job.data;
  // Delivery simulation
  if (job.data.shouldFail) {
    throw new Error('Simulated external mail provider network timeout (504 Gateway Timeout)');
  }
});

taskQueue.registerHandler('export_analytics', async (job) => {
  const { organizationId, exportFormat } = job.data;
});

