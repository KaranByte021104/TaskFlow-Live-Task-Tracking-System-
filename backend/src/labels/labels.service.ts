import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectRole } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class LabelsService {
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
  async create(userId: string, projectId: string, name: string, color: string) {
    const role = await this.checkProjectMembership(projectId, userId);
    if (role !== ProjectRole.ADMIN && role !== ProjectRole.MANAGER) {
      throw new ForbiddenException('Only project admins and managers can create labels');
    }

    return this.prisma.label.create({
      data: {
        name,
        color,
        projectId,
      },
    });
  }

  async list(userId: string, projectId: string) {
    await this.checkProjectMembership(projectId, userId);

    return this.prisma.label.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(userId: string, labelId: string, name?: string, color?: string) {
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
    });
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    const role = await this.checkProjectMembership(label.projectId, userId);
    if (role !== ProjectRole.ADMIN && role !== ProjectRole.MANAGER) {
      throw new ForbiddenException('Only project admins and managers can update labels');
    }

    const updatedLabel = await this.prisma.label.update({
      where: { id: labelId },
      data: {
        ...(name && { name }),
        ...(color && { color }),
      },
    });

    const taskLabels = await this.prisma.taskLabel.findMany({
      where: { labelId },
      select: { taskId: true },
    });

    for (const tl of taskLabels) {
      const updatedTask = await this.prisma.task.findUnique({
        where: { id: tl.taskId },
        include: {
          assignee: {
            select: { id: true, displayName: true, email: true, avatarUrl: true },
          },
          labels: {
            include: { label: true },
          },
          _count: {
            select: { comments: true, images: true },
          },
        },
      });

      if (updatedTask) {
        this.realtimeGateway.sendToProjectRoom(label.projectId, 'task:updated', {
          task: updatedTask,
          userId,
          userDisplayName: 'System',
        });
      }
    }

    return updatedLabel;
  }

  async delete(userId: string, labelId: string) {
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
    });
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    const role = await this.checkProjectMembership(label.projectId, userId);
    if (role !== ProjectRole.ADMIN && role !== ProjectRole.MANAGER) {
      throw new ForbiddenException('Only project admins and managers can delete labels');
    }

    const taskLabels = await this.prisma.taskLabel.findMany({
      where: { labelId },
      select: { taskId: true },
    });

    await this.prisma.label.delete({
      where: { id: labelId },
    });

    for (const tl of taskLabels) {
      const updatedTask = await this.prisma.task.findUnique({
        where: { id: tl.taskId },
        include: {
          assignee: {
            select: { id: true, displayName: true, email: true, avatarUrl: true },
          },
          labels: {
            include: { label: true },
          },
          _count: {
            select: { comments: true, images: true },
          },
        },
      });

      if (updatedTask) {
        this.realtimeGateway.sendToProjectRoom(label.projectId, 'task:updated', {
          task: updatedTask,
          userId,
          userDisplayName: 'System',
        });
      }
    }

    return { success: true };
  }

  async addLabelToTask(userId: string, taskId: string, labelId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
    });
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    if (label.projectId !== task.projectId) {
      throw new ForbiddenException('Label does not belong to the same project as the task');
    }

    const role = await this.checkProjectMembership(task.projectId, userId);
    if (role !== ProjectRole.ADMIN && role !== ProjectRole.MANAGER) {
      if (task.creatorId !== userId && task.assigneeId !== userId) {
        throw new ForbiddenException('Members can only modify labels on their own tasks');
      }
    }

    const existing = await this.prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: { taskId, labelId },
      },
    });

    if (!existing) {
      await this.prisma.taskLabel.create({
        data: {
          taskId,
          labelId,
        },
      });
    }

    const updatedTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        labels: {
          include: { label: true },
        },
        _count: {
          select: { comments: true, images: true },
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    this.realtimeGateway.sendToProjectRoom(task.projectId, 'task:updated', {
      task: updatedTask,
      userId,
      userDisplayName: user?.displayName || 'Someone',
    });

    return updatedTask;
  }

  async removeLabelFromTask(userId: string, taskId: string, labelId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const role = await this.checkProjectMembership(task.projectId, userId);
    if (role !== ProjectRole.ADMIN && role !== ProjectRole.MANAGER) {
      if (task.creatorId !== userId && task.assigneeId !== userId) {
        throw new ForbiddenException('Members can only modify labels on their own tasks');
      }
    }

    const existing = await this.prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: { taskId, labelId },
      },
    });

    if (existing) {
      await this.prisma.taskLabel.delete({
        where: {
          taskId_labelId: { taskId, labelId },
        },
      });
    }

    const updatedTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        labels: {
          include: { label: true },
        },
        _count: {
          select: { comments: true, images: true },
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    this.realtimeGateway.sendToProjectRoom(task.projectId, 'task:updated', {
      task: updatedTask,
      userId,
      userDisplayName: user?.displayName || 'Someone',
    });

    return updatedTask;
  }
}
