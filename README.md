# BiteExpress Restaurant Discovery API

A containerized REST API for restaurant discovery, built on MongoDB as the operational datastore. It powers the customer-facing discovery surface — create a restaurant, fetch one by id, and list/search with filtering, sorting, geo-distance and natural-language queries.

Stack: **Node.js 22 · TypeScript (strict) · Express 5 · MongoDB 8 · Zod · Vitest**, no ODM.

---

## Running the app

Pick one of three ways. They're independent tools — **Make is only a shortcut that runs the Docker or npm commands below**, so you never _need_ it. The API serves on **http://localhost:3000**, seeded and ready.

### Option 1 — Docker Compose (recommended; runs MongoDB + seed + API in containers)

```bash
# Self-managed MongoDB (mongo:8)
docker compose up --build

# Atlas (atlas-local) — adds fuzzy $search
docker compose -f docker-compose.yml -f docker-compose.search.yml up --build

# Stop and clean (either engine)
docker compose down -v
```

> **Restarting the Atlas engine:** atlas-local must initialize fresh each run. `Ctrl+C` only *stops* containers, so a plain re-`up` reuses stale replica-set state and can fail to start. When re-running the Atlas engine, either `docker compose … down -v` first, or add `--force-recreate --renew-anon-volumes` to the `up`. **`make mongo-atlas` does this for you** — prefer Option 2. (`mongo:8` is unaffected.)

### Option 2 — Make (resets first, then runs the commands above)

`make` reads the `Makefile`; each target runs the matching Docker/npm command — and the engine targets **tear down first** so Atlas always initializes cleanly, whatever the previous run did. Standard on macOS/Linux.

| Command | Runs |
|---------|------|
| `make mongo-local` | `docker compose down -v` → `docker compose up --build` |
| `make mongo-atlas` | `docker compose -f … -f docker-compose.search.yml down -v` → `up --build` |
| `make down` | `docker compose down -v --remove-orphans` |
| `make seed` | `npm run build && npm run seed` |
| `make test` / `make lint` / `make typecheck` | `npm test` / `npm run lint` / `npm run typecheck` |

### Option 3 — Node / npm (no Docker; needs your own MongoDB)

Requires Node 22+ and a MongoDB at `mongodb://127.0.0.1:27017` (override via `MONGODB_URI`).

```bash
npm install
npm run build
npm run seed        # full data/zomato.csv if present, else the committed fixture
npm start           # or: npm run dev  (hot reload)
```

No `.env` is required — sensible defaults are built in (see `.env.example` to override).

### Verify (any option)

```bash
curl localhost:3000/healthz                   # {"status":"ok"}
curl localhost:3000/readyz                    # {"status":"ready","mongodb":"ok"}
curl 'localhost:3000/v1/restaurants?limit=3'
```

All options seed automatically — the full 9,551-row dataset when `data/zomato.csv` is present (see **Data**), else a committed 50-row fixture.

### About the Atlas option (fuzzy search)

By default (`mongo:8`), `/search` uses the rule-based parser with anchored-prefix name matching. The Atlas option sets `SEARCH_ENGINE=atlas`, which routes the parser's residual free text through a fuzzy Atlas `$search` index — so typos still match (e.g. "Prankstar" → "Prankster"). The structured part of every query (city, cuisine, price, "nearest") is unchanged. The `$search` index builds asynchronously; give it a few seconds after the API is ready. Both engines keep their own data volume, so no `down -v` is needed when switching.

### Self-managed vs Atlas (DBaaS)

The two images aren't just "with and without fuzzy search" — they model the migration in the brief, running the **same application code** on both:

| | `mongo:8` (`make mongo-local`) | `atlas-local` (`make mongo-atlas`) |
|---|---|---|
| Represents | self-managed MongoDB (today's on-prem setup) | **Atlas — MongoDB as a managed service** |
| Search | app-level parser + prefix match | **Atlas Search** (`mongot`) built in |
| Switch | `SEARCH_ENGINE=basic` | `SEARCH_ENGINE=atlas` — app code unchanged |

Flipping one flag lights up a managed capability with zero application changes — the point of a DBaaS, and the "additive, not a rewrite" story behind the brief's cloud-native goal. Atlas Search is the visible slice; the same argument extends to Vector Search, dedicated Search Nodes, change-stream triggers, backups, and auto-scaling.

---

## Data

The **full 9,551-row dataset loads by default.** The seed resolves its source in order:

1. **`data/zomato.csv`** if present (committed? no — gitignored; e.g. you pre-downloaded or mounted it)
2. **Download from Kaggle** — cached in a temp dir, done automatically when 1 is missing
3. **Committed 50-row fixture** (`fixtures/zomato.sample.csv`) if the download is unavailable — keeps it fully **offline-capable**

So `docker compose up` seeds all 9,551 rows when online, and still works offline with the fixture. The seed is idempotent (upserts on a deterministic `_id`) and logs which source it used plus a data-quality report (rows read, located, coordinate issues, unrated, unknown price, currency anomalies).

Pre-download to avoid the per-seed fetch (optional — populates the gitignored `data/`):

```bash
./scripts/download-data.sh
```

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

### Try it in Postman

Import [`BiteExpress.postman_collection.json`](./BiteExpress.postman_collection.json) (Postman → Import). It has 24 requests across Health / CRUD / List / Search, with the `baseUrl` variable defaulting to `http://localhost:3000`.

Run the requests top-to-bottom, or use the **Collection Runner** — most requests carry test assertions (status codes, derived `country`/`currencyCode`, nearest-first `distanceKm`, the parser's `interpretedQuery`), so the whole collection self-checks. "POST create" generates a fresh id and the Get-by-id / Duplicate requests reuse it. The fuzzy-search request auto-detects the engine and only asserts a typo match when running on atlas-local (`make mongo-atlas`).

---

## Testing

```bash
npm test          # 61 unit + integration tests
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

## Resources & disclosure

- **AI coding assistant** — used during development.
- **MongoDB documentation and best-practice guidance** (schema design, indexing, connection handling) informed the data model and index choices.
- **Dataset** — the public Zomato Restaurants dataset (Kaggle).
