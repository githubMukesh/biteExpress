import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import AdmZip from 'adm-zip';

const FULL_DATA = 'data/zomato.csv';
const FIXTURE = 'fixtures/zomato.sample.csv';
const CACHE = join(tmpdir(), 'biteexpress-zomato.csv');
const KAGGLE_URL =
  'https://www.kaggle.com/api/v1/datasets/download/shrutimehta/zomato-restaurants-data';
const DOWNLOAD_TIMEOUT_MS = 30_000;

export type TDatasetSource = 'host' | 'downloaded' | 'downloaded (cached)' | 'fixture';

export interface IDataset {
  path: string;
  source: TDatasetSource;
}

// Kaggle allows anonymous downloads for this public dataset, but can change that
// or be unreachable, so a failure falls back to the committed fixture.
async function tryDownload(dest: string): Promise<boolean> {
  try {
    const res = await fetch(KAGGLE_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return false; // not a zip (PK)
    const entry = new AdmZip(buf).getEntry('zomato.csv');
    if (!entry) return false;
    writeFileSync(dest, entry.getData());
    return true;
  } catch {
    return false;
  }
}

// Resolution order: a pre-provided data/zomato.csv → a Kaggle download (cached in
// tmp) → the committed 50-row fixture.
export async function resolveDataset(log: (msg: string) => void): Promise<IDataset> {
  const host = resolve(process.cwd(), FULL_DATA);
  if (existsSync(host)) return { path: host, source: 'host' };
  if (existsSync(CACHE)) return { path: CACHE, source: 'downloaded (cached)' };

  log('data/zomato.csv not found — downloading the full dataset from Kaggle...');
  if (await tryDownload(CACHE)) return { path: CACHE, source: 'downloaded' };

  log('Kaggle download unavailable — falling back to the committed fixture.');
  return { path: resolve(process.cwd(), FIXTURE), source: 'fixture' };
}
