import { Module } from '@nestjs/common';
import { TaskImagesService } from './task-images.service';
import { TaskImagesController } from './task-images.controller';

@Module({
  providers: [TaskImagesService],
  controllers: [TaskImagesController],
  exports: [TaskImagesService],
})
export class TaskImagesModule {}
