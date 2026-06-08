import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent = exception.getResponse();
      message =
        typeof resContent === 'string'
          ? resContent
          : (resContent as any).message || exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Resource not found';
          break;
        case 'P2002':
          status = HttpStatus.CONFLICT;
          const targets = exception.meta?.target as string[] | undefined;
          const duplicateField = targets ? targets.join(', ') : 'field';
          message = `Duplicate entry: A record with this ${duplicateField} already exists`;
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = exception.message || 'Database error occurred';
          break;
      }
    } else if (
      exception?.name === 'JsonWebTokenError' ||
      exception?.name === 'TokenExpiredError'
    ) {
      status = HttpStatus.UNAUTHORIZED;
      message =
        exception.name === 'TokenExpiredError'
          ? 'Token expired'
          : 'Invalid token';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      message: message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
