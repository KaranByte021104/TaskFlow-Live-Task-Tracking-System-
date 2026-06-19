import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getBackendUrl(): string {
    const backendPort = this.configService.get<number>('PORT') || 3001;
    return (
      this.configService.get<string>('BACKEND_URL') ||
      `http://localhost:${backendPort}`
    );
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...result } = user;
    return result;
  }

  async updateProfile(userId: string, data: { name?: string; email?: string; notifyByEmail?: boolean }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};

    if (data.name) {
      updateData.displayName = data.name;
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      updateData.email = data.email;
    }

    if (data.notifyByEmail !== undefined) {
      updateData.notifyByEmail = data.notifyByEmail;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const { password, ...result } = updatedUser;
    return result;
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete old avatar if it's stored on server
    await this.deleteLocalAvatarFile(user.avatarUrl);

    const backendUrl = this.getBackendUrl();
    const avatarUrl = `${backendUrl}/uploads/avatars/${file.filename}`;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    const { password, ...result } = updatedUser;
    return result;
  }

  async deleteAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.deleteLocalAvatarFile(user.avatarUrl);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    const { password, ...result } = updatedUser;
    return result;
  }

  private async deleteLocalAvatarFile(avatarUrl: string | null) {
    if (avatarUrl && avatarUrl.includes('/uploads/avatars/')) {
      const parts = avatarUrl.split('/uploads/avatars/');
      const filename = parts[parts.length - 1];
      const filePath = join(process.cwd(), 'uploads', 'avatars', filename);
      try {
        await unlink(filePath);
      } catch (err) {
        console.warn(`File unlink failed for avatar ${filePath}:`, err.message);
      }
    }
  }
}
