import { describe, it, expect } from 'vitest';
import { parseQuery, type IGazetteers } from '../../src/services/nlParser.js';

const gz: IGazetteers = {
  cities: new Set(['gurgaon', 'new delhi', 'mumbai']),
  cuisines: new Set(['south indian', 'north indian', 'chinese', 'street food', 'fast food']),
};

describe('parseQuery — the three brief examples', () => {
  it('"Best restaurants in Gurgaon with South Indian Food"', () => {
    const r = parseQuery('Best restaurants in Gurgaon with South Indian Food', gz);
    expect(r.city).toBe('gurgaon');
    expect(r.cuisines).toEqual(['south indian']);
    expect(r.sort).toBe('rating');
    expect(r.min_rating).toBe(4.0);
    expect(r.name).toBeUndefined();
  });

  it('"Restaurants in Gurgaon under Rs. 1000 for two"', () => {
    const r = parseQuery('Restaurants in Gurgaon under Rs. 1000 for two', gz);
    expect(r.city).toBe('gurgaon');
    expect(r.max_cost_for_two).toBe(1000);
    expect(r.sort).toBeUndefined();
  });

  it('"Nearest place that serves Vada Pav"', () => {
    const r = parseQuery('Nearest place that serves Vada Pav', gz);
    expect(r.sort).toBe('distance');
    expect(r.cuisines).toEqual(['street food', 'fast food']);
    expect(r.name).toBeUndefined();
  });
});

describe('parseQuery — variants', () => {
  it('resolves city aliases', () => {
    expect(parseQuery('top chinese in gurugram', gz).city).toBe('gurgaon');
  });

  it('parses "below 500" cost', () => {
    expect(parseQuery('chinese below 500', gz).max_cost_for_two).toBe(500);
  });

  it('matches all cuisines present', () => {
    expect(parseQuery('north indian and chinese', gz).cuisines).toEqual(['north indian', 'chinese']);
  });

  it('treats leftover words as a name hint', () => {
    expect(parseQuery('prankster in gurgaon', gz)).toMatchObject({ city: 'gurgaon', name: 'prankster' });
  });

  it('returns an empty interpretation for empty input', () => {
    expect(parseQuery('', gz)).toEqual({});
  });
});
