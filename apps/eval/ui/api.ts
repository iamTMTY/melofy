// Slim client-side mirrors of the harness JSON shapes (kept local so the UI
// bundle never imports server code).
export interface AxisAvg {
  fidelity: number | null;
  fluency: number | null;
  slang_idiom: number | null;
  count: number;
}
export interface ResultRow {
  id: string;
  language: string;
  artist: string;
  title: string;
  model: string;
  reviewedRef: boolean;
  fidelity: number | null;
  fluency: number | null;
  slang_idiom: number | null;
  note: string;
  error?: string;
}
export interface RunConfig {
  models: string[];
  judgeModel: string;
  reviewedOnly: boolean;
  languages?: string[];
  limitPerLanguage?: number | null;
  targetLanguage: string;
  productUrl: string;
}
export interface RunSummary {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  config: RunConfig;
  perModel: Record<string, AxisAvg>;
  perLanguage: Record<string, Record<string, AxisAvg>>;
  results: ResultRow[];
}
export type RunEvent =
  | { type: 'start'; total: number; config: RunConfig }
  | { type: 'progress'; row: ResultRow; done: number; total: number }
  | { type: 'log'; message: string }
  | { type: 'done'; summary: RunSummary };

export interface LanguageStat {
  language: string;
  code: string;
  total: number;
  withReference: number;
  reviewed: number;
}
export interface DatasetSummary {
  songs: number;
  languages: LanguageStat[];
  totalWithReference: number;
  totalReviewed: number;
}
export interface RunListItem {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  models: string[];
  judge: string;
  count: number;
  perModel: Record<string, AxisAvg>;
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface ModelOption {
  id: string;
  provider: 'openai' | 'openrouter';
  label: string;
}

export const getDataset = () => getJSON<DatasetSummary>('/api/dataset');
export const getModels = (refresh = false) =>
  getJSON<{ models: ModelOption[]; complete: boolean; defaults: string[]; judge: string; productUrl: string }>(
    `/api/models${refresh ? '?refresh=1' : ''}`
  );
export const getRuns = () => getJSON<{ runs: RunListItem[] }>('/api/runs');
export const getRun = (id: string) => getJSON<RunSummary>(`/api/runs/${id}`);

// POST /api/run and stream NDJSON events to `onEvent` until the stream ends.
export async function startRun(
  body: Partial<RunConfig>,
  onEvent: (ev: RunEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`/api/run → ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim()) {
        try {
          onEvent(JSON.parse(line) as RunEvent);
        } catch {
          /* ignore partial/garbage */
        }
      }
    }
  }
}
