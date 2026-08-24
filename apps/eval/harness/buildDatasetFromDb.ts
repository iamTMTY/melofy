// Rebuild the eval dataset from the translations already cached in MongoDB.
//
// These are real, production translations produced by the app's current model
// (google/gemini-flash-latest — "Gemini Flash"), which we're now treating as the
// BASE reference set: source_lines = the original lyric lines, reference_lines =
// Gemini's translation. Re-runnable as the cache grows ("add more later").
//
//   pnpm eval:dataset:from-db
//
// Reads MONGO_URI + OPENAI_MODEL from the repo-root .env (see env.ts). The old
// dataset.json is backed up to dataset.json.bak before it's overwritten.
//
// NOTE: because the references are Gemini's own output, evaluating Gemini against
// this set is somewhat circular (it's scored against itself) — the value is in
// (a) comparing OTHER models against a strong, real baseline and (b) giving human
// reviewers a concrete set to correct into true gold. `reviewed: false` marks
// every entry as model-seeded, not yet human-verified.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { envGet } from './env.ts';
import type { DatasetEntry } from './types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../dataset/dataset.json');

// Language code → display name, for the dashboard's per-language grouping + the
// judge's context line. Extend as the dataset grows.
const CODE_TO_NAME: Record<string, string> = {
  en: 'English',
  yo: 'Yoruba',
  ig: 'Igbo',
  ha: 'Hausa',
  sw: 'Swahili',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  ar: 'Arabic',
  bm: 'Bambara',
  pcm: 'Nigerian Pidgin',
};

interface CachedDoc {
  artist: string;
  title: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  flaggedInaccurate?: boolean;
  lyrics?: { index: number; original: string; translated: string }[];
}

function slug(s: string): string {
  return s
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function main() {
  const uri = envGet('MONGO_URI') || 'mongodb://localhost:27018/melofy';
  const model = envGet('OPENAI_MODEL') || 'google/gemini-flash-latest';

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const docs = (await client
      .db()
      .collection('cachedtranslations')
      .find({ flaggedInaccurate: { $ne: true } })
      .sort({ createdAt: 1 })
      .toArray()) as unknown as CachedDoc[];

    const entries: DatasetEntry[] = docs
      .filter((d) => Array.isArray(d.lyrics) && d.lyrics.length > 0)
      .map((d, i) => {
        const lyrics = [...d.lyrics!].sort((a, b) => a.index - b.index);
        const code = (d.sourceLanguage || 'unknown').toLowerCase();
        return {
          id: `db-${String(i + 1).padStart(3, '0')}-${slug(d.artist)}-${slug(d.title)}`,
          language: CODE_TO_NAME[code] || d.sourceLanguage || 'unknown',
          code,
          artist: d.artist,
          title: d.title,
          source_lines: lyrics.map((l) => l.original),
          reference_lines: lyrics.map((l) => l.translated),
          brief: null,
          generator_model: model,
          reviewed: false, // model-seeded reference, not yet human-verified
          reviewer: null,
        } satisfies DatasetEntry;
      });

    if (entries.length === 0) {
      console.error('No usable cached translations found in MongoDB — dataset left unchanged.');
      process.exit(1);
    }

    if (fs.existsSync(OUT)) {
      fs.copyFileSync(OUT, `${OUT}.bak`);
      console.log(`Backed up existing dataset → ${path.basename(OUT)}.bak`);
    }
    fs.writeFileSync(OUT, JSON.stringify(entries, null, 2));

    const langs = [...new Set(entries.map((e) => e.language))];
    console.log(`Wrote ${entries.length} entries to ${path.basename(OUT)} (references from ${model}).`);
    console.log(`Languages: ${langs.join(', ')}`);
    console.log('All entries reviewed=false — correct them into gold, then flip reviewed=true.');
  } finally {
    await client.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('dataset:from-db failed:', err?.message || err);
  process.exit(1);
});
