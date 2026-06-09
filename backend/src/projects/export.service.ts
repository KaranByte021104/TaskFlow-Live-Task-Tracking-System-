import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Parser } from 'json2csv';
import * as path from 'path';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getProjectData(projectId: string, userId: string) {
    // Check project membership
    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Fetch tasks with relations
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: true,
        creator: true,
        labels: {
          include: {
            label: true,
          },
        },
        comments: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Fetch activity log
    const activities = await this.prisma.activity.findMany({
      where: { projectId },
      include: {
        user: true,
        task: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { project, tasks, activities };
  }

  async exportToCsv(projectId: string, userId: string): Promise<string> {
    const { tasks, activities } = await this.getProjectData(projectId, userId);

    // 1. Tasks Section
    const formattedTasks = tasks.map((task) => ({
      Title: task.title,
      Description: task.description || '',
      Status: task.status,
      Priority: task.priority,
      Assignee: task.assignee?.displayName || 'Unassigned',
      Creator: task.creator.displayName,
      Labels: task.labels.map((tl) => tl.label.name).join(', '),
      DueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None',
      CreatedAt: new Date(task.createdAt).toLocaleString(),
      UpdatedAt: new Date(task.updatedAt).toLocaleString(),
    }));

    const tasksParser = new Parser({
      fields: ['Title', 'Description', 'Status', 'Priority', 'Assignee', 'Creator', 'Labels', 'DueDate', 'CreatedAt', 'UpdatedAt'],
    });
    const tasksCsv = tasks.length > 0 ? tasksParser.parse(formattedTasks) : 'No tasks found';

    // 2. Comments Section
    const commentsData: any[] = [];
    tasks.forEach((task) => {
      task.comments.forEach((comment) => {
        commentsData.push({
          TaskTitle: task.title,
          Author: comment.user.displayName,
          Comment: comment.text,
          CreatedAt: new Date(comment.createdAt).toLocaleString(),
        });
      });
    });

    const commentsParser = new Parser({
      fields: ['TaskTitle', 'Author', 'Comment', 'CreatedAt'],
    });
    const commentsCsv = commentsData.length > 0 ? commentsParser.parse(commentsData) : 'No comments found';

    // 3. Activity Log Section
    const formattedActivities = activities.map((act) => {
      let desc = act.type.toString();
      if (act.type === 'STATUS_CHANGED') {
        const metadata = act.metadata as any;
        desc = `Moved task "${act.task?.title || 'Unknown'}" from ${metadata?.from || ''} to ${metadata?.to || ''}`;
      } else if (act.type === 'TASK_CREATED') {
        desc = `Created task "${act.task?.title || 'Unknown'}"`;
      } else if (act.type === 'TASK_COMPLETED') {
        desc = `Completed task "${act.task?.title || 'Unknown'}"`;
      } else if (act.type === 'COMMENT_ADDED') {
        desc = `Added a comment on task "${act.task?.title || 'Unknown'}"`;
      } else if (act.type === 'TASK_UPDATED') {
        const info = (act.metadata as any)?.info || '';
        desc = `Updated task "${act.task?.title || 'Unknown'}": ${info}`;
      } else if (act.type === 'MEMBER_ADDED') {
        desc = `Added a member to the project`;
      } else if (act.type === 'MEMBER_REMOVED') {
        desc = `Removed a member from the project`;
      }

      return {
        User: act.user.displayName,
        Description: desc,
        Timestamp: new Date(act.createdAt).toLocaleString(),
      };
    });

    const activitiesParser = new Parser({
      fields: ['User', 'Description', 'Timestamp'],
    });
    const activitiesCsv = formattedActivities.length > 0 ? activitiesParser.parse(formattedActivities) : 'No activity logs found';

    // Combine sections with blank rows and headers
    return [
      '--- TASKS ---',
      tasksCsv,
      '',
      '--- COMMENTS ---',
      commentsCsv,
      '',
      '--- ACTIVITY LOG ---',
      activitiesCsv,
    ].join('\n');
  }

  async exportToPdf(projectId: string, userId: string): Promise<Buffer> {
    const { project, tasks, activities } = await this.getProjectData(projectId, userId);

    // Calculate metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const accentColor = project.color || '#3b82f6';

    // Formulate tasks table
    const tableBody: any[] = [
      [
        { text: 'Title', style: 'tableHeader', fillColor: accentColor },
        { text: 'Status', style: 'tableHeader', fillColor: accentColor },
        { text: 'Priority', style: 'tableHeader', fillColor: accentColor },
        { text: 'Assignee', style: 'tableHeader', fillColor: accentColor },
        { text: 'Due Date', style: 'tableHeader', fillColor: accentColor },
        { text: 'Labels', style: 'tableHeader', fillColor: accentColor },
      ],
    ];

    tasks.forEach((t) => {
      tableBody.push([
        { text: t.title, fontSize: 9 },
        { text: t.status, fontSize: 9 },
        { text: t.priority, fontSize: 9 },
        { text: t.assignee?.displayName || 'Unassigned', fontSize: 9 },
        { text: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'None', fontSize: 9 },
        { text: t.labels.map((tl) => tl.label.name).join(', '), fontSize: 9 },
      ]);
    });

    // Formulate comments list
    const commentsContent: any[] = [];
    tasks.forEach((t) => {
      if (t.comments.length > 0) {
        commentsContent.push({ text: `Task: ${t.title}`, style: 'subheading', margin: [0, 8, 0, 4] });
        t.comments.forEach((c) => {
          commentsContent.push({
            text: [
              { text: `${c.user.displayName}: `, bold: true, fontSize: 9 },
              { text: c.text, fontSize: 9 },
              { text: ` (${new Date(c.createdAt).toLocaleDateString()})`, italic: true, fontSize: 8, color: '#64748b' },
            ],
            margin: [8, 2, 0, 2],
          });
        });
      }
    });

    if (commentsContent.length === 0) {
      commentsContent.push({ text: 'No comments found in this project.', italic: true, fontSize: 9 });
    }

    // Formulate activity log
    const activityContent: any[] = [];
    activities.forEach((act) => {
      let desc = act.type.toString();
      if (act.type === 'STATUS_CHANGED') {
        const metadata = act.metadata as any;
        desc = `Moved task "${act.task?.title || 'Unknown'}" from ${metadata?.from || ''} to ${metadata?.to || ''}`;
      } else if (act.type === 'TASK_CREATED') {
        desc = `Created task "${act.task?.title || 'Unknown'}"`;
      } else if (act.type === 'TASK_COMPLETED') {
        desc = `Completed task "${act.task?.title || 'Unknown'}"`;
      } else if (act.type === 'COMMENT_ADDED') {
        desc = `Added a comment on task "${act.task?.title || 'Unknown'}"`;
      } else if (act.type === 'TASK_UPDATED') {
        const info = (act.metadata as any)?.info || '';
        desc = `Updated task "${act.task?.title || 'Unknown'}": ${info}`;
      } else if (act.type === 'MEMBER_ADDED') {
        desc = `Added a member to the project`;
      } else if (act.type === 'MEMBER_REMOVED') {
        desc = `Removed a member from the project`;
      }

      activityContent.push({
        text: [
          { text: `[${new Date(act.createdAt).toLocaleString()}] `, color: '#64748b', fontSize: 8.5 },
          { text: `${act.user.displayName}: `, bold: true, fontSize: 9 },
          { text: desc, fontSize: 9 },
        ],
        margin: [0, 3, 0, 3],
      });
    });

    if (activityContent.length === 0) {
      activityContent.push({ text: 'No activity records found.', italic: true, fontSize: 9 });
    }

    // Document definition
    const docDefinition = {
      content: [
        // Cover Page
        { text: project.name, style: 'coverTitle', color: accentColor, alignment: 'center', margin: [0, 150, 0, 10] },
        { text: 'PROJECT DATA EXPORT REPORT', style: 'coverSubtitle', alignment: 'center', margin: [0, 0, 0, 50] },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: `Export Date: ${new Date().toLocaleDateString()}`, fontSize: 10, margin: [0, 4, 0, 4] },
                { text: `Total Tasks: ${totalTasks}`, fontSize: 10, margin: [0, 4, 0, 4] },
                { text: `Completed Tasks: ${completedTasks}`, fontSize: 10, margin: [0, 4, 0, 4] },
                { text: `Completion Rate: ${completionPercent}%`, fontSize: 10, margin: [0, 4, 0, 4] },
              ],
            },
          ],
          alignment: 'center',
        },
        { text: '', pageBreak: 'after' },

        // Tasks Page
        { text: 'Tasks List', style: 'heading', color: accentColor },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: 'lightHorizontalLines',
          margin: [0, 10, 0, 20],
        },

        // Comments Page
        { text: 'Task Comments', style: 'heading', color: accentColor, pageBreak: 'before' },
        { stack: commentsContent, margin: [0, 10, 0, 20] },

        // Activity Log Page
        { text: 'Activity Audit Log', style: 'heading', color: accentColor, pageBreak: 'before' },
        { stack: activityContent, margin: [0, 10, 0, 20] },
      ],
      styles: {
        coverTitle: {
          fontSize: 32,
          bold: true,
        },
        coverSubtitle: {
          fontSize: 14,
          bold: true,
          color: '#64748b',
        },
        heading: {
          fontSize: 18,
          bold: true,
          margin: [0, 10, 0, 10],
        },
        subheading: {
          fontSize: 12,
          bold: true,
          color: '#334155',
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    return this.generatePdfBuffer(docDefinition);
  }

  private generatePdfBuffer(docDefinition: any): Promise<Buffer> {
    const pdfmakeDir = path.dirname(require.resolve('pdfmake/package.json'));
    const fonts = {
      Roboto: {
        normal: path.join(pdfmakeDir, 'fonts', 'Roboto', 'Roboto-Regular.ttf'),
        bold: path.join(pdfmakeDir, 'fonts', 'Roboto', 'Roboto-Medium.ttf'),
        italic: path.join(pdfmakeDir, 'fonts', 'Roboto', 'Roboto-Italic.ttf'),
        bolditalic: path.join(pdfmakeDir, 'fonts', 'Roboto', 'Roboto-MediumItalic.ttf'),
      },
    };

    const pdfmake = require('pdfmake');
    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    return pdfDoc.getBuffer();
  }
}
