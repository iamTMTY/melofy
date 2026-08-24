// Shared types for the eval harness (server-side). The UI re-declares the slim
// shapes it needs from the JSON API, so this file stays free of any coupling.

export interface DatasetEntry {
  id: string;
  language: string;
  code: string;
  artist: string;
  title: string;
  source_lines: string[];
  reference_lines: string[] | null;
  brief?: string | null;
  generator_model?: string | null;
  reviewed?: boolean;
  reviewer?: string | null;
}

export interface Scores {
  fidelity: number | null;
  fluency: number | null;
  slang_idiom: number | null;
  note: string;
}

export interface ResultRow extends Scores {
  id: string;
  language: string;
  artist: string;
  title: string;
  model: string;
  reviewedRef: boolean;
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

export interface AxisAvg {
  fidelity: number | null;
  fluency: number | null;
  slang_idiom: number | null;
  count: number;
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
