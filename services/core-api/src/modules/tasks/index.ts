import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { tasksRepo, projectsRepo, commentsRepo, activityRepo, usersRepo } from '../../db/repositories.js';
import { authenticateToken, tenantMiddleware, requireRole } from '../../middleware/index.js';
import { realtimeBroker } from '../../realtime/index.js';
import { taskQueue } from '../../queues/index.js';

export const tasksRouter = Router();

const CreateTaskSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().min(0).default(0),
  tags: z.array(z.string()).default([]),
});

const UpdateTaskSchema = z.object({
  version: z.number().int().min(1), // Required for Optimistic Concurrency Control
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().min(0).optional(),
  actualHours: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
});

const AddCommentSchema = z.object({
  content: z.string().min(1),
});

// 1. List tasks for organization (with filters)
tasksRouter.get(
  '/:orgId/tasks',
  authenticateToken,
  tenantMiddleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        status: req.query.status as string,
        assignee_id: req.query.assigneeId as string,
      };

      const tasks = await tasksRepo.listByOrg(req.organizationId!, filters);
      return res.status(200).json({ success: true, count: tasks.length, data: tasks, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

// 2. Create task
tasksRouter.post(
  '/:orgId/tasks',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner', 'project_manager', 'team_member']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateTaskSchema.parse(req.body);

      // Verify project belongs to organization
      const project = await projectsRepo.findById(data.projectId, req.organizationId!);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { code: 'PROJECT_NOT_FOUND', message: 'Target project not found in organization.' },
          requestId: req.id,
        });
      }

      const task = await tasksRepo.create({
        organization_id: req.organizationId!,
        project_id: data.projectId,
        milestone_id: data.milestoneId || null,
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        assignee_id: data.assigneeId || null,
        creator_id: req.user!.id,
        due_date: data.dueDate || null,
        estimated_hours: data.estimatedHours,
        actual_hours: 0,
        tags: data.tags,
      });

      // Record immutable activity log
      await activityRepo.log({
        organization_id: req.organizationId!,
        entity_type: 'task',
        entity_id: task.id,
        user_id: req.user!.id,
        action: 'created',
        diff_json: { title: task.title, status: task.status, priority: task.priority },
        ip_address: req.ip,
      });

      // Realtime notification broadcast
      realtimeBroker.broadcast(req.organizationId!, 'task_created', task);

      // If assigned, enqueue background notification with deduplication idempotency key
      if (task.assignee_id) {
        const assignee = await usersRepo.findById(task.assignee_id);
        if (assignee) {
          await taskQueue.add(
            'send_notification',
            {
              recipientEmail: assignee.email,
              title: `Assigned: ${task.title}`,
              taskId: task.id,
              organizationId: req.organizationId!,
            },
            { idempotencyKey: `notif:task_assign:${task.id}:${task.assignee_id}` }
          );
        }
      }

      return res.status(201).json({ success: true, data: task, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

// 3. Get single task
tasksRouter.get(
  '/:orgId/tasks/:taskId',
  authenticateToken,
  tenantMiddleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await tasksRepo.findById(req.params.taskId, req.organizationId!);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found in this organization.' },
          requestId: req.id,
        });
      }

      const comments = await commentsRepo.listByTask(task.id, req.organizationId!);
      const history = await activityRepo.listByEntity('task', task.id);

      return res.status(200).json({
        success: true,
        data: { ...task, comments, activityHistory: history },
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 4. Update task (Domain Capstone Challenge: Optimistic Concurrency Control)
tasksRouter.patch(
  '/:orgId/tasks/:taskId',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner', 'project_manager', 'team_member']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UpdateTaskSchema.parse(req.body);

      // Find current task state for diffing
      const existing = await tasksRepo.findById(req.params.taskId, req.organizationId!);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' },
          requestId: req.id,
        });
      }

      // Compute field diffs for activity log
      const diff: Record<string, { before: any; after: any }> = {};
      const updates: any = {};

      if (data.title !== undefined && data.title !== existing.title) {
        diff.title = { before: existing.title, after: data.title };
        updates.title = data.title;
      }
      if (data.description !== undefined && data.description !== existing.description) {
        diff.description = { before: existing.description, after: data.description };
        updates.description = data.description;
      }
      if (data.status !== undefined && data.status !== existing.status) {
        diff.status = { before: existing.status, after: data.status };
        updates.status = data.status;
      }
      if (data.priority !== undefined && data.priority !== existing.priority) {
        diff.priority = { before: existing.priority, after: data.priority };
        updates.priority = data.priority;
      }
      if (data.assigneeId !== undefined && data.assigneeId !== existing.assignee_id) {
        diff.assignee_id = { before: existing.assignee_id, after: data.assigneeId };
        updates.assignee_id = data.assigneeId;
      }
      if (data.dueDate !== undefined && data.dueDate !== existing.due_date) {
        diff.due_date = { before: existing.due_date, after: data.dueDate };
        updates.due_date = data.dueDate;
      }
      if (data.estimatedHours !== undefined && data.estimatedHours !== existing.estimated_hours) {
        updates.estimated_hours = data.estimatedHours;
      }
      if (data.actualHours !== undefined && data.actualHours !== existing.actual_hours) {
        updates.actual_hours = data.actualHours;
      }
      if (data.tags !== undefined) {
        updates.tags = data.tags;
      }

      // Perform optimistic concurrency check and atomic update
      const updated = await tasksRepo.updateWithConcurrencyCheck(
        req.params.taskId,
        req.organizationId!,
        data.version,
        updates
      );

      // Record immutable activity log
      await activityRepo.log({
        organization_id: req.organizationId!,
        entity_type: 'task',
        entity_id: updated.id,
        user_id: req.user!.id,
        action: 'updated',
        diff_json: diff,
        ip_address: req.ip,
      });

      // Broadcast real-time update
      realtimeBroker.broadcast(req.organizationId!, 'task_updated', updated);

      // Enqueue notification with deduplicated idempotency key (prevents duplicate notification on worker retry)
      if (updated.assignee_id) {
        const assignee = await usersRepo.findById(updated.assignee_id);
        if (assignee) {
          await taskQueue.add(
            'send_notification',
            {
              recipientEmail: assignee.email,
              title: `Task Updated: ${updated.title}`,
              taskId: updated.id,
              organizationId: req.organizationId!,
              version: updated.version,
            },
            { idempotencyKey: `notif:task_update:${updated.id}:v${updated.version}` }
          );
        }
      }

      return res.status(200).json({
        success: true,
        data: updated,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 5. Delete task
tasksRouter.delete(
  '/:orgId/tasks/:taskId',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner', 'project_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await tasksRepo.delete(req.params.taskId, req.organizationId!);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' },
          requestId: req.id,
        });
      }

      await activityRepo.log({
        organization_id: req.organizationId!,
        entity_type: 'task',
        entity_id: req.params.taskId,
        user_id: req.user!.id,
        action: 'deleted',
        diff_json: { taskId: req.params.taskId },
        ip_address: req.ip,
      });

      return res.status(200).json({
        success: true,
        data: { message: 'Task deleted successfully.' },
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 6. Comments on task
tasksRouter.get(
  '/:orgId/tasks/:taskId/comments',
  authenticateToken,
  tenantMiddleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comments = await commentsRepo.listByTask(req.params.taskId, req.organizationId!);
      return res.status(200).json({ success: true, data: comments, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

tasksRouter.post(
  '/:orgId/tasks/:taskId/comments',
  authenticateToken,
  tenantMiddleware(),
  requireRole(['org_owner', 'project_manager', 'team_member']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = AddCommentSchema.parse(req.body);

      const task = await tasksRepo.findById(req.params.taskId, req.organizationId!);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' },
          requestId: req.id,
        });
      }

      const comment = await commentsRepo.create({
        task_id: task.id,
        organization_id: req.organizationId!,
        author_id: req.user!.id,
        content: data.content,
      });

      realtimeBroker.broadcast(req.organizationId!, 'comment_added', comment);

      return res.status(201).json({ success: true, data: comment, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
);

