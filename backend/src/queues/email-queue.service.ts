import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  async enqueueEmail(
    template: string,
    data: { email: string; name: string; code: string },
    jobId?: string,
  ) {
    this.logger.log(
      `Enqueuing email job for template: "${template}" to ${data.email} (jobId: ${jobId || 'auto'})`,
    );

    await this.emailQueue.add(template, data, {
      jobId, // For idempotency
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, then 4s, then 8s
      },
      removeOnComplete: true, // automatically remove completed jobs from Redis
      removeOnFail: false, // keep failed jobs for debugging
    });
  }
}
