import type { IRestaurantDoc } from '../domain/restaurant.js';
import { buildRestaurantId, toInternalId, SCHEMA_VERSION } from '../domain/restaurant.js';
import { canonicalCity, normalizeText, weightedRating } from '../domain/normalize.js';
import {
  COUNTRY_BY_CODE,
  DEFAULT_GLOBAL_RATING_MEAN,
  RATING_PRIOR_MIN_VOTES,
} from '../domain/reference.js';
import { ApiError } from '../http/errors.js';
import { toListItem } from '../http/responses.js';
import type { RestaurantRepo } from '../repositories/restaurantRepo.js';
import type { TRestaurantCreate } from '../schemas/restaurant.js';
import type { TListQuery } from '../schemas/listQuery.js';
import type { TRestaurantInsert } from '../seed/transform.js';

export class RestaurantService {
  constructor(
    private repo: RestaurantRepo,
    private tenantId: string,
  ) {}

  async create(input: TRestaurantCreate): Promise<IRestaurantDoc> {
    const ref = COUNTRY_BY_CODE[input.countryCode];
    const now = new Date();
    const system = input.source?.system ?? 'api';
    const sourceId = input.source?.sourceId ?? Date.now();

    const doc: TRestaurantInsert = {
      _id: buildRestaurantId(this.tenantId, system, sourceId),
      tenantId: this.tenantId,
      source: { system, sourceId },
      name: input.name,
      nameNorm: normalizeText(input.name),
      address: input.address,
      city: input.city,
      cityNorm: canonicalCity(input.city),
      countryCode: input.countryCode,
      country: ref?.country ?? `Country ${input.countryCode}`,
      location: input.location
        ? { type: 'Point', coordinates: [input.location.lng, input.location.lat] }
        : null,
      cuisines: input.cuisines.map(normalizeText).filter(Boolean),
      pricing: {
        costForTwo: input.pricing.costForTwo,
        currencySourceLabel: input.pricing.currencySourceLabel,
        currencyCode: input.pricing.currencyCode ?? ref?.currencyCode ?? null,
        currencyAnomaly: ref?.currencyAnomaly ?? false,
        priceAvailable: input.pricing.costForTwo > 0,
      },
      flags: input.flags,
      rating: {
        average: input.rating.average,
        votes: input.rating.votes,
        ratingAvailable: input.rating.average > 0,
        weighted: weightedRating(
          input.rating.average,
          input.rating.votes,
          DEFAULT_GLOBAL_RATING_MEAN,
          RATING_PRIOR_MIN_VOTES,
        ),
      },
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    };

    return this.repo.insert(doc);
  }

  async getById(publicId: string): Promise<IRestaurantDoc> {
    if (!/^[^:]+:\d+$/.test(publicId)) {
      throw ApiError.badRequest('Malformed restaurant id');
    }
    const doc = await this.repo.findById(this.tenantId, toInternalId(this.tenantId, publicId));
    if (!doc) throw ApiError.notFound('Restaurant not found');
    return doc;
  }

  async list(q: TListQuery) {
    const docs = await this.repo.list(q, this.tenantId);
    const hasNext = docs.length > q.limit;
    return {
      items: docs.slice(0, q.limit).map(toListItem),
      page: q.page,
      limit: q.limit,
      hasNext,
    };
  }
}
