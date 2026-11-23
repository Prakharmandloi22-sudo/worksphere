import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';
import { config } from '../config/index.js';
import { usersRepo, orgsRepo, idempotencyRepo, ConcurrencyConflictError } from '../db/repositories.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  is_platform_admin: boolean;
}

export interface UserMembership {
  id: string;
  organization_id: string;
  role: 'org_owner' | 'project_manager' | 'team_member' | 'auditor';
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: AuthenticatedUser;
      organizationId?: string;
      membership?: UserMembership;
    }
  }
}

// 1. Correlation Request ID Middleware
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string) || uuidv4();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

// 2. Authentication Middleware
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing Bearer token.' },
      requestId: req.id,
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwt.secret) as any;
    const user = await usersRepo.findById(payload.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_DEACTIVATED', message: 'User account is inactive or not found.' },
        requestId: req.id,
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      is_platform_admin: user.is_platform_admin,
    };
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired access token.' },
      requestId: req.id,
    });
  }
}

// 3. Tenant Isolation & Membership Middleware
export function tenantMiddleware(options: { allowPlatformAdmin?: boolean } = { allowPlatformAdmin: true }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required prior to tenant check.' },
        requestId: req.id,
      });
    }

    // Resolve target organization from header, query, or route params
    const orgId = (req.params.orgId || req.headers['x-organization-id'] || req.query.orgId) as string;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TENANT_HEADER', message: 'Missing organization identifier (x-organization-id or :orgId).' },
        requestId: req.id,
      });
    }

    // Verify tenant exists
    const org = await orgsRepo.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Target organization does not exist.' },
        requestId: req.id,
      });
    }

    // Platform admin bypass
    if (options.allowPlatformAdmin && req.user.is_platform_admin) {
      req.organizationId = orgId;
      req.membership = {
        id: 'platform-admin',
        organization_id: orgId,
        role: 'org_owner',
      };
      return next();
    }

    // Check organization membership
    const membership = await orgsRepo.findMembership(orgId, req.user.id);
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_CROSS_TENANT',
          message: 'Access denied: You do not belong to this organization or tenant boundary is violated.',
        },
        requestId: req.id,
      });
    }

    req.organizationId = orgId;
    req.membership = {
      id: membership.id,
      organization_id: membership.organization_id,
      role: membership.role,
    };
    next();
  };
}

// 4. Role-Based Access Control (RBAC) Middleware
const ROLE_HIERARCHY: Record<string, number> = {
  auditor: 1,
  team_member: 2,
  project_manager: 3,
  org_owner: 4,
};

export function requireRole(allowedRoles: Array<'org_owner' | 'project_manager' | 'team_member' | 'auditor'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.is_platform_admin) {
      return next();
    }

    if (!req.membership) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN_NO_ROLE', message: 'No tenant membership or role found in current context.' },
        requestId: req.id,
      });
    }

    if (!allowedRoles.includes(req.membership.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
          message: `Permission denied. Required one of: [${allowedRoles.join(', ')}]. Current role: '${req.membership.role}'.`,
        },
        requestId: req.id,
      });
    }

    next();
  };
}

// 5. Idempotency Middleware
export function idempotencyMiddleware(scopePrefix = 'core-api') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey || req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }

    const scope = `${scopePrefix}:${req.path}`;
    const cached = await idempotencyRepo.get(scope, idempotencyKey);
    if (cached) {
      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(cached.status_code).json(cached.response_body);
    }

    // Intercept json response to cache
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Store completed response for 24 hours
      if (res.statusCode >= 200 && res.statusCode < 300) {
        idempotencyRepo.set({
          key: idempotencyKey,
          scope,
          status_code: res.statusCode,
          response_body: body,
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        }).catch((err) => console.error('Error saving idempotency key:', err));
      }
      return originalJson(body);
    };

    next();
  };
}

// 6. Global Error Handling Middleware
export function errorHandlerMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  const reqId = req.id || uuidv4();

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input parameters.',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      requestId: reqId,
    });
  }

  if (err instanceof ConcurrencyConflictError) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONCURRENCY_CONFLICT',
        message: err.message,
        currentVersion: err.currentTask.version,
        currentState: err.currentTask,
      },
      requestId: reqId,
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error occurred.' : err.message;

  // Never leak credentials or stack traces in error response
  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
    },
    requestId: reqId,
  });
}
