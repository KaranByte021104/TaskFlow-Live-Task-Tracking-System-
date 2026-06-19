import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Project, ProjectRole, ActivityType } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // Find if user has a membership and get their role
  async getMemberRole(
    projectId: string,
    userId: string,
  ): Promise<ProjectRole | null> {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });
    return member ? member.role : null;
  }

  // Create project and add creator as ADMIN
  async create(
    userId: string,
    data: { name: string; description?: string; color?: string },
  ): Promise<Project> {
    const project = await this.prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          color: data.color || '#3b82f6',
          members: {
            create: {
              userId: userId,
              role: ProjectRole.ADMIN,
            },
          },
        },
      });

      // Create default channel
      await tx.channel.create({
        data: {
          projectId: newProject.id,
          name: data.name,
        },
      });

      // Log Activity: MEMBER_ADDED (for creator)
      await tx.activity.create({
        data: {
          type: ActivityType.MEMBER_ADDED,
          projectId: newProject.id,
          userId: userId,
          metadata: { info: 'Project creator registered as ADMIN' },
        },
      });

      return newProject;
    });

    // Invalidate project list cache
    await this.cacheManager.del(`project-list:user:${userId}`);

    return project;
  }

  // List all projects user belongs to with counts and completion percentages
  async list(userId: string) {
    const cacheKey = `project-list:user:${userId}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            tasks: {
              select: {
                status: true,
              },
            },
            _count: {
              select: {
                tasks: true,
                members: true,
              },
            },
          },
        },
      },
      orderBy: {
        project: {
          updatedAt: 'desc',
        },
      },
    });

    const result = memberships.map((m) => {
      const project = m.project;
      const totalTasks = project.tasks.length;
      const getTaskWeight = (status: string) => {
        switch (status) {
          case 'TODO':
            return 0.0;
          case 'IN_PROGRESS':
            return 0.3;
          case 'REVIEW':
            return 0.7;
          case 'COMPLETED':
            return 1.0;
          default:
            return 0.0;
        }
      };
      const totalWeight = project.tasks.reduce(
        (sum, t) => sum + getTaskWeight(t.status),
        0,
      );
      const completionPercentage =
        totalTasks > 0 ? Math.round((totalWeight / totalTasks) * 100) : 0;

      const { tasks, ...rest } = project;
      return {
        ...rest,
        completionPercentage,
      };
    });

    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }

  // Get user overall dashboard summary metrics
  async getDashboardStats(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });

    const projectIds = memberships.map((m) => m.projectId);
    const totalProjects = projectIds.length;

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
      },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        dueDate: true,
      },
    });

    const totalTasks = tasks.length;
    const assignedTasks = tasks.filter((t) => t.assigneeId === userId).length;

    const now = new Date();
    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate || t.status === 'COMPLETED') return false;
      return new Date(t.dueDate) < now;
    }).length;

    return {
      totalProjects,
      totalTasks,
      assignedTasks,
      overdueTasks,
    };
  }

  // Fetch project details, only if requesting user is a member
  async findOne(projectId: string, userId: string) {
    const isMember = await this.getMemberRole(projectId, userId);
    if (!isMember) {
      throw new NotFoundException('Project not found');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
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
        },
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  // Update project settings (requires ADMIN role)
  async update(
    projectId: string,
    userId: string,
    data: { name?: string; description?: string; color?: string },
  ): Promise<Project> {
    const role = await this.getMemberRole(projectId, userId);
    if (!role) {
      throw new NotFoundException('Project not found');
    }
    if (role !== ProjectRole.ADMIN) {
      throw new ForbiddenException(
        'Only project admins can update general settings',
      );
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
      },
    });

    // Invalidate cache
    await this.cacheManager.del(`project-stats:project:${projectId}`);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    for (const m of members) {
      await this.cacheManager.del(`project-list:user:${m.userId}`);
    }

    return updatedProject;
  }

  // Delete project (requires ADMIN role)
  async remove(projectId: string, userId: string): Promise<void> {
    const role = await this.getMemberRole(projectId, userId);
    if (!role) {
      throw new NotFoundException('Project not found');
    }
    if (role !== ProjectRole.ADMIN) {
      throw new ForbiddenException('Only project admins can delete projects');
    }

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    // Invalidate cache
    await this.cacheManager.del(`project-stats:project:${projectId}`);
    for (const m of members) {
      await this.cacheManager.del(`project-list:user:${m.userId}`);
    }
  }

  // Team Membership Endpoints
  // Invite/add a member
  async addMember(
    projectId: string,
    adminId: string,
    data: { email: string; role: ProjectRole },
  ) {
    const adminRole = await this.getMemberRole(projectId, adminId);
    if (adminRole !== ProjectRole.ADMIN && adminRole !== ProjectRole.MANAGER) {
      throw new ForbiddenException('Only project admins and managers can manage members');
    }

    if (adminRole === ProjectRole.MANAGER && data.role === ProjectRole.ADMIN) {
      throw new ForbiddenException('Managers cannot assign the ADMIN role');
    }

    // Look up user by email
    const userToInvite = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!userToInvite) {
      throw new NotFoundException('No user found with this email address');
    }

    // Check if already a member
    const existing = await this.getMemberRole(projectId, userToInvite.id);
    if (existing) {
      throw new ForbiddenException('User is already a member of this project');
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: userToInvite.id,
        role: data.role,
      },
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
    });

    // Log Activity: MEMBER_ADDED
    await this.prisma.activity.create({
      data: {
        type: ActivityType.MEMBER_ADDED,
        projectId,
        userId: adminId,
        metadata: {
          invitedUserId: userToInvite.id,
          invitedUserEmail: userToInvite.email,
          role: data.role,
        },
      },
    });

    this.realtimeGateway.sendToUserRoom(userToInvite.id, 'project:added', {
      projectId,
    });

    // Invalidate caches
    await this.cacheManager.del(`project-list:user:${userToInvite.id}`);
    await this.cacheManager.del(`project-list:user:${adminId}`);
    await this.cacheManager.del(`project-stats:project:${projectId}`);

    return member;
  }

  // Update member role
  async updateMemberRole(
    projectId: string,
    adminId: string,
    memberId: string,
    role: ProjectRole,
  ) {
    const adminRole = await this.getMemberRole(projectId, adminId);
    if (adminRole !== ProjectRole.ADMIN && adminRole !== ProjectRole.MANAGER) {
      throw new ForbiddenException(
        'Only project admins and managers can manage member roles',
      );
    }

    const memberToUpdate = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.projectId !== projectId) {
      throw new NotFoundException('Project member record not found');
    }

    if (adminRole === ProjectRole.MANAGER) {
      if (memberToUpdate.role === ProjectRole.ADMIN || role === ProjectRole.ADMIN) {
        throw new ForbiddenException(
          'Managers cannot modify admin roles or assign admin role',
        );
      }
    }

    const updated = await this.prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
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
    });

    this.realtimeGateway.sendToUserRoom(updated.userId, 'project:updated', {
      projectId,
      role,
    });

    // Invalidate caches
    await this.cacheManager.del(`project-list:user:${updated.userId}`);

    return updated;
  }

  // Remove member
  async removeMember(projectId: string, adminId: string, memberId: string) {
    const adminRole = await this.getMemberRole(projectId, adminId);
    if (adminRole !== ProjectRole.ADMIN && adminRole !== ProjectRole.MANAGER) {
      throw new ForbiddenException('Only project admins and managers can remove members');
    }

    const memberToRemove = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToRemove || memberToRemove.projectId !== projectId) {
      throw new NotFoundException('Project member record not found');
    }

    if (adminRole === ProjectRole.MANAGER && memberToRemove.role === ProjectRole.ADMIN) {
      throw new ForbiddenException('Managers cannot remove admin members');
    }

    // Protect last admin removal
    if (memberToRemove.role === ProjectRole.ADMIN) {
      const adminCount = await this.prisma.projectMember.count({
        where: { projectId, role: ProjectRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot remove the last project admin');
      }
    }

    await this.prisma.projectMember.delete({
      where: { id: memberId },
    });

    // Log Activity: MEMBER_REMOVED
    await this.prisma.activity.create({
      data: {
        type: ActivityType.MEMBER_REMOVED,
        projectId,
        userId: adminId,
        metadata: { removedUserId: memberToRemove.userId },
      },
    });

    this.realtimeGateway.sendToUserRoom(
      memberToRemove.userId,
      'project:removed',
      {
        projectId,
      },
    );

    // Invalidate caches
    await this.cacheManager.del(`project-list:user:${memberToRemove.userId}`);
    await this.cacheManager.del(`project-list:user:${adminId}`);
    await this.cacheManager.del(`project-stats:project:${projectId}`);
  }

  // Get project activities list (max 50, sorted desc)
  async listActivities(projectId: string, userId: string) {
    const isMember = await this.getMemberRole(projectId, userId);
    if (!isMember) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.activity.findMany({
      where: { projectId },
      take: 50,
      orderBy: {
        createdAt: 'desc',
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
  }

  // Get project dashboard statistics
  async getStats(projectId: string, userId: string) {
    const isMember = await this.getMemberRole(projectId, userId);
    if (!isMember) {
      throw new NotFoundException('Project not found');
    }

    const cacheKey = `project-stats:project:${projectId}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgressTasks = tasks.filter(
      (t) => t.status === 'IN_PROGRESS',
    ).length;
    const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED').length;

    const getTaskWeight = (status: string) => {
      switch (status) {
        case 'TODO':
          return 0.0;
        case 'IN_PROGRESS':
          return 0.3;
        case 'REVIEW':
          return 0.7;
        case 'COMPLETED':
          return 1.0;
        default:
          return 0.0;
      }
    };
    const totalWeight = tasks.reduce(
      (sum, t) => sum + getTaskWeight(t.status),
      0,
    );
    const completionPercentage =
      totalTasks > 0 ? Math.round((totalWeight / totalTasks) * 100) : 0;

    const priorityLow = tasks.filter((t) => t.priority === 'LOW').length;
    const priorityMedium = tasks.filter((t) => t.priority === 'MEDIUM').length;
    const priorityHigh = tasks.filter((t) => t.priority === 'HIGH').length;

    const recentActivities = await this.prisma.activity.findMany({
      where: { projectId },
      take: 5,
      orderBy: { createdAt: 'desc' },
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

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const upcomingTasks = await this.prisma.task.findMany({
      where: {
        projectId,
        status: { not: 'COMPLETED' },
        dueDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      include: {
        assignee: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const statsResult = {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      completionPercentage,
      priority: {
        LOW: priorityLow,
        MEDIUM: priorityMedium,
        HIGH: priorityHigh,
      },
      recentActivities,
      upcomingTasks,
    };

    await this.cacheManager.set(cacheKey, statsResult, 60000);
    return statsResult;
  }

  // Get all tasks assigned to the user across all projects
  async getMyTasks(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });

    const projectIds = memberships.map((m) => m.projectId);

    return this.prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        assigneeId: userId,
      },
      include: {
        project: {
          select: {
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
      orderBy: [{ dueDate: 'asc' }],
    });
  }
}
