import { type Collection, type Db, type Document } from 'mongodb';
import type { IRestaurantDoc } from '../domain/restaurant.js';
import type { TRestaurantInsert } from '../seed/transform.js';
import type { TListQuery } from '../schemas/listQuery.js';
import type { IGazetteers } from '../services/nlParser.js';
import { RESTAURANTS_COLLECTION } from '../db/validator.js';
import { SEARCH_INDEX_NAME } from '../db/searchIndex.js';
import { buildFilter, buildSort, isGeo } from './queryBuilder.js';

const QUERY_MAX_TIME_MS = 5000;

export type TListResultDoc = IRestaurantDoc & { distanceMeters?: number };

export class RestaurantRepo {
  private col: Collection<IRestaurantDoc>;

  constructor(db: Db) {
    this.col = db.collection<IRestaurantDoc>(RESTAURANTS_COLLECTION);
  }

  async insert(doc: TRestaurantInsert): Promise<IRestaurantDoc> {
    await this.col.insertOne(doc);
    return doc;
  }

  async findById(tenantId: string, id: string): Promise<IRestaurantDoc | null> {
    return this.col.findOne({ _id: id, tenantId });
  }

  // Fetches limit + 1 so the caller can derive hasNext without a separate count.
  async list(q: TListQuery, tenantId: string): Promise<TListResultDoc[]> {
    const filter = buildFilter(q, tenantId);
    const sort = buildSort(q);
    const skip = (q.page - 1) * q.limit;
    const take = q.limit + 1;

    if (isGeo(q)) {
      const pipeline: Document[] = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [q.lng, q.lat] },
            distanceField: 'distanceMeters',
            spherical: true,
            query: filter,
            ...(q.radius_km !== undefined ? { maxDistance: q.radius_km * 1000 } : {}),
          },
        },
      ];
      if (sort) pipeline.push({ $sort: sort });
      pipeline.push({ $skip: skip }, { $limit: take });
      return this.col
        .aggregate<TListResultDoc>(pipeline, { maxTimeMS: QUERY_MAX_TIME_MS })
        .toArray();
    }

    return this.col
      .find(filter, { maxTimeMS: QUERY_MAX_TIME_MS })
      .sort(sort ?? {})
      .skip(skip)
      .limit(take)
      .toArray();
  }

  // Atlas-only: fuzzy name retrieval via $search, with the structured filters
  // applied as a post-$match. $search must be stage one, so this path has no geo
  // distance (fuzzy text and $geoNear can't share stage one).
  async searchText(text: string, q: TListQuery, tenantId: string): Promise<TListResultDoc[]> {
    const skip = (q.page - 1) * q.limit;
    const take = q.limit + 1;
    const pipeline: Document[] = [
      {
        $search: {
          index: SEARCH_INDEX_NAME,
          text: { query: text, path: 'name', fuzzy: { maxEdits: 2 } },
        },
      },
      { $match: buildFilter(q, tenantId) },
      { $skip: skip },
      { $limit: take },
    ];
    return this.col
      .aggregate<TListResultDoc>(pipeline, { maxTimeMS: QUERY_MAX_TIME_MS })
      .toArray();
  }

  async loadGazetteers(tenantId: string): Promise<IGazetteers> {
    const [cities, cuisines] = await Promise.all([
      this.col.distinct('cityNorm', { tenantId }),
      this.col.distinct('cuisines', { tenantId }),
    ]);
    return {
      cities: new Set(cities.filter(Boolean)),
      cuisines: new Set(cuisines.filter(Boolean)),
    };
  }
}
