import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

type GrpcError = {
  code: number;
  details?: string;
  message?: string;
};

@Catch()
export class GrpcToHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
    }

    if (this.isGrpcError(exception) && exception.code === GrpcStatus.NOT_FOUND) {
      return response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: exception.details || 'Not Found',
        error: 'Not Found',
      });
    }

    const message  =
      exception instanceof Error ? exception.message : 'Internal server error';

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      error: 'Internal Server Error',
    });
  }

  private isGrpcError(exception: unknown): exception is GrpcError {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as GrpcError).code === 'number'
    );
  }
}
