import * as React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { AxisAvg } from '@/api';

const METRICS = [
  { key: 'fidelity', label: 'Fidelity', varName: '--chart-1', fallback: '#5b8cff' },
  { key: 'fluency', label: 'Fluency', varName: '--chart-3', fallback: '#3ecf8e' },
  { key: 'slang_idiom', label: 'Slang', varName: '--chart-2', fallback: '#f0a94a' },
] as const;

// SVG `fill="var(--x)"` doesn't resolve as an attribute in Chrome — bars would
// paint black (invisible on dark). Resolve every token to a concrete rgb() via a
// probe element and hand recharts real colors.
function useChartColors() {
  const [c, setC] = React.useState<{ bars: string[]; grid: string; muted: string; fg: string }>({
    bars: METRICS.map((m) => m.fallback),
    grid: 'rgba(255,255,255,0.1)',
    muted: '#949aab',
    fg: '#eef0f6',
  });
  React.useEffect(() => {
    const probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const get = (v: string, fallback: string) => {
      probe.style.color = `var(${v})`;
      const col = getComputedStyle(probe).color;
      return col && /^(rgb|oklch|hsl|#)/.test(col) ? col : fallback;
    };
    setC({
      bars: METRICS.map((m) => get(m.varName, m.fallback)),
      grid: get('--border', 'rgba(255,255,255,0.1)'),
      muted: get('--muted-foreground', '#949aab'),
      fg: get('--foreground', '#eef0f6'),
    });
    probe.remove();
  }, []);
  return c;
}

function shortLabel(id: string) {
  const seg = id.includes('/') ? id.split('/').pop()! : id;
  return seg.length > 18 ? seg.slice(0, 17) + '…' : seg;
}

export function ScoreChart({ perModel, models }: { perModel: Record<string, AxisAvg>; models: string[] }) {
  const colors = useChartColors();
  const data = models
    .filter((m) => perModel[m]?.count)
    .map((m) => ({
      model: m,
      label: shortLabel(m),
      fidelity: perModel[m].fidelity ?? 0,
      fluency: perModel[m].fluency ?? 0,
      slang_idiom: perModel[m].slang_idiom ?? 0,
    }));

  if (!data.length) return null;

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap gap-4">
        {METRICS.map((m, i) => (
          <div key={m.key} className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="size-3 rounded-[3px]" style={{ background: colors.bars[i] }} />
            {m.label}
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 96)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }} barGap={4} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={colors.grid} />
          <XAxis
            type="number"
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.fg, fontSize: 13 }}
          />
          {METRICS.map((m, i) => (
            <Bar key={m.key} dataKey={m.key} fill={colors.bars[i]} radius={4} maxBarSize={22} isAnimationActive={false}>
              <LabelList
                dataKey={m.key}
                position="right"
                fill={colors.fg}
                fontSize={12}
                formatter={(value) => {
                  const v = Number(value);
                  return v ? v.toFixed(1) : '';
                }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
