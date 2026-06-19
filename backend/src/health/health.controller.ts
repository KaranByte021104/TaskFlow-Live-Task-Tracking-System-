import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthCheckResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (e) {
          throw new HealthCheckError('Database health check failed', {
            database: { status: 'down', message: e.message },
          });
        }
      },
      async () => {
        try {
          const res = await this.redis.ping();
          if (res === 'PONG') {
            return { redis: { status: 'up' } };
          }
          throw new Error(`Unexpected ping response: ${res}`);
        } catch (e) {
          throw new HealthCheckError('Redis health check failed', {
            redis: { status: 'down', message: e.message },
          });
        }
      },
    ]);
  }
}
