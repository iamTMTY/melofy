import { loadDataset } from './dataset.ts';
import { translateViaProduct } from './translate.ts';
import { judge } from './judge.ts';
import { recordJob } from './langfuse.ts';
import type { AxisAvg, DatasetEntry, ResultRow, RunConfig, RunEvent } from './types.ts';

const AXES = ['fidelity', 'fluency', 'slang_idiom'] as const;
type Axis = (typeof AXES)[number];

export function selectPool(data: DatasetEntry[], cfg: RunConfig): DatasetEntry[] {
  let pool = data.filter(
    (e) => e.reference_lines && e.reference_lines.length > 0 && (e.reviewed || !cfg.reviewedOnly)
  );
  if (cfg.languages && cfg.languages.length) {
    const set = new Set(cfg.languages);
    pool = pool.filter((e) => set.has(e.language));
  }
  if (cfg.limitPerLanguage && cfg.limitPerLanguage > 0) {
    const seen: Record<string, number> = {};
    pool = pool.filter((e) => {
      seen[e.language] = (seen[e.language] ?? 0) + 1;
      return seen[e.language] <= cfg.limitPerLanguage!;
    });
  }
  return pool;
}

function avg(rows: ResultRow[], key: Axis): number | null {
  const v = rows.map((r) => r[key]).filter((n): n is number => typeof n === 'number');
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
}

function axisAvg(rows: ResultRow[]): AxisAvg {
  return {
    fidelity: avg(rows, 'fidelity'),
    fluency: avg(rows, 'fluency'),
    slang_idiom: avg(rows, 'slang_idiom'),
    count: rows.length,
  };
}

export function summarize(results: ResultRow[], models: string[]) {
  const perModel: Record<string, AxisAvg> = {};
  for (const m of models) perModel[m] = axisAvg(results.filter((r) => r.model === m));

  const perLanguage: Record<string, Record<string, AxisAvg>> = {};
  for (const lang of [...new Set(results.map((r) => r.language))].sort()) {
    perLanguage[lang] = {};
    for (const m of models) {
      perLanguage[lang][m] = axisAvg(results.filter((r) => r.language === lang && r.model === m));
    }
  }
  return { perModel, perLanguage };
}

/**
 * Runs the eval: every (song × model) job translates via the product endpoint,
 * then a reference-anchored judge scores it. Emits a `progress` event per job so
 * the UI fills in live. A small concurrency pool keeps it brisk without hammering
 * the app or the judge API.
 */
export async function runEval(
  cfg: RunConfig,
  emit: (ev: RunEvent) => void,
  signal?: AbortSignal,
  runName = 'eval-run'
): Promise<ResultRow[]> {
  const data = loadDataset();
  const pool = selectPool(data, cfg);

  const jobs: { entry: DatasetEntry; model: string }[] = [];
  for (const entry of pool) for (const model of cfg.models) jobs.push({ entry, model });

  const total = jobs.length;
  emit({ type: 'start', total, config: cfg });

  const results: ResultRow[] = [];
  let done = 0;
  let cursor = 0;
  const CONCURRENCY = 3;

  async function worker() {
    while (cursor < jobs.length) {
      if (signal?.aborted) return;
      const { entry, model } = jobs[cursor++];
      const row: ResultRow = {
        id: entry.id,
        language: entry.language,
        artist: entry.artist,
        title: entry.title,
        model,
        reviewedRef: !!entry.reviewed,
        fidelity: null,
        fluency: null,
        slang_idiom: null,
        note: '',
      };
      const source = entry.source_lines.join('\n');
      const reference = (entry.reference_lines ?? []).join('\n');
      let candidate: string | null = null;
      let scores = null;
      try {
        const translated = await translateViaProduct(
          cfg.productUrl,
          entry.source_lines,
          cfg.targetLanguage,
          model,
          entry.artist,
          entry.title,
          signal
        );
        candidate = translated.join('\n');
        const sc = await judge(cfg.judgeModel, entry.language, source, reference, candidate, signal);
        row.fidelity = sc.fidelity;
        row.fluency = sc.fluency;
        row.slang_idiom = sc.slang_idiom;
        row.note = sc.note;
        scores = sc;
      } catch (err: any) {
        row.error = err?.message || String(err);
        row.note = 'error';
      }
      results.push(row);
      done += 1;
      emit({ type: 'progress', row, done, total });

      // Mirror the job to Langfuse (no-op if unconfigured). Fire-and-forget so
      // telemetry never slows the run or blocks the next job.
      void recordJob({
        runName,
        model,
        judgeModel: cfg.judgeModel,
        language: entry.language,
        songId: entry.id,
        artist: entry.artist,
        title: entry.title,
        source,
        reference,
        candidate,
        scores,
        error: row.error,
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length || 1) }, worker));
  return results;
}
