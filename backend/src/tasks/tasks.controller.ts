import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { TaskStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('projects/:projectId/tasks')
  async create(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
    @Body() createDto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, userId, createDto);
  }

  @Get('projects/:projectId/tasks')
  async list(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
    @Query('status') status?: TaskStatus,
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.tasksService.list(projectId, userId, {
      status,
      assigneeId,
      search,
      cursor,
      limit: parsedLimit,
    });
  }

  @Get('projects/:projectId/tasks/:taskId')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
  ) {
    return this.tasksService.findOne(projectId, taskId, userId);
  }

  @Patch('projects/:projectId/tasks/:taskId')
  async update(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
    @Body() updateDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(projectId, taskId, userId, updateDto);
  }

  @Delete('projects/:projectId/tasks/:taskId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
  ) {
    return this.tasksService.remove(projectId, taskId, userId);
  }

  @Get('tasks/:taskId/history')
  async getHistory(
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
  ) {
    return this.tasksService.getHistory(taskId, userId);
  }

  @Post('tasks/:taskId/dependencies')
  async addDependency(
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
    @Body('blockedByTaskId') blockedByTaskId: string,
  ) {
    return this.tasksService.addDependency(userId, taskId, blockedByTaskId);
  }

  @Delete('tasks/:taskId/dependencies/:blockedByTaskId')
  async removeDependency(
    @Param('taskId') taskId: string,
    @Param('blockedByTaskId') blockedByTaskId: string,
    @GetUser('id') userId: string,
  ) {
    return this.tasksService.removeDependency(userId, taskId, blockedByTaskId);
  }

  @Get('tasks/:taskId/dependencies')
  async getDependencies(
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
  ) {
    return this.tasksService.getDependencies(userId, taskId);
  }
}
