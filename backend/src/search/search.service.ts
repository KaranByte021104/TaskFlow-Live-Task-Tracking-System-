import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: string, scope?: string) {
    if (!query || query.trim() === '') {
      return {
        projects: [],
        tasks: [],
        comments: [],
        users: [],
      };
    }

    const trimmedQuery = query.trim();

    // Check scope if provided
    const validScopes = ['projects', 'tasks', 'comments', 'users'];
    if (scope && !validScopes.includes(scope)) {
      throw new BadRequestException(`Invalid search scope: ${scope}`);
    }

    // Projects search query
    const projectsPromise =
      scope && scope !== 'projects'
        ? Promise.resolve([])
        : this.prisma.project.findMany({
            where: {
              members: {
                some: { userId },
              },
              OR: [
                { name: { contains: trimmedQuery, mode: 'insensitive' } },
                { description: { contains: trimmedQuery, mode: 'insensitive' } },
              ],
            },
            take: 5,
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
            },
          });

    // Tasks search query
    const tasksPromise =
      scope && scope !== 'tasks'
        ? Promise.resolve([])
        : this.prisma.task.findMany({
            where: {
              project: {
                members: {
                  some: { userId },
                },
              },
              OR: [
                { title: { contains: trimmedQuery, mode: 'insensitive' } },
                { description: { contains: trimmedQuery, mode: 'insensitive' } },
              ],
            },
            take: 5,
            select: {
              id: true,
              title: true,
              description: true,
              projectId: true,
            },
          });

    // Comments search query
    const commentsPromise =
      scope && scope !== 'comments'
        ? Promise.resolve([])
        : this.prisma.comment.findMany({
            where: {
              task: {
                project: {
                  members: {
                    some: { userId },
                  },
                },
              },
              text: { contains: trimmedQuery, mode: 'insensitive' },
            },
            take: 5,
            select: {
              id: true,
              text: true,
              taskId: true,
              task: {
                select: {
                  projectId: true,
                  title: true,
                },
              },
              user: {
                select: {
                  displayName: true,
                },
              },
            },
          });

    // Users search query (candidates user shares a project with)
    const usersPromise = async () => {
      if (scope && scope !== 'users') return [];

      const myMemberships = await this.prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const myProjectIds = myMemberships.map((m) => m.projectId);

      return this.prisma.user.findMany({
        where: {
          memberships: {
            some: {
              projectId: { in: myProjectIds },
            },
          },
          OR: [
            { displayName: { contains: trimmedQuery, mode: 'insensitive' } },
            { email: { contains: trimmedQuery, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
        },
      });
    };

    const [projects, tasks, comments, users] = await Promise.all([
      projectsPromise,
      tasksPromise,
      commentsPromise,
      usersPromise(),
    ]);

    return {
      projects,
      tasks,
      comments,
      users,
    };
  }
}
