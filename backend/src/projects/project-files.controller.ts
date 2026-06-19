import {
  Controller,
  Get,
  Post,
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
import { ProjectFilesService } from './project-files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/files')
export class ProjectFilesController {
  constructor(private readonly projectFilesService: ProjectFilesService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'projects'),
        filename: (req, file, cb) => {
          const uniqueId = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `${uniqueId}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/zip',
          'application/x-zip-compressed',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'text/csv',
          'application/csv',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only PDF, Word, Excel, PowerPoint, ZIP documents and standard images are allowed',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB
      },
    }),
  )
  async uploadFiles(
    @Param('projectId') projectId: string,
    @GetUser() user: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    return this.projectFilesService.uploadFiles(projectId, user, files);
  }

  @Get()
  async listFiles(
    @Param('projectId') projectId: string,
    @GetUser('id') userId: string,
  ) {
    return this.projectFilesService.listFiles(projectId, userId);
  }

  @Delete(':fileId')
  async deleteFile(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @GetUser() user: any,
  ) {
    return this.projectFilesService.deleteFile(projectId, fileId, user);
  }
}
