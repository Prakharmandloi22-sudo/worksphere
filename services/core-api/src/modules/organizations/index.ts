import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { orgsRepo, usersRepo, auditRepo } from '../../db/repositories.js';
import { inMemoryDb } from '../../db/index.js';
import { authenticateToken, tenantMiddleware, requireRole } from '../../middleware/index.js';
import { emailAdapter } from '../../integrations/index.js';

export const orgsRouter = Router();

const CreateOrgSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  plan: z.enum(['starter', 'professional', 'enterprise']).default('starter'),
});

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['org_owner', 'project_manager', 'team_member', 'auditor']),
});

// List user's organizations
orgsRouter.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.is_platform_admin) {
      const allOrgs = await orgsRepo.list();
      return res.status(200).json({ success: true, data: allOrgs, requestId: req.id });
    }

    const memberships = Array.from(inMemoryDb.memberships.values()).filter(
      (m) => m.user_id === req.user!.id && m.status === 'active'
    );
    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await orgsRepo.findById(m.organization_id);
        return { ...org, role: m.role };
      })
    );

    return res.status(200).json({ success: true, data: orgs, requestId: req.id });
  } catch (err) {
    next(err);
  }
});

// Create new organization
orgsRouter.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateOrgSchema.parse(req.body);

    const existing = await orgsRepo.findBySlug(data.slug);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'ORG_EXISTS', message: 'Organization slug is already taken.' },
        requestId: req.id,
      });
    }

    const org = await orgsRepo.create({
      name: data.name,
      slug: data.slug,
      plan: data.plan,
      status: 'active',
      settings: {},
    });

    await orgsRepo.addMember({
      organization_id: org.id,
      user_id: req.user!.id,
      role: 'org_owner',
      status: 'active',
    });

    await auditRepo.log({
      organization_id: org.id,
      actor_id: req.user!.id,
      event_type: 'organization.created',
      details: { orgId: org.id, name: org.name },
      ip_address: req.ip,
    });

    return res.status(201).json({ success: true, data: org, requestId: req.id });
  } catch (err) {
    next(err);
  }
});

// Get organization details (Tenant check enforced)
orgsRouter.get('/:orgId', authenticateToken, tenantMiddleware(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await orgsRepo.findById(req.organizationId!);
    return res.status(200).json({ success: true, data: org, membership: req.membership, requestId: req.id });
  } catch (err) {
    next(err);
  }
});

// List organization members
orgsRouter.get('/:orgId/members', authenticateToken, tenantMiddleware(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memberships = await orgsRepo.listMembers(req.organizationId!);
    const membersWithUsers = await Promise.all(
      memberships.map(async (m) => {
        const u = await usersRepo.findById(m.user_id);
        return {
          id: m.id,
          userId: m.user_id,
          role: m.role,
          email: u?.email,
          firstName: u?.first_name,
          lastName: u?.last_name,
          joinedAt: m.joined_at,
        };
      })
    );

    return res.status(200).json({ success: true, data: membersWithUsers, requestId: req.id });
  } catch (err) {
    next(err);
  }
});

// Invite member (Role restricted: org_owner and project_manager only)
orgsRouter.post(
  '/:orgId/invitations',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner', 'project_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = InviteMemberSchema.parse(req.body);

      // Check if user already exists
      let user = await usersRepo.findByEmail(data.email);
      if (!user) {
        // Create user stub
        user = await usersRepo.create({
          email: data.email,
          password_hash: 'placeholder-hash-awaiting-invitation-acceptance',
          first_name: data.email.split('@')[0],
          last_name: 'User',
          is_platform_admin: false,
          is_active: true,
        });
      }

      // Check if already member
      const existingMember = await orgsRepo.findMembership(req.organizationId!, user.id);
      if (existingMember) {
        return res.status(409).json({
          success: false,
          error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this organization.' },
          requestId: req.id,
        });
      }

      const membership = await orgsRepo.addMember({
        organization_id: req.organizationId!,
        user_id: user.id,
        role: data.role,
        status: 'active',
      });

      // Send mock email invitation
      await emailAdapter.sendEmail(
        data.email,
        `You have been invited to join ${req.organizationId} on WorkSphere`,
        `<p>You have been invited as a <strong>${data.role}</strong>.</p>`
      );

      await auditRepo.log({
        organization_id: req.organizationId!,
        actor_id: req.user!.id,
        event_type: 'member.invited',
        details: { invitedEmail: data.email, role: data.role },
        ip_address: req.ip,
      });

      return res.status(201).json({
        success: true,
        data: { membershipId: membership.id, email: data.email, role: data.role },
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

