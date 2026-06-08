import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { TaskImagesService } from './task-images.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class TaskImagesController {
  constructor(private readonly taskImagesService: TaskImagesService) {}

  @Post('tasks/:taskId/images')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'tasks'),
        filename: (req, file, cb) => {
          const uniqueId = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `${uniqueId}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only JPEG, PNG, WebP, and GIF images are allowed',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
      },
    }),
  )
  async uploadImages(
    @Param('taskId') taskId: string,
    @GetUser() user: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    return this.taskImagesService.uploadImages(taskId, user, files);
  }

  @Get('tasks/:taskId/images')
  async getImages(
    @Param('taskId') taskId: string,
    @GetUser('id') userId: string,
  ) {
    return this.taskImagesService.getTaskImages(taskId, userId);
  }

  @Delete('images/:imageId')
  async deleteImage(@Param('imageId') imageId: string, @GetUser() user: any) {
    return this.taskImagesService.deleteImage(imageId, user);
  }
}
