import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import type { IRawRow } from './transform.js';

const FULL_DATA = 'data/zomato.csv';
const FIXTURE = 'fixtures/zomato.sample.csv';

export interface ILoadedCsv {
  rows: IRawRow[];
  sourcePath: string;
  usedFixture: boolean;
}

// The supplied CSV is Latin-1, not UTF-8 clean; the committed fixture is ASCII,
// so Latin-1 reads both correctly.
export function loadRestaurantCsv(encoding: BufferEncoding = 'latin1'): ILoadedCsv {
  const full = resolve(process.cwd(), FULL_DATA);
  const usedFixture = !existsSync(full);
  const sourcePath = usedFixture ? resolve(process.cwd(), FIXTURE) : full;

  const content = readFileSync(sourcePath, encoding);
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as IRawRow[];

  return { rows, sourcePath, usedFixture };
}
