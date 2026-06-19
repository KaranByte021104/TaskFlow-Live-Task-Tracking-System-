import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from '../auth/mail.service';
import { Logger } from '@nestjs/common';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing email job ${job.id} for template: "${job.name}"`);

    switch (job.name) {
      case 'otp': {
        const { email, name, code } = job.data;
        await this.mailService.sendOtpEmail(email, name, code);
        break;
      }
      case 'notification': {
        const { email, recipientName, title, body, link } = job.data;
        await this.mailService.sendNotificationEmail(email, recipientName, title, body, link);
        break;
      }
      default:
        this.logger.warn(`Unknown email template: "${job.name}"`);
        throw new Error(`Unknown email template: "${job.name}"`);
    }

    this.logger.log(`Email job ${job.id} processed successfully`);
  }
}
