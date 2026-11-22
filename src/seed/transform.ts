import {
  canonicalCity,
  normalizeText,
  parseCoordinates,
  splitCuisines,
  weightedRating,
  yesNoToBool,
  type CoordinateResult,
} from '../domain/normalize.js';
import { COUNTRY_BY_CODE, RATING_PRIOR_MIN_VOTES } from '../domain/reference.js';
import { buildRestaurantId, SCHEMA_VERSION, type IRestaurantDoc } from '../domain/restaurant.js';

export interface IRawRow {
  'Restaurant ID': string;
  'Restaurant Name': string;
  'Country Code': string;
  City: string;
  Address: string;
  Locality: string;
  'Locality Verbose': string;
  Longitude: string;
  Latitude: string;
  Cuisines: string;
  'Average Cost for two': string;
  Currency: string;
  'Has Table booking': string;
  'Has Online delivery': string;
  'Is delivering now': string;
  'Switch to order menu': string;
  'Price range': string;
  'Aggregate rating': string;
  'Rating color': string;
  'Rating text': string;
  Votes: string;
}

export type TRestaurantInsert = IRestaurantDoc;

export interface ITransformResult {
  doc: TRestaurantInsert;
  coordinateStatus: CoordinateResult['status'];
}

export interface ITransformOptions {
  tenantId: string;
  globalMean: number;
  minVotesPrior?: number;
  now: Date;
}

function toNumber(value: string): number {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : 0;
}

export function computeGlobalMean(rows: IRawRow[]): number {
  let sum = 0;
  let count = 0;
  for (const r of rows) {
    const avg = toNumber(r['Aggregate rating']);
    if (avg > 0) {
      sum += avg;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

export function rowToRestaurant(row: IRawRow, opts: ITransformOptions): ITransformResult {
  const countryCode = toNumber(row['Country Code']);
  const ref = COUNTRY_BY_CODE[countryCode];

  const coord = parseCoordinates(toNumber(row.Longitude), toNumber(row.Latitude));

  const costForTwo = toNumber(row['Average Cost for two']);
  const average = toNumber(row['Aggregate rating']);
  const votes = toNumber(row.Votes);
  const minVotes = opts.minVotesPrior ?? RATING_PRIOR_MIN_VOTES;
  const sourceId = toNumber(row['Restaurant ID']);
  const system = 'zomato_sample';

  const doc: TRestaurantInsert = {
    _id: buildRestaurantId(opts.tenantId, system, sourceId),
    tenantId: opts.tenantId,
    source: { system, sourceId },

    name: row['Restaurant Name'],
    nameNorm: normalizeText(row['Restaurant Name']),

    address: { line: row.Address, locality: row.Locality },
    city: row.City,
    cityNorm: canonicalCity(row.City),
    countryCode,
    country: ref?.country ?? `Country ${countryCode}`,

    location: coord.location,
    cuisines: splitCuisines(row.Cuisines),

    pricing: {
      costForTwo,
      currencySourceLabel: row.Currency,
      currencyCode: ref?.currencyCode ?? null,
      currencyAnomaly: ref?.currencyAnomaly ?? false,
      priceAvailable: costForTwo > 0,
    },

    flags: {
      tableBooking: yesNoToBool(row['Has Table booking']),
      onlineDelivery: yesNoToBool(row['Has Online delivery']),
      deliveringNow: yesNoToBool(row['Is delivering now']),
      orderMenu: yesNoToBool(row['Switch to order menu']),
    },

    rating: {
      average,
      votes,
      ratingAvailable: average > 0,
      weighted: weightedRating(average, votes, opts.globalMean, minVotes),
    },

    schemaVersion: SCHEMA_VERSION,
    createdAt: opts.now,
    updatedAt: opts.now,
  };

  return { doc, coordinateStatus: coord.status };
}
