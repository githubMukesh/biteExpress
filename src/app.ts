import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Config } from './config.js';
import type { IMongoContext } from './db/client.js';
import { healthRouter } from './routes/health.js';

export interface IBuildAppOptions {
  config: Config;
  mongo: IMongoContext;
  logger: Logger;
}

// App factory kept separate from server startup so tests can exercise it with
// supertest without binding a port.
export function buildApp({ mongo, logger }: IBuildAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.use(healthRouter(mongo));

  return app;
}
