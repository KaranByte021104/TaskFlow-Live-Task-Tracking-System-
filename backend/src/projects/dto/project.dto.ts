import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsHexColor,
  IsEmail,
  IsEnum,
} from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project name is required' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

export class InviteMemberDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsEnum(ProjectRole, { message: 'Role must be ADMIN, MEMBER, or VIEWER' })
  role: ProjectRole;
}
