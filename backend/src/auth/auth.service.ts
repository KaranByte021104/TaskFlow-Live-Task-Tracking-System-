import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EmailQueueService } from '../queues/email-queue.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  private async createRefreshToken(userId: string, family?: string): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const tokenFamily = family || crypto.randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        family: tokenFamily,
        expiresAt,
      },
    });

    return rawToken;
  }

  async register(
    name: string,
    email: string,
    passwordStr: string,
  ): Promise<{ user: Omit<User, 'password'>; accessToken: string; refreshToken: string }> {
    const user = await this.usersService.create({ name, email, passwordStr });
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = await this.createRefreshToken(user.id);
    return { user, accessToken, refreshToken };
  }

  async login(
    email: string,
    passwordStr: string,
  ): Promise<{ user: Omit<User, 'password'>; accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(passwordStr, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    const payload = { sub: result.id, email: result.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = await this.createRefreshToken(result.id);

    return { user: result, accessToken, refreshToken };
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const foundToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!foundToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (foundToken.revoked) {
      // Reuse detection: revoke the entire family!
      await this.prisma.refreshToken.updateMany({
        where: { family: foundToken.family },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (foundToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Mark current token as revoked (rotated out)
    await this.prisma.refreshToken.update({
      where: { id: foundToken.id },
      data: { revoked: true },
    });

    // Issue new dual tokens
    const user = await this.prisma.user.findUnique({
      where: { id: foundToken.userId },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const payload = { sub: user.id, email: user.email };
    const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const newRefreshToken = await this.createRefreshToken(user.id, foundToken.family);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const foundToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (foundToken) {
      // Revoke the entire family chain on logout
      await this.prisma.refreshToken.updateMany({
        where: { family: foundToken.family },
        data: { revoked: true },
      });
    }

    return { success: true };
  }

  async requestOtp(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return {
        message:
          'If an account with that email exists, a 6-digit code has been sent. It expires in 15 minutes.',
      };
    }

    // Invalidate previous tokens
    await this.prisma.otpToken.updateMany({
      where: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Generate secure 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save token
    const otpToken = await this.prisma.otpToken.create({
      data: {
        code,
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        expiresAt,
      },
    });

    // Send email using BullMQ background queue with deterministic jobId for idempotency
    const jobId = `otp-email:${user.id}:${otpToken.id}`;
    await this.emailQueueService.enqueueEmail(
      'otp',
      {
        email: user.email,
        name: user.displayName,
        code,
      },
      jobId,
    );

    return {
      message:
        'If an account with that email exists, a 6-digit code has been sent. It expires in 15 minutes.',
    };
  }

  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ verificationToken: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid or expired code.');
    }

    const otpToken = await this.prisma.otpToken.findFirst({
      where: {
        userId: user.id,
        code,
        purpose: 'PASSWORD_RESET',
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpToken) {
      throw new BadRequestException('Invalid or expired code.');
    }

    // Generate a short-lived verification token
    const otpJwtSecret =
      this.configService.get<string>('OTP_JWT_SECRET') ||
      'default-otp-jwt-secret-key-change-me';
    const verificationToken = this.jwtService.sign(
      {
        sub: user.id,
        purpose: 'PASSWORD_RESET_VERIFIED',
        otpTokenId: otpToken.id,
      },
      { secret: otpJwtSecret, expiresIn: '10m' },
    );

    return { verificationToken };
  }

  async setNewPassword(
    verificationToken: string,
    newPasswordStr: string,
  ): Promise<{ message: string }> {
    const otpJwtSecret =
      this.configService.get<string>('OTP_JWT_SECRET') ||
      'default-otp-jwt-secret-key-change-me';
    let payload: any;
    try {
      payload = this.jwtService.verify(verificationToken, {
        secret: otpJwtSecret,
      });
    } catch (err) {
      throw new BadRequestException(
        'This session has expired. Please start over.',
      );
    }

    if (!payload || payload.purpose !== 'PASSWORD_RESET_VERIFIED') {
      throw new BadRequestException(
        'This session has expired. Please start over.',
      );
    }

    if (!newPasswordStr || newPasswordStr.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPasswordStr, 10);

    // Update user password and mark OTP token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: payload.sub },
        data: { password: hashedPassword },
      }),
      this.prisma.otpToken.update({
        where: { id: payload.otpTokenId },
        data: { used: true },
      }),
    ]);

    return { message: 'Your password has been reset successfully.' };
  }

  async changePassword(
    userId: string,
    currentPasswordStr: string,
    newPasswordStr: string,
    confirmNewPasswordStr: string,
  ): Promise<{ message: string }> {
    if (newPasswordStr !== confirmNewPasswordStr) {
      throw new BadRequestException('New passwords do not match.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const passwordMatch = await bcrypt.compare(
      currentPasswordStr,
      user.password,
    );
    if (!passwordMatch) {
      throw new BadRequestException('Current password is incorrect.');
    }

    if (!newPasswordStr || newPasswordStr.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPasswordStr, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully.' };
  }
}
