import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectRole, ActivityType } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
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

  async create(userId: string, taskId: string, text: string, mentionedUserIds?: string[]) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, title: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkProjectMembership(task.projectId, userId);

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
            images: true,
          },
        },
        labels: {
          include: {
            label: true,
          },
        },
        dependencies: {
          include: {
            blockedBy: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    this.realtimeGateway.sendToProjectRoom(task.projectId, 'task:updated', {
      task: updatedTask,
      userId,
      userDisplayName: user?.displayName || 'Someone',
    });

    // Trigger Mentions Notifications
    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const uniqueMentionedIds = Array.from(new Set(mentionedUserIds));
      for (const recipientId of uniqueMentionedIds) {
        if (recipientId === userId) continue; // Don't notify self

        // Verify they are members of this project
        const isMember = await this.prisma.projectMember.findUnique({
          where: {
            userId_projectId: {
              userId: recipientId,
              projectId: task.projectId,
            },
          },
        });

        if (isMember) {
          const link = `/dashboard/projects/${task.projectId}/board?task=${taskId}`;
          await this.notificationsService.createNotification(
            recipientId,
            'MENTIONED_IN_COMMENT',
            'Mentioned in Comment',
            `${comment.user.displayName} mentioned you in a comment on task "${task.title}"`,
            link,
          );
        }
      }
    }

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
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
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

    await this.checkProjectMembership(
      comment.task.projectId,
      userId,
    );

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

    if (comment.userId !== userId && role !== ProjectRole.ADMIN && role !== ProjectRole.MANAGER) {
      throw new ForbiddenException(
        'Only the author, an admin, or a manager can delete this comment',
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
            images: true,
          },
        },
        labels: {
          include: {
            label: true,
          },
        },
        dependencies: {
          include: {
            blockedBy: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
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

  async toggleReaction(userId: string, commentId: string, emoji: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          select: { projectId: true },
        },
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.checkProjectMembership(comment.task.projectId, userId);

    const existing = await this.prisma.commentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId,
          emoji,
        },
      },
    });

    if (existing) {
      await this.prisma.commentReaction.delete({
        where: {
          commentId_userId_emoji: {
            commentId,
            userId,
            emoji,
          },
        },
      });
    } else {
      await this.prisma.commentReaction.create({
        data: {
          commentId,
          userId,
          emoji,
        },
      });
    }

    const allReactions = await this.prisma.commentReaction.findMany({
      where: { commentId },
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

    this.realtimeGateway.sendToProjectRoom(
      comment.task.projectId,
      'comment:reaction_updated',
      {
        commentId,
        reactions: allReactions,
      },
    );

    return { success: true };
  }

  async listReactions(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          select: { projectId: true },
        },
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.checkProjectMembership(comment.task.projectId, userId);

    const reactions = await this.prisma.commentReaction.findMany({
      where: { commentId },
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

    const groupedMap = new Map<string, { emoji: string; count: number; users: any[]; reactedByMe: boolean }>();

    for (const r of reactions) {
      if (!groupedMap.has(r.emoji)) {
        groupedMap.set(r.emoji, {
          emoji: r.emoji,
          count: 0,
          users: [],
          reactedByMe: false,
        });
      }
      const group = groupedMap.get(r.emoji)!;
      group.count++;
      group.users.push(r.user);
      if (r.userId === userId) {
        group.reactedByMe = true;
      }
    }

    return Array.from(groupedMap.values());
  }
}
