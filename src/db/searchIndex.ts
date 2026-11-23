import type { Db } from 'mongodb';
import { RESTAURANTS_COLLECTION } from './validator.js';

export const SEARCH_INDEX_NAME = 'restaurants_search';

// Dynamic mapping indexes all fields; enough for fuzzy name retrieval on the
// parser's residual text. Only created when SEARCH_ENGINE=atlas.
const searchIndexDefinition = { mappings: { dynamic: true } };

export async function ensureSearchIndex(db: Db): Promise<void> {
  const col = db.collection(RESTAURANTS_COLLECTION);
  const existing = await col.listSearchIndexes().toArray();
  if (existing.some((i) => i.name === SEARCH_INDEX_NAME)) return;
  await col.createSearchIndex({ name: SEARCH_INDEX_NAME, definition: searchIndexDefinition });
}
