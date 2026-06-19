import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ExportService } from './export.service';
import { ProjectFilesService } from './project-files.service';
import { ProjectFilesController } from './project-files.controller';

@Module({
  providers: [ProjectsService, ExportService, ProjectFilesService],
  controllers: [ProjectsController, ProjectFilesController],
  exports: [ProjectsService, ProjectFilesService],
})
export class ProjectsModule {}
