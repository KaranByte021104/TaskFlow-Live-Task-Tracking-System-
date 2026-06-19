import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailQueueService } from './email-queue.service';
import { EmailProcessor } from './email.processor';
import { MailModule } from '../auth/mail.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const urlParsed = new URL(redisUrl);
        return {
          connection: {
            host: urlParsed.hostname,
            port: parseInt(urlParsed.port || '6379', 10),
            username: urlParsed.username || undefined,
            password: urlParsed.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'notifications' },
    ),
    MailModule,
  ],
  providers: [EmailQueueService, EmailProcessor],
  exports: [EmailQueueService, BullModule],
})
export class QueuesModule {}
