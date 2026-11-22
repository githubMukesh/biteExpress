import { describe, it, expect } from 'vitest';
import { buildFilter, buildSort, isGeo } from '../../src/repositories/queryBuilder.js';
import { listQuerySchema } from '../../src/schemas/listQuery.js';

function parse(input: Record<string, string>) {
  return listQuerySchema.parse(input);
}

describe('buildFilter', () => {
  it('always scopes by tenant', () => {
    expect(buildFilter(parse({}), 'biteexpress')).toEqual({ tenantId: 'biteexpress' });
  });

  it('builds an anchored name prefix and normalized city', () => {
    const f = buildFilter(parse({ name: 'Sarav', city: 'Gurugram' }), 't');
    expect(f.nameNorm).toEqual({ $regex: '^sarav' });
    expect(f.cityNorm).toBe('gurgaon');
  });

  it('uses $in for any and $all for all cuisines', () => {
    expect(buildFilter(parse({ cuisines: 'South Indian,Chinese' }), 't').cuisines).toEqual({
      $in: ['south indian', 'chinese'],
    });
    expect(
      buildFilter(parse({ cuisines: 'South Indian,Chinese', cuisine_match: 'all' }), 't').cuisines,
    ).toEqual({ $all: ['south indian', 'chinese'] });
  });

  it('excludes unrated and unpriced when those filters are set', () => {
    const f = buildFilter(parse({ min_rating: '4', max_cost_for_two: '1000' }), 't');
    expect(f['rating.average']).toEqual({ $gte: 4 });
    expect(f['rating.ratingAvailable']).toBe(true);
    expect(f['pricing.costForTwo']).toEqual({ $lte: 1000 });
    expect(f['pricing.priceAvailable']).toBe(true);
  });

  it('escapes regex metacharacters in name', () => {
    const f = buildFilter(parse({ name: 'a.b*c' }), 't');
    expect(f.nameNorm).toEqual({ $regex: '^a\\.b\\*c' });
  });
});

describe('buildSort', () => {
  it('defaults to rating desc with no coordinates', () => {
    expect(buildSort(parse({}))).toEqual({ 'rating.weighted': -1, _id: 1 });
  });
  it('returns null for distance (geoNear handles ordering)', () => {
    expect(buildSort(parse({ lat: '28', lng: '77' }))).toBeNull();
  });
  it('honors explicit sort and order', () => {
    expect(buildSort(parse({ sort: 'name', order: 'desc' }))).toEqual({ nameNorm: -1, _id: 1 });
    expect(buildSort(parse({ sort: 'cost' }))).toEqual({ 'pricing.costForTwo': 1, _id: 1 });
  });
});

describe('isGeo', () => {
  it('is true only when both lat and lng are present', () => {
    expect(isGeo(parse({ lat: '28', lng: '77' }))).toBe(true);
    expect(isGeo(parse({}))).toBe(false);
  });
});
