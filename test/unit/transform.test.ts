import { describe, it, expect } from 'vitest';
import { rowToRestaurant, computeGlobalMean, type IRawRow } from '../../src/seed/transform.js';

function makeRow(overrides: Partial<IRawRow> = {}): IRawRow {
  return {
    'Restaurant ID': '123',
    'Restaurant Name': 'Saravana Bhavan',
    'Country Code': '1',
    City: 'Gurgaon',
    Address: 'DLF Phase 3',
    Locality: 'DLF Phase 3',
    'Locality Verbose': 'DLF Phase 3, Gurgaon',
    Longitude: '77.09',
    Latitude: '28.49',
    Cuisines: 'South Indian, North Indian',
    'Average Cost for two': '500',
    Currency: 'Indian Rupees(Rs.)',
    'Has Table booking': 'Yes',
    'Has Online delivery': 'No',
    'Is delivering now': 'No',
    'Switch to order menu': 'No',
    'Price range': '2',
    'Aggregate rating': '4.3',
    'Rating color': 'Green',
    'Rating text': 'Very Good',
    Votes: '350',
    ...overrides,
  };
}

const opts = { tenantId: 'biteexpress', globalMean: 3.44, now: new Date('2026-01-01') };

describe('rowToRestaurant', () => {
  it('maps a clean India row', () => {
    const { doc } = rowToRestaurant(makeRow(), opts);
    expect(doc.source).toEqual({ system: 'zomato_sample', sourceId: 123 });
    expect(doc.country).toBe('India');
    expect(doc.pricing.currencyCode).toBe('INR');
    expect(doc.cityNorm).toBe('gurgaon');
    expect(doc.cuisines).toEqual(['south indian', 'north indian']);
    expect(doc.location).toEqual({ type: 'Point', coordinates: [77.09, 28.49] });
    expect(doc.rating.ratingAvailable).toBe(true);
    expect(doc.rating.weighted).not.toBeNull();
  });

  it('flags the Philippines currency anomaly without rewriting it', () => {
    const { doc } = rowToRestaurant(
      makeRow({ 'Country Code': '162', Currency: 'Botswana Pula(P)' }),
      opts,
    );
    expect(doc.country).toBe('Philippines');
    expect(doc.pricing.currencySourceLabel).toBe('Botswana Pula(P)');
    expect(doc.pricing.currencyCode).toBeNull();
    expect(doc.pricing.currencyAnomaly).toBe(true);
  });

  it('omits location for (0,0) and reports the status', () => {
    const { doc, coordinateStatus } = rowToRestaurant(
      makeRow({ Longitude: '0', Latitude: '0' }),
      opts,
    );
    expect(doc.location).toBeNull();
    expect(coordinateStatus).toBe('zero');
  });

  it('treats zero rating and zero cost as unavailable', () => {
    const { doc } = rowToRestaurant(
      makeRow({ 'Aggregate rating': '0', Votes: '0', 'Average Cost for two': '0' }),
      opts,
    );
    expect(doc.rating.ratingAvailable).toBe(false);
    expect(doc.rating.weighted).toBeNull();
    expect(doc.pricing.priceAvailable).toBe(false);
  });

  it('throws on an unexpected boolean token', () => {
    expect(() => rowToRestaurant(makeRow({ 'Has Table booking': 'maybe' }), opts)).toThrow();
  });
});

describe('computeGlobalMean', () => {
  it('averages only rated rows', () => {
    const rows = [
      makeRow({ 'Aggregate rating': '4.0' }),
      makeRow({ 'Aggregate rating': '2.0' }),
      makeRow({ 'Aggregate rating': '0' }),
    ];
    expect(computeGlobalMean(rows)).toBe(3.0);
  });
});
