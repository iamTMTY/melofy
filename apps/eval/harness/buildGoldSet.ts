// Build the reviewer gold set: fetch the hand-picked songs from LRCLIB by their
// EXACT track id, draft an English translation with the PRODUCT engine (two-step
// brief → line translation, via /api/eval/translate), and emit both
//   · dataset/dataset.json  — upserted entries for the eval harness / Langfuse
//   · dataset/gold/<id>.txt — one review sheet per song for human reviewers
//
//   pnpm --filter @melofy/eval gold:build
//
// Requires the web app running locally (the engine lives behind its dev-only
// eval endpoint), i.e. `pnpm --filter @melofy/web dev` on :3009.
//
// Track ids are pinned deliberately: LRCLIB search ranking drifts, and several
// of these songs have multiple masters whose timings differ. A pinned id makes
// the gold set reproducible.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { envGet } from './env.ts';
import { translateViaProduct } from './translate.ts';
import type { DatasetEntry } from './types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATASET = path.resolve(HERE, '../dataset/dataset.json');
const GOLD_DIR = path.resolve(HERE, '../dataset/gold');

interface Song {
  lrclibId: number;
  language: string;
  code: string;
  artist: string;
  title: string;
}

// Verified present and synced on LRCLIB (checked before pinning).
const SONGS: Song[] = [
  // --- Yoruba ---
  { lrclibId: 5687021, language: 'Yoruba', code: 'yo', artist: 'Brymo', title: 'Ọkùnrin Mẹ́ta (Ẹ̀dùn Ọkàn)' },
  { lrclibId: 9919001, language: 'Yoruba', code: 'yo', artist: 'Teledalase', title: 'Eledumare' },
  { lrclibId: 17230407, language: 'Yoruba', code: 'yo', artist: 'Sola Allyson', title: 'Eji Owuro' },
  { lrclibId: 11279307, language: 'Yoruba', code: 'yo', artist: 'King Sunny Ade', title: 'Merciful God' },
  { lrclibId: 9854564, language: 'Yoruba', code: 'yo', artist: 'Beautiful Nubia', title: "How do you do? (Owuro L'ojo)" },
  // --- Swahili ---
  { lrclibId: 9715649, language: 'Swahili', code: 'sw', artist: 'Sauti Sol', title: 'Tujiangalie' },
  { lrclibId: 7532759, language: 'Swahili', code: 'sw', artist: 'Mbosso', title: 'Nadekezwa' },
  { lrclibId: 14094907, language: 'Swahili', code: 'sw', artist: 'Ruby', title: 'Na Yule' },
  { lrclibId: 36755218, language: 'Swahili', code: 'sw', artist: 'Sauti Sol', title: 'Kuliko Jana' },
  { lrclibId: 3187169, language: 'Swahili', code: 'sw', artist: 'Alikiba', title: 'Mahaba' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripTimecode = (l: string) => l.replace(/^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*/, '').trim();
const deaccent = (s: string) => s.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
const slug = (s: string) =>
  deaccent(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** LRCLIB answers 503 ServerOverloaded under load — back off rather than drop a song. */
async function fetchTrack(id: number, tries = 5): Promise<any | null> {
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(`https://lrclib.net/api/get/${id}`, {
        headers: { 'User-Agent': 'melofy-eval-goldset (github.com/melofy)' },
      });
      if (r.ok) {
        const d: any = await r.json();
        if (d && !d.statusCode) return d;
      }
    } catch {
      /* retry */
    }
    await sleep(2000 * (a + 1));
  }
  return null;
}

/** One review sheet per song, in the existing dataset/gold/*.txt convention. */
function reviewSheet(entry: DatasetEntry, song: Song, model: string): string {
  const bar = '# ' + '='.repeat(69);
  const head = [
    bar,
    `# ${entry.id}  |  ${song.language}  |  ${song.artist} - ${song.title}`,
    `# LRCLIB track ${song.lrclibId}  |  drafted by ${model} (Melofy two-step engine)`,
    bar,
    '#',
    '# HOW TO FILL THIS IN',
    '#',
    '#   EN:    your translation. ONE English line per SRC: line. This becomes',
    '#          the gold reference. Leave blank if unsure — better an outstanding',
    '#          line than a guess.',
    '#   NOTE:  optional. Slang, idiom, wordplay, double meaning, cultural',
    '#          reference, or "the draft is wrong because...". These are the most',
    '#          valuable thing in this file (see GLOSSARY below).',
    '#   MEL:   what Melofy currently produces, FOR REFERENCE ONLY. It is often',
    '#          wrong on slang and proverbs. Do not anchor on it.',
    '#',
    '#   Do NOT edit SRC: lines or the [n] markers — the merge step matches on them.',
    '#',
    '# TIP: the glossary is worth more than the line translations. A corrected',
    '# glossary feeds straight back into the translator as prior knowledge.',
    '',
    '<<<GLOSSARY',
    '# Slang, idiom, proverb and cultural reference in THIS song.',
    '# One entry per line:    term :: meaning',
    '# Add every term a non-native listener would miss. Blank if genuinely none.',
    'GLOSSARY>>>',
    '',
    '',
  ].join('\n');

  const body = entry.source_lines
    .map((src, i) => {
      const mel = entry.reference_lines?.[i] ?? '';
      return `[${i + 1}]\nSRC: ${src}\nMEL: ${mel}\nEN: \nNOTE: \n`;
    })
    .join('\n');

  return `${head}${body}`;
}

async function main() {
  const productUrl = envGet('EVAL_PRODUCT_URL') || 'http://localhost:3009';
  const model = envGet('OPENAI_MODEL') || 'google/gemini-3.7-flash';

  console.log(`Engine : ${productUrl}/api/eval/translate`);
  console.log(`Model  : ${model}\n`);

  const built: DatasetEntry[] = [];
  const failures: string[] = [];

  let i = 0;
  for (const song of SONGS) {
    i++;
    const label = `[${i}/${SONGS.length}] ${song.language} — ${song.artist} — ${song.title}`;
    process.stdout.write(`${label} … `);

    const track = await fetchTrack(song.lrclibId);
    if (!track) {
      console.log('LRCLIB FAILED');
      failures.push(`${label}: LRCLIB unreachable`);
      continue;
    }
    const raw: string = track.syncedLyrics || track.plainLyrics || '';
    const source_lines = raw.split('\n').map(stripTimecode).filter(Boolean);
    if (source_lines.length < 4) {
      console.log('NO USABLE LYRICS');
      failures.push(`${label}: no usable lyrics on track ${song.lrclibId}`);
      continue;
    }

    const entry: DatasetEntry = {
      id: `gold-${song.code}-${slug(song.artist)}-${slug(song.title)}`,
      language: song.language,
      code: song.code,
      artist: song.artist,
      title: song.title,
      source_lines,
      reference_lines: null,
      brief: null,
      generator_model: model,
      reviewed: false,
      reviewer: null,
    };

    try {
      const translated = await translateViaProduct(
        productUrl,
        source_lines,
        'English',
        model,
        song.artist,
        song.title
      );
      entry.reference_lines = translated;
      const aligned = translated.length === source_lines.length;
      console.log(
        `OK — ${source_lines.length} lines${aligned ? '' : ` ⚠ draft has ${translated.length}`}`
      );
      if (!aligned) failures.push(`${label}: line-count mismatch (${source_lines.length} vs ${translated.length})`);
    } catch (err: any) {
      // Keep the source lyrics either way — they're the hard part to re-obtain.
      entry.reference_lines = [];
      console.log(`draft FAILED (${err?.message || err}) — source kept`);
      failures.push(`${label}: ${err?.message || err}`);
    }

    built.push(entry);
    await sleep(800);
  }

  // --- upsert into dataset.json (never clobber a reviewed entry) -----------
  const existing: DatasetEntry[] = fs.existsSync(DATASET)
    ? JSON.parse(fs.readFileSync(DATASET, 'utf8'))
    : [];
  const byId = new Map(existing.map((e) => [e.id, e]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const e of built) {
    const prev = byId.get(e.id);
    if (prev?.reviewed) {
      skipped++; // a human already corrected this one — leave it alone
      continue;
    }
    if (prev) updated++;
    else added++;
    byId.set(e.id, e);
  }
  const merged = [...byId.values()];
  fs.writeFileSync(DATASET, JSON.stringify(merged, null, 2));

  // --- review sheets -------------------------------------------------------
  // NEVER clobber a sheet that exists: it may hold hours of a reviewer's work,
  // and a half-filled sheet is not marked `reviewed` anywhere, so checking the
  // dataset flag alone would still destroy in-progress annotation. Overwriting
  // requires an explicit --force.
  const force = process.argv.includes('--force');
  fs.mkdirSync(GOLD_DIR, { recursive: true });
  let sheetsWritten = 0;
  const sheetsKept: string[] = [];
  for (const e of built) {
    const song = SONGS.find((s) => `gold-${s.code}-${slug(s.artist)}-${slug(s.title)}` === e.id)!;
    const file = path.join(GOLD_DIR, `${e.id}.txt`);
    if (fs.existsSync(file) && !force) {
      sheetsKept.push(e.id);
      continue;
    }
    fs.writeFileSync(file, reviewSheet(e, song, model));
    sheetsWritten++;
  }

  console.log('\n=================== GOLD SET ===================');
  console.log(`songs built   : ${built.length}/${SONGS.length}`);
  console.log(`dataset.json  : +${added} new, ${updated} updated, ${skipped} skipped (already reviewed) → ${merged.length} total`);
  console.log(`review sheets : ${sheetsWritten} written → dataset/gold/`);
  if (sheetsKept.length) {
    console.log(`                ${sheetsKept.length} kept (already on disk; --force to overwrite)`);
    for (const id of sheetsKept) console.log(`                  · ${id}.txt`);
  }
  const lines = built.reduce((n, e) => n + e.source_lines.length, 0);
  console.log(`source lines  : ${lines}`);
  if (failures.length) {
    console.log(`\n⚠ ${failures.length} issue(s):`);
    for (const f of failures) console.log(`   - ${f}`);
  }
  console.log('\nNext: pnpm --filter @melofy/eval dataset:sync   (push to Langfuse)');
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error('buildGoldSet failed:', err?.message || err);
  process.exit(1);
});
