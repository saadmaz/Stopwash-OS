import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-fg-muted',
        brand: 'bg-primary text-primary-fg',
        accent: 'bg-accent text-accent-fg',
        success: 'bg-success-subtle text-success-fg',
        warning: 'bg-warning-subtle text-warning-fg',
        danger: 'bg-danger-subtle text-danger-fg',
        info: 'bg-info-subtle text-info-fg',
      },
      outline: { true: 'bg-transparent ring-1 ring-inset ring-current' },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Small dot before the label, e.g. for live status. */
  dot?: boolean;
}

export function Badge({ className, tone, outline, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, outline }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
