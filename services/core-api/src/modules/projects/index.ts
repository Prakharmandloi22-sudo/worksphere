import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { projectsRepo, activityRepo } from '../../db/repositories.js';
import { authenticateToken, tenantMiddleware, requireRole } from '../../middleware/index.js';

export const projectsRouter = Router();

const CreateProjectSchema = z.object({
  name: z.string().min(2),
  key: z.string().min(2).max(10).toUpperCase(),
  description: z.string().optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']).default('active'),
});

const CreateMilestoneSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

// List projects in organization
projectsRouter.get(
  '/:orgId/projects',
  authenticateToken,
  tenantMiddleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projects = await projectsRepo.listByOrg(req.organizationId!);
      return res.status(200).json({ success: true, data: projects, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

// Create project (org_owner and project_manager only)
projectsRouter.post(
  '/:orgId/projects',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner', 'project_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateProjectSchema.parse(req.body);

      const project = await projectsRepo.create({
        organization_id: req.organizationId!,
        name: data.name,
        key: data.key,
        description: data.description || null,
        status: data.status,
        owner_id: req.user!.id,
      });

      await activityRepo.log({
        organization_id: req.organizationId!,
        entity_type: 'project',
        entity_id: project.id,
        user_id: req.user!.id,
        action: 'created',
        diff_json: { name: project.name, key: project.key },
      });

      return res.status(201).json({ success: true, data: project, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

// Get project details
projectsRouter.get(
  '/:orgId/projects/:projectId',
  authenticateToken,
  tenantMiddleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectsRepo.findById(req.params.projectId, req.organizationId!);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found in this organization.' },
          requestId: req.id,
        });
      }

      const milestones = await projectsRepo.listMilestones(project.id, req.organizationId!);

      return res.status(200).json({
        success: true,
        data: { ...project, milestones },
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Create milestone
projectsRouter.post(
  '/:orgId/projects/:projectId/milestones',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner', 'project_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectsRepo.findById(req.params.projectId, req.organizationId!);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' },
          requestId: req.id,
        });
      }

      const data = CreateMilestoneSchema.parse(req.body);
      const milestone = await projectsRepo.createMilestone({
        project_id: project.id,
        organization_id: req.organizationId!,
        title: data.title,
        description: data.description || null,
        due_date: data.dueDate || null,
        status: 'open',
      });

      return res.status(201).json({ success: true, data: milestone, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

