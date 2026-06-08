import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Project, ProjectRole, ActivityType } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
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
    const project = await this.prisma.project.create({
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

    // Log Activity: MEMBER_ADDED (for creator)
    await this.prisma.activity.create({
      data: {
        type: ActivityType.MEMBER_ADDED,
        projectId: project.id,
        userId: userId,
        metadata: { info: 'Project creator registered as ADMIN' },
      },
    });

    return project;
  }

  // List all projects user belongs to with counts and completion percentages
  async list(userId: string) {
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

    return memberships.map((m) => {
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

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
      },
    });
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

    await this.prisma.project.delete({
      where: { id: projectId },
    });
  }

  // Team Membership Endpoints
  // Invite/add a member
  async addMember(
    projectId: string,
    adminId: string,
    data: { email: string; role: ProjectRole },
  ) {
    const adminRole = await this.getMemberRole(projectId, adminId);
    if (adminRole !== ProjectRole.ADMIN) {
      throw new ForbiddenException('Only project admins can manage members');
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
    if (adminRole !== ProjectRole.ADMIN) {
      throw new ForbiddenException(
        'Only project admins can manage member roles',
      );
    }

    const memberToUpdate = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.projectId !== projectId) {
      throw new NotFoundException('Project member record not found');
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

    return updated;
  }

  // Remove member
  async removeMember(projectId: string, adminId: string, memberId: string) {
    const adminRole = await this.getMemberRole(projectId, adminId);
    if (adminRole !== ProjectRole.ADMIN) {
      throw new ForbiddenException('Only project admins can remove members');
    }

    const memberToRemove = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToRemove || memberToRemove.projectId !== projectId) {
      throw new NotFoundException('Project member record not found');
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

    return {
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
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }],
    });
  }
}
