import { formatCompact, formatLKR } from '@stopwash/shared';
import { cn } from '@stopwash/ui';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Single-series daily revenue (title names it; no legend). */
export function RevenueBars({
  series,
  label,
}: {
  series: Array<{ date: string; revenueCents: number; count: number }>;
  label: string;
}) {
  return (
    <figure className="h-64 w-full" aria-label={label}>
      <ResponsiveContainer>
        <BarChart
          data={series}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid vertical={false} stroke="var(--sw-border)" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fontSize: 12, fill: 'var(--sw-fg-muted)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tick={{ fontSize: 12, fill: 'var(--sw-fg-muted)' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: 'var(--sw-surface-2)' }}
            contentStyle={{
              background: 'var(--sw-surface)',
              border: '1px solid var(--sw-border)',
              borderRadius: 8,
              color: 'var(--sw-fg)',
            }}
            formatter={(v) => formatLKR(Number(v ?? 0))}
            labelFormatter={(d) => String(d)}
          />
          <Bar
            dataKey="revenueCents"
            name={label}
            fill="var(--sw-chart-1)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Two-part proportion with legend + direct labels (identity is never colour alone). */
export function SplitBar({
  parts,
}: {
  parts: Array<{ label: string; value: number; pct: number }>;
}) {
  const colors = ['var(--sw-chart-1)', 'var(--sw-chart-2)'];
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${p.pct}%`).join(', ')}
      >
        {parts.map((p, i) => (
          <div
            key={p.label}
            style={{ width: `${p.pct}%`, background: colors[i] }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-4 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: colors[i] }} aria-hidden />
            <span className="text-fg">{p.label}</span>
            <span className="tabular font-semibold">{p.value}</span>
            <span className="text-fg-muted">({p.pct}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 7×24 revenue heatmap, one hue light→dark. Cells carry text for screen readers and a title tooltip. */
export function HourHeatmap({ cents, caption }: { cents: number[][]; caption: string }) {
  const max = Math.max(1, ...cents.flat());
  const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= 6 && h <= 21);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-10" />
            {hours.map((h) => (
              <th key={h} scope="col" className="font-normal text-fg-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <tr key={d}>
              <th scope="row" className="pr-1 text-left font-normal text-fg-muted">
                {DAYS[d]}
              </th>
              {hours.map((h) => {
                const v = cents[d]?.[h] ?? 0;
                const pct = v ? 15 + Math.round((v / max) * 85) : 0;
                return (
                  <td
                    key={h}
                    title={`${DAYS[d]} ${h}:00 · ${formatLKR(v)}`}
                    className={cn('h-7 min-w-6 rounded-sm', !v && 'bg-surface-2')}
                    style={
                      v
                        ? {
                            background: `color-mix(in oklab, var(--sw-chart-1) ${pct}%, var(--sw-surface))`,
                          }
                        : undefined
                    }
                  >
                    <span className="sr-only">{`${DAYS[d]} ${h}:00 ${formatLKR(v)}`}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
