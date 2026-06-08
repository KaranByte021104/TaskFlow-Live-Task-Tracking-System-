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
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
    @Body() createDto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, userId, createDto);
  }

  @Get()
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

  @Get(':taskId')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
  ) {
    return this.tasksService.findOne(projectId, taskId, userId);
  }

  @Patch(':taskId')
  async update(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
    @Body() updateDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(projectId, taskId, userId, updateDto);
  }

  @Delete(':taskId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
  ) {
    return this.tasksService.remove(projectId, taskId, userId);
  }
}
