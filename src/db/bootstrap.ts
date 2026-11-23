import type { Db } from 'mongodb';
import { ensureRestaurantCollection } from './validator.js';
import { ensureIndexes } from './indexes.js';
import { ensureSearchIndex } from './searchIndex.js';

export interface IEnsureSchemaOptions {
  searchEngine?: 'basic' | 'atlas';
}

export async function ensureSchema(db: Db, opts: IEnsureSchemaOptions = {}): Promise<void> {
  await ensureRestaurantCollection(db);
  await ensureIndexes(db);
  if (opts.searchEngine === 'atlas') await ensureSearchIndex(db);
}
