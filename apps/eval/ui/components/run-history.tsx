import * as React from 'react';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { RunListItem } from '@/api';

function overall(s: RunListItem['perModel'][string]): number | null {
  if (!s || s.fidelity == null || s.fluency == null || s.slang_idiom == null) return null;
  return Math.round(((s.fidelity + s.fluency + s.slang_idiom) / 3) * 10) / 10;
}

export function RunHistory({
  runs,
  activeId,
  onSelect,
}: {
  runs: RunListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!runs.length) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
        <History className="size-6 opacity-40" />
        <p>No runs yet.</p>
        <p className="text-xs">Runs you complete are saved here to compare.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {runs.map((r) => (
        <button
          key={r.runId}
          onClick={() => onSelect(r.runId)}
          className={cn(
            'hover:border-ring/60 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
            r.runId === activeId ? 'border-primary bg-primary/5' : 'bg-card'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{new Date(r.startedAt).toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">{r.count} scored</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.models.map((m) => (
              <Badge key={m} variant="secondary" className="gap-1 font-mono text-[11px]">
                {m.includes('/') ? m.split('/').pop() : m}
                <span className="text-foreground font-semibold tabular-nums">{overall(r.perModel[m]) ?? '–'}</span>
              </Badge>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
