import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('tasks/:taskId/comments')
  async create(
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
    @Body('text') text: string,
  ) {
    return this.commentsService.create(userId, taskId, text);
  }

  @Get('tasks/:taskId/comments')
  async list(@Param('taskId') taskId: string, @GetUser('id') userId: string) {
    return this.commentsService.list(userId, taskId);
  }

  @Patch('comments/:commentId')
  async update(
    @Param('commentId') commentId: string,
    @GetUser('id') userId: string,
    @Body('text') text: string,
  ) {
    return this.commentsService.update(userId, commentId, text);
  }

  @Delete('comments/:commentId')
  async remove(
    @Param('commentId') commentId: string,
    @GetUser('id') userId: string,
  ) {
    return this.commentsService.delete(userId, commentId);
  }
}
