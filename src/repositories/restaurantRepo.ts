import { type Collection, type Db } from 'mongodb';
import type { IRestaurantDoc } from '../domain/restaurant.js';
import type { TRestaurantInsert } from '../seed/transform.js';
import { RESTAURANTS_COLLECTION } from '../db/validator.js';

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
}
