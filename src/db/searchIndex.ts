import type { Db } from 'mongodb';
import { RESTAURANTS_COLLECTION } from './validator.js';

export const SEARCH_INDEX_NAME = 'restaurants_search';

// Dynamic mapping indexes all fields; enough for fuzzy name retrieval on the
// parser's residual text. Only created when SEARCH_ENGINE=atlas.
const searchIndexDefinition = { mappings: { dynamic: true } };

const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 3000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// atlas-local's Search service (mongot) can lag mongod readiness, so the first
// calls may fail with SearchIndexManagementHostUnreachable (508). Retry until it
// is reachable; never crash the API over search setup.
export async function ensureSearchIndex(db: Db): Promise<void> {
  const col = db.collection(RESTAURANTS_COLLECTION);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const existing = await col.listSearchIndexes().toArray();
      if (!existing.some((i) => i.name === SEARCH_INDEX_NAME)) {
        await col.createSearchIndex({ name: SEARCH_INDEX_NAME, definition: searchIndexDefinition });
      }
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.warn(
          `search index setup gave up after ${MAX_ATTEMPTS} attempts: ${(err as Error).message}`,
        );
        return;
      }
      console.warn(`search service not ready (attempt ${attempt}/${MAX_ATTEMPTS}), retrying...`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}
