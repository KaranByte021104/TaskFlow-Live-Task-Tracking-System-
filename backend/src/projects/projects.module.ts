import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ExportService } from './export.service';

@Module({
  providers: [ProjectsService, ExportService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
