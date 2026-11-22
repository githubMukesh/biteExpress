import type { Db } from 'mongodb';
import { ensureRestaurantCollection } from './validator.js';
import { ensureIndexes } from './indexes.js';

export async function ensureSchema(db: Db): Promise<void> {
  await ensureRestaurantCollection(db);
  await ensureIndexes(db);
}
