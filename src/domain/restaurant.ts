import type { ObjectId } from 'mongodb';
import type { IGeoPoint } from './normalize.js';

export const SCHEMA_VERSION = 2;

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
  _id: ObjectId;
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
