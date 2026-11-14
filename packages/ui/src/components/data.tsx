import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../cn';

/* ── Table ─────────────────────────────────────────── */

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-surface">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}
export const THead = (p: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead {...p} className={cn('bg-surface-2 text-left', p.className)} />
);
export const TBody = (p: HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...p} className={cn('divide-y divide-border', p.className)} />
);
export const TR = (p: HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...p} className={cn('transition-colors hover:bg-surface-2/60', p.className)} />
);
export const TH = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    scope="col"
    className={cn(
      'h-10 px-3 text-xs font-semibold tracking-wide text-fg-muted uppercase',
      className,
    )}
    {...p}
  />
);
export const TD = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2.5 align-middle text-fg', className)} {...p} />
);

/* ── Pagination ────────────────────────────────────── */

export type PageItem = number | 'ellipsis';

/**
 * Page buttons: first, last, current ±1, with ellipses between gaps.
 * Same shape as the old queue pager (renderPageNumbers).
 */
export function pageItems(current: number, total: number): PageItem[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const items: PageItem[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) items.push(i);
    else if (items[items.length - 1] !== 'ellipsis') items.push('ellipsis');
  }
  return items;
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** e.g. "Showing 11 to 20 of 54" (already translated). */
  summary?: ReactNode;
  labels?: { previous: string; next: string; page: (n: number) => string; nav: string };
}

const defaultLabels = {
  previous: 'Previous page',
  next: 'Next page',
  page: (n: number) => `Page ${n}`,
  nav: 'Pagination',
};

export function Pagination({
  page,
  pageCount,
  onPageChange,
  summary,
  labels = defaultLabels,
}: PaginationProps) {
  const btn =
    'grid h-11 min-w-11 place-items-center rounded-md px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40';
  return (
    <nav aria-label={labels.nav} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-fg-muted">{summary}</p>
      <div className="flex items-center gap-1">
        <button
          className={cn(btn, 'hover:bg-surface-2')}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={labels.previous}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {pageItems(page, pageCount).map((it, i) =>
          it === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1 text-fg-subtle" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={it}
              className={cn(btn, it === page ? 'bg-accent text-accent-fg' : 'hover:bg-surface-2')}
              aria-current={it === page ? 'page' : undefined}
              aria-label={labels.page(it)}
              onClick={() => onPageChange(it)}
            >
              {it}
            </button>
          ),
        )}
        <button
          className={cn(btn, 'hover:bg-surface-2')}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label={labels.next}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/* ── Empty state & skeleton ────────────────────────── */

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'danger' | 'warning';
  className?: string;
}

/** Used for empty, error, offline and permission-denied states. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong px-6 py-10 text-center',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'grid size-12 place-items-center rounded-full [&_svg]:size-6',
            tone === 'danger'
              ? 'bg-danger-subtle text-danger'
              : tone === 'warning'
                ? 'bg-warning-subtle text-warning'
                : 'bg-surface-2 text-fg-muted',
          )}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <p className="font-display text-lg font-semibold text-fg">{title}</p>
      {description && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-2', className)}
      {...props}
    />
  );
}

/* ── Stat card ─────────────────────────────────────── */

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Change vs comparison period, in percent. Positive is shown as good unless `invertTrend`. */
  deltaPct?: number | null;
  deltaLabel?: ReactNode;
  invertTrend?: boolean;
  icon?: ReactNode;
  /** 0–100 progress bar (e.g. daily target). */
  progress?: number;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  deltaPct,
  deltaLabel,
  invertTrend,
  icon,
  progress,
  loading,
  className,
}: StatCardProps) {
  const good =
    deltaPct !== null && deltaPct !== undefined && (invertTrend ? deltaPct < 0 : deltaPct >= 0);
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-xs',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        {icon && (
          <span className="text-fg-subtle [&_svg]:size-5" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <p className="tabular font-display text-2xl font-bold text-fg">{value}</p>
      )}
      {deltaPct !== null && deltaPct !== undefined && !loading && (
        <p
          className={cn(
            'flex items-center gap-1 text-xs font-semibold',
            good ? 'text-success' : 'text-danger',
          )}
        >
          {deltaPct >= 0 ? (
            <ArrowUpRight className="size-3.5" aria-hidden />
          ) : (
            <ArrowDownRight className="size-3.5" aria-hidden />
          )}
          {Math.abs(deltaPct).toFixed(1)}%
          {deltaLabel && <span className="font-normal text-fg-muted">{deltaLabel}</span>}
        </p>
      )}
      {progress !== undefined && (
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
