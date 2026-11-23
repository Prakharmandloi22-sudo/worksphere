import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { usersRepo, orgsRepo, refreshTokensRepo, auditRepo } from '../../db/repositories.js';
import { authenticateToken } from '../../middleware/index.js';

export const authRouter = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  organizationName: z.string().min(1).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function generateAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiration as any,
  });
}

// 1. User Registration
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = RegisterSchema.parse(req.body);

    const existing = await usersRepo.findByEmail(data.email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'An account with this email already exists.' },
        requestId: req.id,
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await usersRepo.create({
      email: data.email,
      password_hash: passwordHash,
      first_name: data.firstName,
      last_name: data.lastName,
      is_platform_admin: false,
      is_active: true,
    });

    // Create primary organization if specified or default
    const orgName = data.organizationName || `${data.firstName}'s Workspace`;
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
    const org = await orgsRepo.create({
      name: orgName,
      slug,
      plan: 'starter',
      status: 'active',
      settings: {},
    });

    // Add user as org_owner
    await orgsRepo.addMember({
      organization_id: org.id,
      user_id: user.id,
      role: 'org_owner',
      status: 'active',
    });

    const tokenFamily = uuidv4();
    const rawRefreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);

    await refreshTokensRepo.create({
      user_id: user.id,
      token_family: tokenFamily,
      token_hash: rawRefreshToken, // In-memory lookup key
      is_revoked: false,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    const accessToken = generateAccessToken(user.id, user.email);

    await auditRepo.log({
      organization_id: org.id,
      actor_id: user.id,
      event_type: 'user.registered',
      details: { email: user.email, orgId: org.id },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
        organization: { id: org.id, name: org.name, slug: org.slug, role: 'org_owner' },
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
          tokenFamily,
          expiresIn: config.jwt.accessExpiration,
        },
      },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

// 2. User Login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = LoginSchema.parse(req.body);

    const user = await usersRepo.findByEmail(data.email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        requestId: req.id,
      });
    }

    const isMatch = await bcrypt.compare(data.password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        requestId: req.id,
      });
    }

    const tokenFamily = uuidv4();
    const rawRefreshToken = uuidv4();

    await refreshTokensRepo.create({
      user_id: user.id,
      token_family: tokenFamily,
      token_hash: rawRefreshToken,
      is_revoked: false,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    const accessToken = generateAccessToken(user.id, user.email);

    return res.status(200).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, isPlatformAdmin: user.is_platform_admin },
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
          tokenFamily,
          expiresIn: config.jwt.accessExpiration,
        },
      },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Refresh Token Rotation & Family Revocation (Assessment 04)
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = RefreshSchema.parse(req.body);
    const existing = await refreshTokensRepo.findByHash(data.refreshToken);

    if (!existing) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token not recognized or expired.' },
        requestId: req.id,
      });
    }

    // Reuse Detection: If token is already revoked, potential token theft -> revoke entire token family!
    if (existing.is_revoked) {
      await refreshTokensRepo.revokeFamily(existing.token_family);
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_FAMILY_REVOKED',
          message: 'Refresh token reuse detected. All tokens in this family have been revoked for security.',
        },
        requestId: req.id,
      });
    }

    // Revoke currently used refresh token
    await refreshTokensRepo.revokeToken(existing.token_hash);

    // Issue new rotated refresh token in the same family
    const newRawRefreshToken = uuidv4();
    await refreshTokensRepo.create({
      user_id: existing.user_id,
      token_family: existing.token_family,
      token_hash: newRawRefreshToken,
      is_revoked: false,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    const user = await usersRepo.findById(existing.user_id);
    const accessToken = generateAccessToken(user!.id, user!.email);

    return res.status(200).json({
      success: true,
      data: {
        tokens: {
          accessToken,
          refreshToken: newRawRefreshToken,
          tokenFamily: existing.token_family,
          expiresIn: config.jwt.accessExpiration,
        },
      },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Logout / Revocation
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await refreshTokensRepo.revokeToken(refreshToken);
    }
    return res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully. Tokens revoked.' },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Current User Profile
authRouter.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersRepo.findById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });

    // List all memberships for user
    const allMemberships = Array.from((await import('../../db/index.js')).inMemoryDb.memberships.values()).filter(
      (m) => m.user_id === user.id && m.status === 'active'
    );

    const orgsWithRoles = await Promise.all(
      allMemberships.map(async (m) => {
        const org = await orgsRepo.findById(m.organization_id);
        return {
          organizationId: m.organization_id,
          organizationName: org?.name,
          slug: org?.slug,
          role: m.role,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          isPlatformAdmin: user.is_platform_admin,
        },
        memberships: orgsWithRoles,
      },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});
