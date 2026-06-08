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
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    name: string,
    email: string,
    passwordStr: string,
  ): Promise<{ user: Omit<User, 'password'>; accessToken: string }> {
    const user = await this.usersService.create({ name, email, passwordStr });
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    return { user, accessToken };
  }

  async login(
    email: string,
    passwordStr: string,
  ): Promise<{ user: Omit<User, 'password'>; accessToken: string }> {
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
    const accessToken = this.jwtService.sign(payload);

    return { user: result, accessToken };
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
    await this.prisma.otpToken.create({
      data: {
        code,
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        expiresAt,
      },
    });

    // Send email
    await this.mailService.sendOtpEmail(user.email, user.displayName, code);

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
