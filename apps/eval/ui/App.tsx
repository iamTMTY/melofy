import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, Loader2, Play, Square } from 'lucide-react';
import {
  getDataset,
  getModels,
  getRun,
  getRuns,
  startRun,
  type AxisAvg,
  type DatasetSummary,
  type ModelOption,
  type ResultRow,
  type RunListItem,
} from './api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, type Option } from '@/components/multi-select';
import { Combobox } from '@/components/combobox';
import { ScoreChart } from '@/components/score-chart';
import { ResultsTable } from '@/components/results-table';
import { RunHistory } from '@/components/run-history';

function sameFamily(a: string, b: string): boolean {
  const fam = (m: string) => {
    if (m.startsWith('claude') || m.includes('anthropic/')) return 'anthropic';
    if (m.includes('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.includes('openai/')) return 'openai';
    if (m.includes('gemini') || m.includes('google/')) return 'google';
    return m;
  };
  return fam(a) === fam(b);
}

export function App() {
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [productUrl, setProductUrl] = useState('');

  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [judgeModel, setJudgeModel] = useState('');
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [limitPerLang, setLimitPerLang] = useState(1);

  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runModels, setRunModels] = useState<string[]>([]);
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Track whether the user has picked models/judge, so re-applying defaults as the
  // (flaky) provider lists fill in never clobbers a real choice.
  const touchedModels = useRef(false);
  const touchedJudge = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getDataset().then((d) => !cancelled && setDataset(d)).catch((e) => !cancelled && setError(String(e)));

    const apply = (m: Awaited<ReturnType<typeof getModels>>) => {
      if (cancelled) return;
      setAvailableModels(m.models);
      setProductUrl(m.productUrl);
      const ids = new Set(m.models.map((x) => x.id));
      if (!touchedModels.current) {
        const preset = m.defaults.filter((d) => ids.has(d));
        setSelectedModels(preset.length ? preset : m.models.slice(0, 2).map((x) => x.id));
      }
      if (!touchedJudge.current) {
        setJudgeModel(ids.has(m.judge) ? m.judge : m.models[0]?.id ?? '');
      }
    };

    getModels()
      .then((m) => {
        apply(m);
        // A provider list can flake out on first hit; refetch once to fill it in.
        if (!m.complete) setTimeout(() => getModels(true).then(apply).catch(() => {}), 2500);
      })
      .catch((e) => !cancelled && setError(String(e)));

    refreshRuns();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickModels = (next: string[]) => {
    touchedModels.current = true;
    setSelectedModels(next);
  };
  const pickJudge = (next: string) => {
    touchedJudge.current = true;
    setJudgeModel(next);
  };

  const refreshRuns = () => getRuns().then((r) => setRuns(r.runs)).catch(() => {});

  const activeModels = runModels.length ? runModels : selectedModels;

  const perModel = useMemo(() => {
    const acc: Record<string, AxisAvg> = {};
    for (const m of activeModels) {
      const rs = rows.filter((r) => r.model === m);
      const avg = (k: 'fidelity' | 'fluency' | 'slang_idiom') => {
        const v = rs.map((r) => r[k]).filter((n): n is number => typeof n === 'number');
        return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
      };
      acc[m] = { fidelity: avg('fidelity'), fluency: avg('fluency'), slang_idiom: avg('slang_idiom'), count: rs.length };
    }
    return acc;
  }, [rows, activeModels]);

  const modelOptions: Option[] = useMemo(
    () =>
      availableModels.map((m) => ({
        value: m.id,
        label: m.label,
        hint: m.label === m.id ? m.provider : m.id,
      })),
    [availableModels]
  );

  const langOptions: Option[] = useMemo(
    () =>
      (dataset?.languages ?? []).map((l) => ({
        value: l.language,
        label: l.language,
        hint: `${l.withReference} ref${l.withReference === 1 ? '' : 's'}`,
      })),
    [dataset]
  );

  const judgeWarn = selectedModels.some((m) => sameFamily(m, judgeModel));
  const hasScores = Object.values(perModel).some((s) => s.count > 0);

  async function run() {
    if (!selectedModels.length) return;
    setError(null);
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setRunModels(selectedModels);
    setActiveRunId(null);
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await startRun(
        {
          models: selectedModels,
          judgeModel,
          reviewedOnly,
          languages: selectedLangs.length ? selectedLangs : undefined,
          limitPerLanguage: limitPerLang > 0 ? limitPerLang : null,
        },
        (ev) => {
          if (ev.type === 'start') setProgress({ done: 0, total: ev.total });
          else if (ev.type === 'progress') {
            setRows((r) => [...r, ev.row]);
            setProgress({ done: ev.done, total: ev.total });
          } else if (ev.type === 'done') {
            setActiveRunId(ev.summary.runId);
            refreshRuns();
          }
        },
        ac.signal
      );
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(String(e?.message || e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
  }

  async function loadRun(id: string) {
    try {
      const s = await getRun(id);
      setRunModels(s.config.models);
      setRows(s.results);
      setProgress({ done: s.results.length, total: s.results.length });
      setActiveRunId(id);
      setJudgeModel(s.config.judgeModel);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-8 lg:px-10 lg:py-10">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Melofy <span className="text-primary">Eval</span>
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Score translation models against the reviewed reference set.
          </p>
        </div>
        <div className="text-muted-foreground flex items-center gap-4 text-sm">
          {dataset && (
            <span className="tabular-nums">
              {dataset.songs} songs · {dataset.languages.length} languages · {dataset.totalReviewed} reviewed
            </span>
          )}
          {productUrl && (
            <span className="border-border bg-card inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-xs">
              <span className="size-1.5 rounded-full bg-[var(--success)]" />
              {productUrl.replace(/^https?:\/\//, '')}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="text-destructive border-destructive/30 bg-destructive/10 mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-6">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configure run</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label>
                  Candidate models
                  {selectedModels.length > 0 && (
                    <span className="text-muted-foreground font-normal">· {selectedModels.length} selected</span>
                  )}
                </Label>
                <MultiSelect
                  options={modelOptions}
                  selected={selectedModels}
                  onChange={pickModels}
                  disabled={running}
                  placeholder={availableModels.length ? 'Choose models to evaluate…' : 'Loading models…'}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label>Judge model</Label>
                  <Combobox
                    options={modelOptions}
                    value={judgeModel}
                    onChange={pickJudge}
                    disabled={running}
                    placeholder="Choose a judge…"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Coverage</Label>
                  <Select value={String(limitPerLang)} onValueChange={(v) => setLimitPerLang(Number(v))} disabled={running}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 song / language</SelectItem>
                      <SelectItem value="2">2 songs / language</SelectItem>
                      <SelectItem value="3">3 songs / language</SelectItem>
                      <SelectItem value="5">5 songs / language</SelectItem>
                      <SelectItem value="0">All songs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>References</Label>
                  <Select
                    value={reviewedOnly ? 'reviewed' : 'all'}
                    onValueChange={(v) => setReviewedOnly(v === 'reviewed')}
                    disabled={running}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All references</SelectItem>
                      <SelectItem value="reviewed">Human-reviewed only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>
                  Languages
                  <span className="text-muted-foreground font-normal">
                    · {selectedLangs.length ? `${selectedLangs.length} selected` : 'all'}
                  </span>
                </Label>
                <MultiSelect
                  options={langOptions}
                  selected={selectedLangs}
                  onChange={setSelectedLangs}
                  disabled={running}
                  placeholder="All languages — choose to narrow…"
                />
              </div>

              {judgeWarn && (
                <div className="text-[var(--warning)] flex items-start gap-2 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  Judge shares a family with a candidate — pick a different family for a less biased score.
                </div>
              )}

              <Separator />

              <div className="flex flex-wrap items-center gap-4">
                {running ? (
                  <Button variant="destructive" onClick={cancel} className="gap-2">
                    <Square className="size-4" /> Cancel run
                  </Button>
                ) : (
                  <Button onClick={run} disabled={!selectedModels.length} className="gap-2">
                    <Play className="size-4" /> Run eval
                  </Button>
                )}
                {(running || progress.total > 0) && (
                  <div className="flex flex-1 items-center gap-3">
                    <Progress value={pct} className="flex-1" />
                    <span className="text-muted-foreground w-28 text-right text-sm tabular-nums">
                      {running && <Loader2 className="mr-1 inline size-3.5 animate-spin" />}
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          {hasScores && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Model scores
                  {activeRunId && <span className="text-muted-foreground ml-2 font-mono text-xs font-normal">{activeRunId}</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreChart perModel={perModel} models={activeModels} />
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {rows.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Results</CardTitle>
              </CardHeader>
              <CardContent>
                <ResultsTable rows={rows} />
              </CardContent>
            </Card>
          ) : (
            !running && (
              <Card>
                <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center">
                  <BarChart3 className="size-8 opacity-40" />
                  <div>
                    <p className="text-foreground text-sm font-medium">No results yet</p>
                    <p className="mt-1 text-sm">
                      Pick your models and hit <span className="text-foreground font-medium">Run eval</span>. Scores stream
                      in per song, live.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>

        {/* History sidebar */}
        <aside className="lg:sticky lg:top-10 lg:h-fit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <RunHistory runs={runs} activeId={activeRunId} onSelect={loadRun} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
