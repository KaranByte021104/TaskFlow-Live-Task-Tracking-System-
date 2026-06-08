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
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  InviteMemberDto,
} from './dto/project.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { ProjectRole } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async create(
    @GetUser('id') userId: string,
    @Body() createDto: CreateProjectDto,
  ) {
    return this.projectsService.create(userId, createDto);
  }

  @Get()
  async list(@GetUser('id') userId: string) {
    return this.projectsService.list(userId);
  }

  @Get('dashboard/stats')
  async getDashboardStats(@GetUser('id') userId: string) {
    return this.projectsService.getDashboardStats(userId);
  }

  @Get('tasks/assigned')
  async getMyTasks(@GetUser('id') userId: string) {
    return this.projectsService.getMyTasks(userId);
  }

  @Get(':id')
  async findOne(@Param('id') projectId: string, @GetUser('id') userId: string) {
    return this.projectsService.findOne(projectId, userId);
  }

  @Get(':id/activities')
  async listActivities(
    @Param('id') projectId: string,
    @GetUser('id') userId: string,
  ) {
    return this.projectsService.listActivities(projectId, userId);
  }

  @Get(':id/stats')
  async getStats(
    @Param('id') projectId: string,
    @GetUser('id') userId: string,
  ) {
    return this.projectsService.getStats(projectId, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') projectId: string,
    @GetUser('id') userId: string,
    @Body() updateDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(projectId, userId, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') projectId: string, @GetUser('id') userId: string) {
    return this.projectsService.remove(projectId, userId);
  }

  // Member management endpoints
  @Post(':id/members')
  async addMember(
    @Param('id') projectId: string,
    @GetUser('id') userId: string,
    @Body() inviteDto: InviteMemberDto,
  ) {
    return this.projectsService.addMember(projectId, userId, inviteDto);
  }

  @Patch(':id/members/:memberId')
  async updateMemberRole(
    @Param('id') projectId: string,
    @GetUser('id') userId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: ProjectRole,
  ) {
    return this.projectsService.updateMemberRole(
      projectId,
      userId,
      memberId,
      role,
    );
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') projectId: string,
    @GetUser('id') userId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projectsService.removeMember(projectId, userId, memberId);
  }
}
