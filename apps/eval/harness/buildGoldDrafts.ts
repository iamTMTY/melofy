// Fetch lyrics (LRCLIB) for a hand-picked gold-set song list and produce Gemini
// DRAFT English translations for human reviewers to correct into gold references.
//
//   pnpm --filter @melofy/eval exec tsx harness/buildGoldDrafts.ts
//
// Writes apps/eval/dataset/gold-drafts.json (DatasetEntry[], reviewed:false) for
// the songs whose lyrics were found, and prints a coverage report (found vs
// missing) so you know which songs to source lyrics for manually.
//
// NOTE: LRCLIB is crowd-sourced and sparse on indigenous African music — expect
// misses for traditional Hausa/Igbo. For a miss, paste the lyrics and we'll draft
// those separately.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { envGet } from './env.ts';
import type { DatasetEntry } from './types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../dataset/gold-drafts.json');

interface Song {
  language: string;
  code: string;
  artist: string;
  title: string;
}

// Primary picks from the provided list. Feature credits trimmed to the primary
// artist (how LRCLIB indexes). Yoruba is short (list only named Brymo tracks).
const SONGS: Song[] = [
  // Yoruba (short — needs ~2 more to reach 5)
  { language: 'Yoruba', code: 'yo', artist: 'Brymo', title: 'Gbegiri' },
  { language: 'Yoruba', code: 'yo', artist: 'Brymo', title: 'Obej Kun' },
  { language: 'Yoruba', code: 'yo', artist: 'Brymo', title: 'Good Morning' },
  // Swahili
  { language: 'Swahili', code: 'sw', artist: 'Alikiba', title: 'Mfalme' },
  { language: 'Swahili', code: 'sw', artist: 'Jux', title: 'Acha Aisee' },
  { language: 'Swahili', code: 'sw', artist: 'Alikiba', title: 'Utatubu' },
  { language: 'Swahili', code: 'sw', artist: 'Alikiba', title: 'Mwana' },
  { language: 'Swahili', code: 'sw', artist: 'Jay Melody', title: 'Nakupenda' },
  // Hausa
  { language: 'Hausa', code: 'ha', artist: 'Hamisu Breaker', title: 'Jaruma' },
  { language: 'Hausa', code: 'ha', artist: 'Hamisu Breaker', title: 'Bani da Damuwa' },
  { language: 'Hausa', code: 'ha', artist: 'Nomiis Gee', title: 'Marubuci' },
  { language: 'Hausa', code: 'ha', artist: 'Dabo Daprof', title: 'Dan Arewa' },
  { language: 'Hausa', code: 'ha', artist: 'Moreh', title: 'Mai Ango' },
  // Igbo
  { language: 'Igbo', code: 'ig', artist: 'Oliver De Coque', title: 'Onye Isi Mmanya' },
  { language: 'Igbo', code: 'ig', artist: 'Flavour', title: 'Nkolika' },
  { language: 'Igbo', code: 'ig', artist: 'Osita Osadebe', title: 'Anyi Bu Ndi Igbo' },
  { language: 'Igbo', code: 'ig', artist: 'Mike Ejeagha', title: 'Ochinga' },
  { language: 'Igbo', code: 'ig', artist: 'Phyno', title: 'Abulo' },
  // Nigerian Pidgin
  { language: 'Nigerian Pidgin', code: 'pcm', artist: 'Olu Maintain', title: 'Yahooze' },
  { language: 'Nigerian Pidgin', code: 'pcm', artist: 'Olamide', title: 'Wo' },
  { language: 'Nigerian Pidgin', code: 'pcm', artist: 'Portable', title: 'Zazu Zeh' },
  { language: 'Nigerian Pidgin', code: 'pcm', artist: 'Fela Kuti', title: 'Colonial Mentality' },
  { language: 'Nigerian Pidgin', code: 'pcm', artist: 'Wizkid', title: 'Ojuelegba' },
];

const deaccent = (s: string) => s.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
const stripTimecode = (l: string) => l.replace(/^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*/, '').trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry on 429 / 5xx (rate limits, transient overload) with backoff. Returns the
// final Response (even a non-retryable 4xx like 404) or null if unreachable.
async function fetchRetry(url: string, init: RequestInit = {}, tries = 5): Promise<Response | null> {
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, init);
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) return r;
      await sleep(1500 * (a + 1) + Math.floor(Math.random() * 600));
    } catch {
      await sleep(1500 * (a + 1));
    }
  }
  return null;
}

interface Found {
  lines: string[];
  synced: boolean;
  matchedArtist: string;
  matchedTitle: string;
}

async function fetchLyrics(song: Song): Promise<Found | null> {
  const pick = (d: any): Found | null => {
    const raw = d?.syncedLyrics || d?.plainLyrics;
    if (!raw) return null;
    const lines = String(raw).split('\n').map(stripTimecode).filter(Boolean);
    if (lines.length < 4) return null; // too short to be real lyrics
    return { lines, synced: !!d.syncedLyrics, matchedArtist: d.artistName || song.artist, matchedTitle: d.trackName || song.title };
  };

  const H = { headers: { 'User-Agent': 'melofy-eval-gold-draft (github.com/melofy)' } };

  // 1) exact get
  {
    const p = new URLSearchParams({ artist_name: song.artist, track_name: song.title });
    const r = await fetchRetry(`https://lrclib.net/api/get?${p}`, H);
    if (r && r.ok) {
      const hit = pick(await r.json().catch(() => null));
      if (hit) return hit;
    }
    await sleep(400);
  }

  // 2) free-text search (try accented then de-accented query)
  for (const q of [`${song.title} ${song.artist}`, deaccent(`${song.title} ${song.artist}`)]) {
    const r = await fetchRetry(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, H);
    await sleep(400);
    if (!r || !r.ok) continue;
    {
      const arr: any[] = await r.json().catch(() => []);
      if (!Array.isArray(arr)) continue;
      // Prefer a result whose artist loosely matches, else first with lyrics.
      const wantA = deaccent(song.artist).toLowerCase();
      const sorted = [...arr].sort((a, b) => {
        const am = deaccent(String(a.artistName || '')).toLowerCase().includes(wantA) ? 0 : 1;
        const bm = deaccent(String(b.artistName || '')).toLowerCase().includes(wantA) ? 0 : 1;
        return am - bm;
      });
      for (const cand of sorted) {
        const hit = pick(cand);
        if (hit) return hit;
      }
    }
  }
  return null;
}

