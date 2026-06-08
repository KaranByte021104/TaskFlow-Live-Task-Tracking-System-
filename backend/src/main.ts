import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Serve static files from uploads folder
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Set global route prefix
  app.setGlobalPrefix('api');

  // Register global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable global validation pipe with whitelisting
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Enable CORS
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);
  console.log(`Backend service is running on: http://localhost:${port}/api`);
}
bootstrap();
