import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MinLength,
  IsDateString,
} from 'class-validator';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @MinLength(2, { message: 'Title must be at least 2 characters long' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus, { message: 'Invalid status' })
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority, { message: 'Invalid priority' })
  @IsOptional()
  priority?: TaskPriority;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsDateString({}, { message: 'Invalid due date format' })
  @IsOptional()
  dueDate?: string;
}

export class UpdateTaskDto {
  @IsString()
  @MinLength(2, { message: 'Title must be at least 2 characters long' })
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus, { message: 'Invalid status' })
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority, { message: 'Invalid priority' })
  @IsOptional()
  priority?: TaskPriority;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsDateString({}, { message: 'Invalid due date format' })
  @IsOptional()
  dueDate?: string;

  @IsDateString({}, { message: 'Invalid lastKnownUpdatedAt format' })
  @IsOptional()
  lastKnownUpdatedAt?: string;
}
