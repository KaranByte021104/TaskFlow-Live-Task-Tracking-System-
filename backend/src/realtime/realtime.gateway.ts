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

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // In-memory map: projectId -> Map of socketId -> User info
  private projectPresence = new Map<
    string,
    Map<string, { id: string; name: string; avatarUrl: string | null }>
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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
      client.join(`user:${user.id}`);
      client.emit('authenticated');
      console.log(
        `Socket authenticated: User ${user.displayName} connected (${client.id})`,
      );
    } catch (err) {
      console.log('Socket authentication failed:', err.message);
      client.disconnect(true);
    }
  }

  // Send socket events to a specific user's room
  sendToUserRoom(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Handle socket disconnection and cleanup presence
  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.user) return;
    console.log(
      `Socket disconnected: User ${client.user.displayName} (${client.id})`,
    );

    // Clean up presence from all projects
    for (const [projectId, socketsMap] of this.projectPresence.entries()) {
      if (socketsMap.has(client.id)) {
        socketsMap.delete(client.id);
        this.emitPresenceUpdate(projectId);
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

    // Update presence map
    if (!this.projectPresence.has(projectId)) {
      this.projectPresence.set(projectId, new Map());
    }
    this.projectPresence.get(projectId)!.set(client.id, {
      id: client.user.id,
      name: client.user.displayName,
      avatarUrl: client.user.avatarUrl,
    });

    this.emitPresenceUpdate(projectId);
    console.log(`User ${client.user.displayName} joined project:${projectId}`);
  }

  // Handle leaveProject triggers
  @SubscribeMessage('leaveProject')
  handleLeaveProject(client: AuthenticatedSocket, projectId: string) {
    client.leave(`project:${projectId}`);

    const socketsMap = this.projectPresence.get(projectId);
    if (socketsMap && socketsMap.has(client.id)) {
      socketsMap.delete(client.id);
      this.emitPresenceUpdate(projectId);
    }
    console.log(`User ${client.user?.displayName} left project:${projectId}`);
  }

  // Helper: emits presence:update list containing active users in room (unique user items only)
  private emitPresenceUpdate(projectId: string) {
    const socketsMap = this.projectPresence.get(projectId);
    if (!socketsMap) return;

    // Filter unique user IDs to avoid double listing on multiple tabs
    const uniqueUsers = new Map<
      string,
      { id: string; name: string; avatarUrl: string | null }
    >();
    for (const user of socketsMap.values()) {
      uniqueUsers.set(user.id, user);
    }

    this.server
      .to(`project:${projectId}`)
      .emit('presence:update', Array.from(uniqueUsers.values()));
  }

  // General helpers: trigger socket events out to project rooms
  sendToProjectRoom(projectId: string, event: string, data: any) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }
}
