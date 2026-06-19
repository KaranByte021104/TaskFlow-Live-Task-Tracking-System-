import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { EmailQueueService } from '../queues/email-queue.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  // Create a notification
  async createNotification(
    recipientId: string,
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
    metadata?: any,
  ) {
    // Save to database
    const notification = await this.prisma.notification.create({
      data: {
        recipientId,
        type,
        title,
        body,
        link,
        metadata: metadata || undefined,
      },
    });

    // Real-time emission to user's personal room
    this.realtimeGateway.sendToUserRoom(recipientId, 'notification:new', notification);

    // Fetch recipient configuration
    const user = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true, displayName: true, notifyByEmail: true },
    });

    if (user && user.notifyByEmail) {
      // Enqueue background email
      const emailJobId = `notification-email:${recipientId}:${notification.id}`;
      await this.emailQueueService.enqueueEmail(
        'notification',
        {
          email: user.email,
          recipientName: user.displayName,
          title,
          body,
          link,
        } as any,
        emailJobId,
      ).catch((err) => {
        this.logger.error(`Failed to enqueue notification email to ${user.email}:`, err);
      });
    }

    return notification;
  }

  // Get recipient's notifications with cursor pagination
  async getNotifications(userId: string, limit = 10, cursor?: string) {
    const notifications = await this.prisma.notification.findMany({
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return notifications;
  }

  // Get recipient's unread notifications count
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, read: false },
    });
    return { count };
  }

  // Mark a single notification as read
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.recipientId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  // Mark all notifications for a user as read
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true },
    });
  }
}
