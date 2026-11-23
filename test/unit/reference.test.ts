import { describe, it, expect } from 'vitest';
import { resolveCountryName, resolveCurrency } from '../../src/domain/reference.js';

describe('resolveCountryName', () => {
  it('maps known codes and fixes the source spelling', () => {
    expect(resolveCountryName(1)).toBe('India');
    expect(resolveCountryName(162)).toBe('Philippines');
  });
  it('falls back for an unknown code', () => {
    expect(resolveCountryName(999)).toBe('Country 999');
  });
});

describe('resolveCurrency', () => {
  it('maps a known country to its ISO code', () => {
    expect(resolveCurrency(1)).toEqual({ code: 'INR', anomaly: false });
  });
  it('flags the Philippines anomaly with a null code', () => {
    expect(resolveCurrency(162)).toEqual({ code: null, anomaly: true });
  });
  it('returns null for an unknown code', () => {
    expect(resolveCurrency(999)).toEqual({ code: null, anomaly: false });
  });
});
