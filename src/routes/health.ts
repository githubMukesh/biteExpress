import { Router } from 'express';
import { mongoPing, type MongoContext } from '../db/client.js';

export function healthRouter(mongo: MongoContext): Router {
  const router = Router();

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/readyz', async (_req, res) => {
    const ok = await mongoPing(mongo).catch(() => false);
    if (!ok) {
      res.status(503).json({ status: 'not_ready', mongodb: 'unavailable' });
      return;
    }
    res.json({ status: 'ready', mongodb: 'ok' });
  });

  return router;
}
