import type { IGeoPoint } from './normalize.js';

export const SCHEMA_VERSION = 2;

// Deterministic _id from the natural key, so a duplicate insert collides on the
// mandatory _id index (no separate unique index needed) and seeding is idempotent.
export function buildRestaurantId(tenantId: string, system: string, sourceId: number): string {
  return `${tenantId}:${system}:${sourceId}`;
}

// Public id excludes the tenant, which stays server-side. The internal _id is
// rebuilt by prepending the tenant from context.
export function toPublicId(system: string, sourceId: number): string {
  return `${system}:${sourceId}`;
}

export function toInternalId(tenantId: string, publicId: string): string {
  return `${tenantId}:${publicId}`;
}

export interface IRestaurantSource {
  system: string;
  sourceId: number;
}

export interface IAddress {
  line: string;
  locality: string;
}

export interface IPricing {
  costForTwo: number;
  currencySourceLabel: string;
  currencyCode: string | null;
  currencyAnomaly: boolean;
  priceAvailable: boolean; // false when cost is unknown (source 0)
}

export interface IOperationalFlags {
  tableBooking: boolean;
  onlineDelivery: boolean;
  deliveringNow: boolean;
  orderMenu: boolean;
}

export interface IRating {
  average: number;
  votes: number;
  ratingAvailable: boolean; // false when source rating is 0
  weighted: number | null; // null for unrated records
}

// One document per restaurant, shaped for the discovery read path so the list
// screen needs no $lookup. Nullability mirrors real source-data quality.
export interface IRestaurantDoc {
  _id: string;
  tenantId: string;
  source: IRestaurantSource;

  name: string;
  nameNorm: string;

  address: IAddress;
  city: string;
  cityNorm: string;
  countryCode: number;
  country: string;

  location: IGeoPoint | null;
  cuisines: string[];

  pricing: IPricing;
  flags: IOperationalFlags;
  rating: IRating;

  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
