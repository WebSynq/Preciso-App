import type { NextFunction, Request, Response } from 'express';

/**
 * Structured application error with safe client message.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public clientMessage: string,
    internalMessage?: string,
  ) {
    super(internalMessage || clientMessage);
    this.name = 'AppError';
  }
}

/**
 * Global error handler. Never exposes stack traces or internal details.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Log full error for CloudWatch / observability
  console.error('[API Error]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.clientMessage });
    return;
  }

  // Generic 500 — never expose internal error details
  res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
}
