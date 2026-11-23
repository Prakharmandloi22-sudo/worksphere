import { Response } from 'express';

export interface RealtimeEvent {
  event: 'task_updated' | 'task_created' | 'comment_added' | 'status_changed';
  organizationId: string;
  data: any;
  timestamp: string;
}

export class RealtimeBroker {
  private subscribers: Map<string, Set<Response>> = new Map();

  addSubscriber(organizationId: string, res: Response) {
    if (!this.subscribers.has(organizationId)) {
      this.subscribers.set(organizationId, new Set());
    }
    this.subscribers.get(organizationId)!.add(res);

    // Initial SSE connection handshake
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ type: 'connected', organizationId })}\n\n`);
  }

  removeSubscriber(organizationId: string, res: Response) {
    const orgSubs = this.subscribers.get(organizationId);
    if (orgSubs) {
      orgSubs.delete(res);
      if (orgSubs.size === 0) {
        this.subscribers.delete(organizationId);
      }
    }
  }

  broadcast(organizationId: string, eventName: RealtimeEvent['event'], data: any) {
    const orgSubs = this.subscribers.get(organizationId);
    if (!orgSubs || orgSubs.size === 0) return;

    const payload = JSON.stringify({
      event: eventName,
      organizationId,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const res of orgSubs) {
      try {
        res.write(`event: ${eventName}\ndata: ${payload}\n\n`);
      } catch (err) {
        // Socket closed
      }
    }
  }

  getSubscriberCount(organizationId: string): number {
    return this.subscribers.get(organizationId)?.size || 0;
  }
}

export const realtimeBroker = new RealtimeBroker();
