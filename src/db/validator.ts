import type { Db } from 'mongodb';
import { SCHEMA_VERSION } from '../domain/restaurant.js';

export const RESTAURANTS_COLLECTION = 'restaurants';

const restaurantJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'tenantId',
      'source',
      'name',
      'nameNorm',
      'address',
      'city',
      'cityNorm',
      'countryCode',
      'cuisines',
      'pricing',
      'flags',
      'rating',
      'schemaVersion',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      tenantId: { bsonType: 'string' },
      source: {
        bsonType: 'object',
        required: ['system', 'sourceId'],
        properties: {
          system: { bsonType: 'string' },
          sourceId: { bsonType: 'number' },
        },
      },
      name: { bsonType: 'string' },
      nameNorm: { bsonType: 'string' },
      address: {
        bsonType: 'object',
        required: ['line', 'locality'],
        properties: {
          line: { bsonType: 'string' },
          locality: { bsonType: 'string' },
        },
      },
      city: { bsonType: 'string' },
      cityNorm: { bsonType: 'string' },
      countryCode: { bsonType: 'number' },
      location: {
        bsonType: ['object', 'null'],
        required: ['type', 'coordinates'],
        properties: {
          type: { enum: ['Point'] },
          coordinates: {
            bsonType: 'array',
            minItems: 2,
            maxItems: 2,
            items: { bsonType: 'number' },
          },
        },
      },
      cuisines: { bsonType: 'array', items: { bsonType: 'string' } },
      pricing: {
        bsonType: 'object',
        required: ['costForTwo', 'currencySourceLabel', 'priceAvailable'],
        properties: {
          costForTwo: { bsonType: 'number', minimum: 0 },
          currencySourceLabel: { bsonType: 'string' },
          priceAvailable: { bsonType: 'bool' },
        },
      },
      flags: {
        bsonType: 'object',
        required: ['tableBooking', 'onlineDelivery', 'deliveringNow', 'orderMenu'],
        properties: {
          tableBooking: { bsonType: 'bool' },
          onlineDelivery: { bsonType: 'bool' },
          deliveringNow: { bsonType: 'bool' },
          orderMenu: { bsonType: 'bool' },
        },
      },
      rating: {
        bsonType: 'object',
        required: ['average', 'votes', 'ratingAvailable', 'weighted'],
        properties: {
          average: { bsonType: 'number', minimum: 0, maximum: 5 },
          votes: { bsonType: 'number', minimum: 0 },
          ratingAvailable: { bsonType: 'bool' },
          weighted: { bsonType: ['number', 'null'], minimum: 0, maximum: 5 },
        },
      },
      schemaVersion: { bsonType: 'number' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
} as const;

export async function ensureRestaurantCollection(db: Db): Promise<void> {
  const exists = await db.listCollections({ name: RESTAURANTS_COLLECTION }).hasNext();
  if (exists) {
    await db.command({
      collMod: RESTAURANTS_COLLECTION,
      validator: restaurantJsonSchema,
      validationAction: 'error',
      validationLevel: 'strict',
    });
  } else {
    await db.createCollection(RESTAURANTS_COLLECTION, {
      validator: restaurantJsonSchema,
      validationAction: 'error',
      validationLevel: 'strict',
    });
  }
}

export { SCHEMA_VERSION };
