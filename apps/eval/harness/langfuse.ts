// Optional Langfuse tracing for eval runs. Every (song × model) job becomes a
// trace with a child generation (the candidate translation) and the judge's
// three axis scores attached. This is additive — the local dashboard/run-history
// keeps working exactly as before; Langfuse just gets a copy so runs are
// comparable over time and songs can be sent to human annotators.
//
// Entirely no-op unless LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY are set (in the
// repo-root .env or the process env), so the eval still runs fully offline.
import { envGet } from './env.ts';
import type { Scores } from './types.ts';

const PUBLIC_KEY = envGet('LANGFUSE_PUBLIC_KEY');
const SECRET_KEY = envGet('LANGFUSE_SECRET_KEY');
// v4/v5 SDK reads LANGFUSE_BASE_URL; accept the older LANGFUSE_HOST spelling too.
const BASE_URL = envGet('LANGFUSE_BASE_URL') || envGet('LANGFUSE_HOST') || 'https://cloud.langfuse.com';
const DATASET_NAME = envGet('LANGFUSE_DATASET') || 'melofy-lyrics';

export const langfuseEnabled = !!(PUBLIC_KEY && SECRET_KEY);
export const datasetName = DATASET_NAME;

// The harness reads the repo-root .env by hand (see env.ts) rather than exporting
// it, but the Langfuse SDK reads process.env directly — bridge the values across
// so both the explicit-constructor and env-based code paths agree.
if (langfuseEnabled) {
  process.env.LANGFUSE_PUBLIC_KEY ||= PUBLIC_KEY;
  process.env.LANGFUSE_SECRET_KEY ||= SECRET_KEY;
  process.env.LANGFUSE_BASE_URL ||= BASE_URL;
}

// Lazily-loaded SDK singletons. Loaded via dynamic import so a repo without the
// packages installed (or with Langfuse disabled) never pays the import cost.
type SpanProcessor = { forceFlush(): Promise<void> };
type Observation = {
  id: string;
  traceId: string;
  update(data: Record<string, unknown>): Observation;
  end(): Observation;
  startObservation(name: string, data: Record<string, unknown>, opts?: { asType?: string }): Observation;
};
type Client = {
  flush(): Promise<void>;
  score: { create(args: Record<string, unknown>): unknown };
  dataset: {
    create(args: Record<string, unknown>): Promise<unknown>;
    createItem(args: Record<string, unknown>): Promise<unknown>;
  };
};

let spanProcessor: SpanProcessor | null = null;
let client: Client | null = null;
let startObservationFn: ((name: string, data: Record<string, unknown>) => Observation) | null = null;
let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  if (!langfuseEnabled) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const [{ NodeSDK }, { LangfuseSpanProcessor }, { LangfuseClient }, tracing] = await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@langfuse/otel'),
      import('@langfuse/client'),
      import('@langfuse/tracing'),
    ]);
    const processor = new LangfuseSpanProcessor({
      publicKey: PUBLIC_KEY,
      secretKey: SECRET_KEY,
      baseUrl: BASE_URL,
    });
    new NodeSDK({ spanProcessors: [processor] }).start();
    spanProcessor = processor as unknown as SpanProcessor;
    client = new LangfuseClient({ publicKey: PUBLIC_KEY, secretKey: SECRET_KEY, baseUrl: BASE_URL }) as unknown as Client;
    startObservationFn = tracing.startObservation as unknown as typeof startObservationFn;
  })().catch((err) => {
    console.warn('[langfuse] init failed — continuing without tracing:', err?.message || err);
    spanProcessor = null;
    client = null;
    startObservationFn = null;
  });
  return initPromise;
}

export interface JobRecord {
  runName: string;
  model: string;
  judgeModel: string;
  language: string;
  songId: string;
  artist: string;
  title: string;
  source: string;
  reference: string;
  candidate: string | null;
  scores: Scores | null;
  error?: string;
}

const AXES = ['fidelity', 'fluency', 'slang_idiom'] as const;

/** Record one eval job as a Langfuse trace + scores. Safe to call always. */
export async function recordJob(job: JobRecord): Promise<void> {
  if (!langfuseEnabled) return;
  await init();
  if (!startObservationFn || !client) return;
  try {
    const root = startObservationFn('eval-translation', {
      input: { source: job.source, language: job.language, artist: job.artist, title: job.title },
      output: job.candidate ?? undefined,
      metadata: {
        runName: job.runName,
        model: job.model,
        judgeModel: job.judgeModel,
        songId: job.songId,
        datasetName: DATASET_NAME,
        reference: job.reference,
      },
    });
    // `startObservation` accepts tags via update() on some SDK builds; tags in
    // metadata keep it version-proof for filtering in the UI.
    if (job.error) root.update({ level: 'ERROR', statusMessage: job.error });

    const gen = root.startObservation(
      'translate',
      { model: job.model, input: job.source, output: job.candidate ?? undefined },
      { asType: 'generation' }
    );
    if (job.error) gen.update({ level: 'ERROR', statusMessage: job.error });
    gen.end();
    root.end();

    if (job.scores) {
      for (const axis of AXES) {
        const value = job.scores[axis];
        if (typeof value === 'number') {
          client.score.create({
            traceId: root.traceId,
            observationId: gen.id,
            name: axis,
            value,
            dataType: 'NUMERIC',
            comment: job.scores.note || undefined,
          });
        }
      }
    }
  } catch (err) {
    // Never let telemetry break a run.
    console.warn('[langfuse] recordJob failed:', (err as Error)?.message || err);
  }
}

/** Flush spans + scores. Call at the end of a run (short-lived write window). */
export async function flush(): Promise<void> {
  try {
    if (spanProcessor) await spanProcessor.forceFlush();
    if (client) await client.flush();
  } catch (err) {
    console.warn('[langfuse] flush failed:', (err as Error)?.message || err);
  }
}

/** Upsert the dataset + one item per entry (idempotent). Used by `dataset:sync`. */
export async function upsertDatasetItems(
  items: Array<{ id: string; input: unknown; expectedOutput: unknown; metadata?: unknown }>
): Promise<{ dataset: string; count: number }> {
  if (!langfuseEnabled) throw new Error('Langfuse is not configured (set LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY).');
  await init();
  if (!client) throw new Error('Langfuse client failed to initialize.');
  await client.dataset.create({ name: DATASET_NAME, description: 'Melofy lyric-translation eval set (source + human-reviewed reference).' });
  let count = 0;
  for (const it of items) {
    await client.dataset.createItem({
      datasetName: DATASET_NAME,
      id: it.id, // stable id → re-running updates the same item instead of duplicating
      input: it.input,
      expectedOutput: it.expectedOutput,
      metadata: it.metadata,
    });
    count++;
  }
  await flush();
  return { dataset: DATASET_NAME, count };
}
