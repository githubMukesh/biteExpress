import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Config } from './config.js';
import type { IMongoContext } from './db/client.js';
import { healthRouter } from './routes/health.js';
import { restaurantsRouter } from './routes/v1/restaurants.js';
import { ROUTES } from './routes/paths.js';
import { RestaurantRepo } from './repositories/restaurantRepo.js';
import { RestaurantService } from './services/restaurantService.js';
import { errorHandler } from './http/errors.js';

export interface IBuildAppOptions {
  config: Config;
  mongo: IMongoContext;
  logger: Logger;
}

// App factory kept separate from server startup so tests can exercise it with
// supertest without binding a port.
export function buildApp({ config, mongo, logger }: IBuildAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  const service = new RestaurantService(
    new RestaurantRepo(mongo.db),
    config.TENANT_ID,
    config.SEARCH_ENGINE,
  );

  app.use(healthRouter(mongo));
  app.use(ROUTES.restaurants, restaurantsRouter(service));

  app.use(errorHandler);

  return app;
}
