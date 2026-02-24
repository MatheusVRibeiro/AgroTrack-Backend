import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface CustomError extends Error {
  statusCode?: number;
}

export const errorHandler = (err: Error | CustomError, req: Request, res: Response, _next: NextFunction): void => {
  console.error(`Error on ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: err.errors,
    });
    return;
  }

  const statusCode = err instanceof Error && 'statusCode' in err ? err.statusCode || 500 : 500;
  const message = err.message || 'Erro interno do servidor';

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? { message: err.message, stack: (err as Error).stack } : undefined,
  });
};
