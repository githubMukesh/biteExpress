import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { loadConfig } from '../../src/config.js';
import { createLogger } from '../../src/logger.js';
import { createMongo, type IMongoContext } from '../../src/db/client.js';
import { ensureSchema } from '../../src/db/bootstrap.js';
import { buildApp } from '../../src/app.js';
import { RESTAURANTS_COLLECTION } from '../../src/db/validator.js';

let app: Express;
let mongo: IMongoContext;

function post(body: Record<string, unknown>) {
  return request(app).post('/v1/restaurants').send(body);
}

beforeAll(async () => {
  const config = loadConfig({ ...process.env, MONGODB_DB: 'biteexpress_searchtest', LOG_LEVEL: 'silent' });
  mongo = await createMongo(config);
  await ensureSchema(mongo.db);
  await mongo.db.collection(RESTAURANTS_COLLECTION).deleteMany({});
  app = buildApp({ config, mongo, logger: createLogger(config) });

  await post({
    name: 'Saravana Bhavan', address: { line: 'A' }, city: 'Gurgaon', countryCode: 1,
    cuisines: ['South Indian'], pricing: { costForTwo: 500 }, rating: { average: 4.6, votes: 800 },
    location: { lng: 77.09, lat: 28.49 }, source: { system: 'test', sourceId: 1 },
  });
  await post({
    name: 'Dragon Bowl', address: { line: 'B' }, city: 'Gurgaon', countryCode: 1,
    cuisines: ['Chinese'], pricing: { costForTwo: 1500 }, rating: { average: 3.2, votes: 40 },
    location: { lng: 77.1, lat: 28.5 }, source: { system: 'test', sourceId: 2 },
  });
});

afterAll(async () => {
  await mongo.db.dropDatabase();
  await mongo.client.close();
});

describe('GET /v1/restaurants/search', () => {
  it('interprets "Best restaurants in Gurgaon with South Indian Food"', async () => {
    const res = await request(app)
      .get('/v1/restaurants/search')
      .query({ q: 'Best restaurants in Gurgaon with South Indian Food' });
    expect(res.status).toBe(200);
    expect(res.body.interpretedQuery).toMatchObject({
      city: 'gurgaon',
      cuisines: ['south indian'],
      sort: 'rating',
      min_rating: 4,
    });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Saravana Bhavan');
  });

  it('interprets an under-cost query', async () => {
    const res = await request(app)
      .get('/v1/restaurants/search')
      .query({ q: 'Restaurants in Gurgaon under Rs. 1000 for two' });
    expect(res.body.interpretedQuery.max_cost_for_two).toBe(1000);
    expect(res.body.items.every((i: { name: string }) => i.name !== 'Dragon Bowl')).toBe(true);
  });

  it('returns 400 when a nearest query has no coordinates', async () => {
    const res = await request(app)
      .get('/v1/restaurants/search')
      .query({ q: 'Nearest place that serves Vada Pav' });
    expect(res.status).toBe(400);
  });

  it('answers a nearest query when coordinates are supplied', async () => {
    const res = await request(app)
      .get('/v1/restaurants/search')
      .query({ q: 'nearest south indian', lat: '28.49', lng: '77.09' });
    expect(res.status).toBe(200);
    expect(res.body.interpretedQuery.sort).toBe('distance');
    expect(res.body.items[0]).toHaveProperty('distanceKm');
  });

  it('lets an explicit param override the parsed interpretation', async () => {
    const res = await request(app)
      .get('/v1/restaurants/search')
      .query({ q: 'best in gurgaon', city: 'New Delhi' });
    expect(res.body.interpretedQuery.city).toBe('gurgaon');
    expect(res.body.items).toHaveLength(0); // explicit New Delhi wins, no matches
  });
});
