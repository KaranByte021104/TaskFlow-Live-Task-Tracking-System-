import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) return null;
    const { password, ...result } = user;
    return result;
  }

  async create(data: {
    name: string;
    email: string;
    passwordStr: string;
  }): Promise<Omit<User, 'password'>> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.passwordStr, 10);
    const user = await this.prisma.user.create({
      data: {
        displayName: data.name,
        email: data.email,
        password: hashedPassword,
      },
    });

    const { password, ...result } = user;
    return result;
  }
}
