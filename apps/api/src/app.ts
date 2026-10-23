import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { loadUser } from './auth.js';
import { errorHandler } from './errors.js';
import { authRouter } from './routes/auth.js';
import { callbacksRouter } from './routes/callbacks.js';
import { consultationsRouter } from './routes/consultations.js';
import { geoRouter } from './routes/geo.js';
import { issuesRouter } from './routes/issues.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use(callbacksRouter);
  api.use(loadUser);
  api.use(authRouter, geoRouter, consultationsRouter, issuesRouter);
  app.use('/api', api);

  app.use(errorHandler);
  return app;
}
