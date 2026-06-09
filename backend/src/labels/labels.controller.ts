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
import { LabelsService } from './labels.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post('projects/:projectId/labels')
  async create(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
    @Body('name') name: string,
    @Body('color') color: string,
  ) {
    return this.labelsService.create(userId, projectId, name, color);
  }

  @Get('projects/:projectId/labels')
  async list(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
  ) {
    return this.labelsService.list(userId, projectId);
  }

  @Patch('labels/:labelId')
  async update(
    @Param('labelId') labelId: string,
    @GetUser('id') userId: string,
    @Body('name') name?: string,
    @Body('color') color?: string,
  ) {
    return this.labelsService.update(userId, labelId, name, color);
  }

  @Delete('labels/:labelId')
  async remove(
    @Param('labelId') labelId: string,
    @GetUser('id') userId: string,
  ) {
    return this.labelsService.delete(userId, labelId);
  }

  @Post('tasks/:taskId/labels')
  async addLabel(
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
    @Body('labelId') labelId: string,
  ) {
    return this.labelsService.addLabelToTask(userId, taskId, labelId);
  }

  @Delete('tasks/:taskId/labels/:labelId')
  async removeLabel(
    @Param('taskId') taskId: string,
    @Param('labelId') labelId: string,
    @GetUser('id') userId: string,
  ) {
    return this.labelsService.removeLabelFromTask(userId, taskId, labelId);
  }
}
