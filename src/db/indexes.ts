import type { Db, IndexDescription } from 'mongodb';
import { RESTAURANTS_COLLECTION } from './validator.js';

// Indexes are hypotheses derived from the endpoint query shapes. Compound keys
// follow Equality -> Sort -> Range, with _id last for a stable tie-break under
// pagination. Validate each with explain() on representative data.
// Duplicate inserts collide on the deterministic _id, so no separate unique
// index on (tenantId, source.sourceId) is needed.
export const RESTAURANT_INDEXES: IndexDescription[] = [
  // Distance filter/sort via $geoNear. Skips docs with no location.
  { key: { location: '2dsphere' }, name: 'location_2dsphere' },

  // City listing sorted by weighted rating.
  { key: { tenantId: 1, cityNorm: 1, 'rating.weighted': -1, _id: 1 }, name: 'tenant_city_rating' },

  // City + cuisine ("South Indian in Gurgaon"); cuisines is multikey.
  {
    key: { tenantId: 1, cityNorm: 1, cuisines: 1, 'rating.weighted': -1, _id: 1 },
    name: 'tenant_city_cuisine_rating',
  },

  // Anchored prefix match on normalized name.
  { key: { tenantId: 1, nameNorm: 1 }, name: 'tenant_name' },
];

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection(RESTAURANTS_COLLECTION).createIndexes(RESTAURANT_INDEXES);
}
