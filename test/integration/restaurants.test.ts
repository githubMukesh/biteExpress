import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

const validBody = {
  name: 'Saravana Bhavan',
  address: { line: 'DLF Phase 3', locality: 'DLF Phase 3' },
  city: 'Gurgaon',
  countryCode: 1,
  location: { lng: 77.09, lat: 28.49 },
  cuisines: ['South Indian'],
  pricing: { costForTwo: 500, currencySourceLabel: 'Indian Rupees(Rs.)' },
  rating: { average: 4.3, votes: 350 },
  source: { system: 'test', sourceId: 999001 },
};

beforeAll(async () => {
  const config = loadConfig({ ...process.env, MONGODB_DB: 'biteexpress_apitest', LOG_LEVEL: 'silent' });
  mongo = await createMongo(config);
  await ensureSchema(mongo.db);
  app = buildApp({ config, mongo, logger: createLogger(config) });
});

beforeEach(async () => {
  await mongo.db.collection(RESTAURANTS_COLLECTION).deleteMany({});
});

afterAll(async () => {
  await mongo.db.dropDatabase();
  await mongo.client.close();
});

describe('POST /v1/restaurants', () => {
  it('creates a restaurant and returns 201 with the entity', async () => {
    const res = await request(app).post('/v1/restaurants').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('test:999001');
    expect(res.headers.location).toBe('/v1/restaurants/test:999001');
    expect(res.body.name).toBe('Saravana Bhavan');
    expect(res.body.country).toBe('India');
    expect(res.body.pricing.currencyCode).toBe('INR');
    expect(res.body.rating.weighted).toBeGreaterThan(0);
  });

  it('rejects an invalid body with 422', async () => {
    const { name: _omit, ...noName } = validBody;
    const res = await request(app).post('/v1/restaurants').send(noName);
    expect(res.status).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.errors).toBeDefined();
  });

  it('rejects a duplicate source with 409', async () => {
    await request(app).post('/v1/restaurants').send(validBody);
    const res = await request(app).post('/v1/restaurants').send(validBody);
    expect(res.status).toBe(409);
  });
});

describe('GET /v1/restaurants/:id', () => {
  it('returns the full restaurant by id', async () => {
    const created = await request(app).post('/v1/restaurants').send(validBody);
    const res = await request(app).get(`/v1/restaurants/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.location).toEqual({ lng: 77.09, lat: 28.49 });
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/v1/restaurants/not-an-id');
    expect(res.status).toBe(400);
  });

  it('returns 404 for a missing id', async () => {
    const res = await request(app).get('/v1/restaurants/test:404404');
    expect(res.status).toBe(404);
  });
});
