import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  async sendOtpEmail(
    email: string,
    name: string,
    code: string,
  ): Promise<void> {
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 20px;">Password Reset Verification</h2>
        <p>Hello ${name},</p>
        <p>You requested a password reset. Use the code below to proceed.</p>
        <div style="margin: 30px auto; text-align: center;">
          <div style="background-color: #f1f5f9; color: #1e293b; padding: 16px 24px; border-radius: 8px; font-weight: 800; font-size: 32px; letter-spacing: 6px; display: inline-block; border: 1px solid #e2e8f0; font-family: monospace;">${code}</div>
        </div>
        <p>This code is valid for <strong>15 minutes</strong>.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">If you did not request this verification, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"TaskFlow Support" <${this.configService.get<string>('SMTP_USER')}>`,
        to: email,
        subject: 'Reset Your TaskFlow Password - Verification Code',
        html: htmlContent,
      });
      this.logger.log(`Password reset OTP email sent to: ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset OTP email to: ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendNotificationEmail(
    email: string,
    recipientName: string,
    title: string,
    body: string,
    link?: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const actionUrl = link ? `${appUrl}${link}` : null;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 20px;">New Notification</h2>
        <p>Hello ${recipientName},</p>
        <p><strong>${title}</strong></p>
        <p>${body}</p>
        ${
          actionUrl
            ? `<div style="margin: 30px auto; text-align: center;">
                <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View in TaskFlow</a>
              </div>`
            : ''
        }
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">You received this because email notifications are enabled on your profile. You can turn them off in your Settings.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"TaskFlow Support" <${this.configService.get<string>('SMTP_USER')}>`,
        to: email,
        subject: `[TaskFlow] Notification: ${title}`,
        html: htmlContent,
      });
      this.logger.log(`Notification email sent to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send notification email to: ${email}`, error);
      throw error;
    }
  }
}