const TRANSLATE_SYSTEM = (language: string) =>
  `You are an expert literary translator. Translate the following ${language} song lyrics into natural English.
STRICT RULES:
- Output EXACTLY one English line per input line, in the same order, with the SAME number of lines.
- Faithfully render slang, idioms, proverbs, ad-libs, and cultural references by MEANING, not word-for-word.
- Keep proper nouns, names, and untranslatable ad-libs as-is.
- Do NOT add notes, numbering, or commentary. Output ONLY the translated lines.`;

async function translate(lines: string[], language: string, model: string): Promise<string[]> {
  const key = envGet('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not set in repo-root .env');
  const res = await fetchRetry('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: Math.max(1024, Math.ceil(lines.join('\n').length * 1.5)),
      messages: [
        { role: 'system', content: TRANSLATE_SYSTEM(language) },
        { role: 'user', content: lines.join('\n') },
      ],
    }),
  }, 6);
  if (!res) throw new Error('gemini unreachable after retries (429/503 overload)');
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d: any = await res.json();
  const content = String(d.choices?.[0]?.message?.content ?? '');
  return content.split('\n').map((s) => s.trim()).filter(Boolean);
}

function slug(s: string): string {
  return deaccent(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

async function main() {
  // Google's OpenAI-compat endpoint wants the bare model name (strip "google/").
  const model = (envGet('OPENAI_MODEL') || 'gemini-flash-latest').replace(/^google\//, '');
  const entries: DatasetEntry[] = [];
  const missing: Song[] = [];
  const sourceOnly: Song[] = []; // lyrics found, but draft translation failed
  const mismatched: string[] = [];
  let i = 0;

  for (const song of SONGS) {
    i++;
    process.stdout.write(`[${i}/${SONGS.length}] ${song.language} — ${song.artist} — ${song.title} … `);
    const found = await fetchLyrics(song);
    if (!found) {
      console.log('MISSING (no lyrics on LRCLIB)');
      missing.push(song);
      await sleep(600);
      continue;
    }

    const base = {
      id: `gold-${song.code}-${slug(song.artist)}-${slug(song.title)}`,
      language: song.language,
      code: song.code,
      artist: song.artist,
      title: song.title,
      source_lines: found.lines,
      brief: null,
      generator_model: model,
      reviewed: false,
      reviewer: null,
    };

    let translated: string[] = [];
    try {
      translated = await translate(found.lines, song.language, model);
    } catch (err: any) {
      // Keep the fetched SOURCE lyrics even if the draft failed — they're the
      // hard-to-get part; the draft can be retried later.
      console.log(`found ${found.lines.length} lines, draft FAILED (${err?.message || err}) — source saved`);
      entries.push({ ...base, reference_lines: [] });
      sourceOnly.push(song);
      await sleep(600);
      continue;
    }

    const aligned = translated.length === found.lines.length;
    if (!aligned) mismatched.push(`${song.artist} — ${song.title} (src ${found.lines.length} vs draft ${translated.length})`);
    entries.push({ ...base, reference_lines: translated });
    console.log(`OK — ${found.lines.length} lines${aligned ? '' : ` ⚠ draft has ${translated.length}`} (matched "${found.matchedArtist} — ${found.matchedTitle}")`);
    await sleep(600);
  }

  fs.writeFileSync(OUT, JSON.stringify(entries, null, 2));

  // ---- Report ----
  const byLang = (arr: { language: string }[]) => {
    const m: Record<string, number> = {};
    for (const e of arr) m[e.language] = (m[e.language] ?? 0) + 1;
    return m;
  };
  const drafted = entries.filter((e) => (e.reference_lines?.length ?? 0) > 0);
  console.log('\n=================== COVERAGE REPORT ===================');
  console.log(`In file         : ${entries.length}/${SONGS.length}  → ${path.basename(OUT)}`);
  console.log(`  drafted       : ${drafted.length}  ${JSON.stringify(byLang(drafted))}`);
  console.log(`  source-only   : ${sourceOnly.length} (lyrics found, draft failed — retry later)`);
  for (const s of sourceOnly) console.log(`     · ${s.language}: ${s.artist} — ${s.title}`);
  console.log(`Missing (no lyrics on LRCLIB): ${missing.length}`);
  for (const m of missing) console.log(`   - ${m.language}: ${m.artist} — ${m.title}`);
  if (mismatched.length) {
    console.log(`\n⚠ Line-count mismatches (reviewer must realign): ${mismatched.length}`);
    for (const m of mismatched) console.log(`   - ${m}`);
  }
  console.log('\nDrafts are Gemini output with reviewed:false — hand to reviewers to correct into gold.');
  process.exit(0);
}

main().catch((err) => {
  console.error('buildGoldDrafts failed:', err?.message || err);
  process.exit(1);
});
