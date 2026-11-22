import { MongoClient, type Db } from 'mongodb';
import type { Config } from '../config.js';

export interface MongoContext {
  client: MongoClient;
  db: Db;
}

// One MongoClient per process: the driver pools connections internally, so a
// client-per-request would exhaust the server under load.
export async function createMongo(config: Config): Promise<MongoContext> {
  const client = new MongoClient(config.MONGODB_URI, {
    maxPoolSize: config.MONGODB_MAX_POOL_SIZE,
    minPoolSize: config.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
  });

  await client.connect();
  return { client, db: client.db(config.MONGODB_DB) };
}

export async function mongoPing(ctx: MongoContext): Promise<boolean> {
  const res = await ctx.db.command({ ping: 1 });
  return res.ok === 1;
}
