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

import { TaskImage } from '@prisma/client';

@Injectable()
export class TaskImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly configService: ConfigService,
  ) {}

  // Helper to check membership
  private async checkProjectMembership(projectId: string, userId: string) {
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

  // Upload task images
  async uploadImages(taskId: string, user: any, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      return [];
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, title: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const member = await this.checkProjectMembership(task.projectId, user.id);
    if (member.role !== 'ADMIN' && member.role !== 'MANAGER') {
      const fullTask = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { creatorId: true, assigneeId: true },
      });
      if (fullTask && fullTask.creatorId !== user.id && fullTask.assigneeId !== user.id) {
        throw new ForbiddenException('Members can only upload images to their own tasks');
      }
    }

    const backendPort = this.configService.get<number>('PORT') || 3001;
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      `http://localhost:${backendPort}`;

    const imagesData = files.map((file) => ({
      taskId,
      originalName: file.originalname,
      storedName: file.filename,
      url: `${backendUrl}/uploads/tasks/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype,
      uploaderId: user.id,
    }));

    await this.prisma.taskImage.createMany({
      data: imagesData,
    });

    // Fetch the full updated list of images for this task
    const allImages = await this.prisma.taskImage.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });

    // Log activity: TASK_UPDATED
    await this.prisma.activity.create({
      data: {
        type: 'TASK_UPDATED',
        projectId: task.projectId,
        userId: user.id,
        taskId,
        metadata: { info: `Uploaded ${files.length} image attachment(s)` },
      },
    });

    // Emit live update
    this.realtimeGateway.sendToProjectRoom(
      task.projectId,
      'task:images_updated',
      {
        taskId,
        images: allImages,
      },
    );

    // Return the newly created images
    return allImages.filter((img: TaskImage) =>
      files.some((f) => f.filename === img.storedName),
    );
  }

  // Get task images
  async getTaskImages(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkProjectMembership(task.projectId, userId);

    return this.prisma.taskImage.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Delete task image
  async deleteImage(imageId: string, user: any) {
    const image = await this.prisma.taskImage.findUnique({
      where: { id: imageId },
      include: {
        task: {
          select: {
            projectId: true,
            id: true,
          },
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Image attachment not found');
    }

    const member = await this.checkProjectMembership(
      image.task.projectId,
      user.id,
    );

    if (image.uploaderId !== user.id && member.role !== 'ADMIN' && member.role !== 'MANAGER') {
      throw new ForbiddenException(
        'Only the uploader, project admins, or managers can delete images',
      );
    }

    // Delete from filesystem
    const filePath = join(process.cwd(), 'uploads', 'tasks', image.storedName);
    try {
      await unlink(filePath);
    } catch (err) {
      console.warn(`File unlink failed for ${filePath}:`, err.message);
    }

    // Delete from database
    await this.prisma.taskImage.delete({
      where: { id: imageId },
    });

    // Fetch remaining task images
    const remainingImages = await this.prisma.taskImage.findMany({
      where: { taskId: image.task.id },
      orderBy: { createdAt: 'asc' },
    });

    // Emit live update
    this.realtimeGateway.sendToProjectRoom(
      image.task.projectId,
      'task:images_updated',
      {
        taskId: image.task.id,
        images: remainingImages,
      },
    );

    return { success: true };
  }
}
