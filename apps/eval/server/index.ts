import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { envGet } from '../harness/env.ts';
import { datasetSummary, loadDataset } from '../harness/dataset.ts';
import { runEval, summarize } from '../harness/runEval.ts';
import { flush as flushLangfuse, langfuseEnabled } from '../harness/langfuse.ts';
import type { RunConfig, RunEvent, RunSummary } from '../harness/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.resolve(HERE, '../runs');
const DIST_DIR = path.resolve(HERE, '../dist');
fs.mkdirSync(RUNS_DIR, { recursive: true });

const PORT = Number(process.env.EVAL_API_PORT || 5175);
const PRODUCT_URL = process.env.PRODUCT_URL || 'http://localhost:3009';

// Preselected in the UI; also the fallback if a run arrives with no models.
// All models route through OpenRouter (see harness/providers.ts).
const DEFAULT_MODELS = ['google/gemini-3.7-flash', 'google/gemini-2.5-flash'];
// Keep the judge a DIFFERENT family than the candidates when you can.
const DEFAULT_JUDGE = 'anthropic/claude-sonnet-5';

interface ModelOption {
  id: string;
  provider: 'openrouter';
  label: string;
}

// Used when the OpenRouter catalogue can't be fetched (no key / offline) so the
// UI is never empty. Real IDs, still selectable.
const FALLBACK_MODELS: ModelOption[] = [
  { id: 'google/gemini-2.5-flash-lite', provider: 'openrouter', label: 'Google: Gemini 2.5 Flash Lite' },
  { id: 'google/gemini-2.5-flash', provider: 'openrouter', label: 'Google: Gemini 2.5 Flash' },
  { id: 'google/gemini-3.7-flash', provider: 'openrouter', label: 'Google: Gemini 3.7 Flash' },
  { id: 'anthropic/claude-sonnet-5', provider: 'openrouter', label: 'Anthropic: Claude Sonnet 5' },
  { id: 'anthropic/claude-opus-5', provider: 'openrouter', label: 'Anthropic: Claude Opus 5' },
  { id: 'openai/gpt-5.1', provider: 'openrouter', label: 'OpenAI: GPT-5.1' },
];

// Remembered the first time the OpenRouter catalogue is fetched successfully.
let openrouterCache: ModelOption[] | null = null;

async function withRetry(fn: () => Promise<ModelOption[] | null>, tries = 2): Promise<ModelOption[] | null> {
  for (let i = 0; i < tries; i++) {
    const r = await fn();
    if (r) return r;
  }
  return null;
}

async function fetchOpenRouterModels(): Promise<ModelOption[] | null> {
  const key = process.env.OPEN_ROUTER_API_KEY || envGet('OPEN_ROUTER_API_KEY');
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const d: any = await r.json();
    const out: ModelOption[] = [];
    for (const m of d.data ?? []) {
      if (typeof m.id === 'string') out.push({ id: m.id, provider: 'openrouter', label: m.name || m.id });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

async function fetchAvailableModels(refresh = false): Promise<{ models: ModelOption[]; complete: boolean }> {
  if (refresh) openrouterCache = null;
  const openrouter = openrouterCache ?? (await withRetry(fetchOpenRouterModels));
  if (openrouter) openrouterCache = openrouter;

  const seen = new Set<string>();
  const list = (openrouterCache ?? FALLBACK_MODELS).filter((m) =>
    seen.has(m.id) ? false : (seen.add(m.id), true)
  );
  list.sort((a, b) => a.id.localeCompare(b.id));
  return { models: list, complete: !!openrouterCache };
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, productUrl: PRODUCT_URL }));

app.get('/api/models', async (req, res) => {
  try {
    const { models, complete } = await fetchAvailableModels(req.query.refresh === '1');
    res.json({ models, complete, defaults: DEFAULT_MODELS, judge: DEFAULT_JUDGE, productUrl: PRODUCT_URL });
  } catch {
    res.json({ models: FALLBACK_MODELS, complete: false, defaults: DEFAULT_MODELS, judge: DEFAULT_JUDGE, productUrl: PRODUCT_URL });
  }
});

app.get('/api/dataset', (_req, res) => {
  try {
    res.json(datasetSummary(loadDataset()));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed to load dataset' });
  }
});

app.get('/api/runs', (_req, res) => {
  const runs = fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8')) as RunSummary;
        return {
          runId: s.runId,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
          models: s.config.models,
          judge: s.config.judgeModel,
          count: s.results.length,
          perModel: s.perModel,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (a.startedAt < b.startedAt ? 1 : -1));
  res.json({ runs });
});

app.get('/api/runs/:id', (req, res) => {
  const file = path.join(RUNS_DIR, `${path.basename(req.params.id)}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'run not found' });
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

app.post('/api/run', async (req, res) => {
  const b = req.body ?? {};
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const startedAt = new Date().toISOString();
  const cfg: RunConfig = {
    models: Array.isArray(b.models) && b.models.length ? b.models : DEFAULT_MODELS,
    judgeModel: typeof b.judgeModel === 'string' && b.judgeModel ? b.judgeModel : DEFAULT_JUDGE,
    reviewedOnly: !!b.reviewedOnly,
    languages: Array.isArray(b.languages) && b.languages.length ? b.languages : undefined,
    limitPerLanguage:
      typeof b.limitPerLanguage === 'number' && b.limitPerLanguage > 0 ? b.limitPerLanguage : null,
    targetLanguage: typeof b.targetLanguage === 'string' && b.targetLanguage ? b.targetLanguage : 'English',
    productUrl: PRODUCT_URL,
  };

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const send = (ev: RunEvent) => res.write(JSON.stringify(ev) + '\n');

  try {
    const results = await runEval(cfg, send, controller.signal, runId);
    await flushLangfuse(); // push traces + scores before we finish
    const { perModel, perLanguage } = summarize(results, cfg.models);
    const summary: RunSummary = {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      config: cfg,
      perModel,
      perLanguage,
      results,
    };
    if (!controller.signal.aborted) {
      fs.writeFileSync(path.join(RUNS_DIR, `${runId}.json`), JSON.stringify(summary, null, 2));
    }
    send({ type: 'done', summary });
    res.end();
  } catch (err: any) {
    send({ type: 'log', message: `run failed: ${err?.message || err}` });
    res.end();
  }
});

// In a built deployment (npm run build && npm start) serve the static UI too.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[eval-api] listening on http://localhost:${PORT}`);
  console.log(`[eval-api] product target: ${PRODUCT_URL}`);
  console.log(`[eval-api] langfuse tracing: ${langfuseEnabled ? 'ON' : 'off (set LANGFUSE_* to enable)'}`);
});
