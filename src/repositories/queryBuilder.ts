import { canonicalCity, normalizeText } from '../domain/normalize.js';
import type { TListQuery } from '../schemas/listQuery.js';

export type TFilter = Record<string, unknown>;
export type TSort = Record<string, 1 | -1>;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isGeo(q: TListQuery): boolean {
  return q.lat !== undefined && q.lng !== undefined;
}

export function buildFilter(q: TListQuery, tenantId: string): TFilter {
  const filter: TFilter = { tenantId };

  if (q.name) filter.nameNorm = { $regex: `^${escapeRegex(normalizeText(q.name))}` };
  if (q.city) filter.cityNorm = canonicalCity(q.city);

  if (q.cuisines) {
    const arr = q.cuisines.split(',').map(normalizeText).filter(Boolean);
    if (arr.length) filter.cuisines = q.cuisine_match === 'all' ? { $all: arr } : { $in: arr };
  }

  if (q.min_rating !== undefined) {
    filter['rating.average'] = { $gte: q.min_rating };
    filter['rating.ratingAvailable'] = true;
  }

  if (q.max_cost_for_two !== undefined) {
    filter['pricing.costForTwo'] = { $lte: q.max_cost_for_two };
    filter['pricing.priceAvailable'] = true;
  }

  return filter;
}

// Null means "ordered by $geoNear distance" (the geo path sorts by proximity).
export function buildSort(q: TListQuery): TSort | null {
  const sort = q.sort ?? (isGeo(q) ? 'distance' : 'rating');
  if (sort === 'distance') return null;

  const defaultOrder: Record<string, 'asc' | 'desc'> = { rating: 'desc', name: 'asc', cost: 'asc' };
  const dir: 1 | -1 = (q.order ?? defaultOrder[sort]) === 'asc' ? 1 : -1;

  const field =
    sort === 'rating' ? 'rating.weighted' : sort === 'name' ? 'nameNorm' : 'pricing.costForTwo';

  return { [field]: dir, _id: 1 };
}
