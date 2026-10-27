import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const maxSizeMb = Math.ceil(env.rag.maxPdfBytes / (1024 * 1024));
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `This PDF exceeds the ${maxSizeMb} MB upload limit.`
      : 'Could not read the uploaded file.';
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ field: 'file', message }],
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body must be JSON',
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    },
  });
};
