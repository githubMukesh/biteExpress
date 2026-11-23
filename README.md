# BiteExpress Restaurant Discovery API

A containerized REST API for restaurant discovery, built on MongoDB as the operational datastore. It powers the customer-facing discovery surface — create a restaurant, fetch one by id, and list/search with filtering, sorting, geo-distance and natural-language queries.

Stack: **Node.js 22 · TypeScript (strict) · Express 5 · MongoDB 8 · Zod · Vitest**, no ODM.

---

## Quick start (one command)

Requires Docker.

```bash
docker compose up --build
```

This starts MongoDB, runs a one-shot seed job, then starts the API on **http://localhost:3000**. The seed loads a committed 50-row sample, so this works fully offline.

Verify:

```bash
curl localhost:3000/healthz        # {"status":"ok"}
curl localhost:3000/readyz         # {"status":"ready","mongodb":"ok"}
curl localhost:3000/v1/restaurants?limit=3
```

Tear down (also clears the data volume):

```bash
docker compose down -v
```

### Optional: Atlas Search engine

To run against `mongodb-atlas-local` (bundles Atlas Search for the search stretch) instead of plain MongoDB:

```bash
make up-search
# equivalently:
docker compose -f docker-compose.yml -f docker-compose.search.yml up --build
```

Run `docker compose down -v` when switching engines so the data volume isn't shared between two different server builds.

---

## Running locally (without Docker)

Requires Node 22+ and a MongoDB reachable at `mongodb://127.0.0.1:27017` (override with `MONGODB_URI`).

```bash
npm install
npm run build
npm run seed        # loads data/zomato.csv if present, else the committed fixture
npm start           # http://localhost:3000
```

Hot-reload during development:

```bash
npm run dev
```

No `.env` is required — sensible defaults are built in (see `.env.example` for overrides).

---

## Data

The seed prefers the full dataset and falls back to a committed sample:

| Path | Committed | Rows | Used when |
|------|-----------|------|-----------|
| `fixtures/zomato.sample.csv` | yes | 50 | `data/zomato.csv` is absent (Docker default) |
| `data/zomato.csv` | no (gitignored) | 9,551 | present after running the download script |

To seed the full dataset:

```bash
./scripts/download-data.sh      # downloads + unzips into data/ (gitignored)
npm run seed                    # re-seed; idempotent
```

The seed is idempotent (upserts on a deterministic `_id`) and prints a data-quality report (rows read, located, coordinate issues, unrated, unknown price, currency anomalies).

---

## API

Base path: `/v1/restaurants`. Errors use RFC 9457 `application/problem+json`.

### `POST /v1/restaurants`

Creates a restaurant and returns the created entity (`201`, with a `Location` header). `409` on duplicate, `422` on an invalid body.

```bash
curl -X POST localhost:3000/v1/restaurants \
  -H 'content-type: application/json' \
  -d '{
    "name": "Saravana Bhavan",
    "address": { "line": "DLF Phase 3", "locality": "DLF Phase 3" },
    "city": "Gurgaon",
    "countryCode": 1,
    "location": { "lng": 77.09, "lat": 28.49 },
    "cuisines": ["South Indian"],
    "pricing": { "costForTwo": 500, "currencySourceLabel": "Indian Rupees(Rs.)" },
    "rating": { "average": 4.3, "votes": 350 },
    "source": { "system": "manual", "sourceId": 42 }
  }'
```

`name`, `address.line`, `city` and `countryCode` are required; everything else is optional. `country`, `currencyCode` and the weighted rating are derived server-side; `source.sourceId` is auto-generated if omitted.

### `GET /v1/restaurants/{id}`

Full details for one restaurant. The id is `source.system:sourceId` (e.g. `zomato_sample:6317637`). `400` on a malformed id, `404` when missing.

```bash
curl localhost:3000/v1/restaurants/zomato_sample:6317637
```

### `GET /v1/restaurants`

Filter, sort and paginate. Returns `{ items, page, limit, hasNext }`. Each item carries `id, name, address, city, country, cuisines, averageRating` and `distanceKm` (only when coordinates are supplied).

| Parameter | Meaning |
|-----------|---------|
| `name` | case-insensitive prefix match |
| `city` | exact match after normalization + alias mapping (e.g. gurugram → gurgaon) |
| `cuisines` | comma-separated; `cuisine_match=any` (default) or `all` |
| `min_rating` | minimum average rating, 0–5 (excludes unrated) |
| `max_cost_for_two` | upper price bound (excludes unknown-price rows) |
| `lat`, `lng`, `radius_km` | distance origin; `radius_km` optional |
| `sort` | `distance` \| `rating` \| `name` \| `cost` + `order=asc\|desc`; default distance when coords present, else rating |
| `page`, `limit` | defaults 1 and 20; `limit` capped at 100 |

