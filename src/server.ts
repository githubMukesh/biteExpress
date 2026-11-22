import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createMongo } from './db/client.js';
import { ensureSchema } from './db/bootstrap.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const mongo = await createMongo(config);
  await ensureSchema(mongo.db);
  const app = buildApp({ config, mongo, logger });

  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info(`listening on http://${config.HOST}:${config.PORT}`);
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void mongo.client.close().then(() => process.exit(0));
    });
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => shutdown(signal));
  }
}

main().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
