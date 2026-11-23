import type { AnyBulkWriteOperation } from 'mongodb';
import { loadConfig } from '../config.js';
import { createMongo } from '../db/client.js';
import { ensureSchema } from '../db/bootstrap.js';
import { RESTAURANTS_COLLECTION } from '../db/validator.js';
import type { IRestaurantDoc } from '../domain/restaurant.js';
import { resolveCurrency } from '../domain/reference.js';
import { loadRestaurantCsv } from './csv.js';
import { computeGlobalMean, rowToRestaurant } from './transform.js';

const BATCH_SIZE = 1000;

interface IReport {
  read: number;
  upserted: number;
  modified: number;
  skipped: number;
  coord: Record<string, number>;
  missingCuisines: number;
  unrated: number;
  unknownPrice: number;
  currencyAnomaly: number;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const encoding = (process.env.SEED_ENCODING as BufferEncoding) ?? 'latin1';

  const { rows, sourcePath, usedFixture } = loadRestaurantCsv(encoding);
  console.log(`Seeding from ${sourcePath}${usedFixture ? ' (fixture)' : ''} — ${rows.length} rows`);

  const globalMean = computeGlobalMean(rows);
  const now = new Date();

  const report: IReport = {
    read: rows.length,
    upserted: 0,
    modified: 0,
    skipped: 0,
    coord: {},
    missingCuisines: 0,
    unrated: 0,
    unknownPrice: 0,
    currencyAnomaly: 0,
  };

  const ops: AnyBulkWriteOperation<IRestaurantDoc>[] = [];
  for (const row of rows) {
    let result;
    try {
      result = rowToRestaurant(row, { tenantId: config.TENANT_ID, globalMean, now });
    } catch (err) {
      report.skipped += 1;
      console.warn(`Skipped row ${row['Restaurant ID']}: ${(err as Error).message}`);
      continue;
    }

    const { doc, coordinateStatus } = result;
    report.coord[coordinateStatus] = (report.coord[coordinateStatus] ?? 0) + 1;
    if (doc.cuisines.length === 0) report.missingCuisines += 1;
    if (!doc.rating.ratingAvailable) report.unrated += 1;
    if (!doc.pricing.priceAvailable) report.unknownPrice += 1;
    if (resolveCurrency(doc.countryCode).anomaly) report.currencyAnomaly += 1;

    const { _id, createdAt, ...rest } = doc;
    ops.push({
      updateOne: {
        filter: { _id },
        update: { $set: rest, $setOnInsert: { createdAt } },
        upsert: true,
      },
    });
  }

  const mongo = await createMongo(config);
  try {
    await ensureSchema(mongo.db);
    const col = mongo.db.collection<IRestaurantDoc>(RESTAURANTS_COLLECTION);

    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const batch = ops.slice(i, i + BATCH_SIZE);
      const res = await col.bulkWrite(batch, { ordered: false });
      report.upserted += res.upsertedCount;
      report.modified += res.modifiedCount;
    }
  } finally {
    await mongo.client.close();
  }

  console.log('\nData-quality report');
  console.table({
    rowsRead: report.read,
    inserted: report.upserted,
    updated: report.modified,
    skipped: report.skipped,
    locatedOk: report.coord.ok ?? 0,
    coordMissing: report.coord.missing ?? 0,
    coordZero: report.coord.zero ?? 0,
    coordPartialZero: report.coord['partial-zero'] ?? 0,
    coordOutOfRange: report.coord['out-of-range'] ?? 0,
    missingCuisines: report.missingCuisines,
    unrated: report.unrated,
    unknownPrice: report.unknownPrice,
    currencyAnomaly: report.currencyAnomaly,
  });
}

main().catch((err) => {
  console.error('seed failed', err);
  process.exit(1);
});
