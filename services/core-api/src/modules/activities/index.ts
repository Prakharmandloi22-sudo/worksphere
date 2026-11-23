import { Router, Request, Response, NextFunction } from 'express';
import { activityRepo, auditRepo } from '../../db/repositories.js';
import { authenticateToken, tenantMiddleware, requireRole } from '../../middleware/index.js';

export const activitiesRouter = Router();

// 1. Immutable Activity History for Organization
activitiesRouter.get(
  '/:orgId/activities',
  authenticateToken,
  tenantMiddleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt((req.query.limit as string) || '50', 10);
      const logs = await activityRepo.listByOrg(req.organizationId!, limit);
      return res.status(200).json({ success: true, count: logs.length, data: logs, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

// 2. Compliance Audit Logs (Auditor and Org Owner only)
activitiesRouter.get(
  '/:orgId/audit-logs',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner', 'auditor']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt((req.query.limit as string) || '100', 10);
      const events = await auditRepo.list(req.organizationId!, limit);
      return res.status(200).json({ success: true, count: events.length, data: events, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

