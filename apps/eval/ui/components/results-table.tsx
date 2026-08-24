import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ResultRow } from '@/api';

function scoreColor(n: number | null): string {
  if (n == null) return 'text-muted-foreground';
  if (n >= 4) return 'text-[var(--success)]';
  if (n >= 3) return 'text-[var(--warning)]';
  return 'text-destructive';
}

function Score({ n }: { n: number | null }) {
  return <span className={cn('font-semibold tabular-nums', scoreColor(n))}>{n ?? '–'}</span>;
}

export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Language</TableHead>
          <TableHead>Song</TableHead>
          <TableHead>Model</TableHead>
          <TableHead className="text-center">Fidelity</TableHead>
          <TableHead className="text-center">Fluency</TableHead>
          <TableHead className="text-center">Slang</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={`${r.id}-${r.model}-${i}`}>
            <TableCell className="font-medium">{r.language}</TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{r.title}</span>
                <span className="text-muted-foreground text-xs">{r.artist}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="font-mono text-xs">
                {r.model}
              </Badge>
            </TableCell>
            {r.error ? (
              <TableCell colSpan={3}>
                <span className="text-destructive flex items-center gap-1.5 text-xs">
                  <AlertCircle className="size-3.5" /> {r.error}
                </span>
              </TableCell>
            ) : (
              <>
                <TableCell className="text-center">
                  <Score n={r.fidelity} />
                </TableCell>
                <TableCell className="text-center">
                  <Score n={r.fluency} />
                </TableCell>
                <TableCell className="text-center">
                  <Score n={r.slang_idiom} />
                </TableCell>
              </>
            )}
            <TableCell className="text-muted-foreground max-w-[220px] text-xs">
              <div className="flex items-center gap-1.5">
                {!r.reviewedRef && (
                  <Badge variant="outline" className="border-[var(--warning)]/40 text-[var(--warning)]">
                    seed
                  </Badge>
                )}
                <span className="truncate" title={r.note}>
                  {r.note}
                </span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