```bash
curl 'localhost:3000/v1/restaurants?city=Gurgaon&cuisines=South%20Indian&min_rating=4&sort=rating'
curl 'localhost:3000/v1/restaurants?lat=28.49&lng=77.09&radius_km=2&limit=5'
```

### `GET /v1/restaurants/search`

Everything the list endpoint does, plus a free-text `q` parsed into the same structured query. The response adds `interpretedQuery` so the caller sees how `q` was understood. `400` when a "nearest" query is given without coordinates.

```bash
curl -G localhost:3000/v1/restaurants/search \
  --data-urlencode 'q=Best restaurants in Gurgaon with South Indian Food'

curl -G localhost:3000/v1/restaurants/search \
  --data-urlencode 'q=Nearest place that serves Vada Pav' \
  --data-urlencode 'lat=28.49' --data-urlencode 'lng=77.09'
```

Explicit query parameters always override the parsed interpretation.

### Health

`GET /healthz` (process alive) and `GET /readyz` (pings MongoDB) for orchestrators and load balancers.

---

## Testing

```bash
npm test          # 56 unit + integration tests
npm run lint
npm run typecheck
```

Integration tests run against a real MongoDB (the one at `MONGODB_URI`) using isolated databases that are dropped afterward. Unit tests cover the data-cleaning rules, the query builder, and the NL parser (including the three example queries from the brief).

---

## Design notes

- **Document model.** One `restaurants` document per restaurant, shaped for the discovery read path so a list needs no `$lookup`. Address, pricing, flags and rating summary are embedded; unbounded data (reviews, menus) would be separate collections.
- **Deterministic `_id`.** `_id = tenantId:source.system:sourceId`, so a duplicate insert collides on the mandatory `_id` index (no separate unique index) and the seed is idempotent. The API exposes `source.system:sourceId` — the tenant stays server-side.
- **Indexes per query shape.** `2dsphere` for geo, plus compound indexes following Equality → Sort → Range with `_id` last for stable pagination. Validated with `explain()` (no COLLSCAN on the covered shapes).
- **Weighted rating.** A Bayesian score pulls low-vote restaurants toward the global mean, so a 5.0 with 3 votes doesn't outrank a 4.7 with thousands. Unrated rows (source rating 0) are ranked separately.
- **Data quality.** Coordinates are stored as GeoJSON `[lng, lat]`; `(0,0)` rows get no location; the Philippines currency anomaly (rows labelled "Botswana Pula") is flagged, never rewritten.
- **Validation layers.** Zod at the API boundary (`422`), a TypeScript document type at compile time, and a MongoDB JSON Schema validator (`validationAction: error`) as the runtime guard.
- **NL search.** A deterministic, rules-first parser (city/cuisine gazetteers built from the data, intent cues, a dish→cuisine map) keeps the demo offline and explainable. The `QueryParser` seam lets Atlas Search or an LLM slot in later for fuzzy/semantic queries.
- **Connections.** One `MongoClient` per process with explicit pool sizes and timeouts; `maxTimeMS` on queries so a slow request can't hold a connection during a traffic spike.

---

## Project structure

```
src/
  server.ts            entry: load config, connect, ensureSchema, listen, graceful shutdown
  app.ts               Express app factory (reused by tests)
  config.ts            Zod-validated environment
  routes/              health + v1/restaurants
  services/            restaurantService, nlParser
  repositories/        restaurantRepo, queryBuilder
  schemas/             Zod request schemas
  db/                  client, validator, indexes, bootstrap
  domain/              restaurant model, normalization, reference data
  seed/                CSV load, transform, runner
test/                  unit + integration
fixtures/              committed 50-row sample
scripts/               download-data.sh
```

---

## AI & resource disclosure

Per the assessment's integrity guidance:

- **Claude Code** (Anthropic) was used as a coding assistant throughout — scaffolding, drafting implementation and tests, and iterating on design. All decisions were reviewed and are owned by me, and I can explain and change any part.
- The implementation follows a personal technical plan informed by **MongoDB's documentation** and the **mongodb/agent-skills** guidance (schema design, query optimization, connection handling, search).
- The dataset is the public **Zomato Restaurants** dataset (Kaggle).
