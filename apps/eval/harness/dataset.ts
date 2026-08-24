import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatasetEntry } from './types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../dataset/dataset.json'); // apps/eval/harness -> apps/eval/dataset

export function loadDataset(): DatasetEntry[] {
  if (!fs.existsSync(DATA)) {
    throw new Error(
      `dataset not found at ${DATA}. Build it from the cached translations with ` +
        `\`pnpm eval:dataset:from-db\`.`
    );
  }
  return JSON.parse(fs.readFileSync(DATA, 'utf8')) as DatasetEntry[];
}

export interface LanguageStat {
  language: string;
  code: string;
  total: number;
  withReference: number;
  reviewed: number;
}

export function datasetSummary(data: DatasetEntry[]) {
  const byLang = new Map<string, LanguageStat>();
  for (const e of data) {
    const s =
      byLang.get(e.language) ??
      { language: e.language, code: e.code, total: 0, withReference: 0, reviewed: 0 };
    s.total += 1;
    if (e.reference_lines && e.reference_lines.length) s.withReference += 1;
    if (e.reviewed) s.reviewed += 1;
    byLang.set(e.language, s);
  }
  const languages = [...byLang.values()].sort((a, b) => a.language.localeCompare(b.language));
  return {
    songs: data.length,
    languages,
    totalWithReference: data.filter((e) => e.reference_lines && e.reference_lines.length).length,
    totalReviewed: data.filter((e) => e.reviewed).length,
  };
}
