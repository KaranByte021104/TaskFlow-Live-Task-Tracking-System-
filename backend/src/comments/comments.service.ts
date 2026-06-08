import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectRole, ActivityType } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

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

  async create(userId: string, taskId: string, text: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, title: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const role = await this.checkProjectMembership(task.projectId, userId);
    if (role === ProjectRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot comment');
    }

    const comment = await this.prisma.comment.create({
      data: {
        text,
        taskId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    // Create Activity Log
    const activity = await this.prisma.activity.create({
      data: {
        type: ActivityType.COMMENT_ADDED,
        projectId: task.projectId,
        userId,
        taskId,
        metadata: { taskTitle: task.title },
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

    // Emit activity:new
    this.realtimeGateway.sendToProjectRoom(task.projectId, 'activity:new', {
      activity,
    });

    // Emit task:updated so that count updates
    const updatedTask = await this.prisma.task.findFirst({
      where: { id: taskId },
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
          },
        },
      },
    });

    this.realtimeGateway.sendToProjectRoom(task.projectId, 'task:updated', {
      task: updatedTask,
      userId,
      userDisplayName: user?.displayName || 'Someone',
    });

    return comment;
  }

  async list(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkProjectMembership(task.projectId, userId);

    return this.prisma.comment.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async update(userId: string, commentId: string, text: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          select: {
            projectId: true,
          },
        },
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const role = await this.checkProjectMembership(
      comment.task.projectId,
      userId,
    );
    if (role === ProjectRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot edit comments');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('Only the author can edit this comment');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { text },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async delete(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          select: {
            projectId: true,
            id: true,
          },
        },
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const role = await this.checkProjectMembership(
      comment.task.projectId,
      userId,
    );
    if (role === ProjectRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot delete comments');
    }

    if (comment.userId !== userId && role !== ProjectRole.ADMIN) {
      throw new ForbiddenException(
        'Only the author or an admin can delete this comment',
      );
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    // Send task:updated event so comments count updates
    const updatedTask = await this.prisma.task.findFirst({
      where: { id: comment.task.id },
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
          },
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    this.realtimeGateway.sendToProjectRoom(
      comment.task.projectId,
      'task:updated',
      {
        task: updatedTask,
        userId,
        userDisplayName: user?.displayName || 'Someone',
      },
    );

    return { success: true };
  }
}
