import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import type { IRawRow } from './transform.js';

// The supplied CSV is Latin-1, not UTF-8 clean; the committed fixture is ASCII,
// so Latin-1 reads both correctly.
export function loadCsv(path: string, encoding: BufferEncoding = 'latin1'): IRawRow[] {
  const content = readFileSync(path, encoding);
  return parse(content, { columns: true, skip_empty_lines: true }) as IRawRow[];
}
