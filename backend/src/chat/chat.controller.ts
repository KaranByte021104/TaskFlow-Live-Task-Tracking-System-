import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('projects/:projectId/channel')
  async getChannel(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
  ) {
    return this.chatService.getChannelForProject(projectId, userId);
  }

  @Get('conversations')
  async getConversations(@GetUser('id') userId: string) {
    return this.chatService.listUserConversations(userId);
  }

  @Post('conversations')
  async getOrCreateConversation(
    @GetUser('id') userId: string,
    @Body('otherUserId') otherUserId: string,
  ) {
    return this.chatService.getOrCreateConversation(otherUserId, userId);
  }

  @Post('channels/:channelId/messages')
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'attachments'),
        filename: (req, file, cb) => {
          const uniqueId = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `${uniqueId}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  async sendChannelMessage(
    @Param('channelId') channelId: string,
    @GetUser('id') userId: string,
    @Body('content') content: string,
    @Body('mentionedUserIds') mentionedUserIds?: string | string[],
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const mentions = typeof mentionedUserIds === 'string'
      ? JSON.parse(mentionedUserIds)
      : mentionedUserIds;

    return this.chatService.sendMessage(
      userId,
      {
        channelId,
        content,
        mentionedUserIds: mentions,
      },
      files,
    );
  }

  @Get('channels/:channelId/messages')
  async getChannelMessages(
    @Param('channelId') channelId: string,
    @GetUser('id') userId: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getMessageHistory(
      userId,
      { channelId },
      limit,
      cursor,
    );
  }

  @Post('conversations/:conversationId/messages')
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'attachments'),
        filename: (req, file, cb) => {
          const uniqueId = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `${uniqueId}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  async sendConversationMessage(
    @Param('conversationId') conversationId: string,
    @GetUser('id') userId: string,
    @Body('content') content: string,
    @Body('mentionedUserIds') mentionedUserIds?: string | string[],
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const mentions = typeof mentionedUserIds === 'string'
      ? JSON.parse(mentionedUserIds)
      : mentionedUserIds;

    return this.chatService.sendMessage(
      userId,
      {
        conversationId,
        content,
        mentionedUserIds: mentions,
      },
      files,
    );
  }

  @Get('conversations/:conversationId/messages')
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @GetUser('id') userId: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getMessageHistory(
      userId,
      { conversationId },
      limit,
      cursor,
    );
  }

  @Post('channels/:channelId/read')
  async markChannelRead(
    @Param('channelId') channelId: string,
    @GetUser('id') userId: string,
  ) {
    return this.chatService.markChannelRead(channelId, userId);
  }

  @Post('conversations/:conversationId/read')
  async markConversationRead(
    @Param('conversationId') conversationId: string,
    @GetUser('id') userId: string,
  ) {
    return this.chatService.markConversationRead(conversationId, userId);
  }

  @Get('conversations/candidates')
  async getDmCandidates(@GetUser('id') userId: string) {
    return this.chatService.getDmCandidates(userId);
  }

  @Post('projects/:projectId/channels')
  async createChannel(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
    @Body() body: { name: string; description?: string; isPrivate?: boolean; memberIds?: string[] },
  ) {
    return this.chatService.createChannel(userId, projectId, body);
  }

  @Get('projects/:projectId/channels')
  async listChannels(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
  ) {
    return this.chatService.listChannels(projectId, userId);
  }

  @Patch('channels/:channelId')
  async updateChannel(
    @Param('channelId') channelId: string,
    @GetUser('id') userId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.chatService.updateChannel(userId, channelId, body);
  }

  @Post('channels/:channelId/archive')
  async archiveChannel(
    @Param('channelId') channelId: string,
    @GetUser('id') userId: string,
  ) {
    return this.chatService.archiveChannel(userId, channelId);
  }

  @Post('channels/:channelId/unarchive')
  async unarchiveChannel(
    @Param('channelId') channelId: string,
    @GetUser('id') userId: string,
  ) {
    return this.chatService.unarchiveChannel(userId, channelId);
  }

  @Post('channels/:channelId/members')
  async addChannelMembers(
    @Param('channelId') channelId: string,
    @GetUser('id') userId: string,
    @Body('memberIds') memberIds: string[],
  ) {
    return this.chatService.addChannelMembers(userId, channelId, memberIds);
  }

  @Delete('channels/:channelId/members/:targetUserId')
  async removeChannelMember(
    @Param('channelId') channelId: string,
    @Param('targetUserId') targetUserId: string,
    @GetUser('id') userId: string,
  ) {
    return this.chatService.removeChannelMember(userId, channelId, targetUserId);
  }

  @Get('channels/:channelId/members')
  async listChannelMembers(
    @Param('channelId') channelId: string,
    @GetUser('id') userId: string,
  ) {
    return this.chatService.listChannelMembers(channelId, userId);
  }
}
