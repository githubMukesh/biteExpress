import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  canonicalCity,
  splitCuisines,
  yesNoToBool,
  parseCoordinates,
  weightedRating,
} from '../../src/domain/normalize.js';

describe('normalizeText', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeText('  Le   Petit  Souffle ')).toBe('le petit souffle');
  });
});

describe('canonicalCity', () => {
  it('maps alternate spellings to the dataset spelling', () => {
    expect(canonicalCity('Gurugram')).toBe('gurgaon');
    expect(canonicalCity('Bengaluru')).toBe('bangalore');
  });
  it('passes through cities without an alias', () => {
    expect(canonicalCity('New Delhi')).toBe('new delhi');
  });
});

describe('splitCuisines', () => {
  it('splits, lowercases, trims and de-duplicates', () => {
    expect(splitCuisines('French, Japanese, Desserts')).toEqual(['french', 'japanese', 'desserts']);
  });
  it('drops empty tokens and returns [] for null/blank', () => {
    expect(splitCuisines('North Indian, , Mughlai,')).toEqual(['north indian', 'mughlai']);
    expect(splitCuisines(null)).toEqual([]);
    expect(splitCuisines('')).toEqual([]);
  });
});

describe('yesNoToBool', () => {
  it('maps Yes/No case-insensitively', () => {
    expect(yesNoToBool('Yes')).toBe(true);
    expect(yesNoToBool('no')).toBe(false);
  });
  it('throws on unexpected tokens', () => {
    expect(() => yesNoToBool('maybe')).toThrow();
  });
});

describe('parseCoordinates', () => {
  it('builds a [lng, lat] GeoJSON Point', () => {
    const r = parseCoordinates(121.027535, 14.565443);
    expect(r.status).toBe('ok');
    expect(r.location).toEqual({ type: 'Point', coordinates: [121.027535, 14.565443] });
  });
  it('treats (0,0) as missing location', () => {
    expect(parseCoordinates(0, 0)).toEqual({ location: null, status: 'zero' });
  });
  it('flags a single zero coordinate as partial-zero', () => {
    expect(parseCoordinates(0, 14.5).status).toBe('partial-zero');
    expect(parseCoordinates(121.0, 0).status).toBe('partial-zero');
  });
  it('rejects out-of-range coordinates', () => {
    expect(parseCoordinates(200, 14.5).status).toBe('out-of-range');
    expect(parseCoordinates(121, 99).status).toBe('out-of-range');
  });
  it('reports missing for null/NaN', () => {
    expect(parseCoordinates(null, 14.5).status).toBe('missing');
    expect(parseCoordinates(NaN, NaN).status).toBe('missing');
  });
});

describe('weightedRating', () => {
  const C = 3.44;
  const m = 50;
  it('pulls low-vote restaurants toward the global mean', () => {
    const fewVotes = weightedRating(5.0, 3, C, m)!;
    const manyVotes = weightedRating(4.7, 3000, C, m)!;
    expect(fewVotes).toBeLessThan(manyVotes);
  });
  it('returns null for unrated or zero-vote records', () => {
    expect(weightedRating(0, 100, C, m)).toBeNull();
    expect(weightedRating(4.5, 0, C, m)).toBeNull();
  });
  it('approaches the source average as votes grow large', () => {
    expect(weightedRating(4.7, 1_000_000, C, m)!).toBeCloseTo(4.7, 3);
  });
});
