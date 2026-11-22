import { CITY_ALIASES } from './reference.js';

// Pure cleaning helpers shared by the seed pipeline and the API. Kept pure so the
// tricky data-quality rules stay directly testable.

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function canonicalCity(city: string): string {
  const norm = normalizeText(city);
  return CITY_ALIASES[norm] ?? norm;
}

export function splitCuisines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const c = normalizeText(part);
    if (c) seen.add(c);
  }
  return [...seen];
}

export function yesNoToBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === 'yes') return true;
  if (v === 'no') return false;
  throw new Error(`Expected Yes/No, got: ${JSON.stringify(value)}`);
}

export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export type CoordinateResult =
  | { location: IGeoPoint; status: 'ok' }
  | { location: null; status: 'missing' | 'zero' | 'partial-zero' | 'out-of-range' };

// GeoJSON Point is [longitude, latitude] — swapping them is the classic bug.
// (0,0) and partial zeros are reported as missing rather than treated as a place.
export function parseCoordinates(
  longitude: number | null,
  latitude: number | null,
): CoordinateResult {
  if (longitude === null || latitude === null || Number.isNaN(longitude) || Number.isNaN(latitude)) {
    return { location: null, status: 'missing' };
  }
  const lngZero = longitude === 0;
  const latZero = latitude === 0;
  if (lngZero && latZero) return { location: null, status: 'zero' };
  if (lngZero || latZero) return { location: null, status: 'partial-zero' };
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return { location: null, status: 'out-of-range' };
  }
  return { location: { type: 'Point', coordinates: [longitude, latitude] }, status: 'ok' };
}

// Bayesian weighted rating for ranking (not display):
//   WR = (v / (v + m)) * R + (m / (v + m)) * C
// Returns null for unrated/zero-vote records so they rank separately.
export function weightedRating(
  average: number,
  votes: number,
  globalMean: number,
  minVotesPrior: number,
): number | null {
  if (average <= 0 || votes <= 0) return null;
  const wr =
    (votes / (votes + minVotesPrior)) * average +
    (minVotesPrior / (votes + minVotesPrior)) * globalMean;
  return Math.round(wr * 1e6) / 1e6;
}
