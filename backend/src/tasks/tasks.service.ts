import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Task,
  TaskStatus,
  TaskPriority,
  ActivityType,
  ProjectRole,
} from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // Helper to verify project membership and return user role
  private async checkProjectMembership(
    projectId: string,
    userId: string,
  ): Promise<ProjectRole> {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });
    if (!member) {
      throw new NotFoundException('Project not found');
    }
    return member.role;
  }

  // Helper to log activity and emit activity:new real-time event
  private async logAndEmitActivity(
    projectId: string,
    userId: string,
    taskId: string | null,
    type: ActivityType,
    metadata: any,
  ) {
    const activity = await this.prisma.activity.create({
      data: {
        type,
        projectId,
        userId,
        taskId,
        metadata,
      },
      include: {
        user: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
        task: {
          select: {
            title: true,
          },
        },
      },
    });

    this.realtimeGateway.sendToProjectRoom(projectId, 'activity:new', {
      activity,
    });
    return activity;
  }

  // Create a task
  async create(
    projectId: string,
    creatorId: string,
    data: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string;
      dueDate?: string;
    },
  ) {
    const role = await this.checkProjectMembership(projectId, creatorId);
    if (role === ProjectRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot create tasks');
    }

    const task = await this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status || TaskStatus.TODO,
        priority: data.priority || TaskPriority.MEDIUM,
        projectId,
        creatorId,
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        creator: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Broadcast event: task:created
    this.realtimeGateway.sendToProjectRoom(projectId, 'task:created', {
      task: {
        ...task,
        _count: { comments: 0, images: 0 },
      },
      userId: creatorId,
      userDisplayName: task.creator.displayName,
    });

    // Log & Broadcast activity: TASK_CREATED
    await this.logAndEmitActivity(
      projectId,
      creatorId,
      task.id,
      ActivityType.TASK_CREATED,
      {
        taskTitle: task.title,
      },
    );

    return task;
  }

  // List all tasks in a project with optional filters, search, and cursor-based pagination
  async list(
    projectId: string,
    userId: string,
    filters: {
      status?: TaskStatus;
      assigneeId?: string;
      search?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    await this.checkProjectMembership(projectId, userId);

    const limit = filters.limit || 50;
    const cursor = filters.cursor;

    return this.prisma.task.findMany({
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: {
          id: cursor,
        },
      }),
      where: {
        projectId,
        ...(filters.status && { status: filters.status }),
        ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
        ...(filters.search && {
          title: {
            contains: filters.search,
            mode: 'insensitive',
          },
        }),
      },
      include: {
        assignee: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            comments: true,
            images: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  // Get all tasks assigned to a specific user across all their projects
  async getMyTasks(userId: string) {
    return this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        project: {
          members: {
            some: { userId },
          },
        },
      },
      include: {
        assignee: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            comments: true,
            images: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(projectId: string, taskId: string, userId: string) {
    await this.checkProjectMembership(projectId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        assignee: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        creator: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  // Update task details
  async update(
    projectId: string,
    taskId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
      dueDate?: string | null;
      lastKnownUpdatedAt?: string;
    },
  ) {
    const role = await this.checkProjectMembership(projectId, userId);
    if (role === ProjectRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot modify tasks');
    }

    const originalTask = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!originalTask) {
      throw new NotFoundException('Task not found');
    }

    // Concurrency conflict check
    if (data.lastKnownUpdatedAt) {
      const clientTime = new Date(data.lastKnownUpdatedAt).getTime();
      const serverTime = new Date(originalTask.updatedAt).getTime();
      if (Math.abs(serverTime - clientTime) > 1000) {
        throw new ConflictException({
          message: 'Task has been updated by another user',
          serverTask: originalTask,
        });
      }
    }

    // Prepare fields to update
    const updateData: any = {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status && { status: data.status }),
      ...(data.priority && { priority: data.priority }),
      ...(data.assigneeId !== undefined && {
        assigneeId: data.assigneeId || null,
      }),
      ...(data.dueDate !== undefined && {
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      }),
    };

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            comments: true,
            images: true,
          },
        },
      },
    });

    const updaterUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    // Broadcast event: task:updated (Send task ID and updated fields)
    this.realtimeGateway.sendToProjectRoom(projectId, 'task:updated', {
      task: updatedTask,
      userId,
      userDisplayName: updaterUser?.displayName || 'Someone',
    });

    // Log Activity: TASK_UPDATED
    await this.logAndEmitActivity(
      projectId,
      userId,
      taskId,
      ActivityType.TASK_UPDATED,
      {
        taskTitle: updatedTask.title,
      },
    );

    // Log Activity: STATUS_CHANGED / TASK_COMPLETED
    if (data.status && data.status !== originalTask.status) {
      const type =
        data.status === TaskStatus.COMPLETED
          ? ActivityType.TASK_COMPLETED
          : ActivityType.STATUS_CHANGED;
      await this.logAndEmitActivity(projectId, userId, taskId, type, {
        taskTitle: updatedTask.title,
        oldStatus: originalTask.status,
        newStatus: data.status,
      });
    }

    return updatedTask;
  }

  // Delete a task
  async remove(projectId: string, taskId: string, userId: string) {
    const role = await this.checkProjectMembership(projectId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check permissions: ADMIN role or task creator
    if (role !== ProjectRole.ADMIN && task.creatorId !== userId) {
      throw new ForbiddenException(
        'Only project admins or the task creator can delete tasks',
      );
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    const deleterUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    // Broadcast event: task:deleted
    this.realtimeGateway.sendToProjectRoom(projectId, 'task:deleted', {
      taskId,
      title: task.title,
      userId,
      userDisplayName: deleterUser?.displayName || 'Someone',
    });

    return { success: true, message: 'Task deleted successfully' };
  }
}
