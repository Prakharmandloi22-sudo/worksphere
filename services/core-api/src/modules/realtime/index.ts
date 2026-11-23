import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, tenantMiddleware } from '../../middleware/index.js';
import { realtimeBroker } from '../../realtime/index.js';

export const realtimeRouter = Router();

// Server-Sent Events (SSE) Stream for real-time task updates
realtimeRouter.get(
  '/:orgId/realtime/stream',
  authenticateToken,
  tenantMiddleware(),
  (req: Request, res: Response) => {
    const orgId = req.organizationId!;
    realtimeBroker.addSubscriber(orgId, res);

    req.on('close', () => {
      realtimeBroker.removeSubscriber(orgId, res);
    });
  }
);

