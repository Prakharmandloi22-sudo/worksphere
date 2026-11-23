import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { webhooksRepo, idempotencyRepo } from '../../db/repositories.js';
import { authenticateToken, tenantMiddleware, requireRole } from '../../middleware/index.js';
import { verifyWebhookSignature } from '../../integrations/index.js';

export const webhooksRouter = Router();

const RegisterWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(z.string()).default(['*']),
});

// Register outgoing webhook subscription
webhooksRouter.post(
  '/:orgId/webhooks',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = RegisterWebhookSchema.parse(req.body);

      const webhook = await webhooksRepo.create({
        organization_id: req.organizationId!,
        url: data.url,
        secret: data.secret,
        events: data.events,
        is_active: true,
      });

      return res.status(201).json({ success: true, data: webhook, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

// List organization webhooks
webhooksRouter.get(
  '/:orgId/webhooks',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhooks = await webhooksRepo.listByOrg(req.organizationId!);
      return res.status(200).json({ success: true, data: webhooks, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

// Incoming webhook receiver endpoint (Assessment 08: Signature Verification & Idempotency)
webhooksRouter.post('/incoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-worksphere-signature'] as string;
    const timestamp = req.headers['x-worksphere-timestamp'] as string;
    const eventId = req.headers['x-event-id'] as string;

    if (!signature || !timestamp) {
      return res.status(401).json({
        success: false,
        error: { code: 'MISSING_SIGNATURE', message: 'Missing webhook signature or timestamp headers.' },
        requestId: req.id,
      });
    }

    const rawBody = JSON.stringify(req.body);
    const verification = verifyWebhookSignature(rawBody, signature, timestamp, config.webhook.signingSecret);

    if (!verification.isValid) {
      return res.status(403).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: `Webhook verification failed: ${verification.reason}` },
        requestId: req.id,
      });
    }

    // Check duplicate event processing using eventId
    if (eventId) {
      const alreadyProcessed = await idempotencyRepo.get('webhook-incoming', eventId);
      if (alreadyProcessed) {
        return res.status(200).json({
          success: true,
          message: 'Event already received and processed (Idempotent ignore)',
          eventId,
        });
      }

      await idempotencyRepo.set({
        key: eventId,
        scope: 'webhook-incoming',
        status_code: 200,
        response_body: { processed: true, eventId },
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook received, verified, and accepted.',
      eventId: eventId || null,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

