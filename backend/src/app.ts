import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { apiRouter } from './routes';
import './types/express';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api/v1', apiRouter);

  if (env.nodeEnv === 'production') {
    const frontendDirectory = path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDirectory));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDirectory, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
