import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  // Get/create a channel for a project
  async getChannelForProject(projectId: string, userId: string) {
    // Verify membership
    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }

    let channel = await this.prisma.channel.findFirst({
      where: { projectId, isGeneral: true },
    });

    if (!channel) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      channel = await this.prisma.channel.create({
        data: {
          projectId,
          name: 'general',
          isGeneral: true,
        },
      });
    }

    const unreadCount = await this.prisma.message.count({
      where: {
        channelId: channel.id,
        senderId: { not: userId },
        createdAt: {
          gt: member.lastReadAt,
        },
      },
    });

    return {
      ...channel,
      unreadCount,
    };
  }

  // Get or create a DM conversation
  async getOrCreateConversation(otherUserId: string, userId: string) {
    if (otherUserId === userId) {
      throw new BadRequestException('You cannot start a conversation with yourself');
    }

    // Verify both users share at least one project
    const sharedProject = await this.prisma.projectMember.findFirst({
      where: {
        userId: userId,
        project: {
          members: {
            some: {
              userId: otherUserId,
            },
          },
        },
      },
    });

    if (!sharedProject) {
      throw new ForbiddenException(
        'You cannot direct message someone you do not share a project with',
      );
    }

    // Look up existing conversation
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        participants: {
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
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          participants: {
            create: [{ userId }, { userId: otherUserId }],
          },
        },
        include: {
          participants: {
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
        },
      });
    }

    return conversation;
  }

  // List user's conversations
  async listUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
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
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    return conversations
      .map((conv) => {
        const otherParticipant =
          conv.participants.find((p) => p.userId !== userId)?.user || null;
        const lastMessage = conv.messages[0] || null;
        const userParticipant = conv.participants.find((p) => p.userId === userId);
        const lastReadAt = userParticipant?.lastReadAt || new Date(0);

        // Calculate unread count
        const unreadCount = conv.messages.filter(
          (msg) => msg.senderId !== userId && new Date(msg.createdAt) > new Date(lastReadAt),
        ).length;

        return {
          id: conv.id,
          createdAt: conv.createdAt,
          otherParticipant,
          lastMessage,
          lastReadAt,
          unreadCount,
        };
      })
      .sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
  }

  // Send message
  async sendMessage(
    userId: string,
    data: {
      channelId?: string;
      conversationId?: string;
      content: string;
      mentionedUserIds?: string[];
    },
    files?: Express.Multer.File[],
  ) {
    const { channelId, conversationId, content, mentionedUserIds } = data;

    if (!channelId && !conversationId) {
      throw new BadRequestException('Either channelId or conversationId must be provided');
    }
    if (channelId && conversationId) {
      throw new BadRequestException('Cannot provide both channelId and conversationId');
    }

    // Authorization checks
    let projectId: string | null = null;
    if (channelId) {
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
      });
      if (!channel) throw new NotFoundException('Channel not found');
      if (channel.isArchived) {
        throw new BadRequestException('Cannot send messages to an archived channel');
      }
      projectId = channel.projectId;

      const member = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId, projectId: channel.projectId },
        },
      });
      if (!member) {
        throw new ForbiddenException('Not authorized to send messages in this channel');
      }
    } else if (conversationId) {
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });
      if (!participant) {
        throw new ForbiddenException('Not authorized to send messages in this conversation');
      }
    }

    const backendPort = this.configService.get<number>('PORT') || 3001;
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      `http://localhost:${backendPort}`;

    // Create the message
    const message = await this.prisma.message.create({
      data: {
        content,
        senderId: userId,
        channelId: channelId || null,
        conversationId: conversationId || null,
        attachments:
          files && files.length > 0
            ? {
                create: files.map((file) => ({
                  originalName: file.originalname,
                  storedName: file.filename,
                  url: `${backendUrl}/uploads/attachments/${file.filename}`,
                  size: file.size,
                  mimeType: file.mimetype,
                })),
              }
            : undefined,
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        attachments: true,
      },
    });

    // Update last read of sender
    if (channelId && projectId) {
      await this.prisma.projectMember.update({
        where: {
          userId_projectId: { userId, projectId },
        },
        data: {
          lastReadAt: new Date(),
        },
      });
    } else if (conversationId) {
      await this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        data: {
          lastReadAt: new Date(),
        },
      });
    }

    // Handle Mentions
    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const uniqueMentionedIds = Array.from(new Set(mentionedUserIds));
      const validRecipientIds: string[] = [];

      for (const mId of uniqueMentionedIds) {
        if (mId === userId) continue; // Don't notify self

        if (channelId && projectId) {
          const isMember = await this.prisma.projectMember.findUnique({
            where: { userId_projectId: { userId: mId, projectId } },
          });
          if (isMember) validRecipientIds.push(mId);
        } else if (conversationId) {
          const isParticipant = await this.prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId, userId: mId } },
          });
          if (isParticipant) validRecipientIds.push(mId);
        }
      }

      if (validRecipientIds.length > 0) {
        await this.prisma.messageMention.createMany({
          data: validRecipientIds.map((mId) => ({
            messageId: message.id,
            userId: mId,
          })),
        });

        // Trigger notifications
        for (const recipientId of validRecipientIds) {
          const link = channelId
            ? `/dashboard/projects/${projectId}/chat`
            : `/dashboard/messages?conversation=${conversationId}`;

          const typeName = channelId ? 'channel' : 'direct message';

          await this.notificationsService.createNotification(
            recipientId,
            'MENTIONED_IN_CHAT',
            'Mentioned in Chat',
            `${message.sender.displayName} mentioned you in a ${typeName}`,
            link,
          );
        }
      }
    }

    // Emit live update
    const roomName = channelId ? `channel:${channelId}` : `conversation:${conversationId}`;
    this.realtimeGateway.sendToRoom(roomName, 'message:new', message);

    return message;
  }

  // Get message history
  async getMessageHistory(
    userId: string,
    target: { channelId?: string; conversationId?: string },
    limit = 20,
    cursor?: string,
  ) {
    const { channelId, conversationId } = target;

    if (!channelId && !conversationId) {
      throw new BadRequestException('Either channelId or conversationId must be provided');
    }

    // Authorization checks
    if (channelId) {
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
      });
      if (!channel) throw new NotFoundException('Channel not found');

      const member = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId, projectId: channel.projectId },
        },
      });
      if (!member) {
        throw new ForbiddenException('Not authorized to view messages in this channel');
      }
    } else if (conversationId) {
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
      });
      if (!participant) {
        throw new ForbiddenException('Not authorized to view messages in this conversation');
      }
    }

    const limitVal = Number(limit) || 20;

    const messages = await this.prisma.message.findMany({
      take: limitVal,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      where: {
        channelId: channelId || null,
        conversationId: conversationId || null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        attachments: true,
      },
    });

    return messages.reverse();
  }

  // Mark channel as read
  async markChannelRead(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    await this.prisma.projectMember.update({
      where: {
        userId_projectId: { userId, projectId: channel.projectId },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return { success: true };
  }

  // Mark conversation as read
  async markConversationRead(conversationId: string, userId: string) {
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return { success: true };
  }

  // Get users who share at least one project (candidates for direct message)
  async getDmCandidates(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = memberships.map((m) => m.projectId);

    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        memberships: {
          some: {
            projectId: { in: projectIds },
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        avatarUrl: true,
      },
    });
  }

  // Create a channel
  async createChannel(
    userId: string,
    projectId: string,
    data: {
      name: string;
      description?: string;
      isPrivate?: boolean;
      memberIds?: string[];
    },
  ) {
    // Verify user is ADMIN or MANAGER of the project
    const requesterMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!requesterMember || (requesterMember.role !== 'ADMIN' && requesterMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Only Admins or Managers can create channels');
    }

    const { name, description, isPrivate = false, memberIds = [] } = data;

    // Create the channel
    const channel = await this.prisma.channel.create({
      data: {
        projectId,
        name,
        description,
        isPrivate,
        isGeneral: false,
        creatorId: userId,
      },
    });

    // If private, add the creator and specified members
    if (isPrivate) {
      const uniqueMemberIds = Array.from(new Set([userId, ...memberIds]));
      
      // Verify all memberIds belong to the project
      const validProjectMembers = await this.prisma.projectMember.findMany({
        where: {
          projectId,
          userId: { in: uniqueMemberIds },
        },
        select: { userId: true },
      });
      const validUserIds = validProjectMembers.map((m) => m.userId);

      await this.prisma.channelMember.createMany({
        data: validUserIds.map((uId) => ({
          channelId: channel.id,
          userId: uId,
        })),
      });

      // Emit channel:created event to invited members
      for (const uId of validUserIds) {
        this.realtimeGateway.sendToUser(uId, 'channel:created', channel);
      }
    } else {
      // Public channel: emit to project room
      this.realtimeGateway.sendToRoom(`project:${projectId}`, 'channel:created', channel);
    }

    return channel;
  }

  // List visible channels for a project
  async listChannels(projectId: string, userId: string) {
    // Verify membership
    const member = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this project');
    }

    // Always ensure general channel exists
    await this.getChannelForProject(projectId, userId);

    // Fetch channels visible to user:
    // - all public channels (isPrivate: false)
    // - private channels user is a member of
    const channels = await this.prisma.channel.findMany({
      where: {
        projectId,
        OR: [
          { isPrivate: false },
          {
            isPrivate: true,
            members: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Calculate unread count for each channel
    const channelsWithUnread = await Promise.all(
      channels.map(async (chan) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            channelId: chan.id,
            senderId: { not: userId },
            createdAt: {
              gt: member.lastReadAt,
            },
          },
        });
        return {
          ...chan,
          unreadCount,
        };
      }),
    );

    // Sort: general channel at top (isGeneral = true), followed by others
    return channelsWithUnread.sort((a, b) => {
      if (a.isGeneral) return -1;
      if (b.isGeneral) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  // Update channel name/description
  async updateChannel(
    userId: string,
    channelId: string,
    data: { name?: string; description?: string },
  ) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    // Verify Admin/Manager
    const requesterMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: channel.projectId } },
    });
    if (!requesterMember || (requesterMember.role !== 'ADMIN' && requesterMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Only Admins or Managers can edit channel settings');
    }

    if (channel.isGeneral && data.name && data.name !== 'general') {
      throw new BadRequestException('Cannot rename the general channel');
    }

    const updatedChannel = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        name: data.name,
        description: data.description,
      },
    });

    // Emit live update
    const roomName = channel.isPrivate ? `channel:${channelId}` : `project:${channel.projectId}`;
    this.realtimeGateway.sendToRoom(roomName, 'channel:updated', updatedChannel);

    return updatedChannel;
  }

  // Archive a channel
  async archiveChannel(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.isGeneral) {
      throw new BadRequestException('The general channel cannot be archived');
    }

    // Verify Admin/Manager
    const requesterMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: channel.projectId } },
    });
    if (!requesterMember || (requesterMember.role !== 'ADMIN' && requesterMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Only Admins or Managers can archive channels');
    }

    const updatedChannel = await this.prisma.channel.update({
      where: { id: channelId },
      data: { isArchived: true },
    });

    // Emit live update
    const roomName = channel.isPrivate ? `channel:${channelId}` : `project:${channel.projectId}`;
    this.realtimeGateway.sendToRoom(roomName, 'channel:archived', updatedChannel);

    return updatedChannel;
  }

  // Unarchive a channel
  async unarchiveChannel(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    // Verify Admin/Manager
    const requesterMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: channel.projectId } },
    });
    if (!requesterMember || (requesterMember.role !== 'ADMIN' && requesterMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Only Admins or Managers can unarchive channels');
    }

    const updatedChannel = await this.prisma.channel.update({
      where: { id: channelId },
      data: { isArchived: false },
    });

    // Emit live update
    const roomName = channel.isPrivate ? `channel:${channelId}` : `project:${channel.projectId}`;
    this.realtimeGateway.sendToRoom(roomName, 'channel:updated', updatedChannel);

    return updatedChannel;
  }

  // Add members to a private channel
  async addChannelMembers(userId: string, channelId: string, memberIds: string[]) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (!channel.isPrivate) {
      throw new BadRequestException('Cannot manage members of a public channel');
    }

    // Verify Admin/Manager
    const requesterMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: channel.projectId } },
    });
    if (!requesterMember || (requesterMember.role !== 'ADMIN' && requesterMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Only Admins or Managers can add members to private channels');
    }

    // Filter project members
    const validProjectMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId: channel.projectId,
        userId: { in: memberIds },
      },
      select: { userId: true },
    });
    const validUserIds = validProjectMembers.map((m) => m.userId);

    // Exclude existing members
    const existingMembers = await this.prisma.channelMember.findMany({
      where: {
        channelId,
        userId: { in: validUserIds },
      },
      select: { userId: true },
    });
    const existingUserIds = existingMembers.map((m) => m.userId);
    const newUserIds = validUserIds.filter((uId) => !existingUserIds.includes(uId));

    if (newUserIds.length > 0) {
      await this.prisma.channelMember.createMany({
        data: newUserIds.map((uId) => ({
          channelId,
          userId: uId,
        })),
      });

      // Emit member added events
      for (const newUId of newUserIds) {
        this.realtimeGateway.sendToUser(newUId, 'channel:joined', channel);
        this.realtimeGateway.sendToRoom(`channel:${channelId}`, 'channel:member_added', {
          channelId,
          userId: newUId,
        });
      }
    }

    return { success: true };
  }

  // Remove a member from a private channel
  async removeChannelMember(userId: string, channelId: string, targetUserId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (!channel.isPrivate) {
      throw new BadRequestException('Cannot manage members of a public channel');
    }

    // Verify Admin/Manager, or if user is removing themselves
    const requesterMember = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: channel.projectId } },
    });
    const isAdminOrManager = requesterMember && (requesterMember.role === 'ADMIN' || requesterMember.role === 'MANAGER');
    
    if (!isAdminOrManager && userId !== targetUserId) {
      throw new ForbiddenException('Not authorized to remove this member');
    }

    const member = await this.prisma.channelMember.findFirst({
      where: { channelId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Member not found in this channel');

    await this.prisma.channelMember.delete({
      where: { id: member.id },
    });

    // Notify removed user and channel room
    this.realtimeGateway.sendToUser(targetUserId, 'channel:left', { channelId });
    this.realtimeGateway.sendToRoom(`channel:${channelId}`, 'channel:member_removed', {
      channelId,
      userId: targetUserId,
    });

    return { success: true };
  }

  // List members of a private channel
  async listChannelMembers(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    // Verify requesting user is member of project
    const pm = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: channel.projectId } },
    });
    if (!pm) throw new ForbiddenException('Not authorized to view channel members');

    if (!channel.isPrivate) {
      // Public channel: return all project members
      return this.prisma.projectMember.findMany({
        where: { projectId: channel.projectId },
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
      }).then((members) => members.map((m) => m.user));
    }

    // Private channel: return actual channel members
    const members = await this.prisma.channelMember.findMany({
      where: { channelId },
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

    return members.map((m) => m.user);
  }
}
