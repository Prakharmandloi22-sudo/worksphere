import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

// --- Webhook Signatures & Verification (Assessment 08) ---
export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  organizationId: string;
  data: Record<string, any>;
}

export function signWebhookPayload(payload: WebhookPayload, secret: string): { signature: string; timestamp: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const serialized = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(serialized).digest('hex');
  return { signature: `v1=${signature}`, timestamp };
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  secret: string,
  toleranceSeconds = 300
): { isValid: boolean; reason?: string } {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const eventTimestamp = parseInt(timestampHeader, 10);

  if (isNaN(eventTimestamp)) {
    return { isValid: false, reason: 'Invalid timestamp format' };
  }

  // Replay attack prevention: timestamp must be within tolerance window (5 mins)
  if (Math.abs(currentTimestamp - eventTimestamp) > toleranceSeconds) {
    return { isValid: false, reason: 'Timestamp outside acceptable tolerance window (replay protection)' };
  }

  const expectedSignature = `v1=${crypto
    .createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex')}`;

  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length) {
    return { isValid: false, reason: 'Signature mismatch' };
  }

  const isValid = crypto.timingSafeEqual(sigBuf, expBuf);

  return isValid ? { isValid: true } : { isValid: false, reason: 'Signature mismatch' };
}

// --- Object Storage Adapter (Local / S3 Compatible) ---
export interface StorageFile {
  fileKey: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  url: string;
}

export class ObjectStorageAdapter {
  private inMemoryFiles: Map<string, { buffer: Buffer; meta: StorageFile }> = new Map();

  async uploadFile(fileName: string, mimeType: string, buffer: Buffer): Promise<StorageFile> {
    const fileKey = `uploads/${uuidv4()}-${fileName}`;
    const fileMeta: StorageFile = {
      fileKey,
      fileName,
      sizeBytes: buffer.length,
      mimeType,
      url: `/api/v1/attachments/${fileKey}`,
    };
    this.inMemoryFiles.set(fileKey, { buffer, meta: fileMeta });
    return fileMeta;
  }

  async getPresignedDownloadUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    return `https://storage.worksphere.local/${fileKey}?expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  async getFile(fileKey: string): Promise<{ buffer: Buffer; meta: StorageFile } | null> {
    return this.inMemoryFiles.get(fileKey) || null;
  }
}

export const storageAdapter = new ObjectStorageAdapter();

// --- Email Provider Adapter (Sandbox / Mock) ---
export interface EmailMessage {
  id: string;
  to: string;
  from: string;
  subject: string;
  htmlBody: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'bounced';
}

export class EmailAdapter {
  sentEmails: EmailMessage[] = [];

  async sendEmail(to: string, subject: string, htmlBody: string): Promise<EmailMessage> {
    const email: EmailMessage = {
      id: uuidv4(),
      to,
      from: config.email.from,
      subject,
      htmlBody,
      sentAt: new Date().toISOString(),
      status: 'sent',
    };
    this.sentEmails.push(email);
    return email;
  }

  getSentEmails(): EmailMessage[] {
    return [...this.sentEmails];
  }

  clear(): void {
    this.sentEmails = [];
  }
}

export const emailAdapter = new EmailAdapter();
