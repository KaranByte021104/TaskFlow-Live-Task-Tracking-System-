import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConfigService } from '@nestjs/config';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { ActivityType } from '@prisma/client';

@Injectable()
export class ProjectFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly configService: ConfigService,
  ) {}

  // Helper to verify membership
  private async verifyMemberRole(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }
    return member;
  }

  // Upload project files
  async uploadFiles(projectId: string, user: any, files: Express.Multer.File[]) {
    await this.verifyMemberRole(projectId, user.id);

    const backendPort = this.configService.get<number>('PORT') || 3001;
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      `http://localhost:${backendPort}`;

    const filesData = files.map((file) => ({
      projectId,
      originalName: file.originalname,
      storedName: file.filename,
      url: `${backendUrl}/uploads/projects/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype,
      uploaderId: user.id,
    }));

    await this.prisma.projectFile.createMany({
      data: filesData,
    });

    const newlyCreated = await this.prisma.projectFile.findMany({
      where: {
        projectId,
        storedName: { in: files.map((f) => f.filename) },
      },
      include: {
        uploader: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Log Activity
    await this.prisma.activity.create({
      data: {
        type: ActivityType.FILE_UPLOADED,
        projectId,
        userId: user.id,
        metadata: {
          info: `Uploaded ${files.length} file(s)`,
          files: newlyCreated.map((f) => ({ id: f.id, name: f.originalName })),
        },
      },
    });

    // Emit live Socket.IO update to project room
    this.realtimeGateway.sendToProjectRoom(projectId, 'project:file_uploaded', newlyCreated);

    return newlyCreated;
  }

  // List all files for a project
  async listFiles(projectId: string, userId: string) {
    await this.verifyMemberRole(projectId, userId);

    return this.prisma.projectFile.findMany({
      where: { projectId },
      include: {
        uploader: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Delete a file
  async deleteFile(projectId: string, fileId: string, user: any) {
    const file = await this.prisma.projectFile.findUnique({
      where: { id: fileId },
    });

    if (!file || file.projectId !== projectId) {
      throw new NotFoundException('Project file not found');
    }

    const member = await this.verifyMemberRole(projectId, user.id);

    // Only uploader, Admin, or Manager can delete
    const isOwner = file.uploaderId === user.id;
    const isPrivileged = member.role === 'ADMIN' || member.role === 'MANAGER';

    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException('Only the uploader or project managers/admins can delete files');
    }

    // Delete from database
    await this.prisma.projectFile.delete({
      where: { id: fileId },
    });

    // Delete from disk
    const filePath = join(process.cwd(), 'uploads', 'projects', file.storedName);
    try {
      await unlink(filePath);
    } catch (err) {
      console.warn(`Failed to delete project file from disk: ${filePath}`, err.message);
    }

    // Log Activity
    await this.prisma.activity.create({
      data: {
        type: ActivityType.FILE_DELETED,
        projectId,
        userId: user.id,
        metadata: {
          info: `Deleted file: ${file.originalName}`,
          fileId,
          filename: file.originalName,
        },
      },
    });

    // Emit live Socket.IO update to project room
    this.realtimeGateway.sendToProjectRoom(projectId, 'project:file_deleted', { fileId });

    return { success: true };
  }
}
