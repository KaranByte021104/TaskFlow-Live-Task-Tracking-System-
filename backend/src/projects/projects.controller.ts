import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ProjectsService } from './projects.service';
import { ExportService } from './export.service';
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
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly exportService: ExportService,
  ) {}

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
  @Get(':id/export/csv')
  async exportCsv(
    @Param('id') projectId: string,
    @GetUser() user: any,
    @Res() res: any,
  ) {
    const csvContent = await this.exportService.exportToCsv(projectId, user.id);
    const project = await this.projectsService.findOne(projectId, user.id);
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-export.csv"`);
    res.status(200).send(csvContent);
  }

  @Get(':id/export/pdf')
  async exportPdf(
    @Param('id') projectId: string,
    @GetUser() user: any,
    @Res() res: any,
  ) {
    const pdfBuffer = await this.exportService.exportToPdf(projectId, user.id);
    const project = await this.projectsService.findOne(projectId, user.id);
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-export.pdf"`);
    res.status(200).send(pdfBuffer);
  }
}
