import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Inject, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
  joinedProjects?: Set<string>;
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  onModuleInit() {
    // Periodically refresh presence for all active sockets on this server
    setInterval(async () => {
      try {
        if (!this.server) return;
        const sockets = await this.server.fetchSockets();
        const now = Date.now();
        const redisOps = [];

        for (const socket of sockets) {
          const authSocket = socket as unknown as AuthenticatedSocket;
          if (authSocket.user && authSocket.joinedProjects) {
            for (const projectId of authSocket.joinedProjects) {
              const redisKey = `presence:project:${projectId}`;
              redisOps.push(
                this.redis.zadd(redisKey, now, `${authSocket.user.id}:${authSocket.id}`),
              );
            }
          }
        }
        if (redisOps.length > 0) {
          await Promise.all(redisOps);
        }
      } catch (err) {
        this.logger.error('Failed to update presence heartbeats in Redis:', err);
      }
    }, 30000); // refresh every 30 seconds
  }

  // Handle incoming socket connection and authenticate JWT
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const authHeader =
        client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!authHeader) {
        client.disconnect(true);
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = this.jwtService.verify(token, {
        secret:
          this.configService.get<string>('JWT_SECRET') ||
          'super-secret-jwt-key-replace-in-production',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, displayName: true, avatarUrl: true },
      });

      if (!user) {
        client.disconnect(true);
        return;
      }

      client.user = user;
      client.joinedProjects = new Set();
      client.join(`user:${user.id}`);
      client.emit('authenticated');
      this.logger.log(
        `Socket authenticated: User ${user.displayName} connected (${client.id})`,
      );
    } catch (err) {
      this.logger.log(`Socket authentication failed: ${err.message}`);
      client.disconnect(true);
    }
  }

  // Send socket events to a specific user's room
  sendToUserRoom(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  sendToUser(userId: string, event: string, data: any) {
    this.sendToUserRoom(userId, event, data);
  }

  // Handle socket disconnection and cleanup presence
  async handleDisconnect(client: AuthenticatedSocket) {
    if (!client.user) return;
    this.logger.log(
      `Socket disconnected: User ${client.user.displayName} (${client.id})`,
    );

    // Clean up presence from all projects
    if (client.joinedProjects && client.joinedProjects.size > 0) {
      const redisOps = [];
      const projectsToUpdate = Array.from(client.joinedProjects);
      for (const projectId of projectsToUpdate) {
        const redisKey = `presence:project:${projectId}`;
        redisOps.push(this.redis.zrem(redisKey, `${client.user.id}:${client.id}`));
      }
      await Promise.all(redisOps);
      for (const projectId of projectsToUpdate) {
        await this.emitPresenceUpdate(projectId);
      }
    }
  }

  // Handle joinProject subscriptions
  @SubscribeMessage('joinProject')
  async handleJoinProject(client: AuthenticatedSocket, projectId: string) {
    if (!client.user) return;

    // Verify project membership
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: client.user.id,
          projectId,
        },
      },
    });

    if (!membership) {
      client.emit('error', { message: 'Unauthorized project room access' });
      return;
    }

    client.join(`project:${projectId}`);

    // Update presence
    if (!client.joinedProjects) {
      client.joinedProjects = new Set();
    }
    client.joinedProjects.add(projectId);

    const redisKey = `presence:project:${projectId}`;
    await this.redis.zadd(redisKey, Date.now(), `${client.user.id}:${client.id}`);
    await this.redis.expire(redisKey, 86400); // 24 hours safety TTL

    await this.emitPresenceUpdate(projectId);
    this.logger.log(`User ${client.user.displayName} joined project:${projectId}`);
  }

  // Handle leaveProject triggers
  @SubscribeMessage('leaveProject')
  async handleLeaveProject(client: AuthenticatedSocket, projectId: string) {
    client.leave(`project:${projectId}`);

    if (client.joinedProjects) {
      client.joinedProjects.delete(projectId);
    }

    const redisKey = `presence:project:${projectId}`;
    await this.redis.zrem(redisKey, `${client.user?.id}:${client.id}`);
    await this.emitPresenceUpdate(projectId);
    this.logger.log(`User ${client.user?.displayName} left project:${projectId}`);
  }

  // Helper: emits presence:update list containing active users in room (unique user items only)
  private async emitPresenceUpdate(projectId: string) {
    try {
      const redisKey = `presence:project:${projectId}`;
      // Clean up stale entries older than 90 seconds
      const staleThreshold = Date.now() - 90000;
      await this.redis.zremrangebyscore(redisKey, '-inf', staleThreshold);

      // Get all active socket members
      const members = await this.redis.zrange(redisKey, 0, -1);
      const uniqueUserIds = Array.from(
        new Set(members.map((m) => m.split(':')[0])),
      );

      if (uniqueUserIds.length === 0) {
        this.server.to(`project:${projectId}`).emit('presence:update', []);
        return;
      }

      // Fetch user details from database
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: uniqueUserIds },
        },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      });

      const presenceList = users.map((u) => ({
        id: u.id,
        name: u.displayName,
        avatarUrl: u.avatarUrl,
      }));

      this.server
        .to(`project:${projectId}`)
        .emit('presence:update', presenceList);
    } catch (err) {
      this.logger.error(`Failed emitting presence update for project ${projectId}:`, err);
    }
  }

  // General helpers: trigger socket events out to project rooms
  sendToProjectRoom(projectId: string, event: string, data: any) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }

  // General helper: trigger socket events out to any room
  sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  // Join channel room
  @SubscribeMessage('joinChannel')
  async handleJoinChannel(client: AuthenticatedSocket, channelId: string) {
    if (!client.user) return;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      client.emit('error', { message: 'Channel not found' });
      return;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: client.user.id,
          projectId: channel.projectId,
        },
      },
    });

    if (!membership) {
      client.emit('error', { message: 'Unauthorized channel access' });
      return;
    }

    if (channel.isPrivate) {
      const channelMember = await this.prisma.channelMember.findFirst({
        where: { channelId, userId: client.user.id },
      });
      if (!channelMember) {
        client.emit('error', { message: 'Unauthorized private channel access' });
        return;
      }
    }

    client.join(`channel:${channelId}`);
    this.logger.log(`User ${client.user.displayName} joined channel:${channelId}`);
  }

  // Leave channel room
  @SubscribeMessage('leaveChannel')
  async handleLeaveChannel(client: AuthenticatedSocket, channelId: string) {
    client.leave(`channel:${channelId}`);
    this.logger.log(`User ${client.user?.displayName} left channel:${channelId}`);
  }

  // Join conversation room
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(client: AuthenticatedSocket, conversationId: string) {
    if (!client.user) return;

    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: client.user.id,
        },
      },
    });

    if (!participant) {
      client.emit('error', { message: 'Unauthorized conversation access' });
      return;
    }

    client.join(`conversation:${conversationId}`);
    this.logger.log(`User ${client.user.displayName} joined conversation:${conversationId}`);
  }

  // Leave conversation room
  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(client: AuthenticatedSocket, conversationId: string) {
    client.leave(`conversation:${conversationId}`);
    this.logger.log(`User ${client.user?.displayName} left conversation:${conversationId}`);
  }

  // Handle typing:start event
  @SubscribeMessage('typing:start')
  async handleTypingStart(
    client: AuthenticatedSocket,
    data: { channelId?: string; conversationId?: string },
  ) {
    if (!client.user) return;
    const room = data.channelId
      ? `channel:${data.channelId}`
      : `conversation:${data.conversationId}`;

    client.to(room).emit('typing:update', {
      userId: client.user.id,
      name: client.user.displayName,
      typing: true,
      channelId: data.channelId,
      conversationId: data.conversationId,
    });
  }

  // Handle typing:stop event
  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    client: AuthenticatedSocket,
    data: { channelId?: string; conversationId?: string },
  ) {
    if (!client.user) return;
    const room = data.channelId
      ? `channel:${data.channelId}`
      : `conversation:${data.conversationId}`;

    client.to(room).emit('typing:update', {
      userId: client.user.id,
      name: client.user.displayName,
      typing: false,
      channelId: data.channelId,
      conversationId: data.conversationId,
    });
  }
}

