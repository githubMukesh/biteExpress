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
  const config = loadConfig({ ...process.env, MONGODB_DB: 'biteexpress_listtest', LOG_LEVEL: 'silent' });
  mongo = await createMongo(config);
  await ensureSchema(mongo.db);
  await mongo.db.collection(RESTAURANTS_COLLECTION).deleteMany({});
  app = buildApp({ config, mongo, logger: createLogger(config) });

  await post({
    name: 'Alpha South', address: { line: 'A' }, city: 'Gurgaon', countryCode: 1,
    cuisines: ['South Indian'], pricing: { costForTwo: 500 }, rating: { average: 4.5, votes: 500 },
    location: { lng: 77.09, lat: 28.49 }, source: { system: 'test', sourceId: 1 },
  });
  await post({
    name: 'Beta Chinese', address: { line: 'B' }, city: 'Gurgaon', countryCode: 1,
    cuisines: ['Chinese'], pricing: { costForTwo: 1500 }, rating: { average: 3.0, votes: 50 },
    location: { lng: 77.3, lat: 28.7 }, source: { system: 'test', sourceId: 2 },
  });
  await post({
    name: 'Gamma South', address: { line: 'G' }, city: 'New Delhi', countryCode: 1,
    cuisines: ['South Indian'], pricing: { costForTwo: 800 }, rating: { average: 4.8, votes: 1000 },
    location: { lng: 77.2, lat: 28.6 }, source: { system: 'test', sourceId: 3 },
  });
});

afterAll(async () => {
  await mongo.db.dropDatabase();
  await mongo.client.close();
});

describe('GET /v1/restaurants', () => {
  it('lists all with the required attributes, default sort rating desc', async () => {
    const res = await request(app).get('/v1/restaurants');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.hasNext).toBe(false);
    expect(res.body.items[0].name).toBe('Gamma South'); // highest weighted
    expect(res.body.items[0]).toHaveProperty('averageRating');
    expect(res.body.items[0]).toHaveProperty('country', 'India');
    expect(res.body.items[0]).not.toHaveProperty('distanceKm');
  });

  it('filters by city', async () => {
    const res = await request(app).get('/v1/restaurants?city=Gurgaon');
    expect(res.body.items.map((i: { name: string }) => i.name).sort()).toEqual([
      'Alpha South',
      'Beta Chinese',
    ]);
  });

  it('filters by cuisine', async () => {
    const res = await request(app).get('/v1/restaurants?cuisines=South Indian');
    expect(res.body.items).toHaveLength(2);
  });

  it('filters by min_rating', async () => {
    const res = await request(app).get('/v1/restaurants?min_rating=4');
    expect(res.body.items.map((i: { name: string }) => i.name)).not.toContain('Beta Chinese');
  });

  it('returns distanceKm and nearest-first when coordinates are given', async () => {
    const res = await request(app).get('/v1/restaurants?lat=28.49&lng=77.09');
    expect(res.body.items[0].name).toBe('Alpha South');
    expect(res.body.items[0].distanceKm).toBeCloseTo(0, 1);
    expect(res.body.items[0].distanceKm).toBeLessThan(res.body.items[1].distanceKm);
  });

  it('paginates with hasNext', async () => {
    const res = await request(app).get('/v1/restaurants?limit=1');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.hasNext).toBe(true);
  });

  it('rejects sort=distance without coordinates (422)', async () => {
    const res = await request(app).get('/v1/restaurants?sort=distance');
    expect(res.status).toBe(422);
  });
});
