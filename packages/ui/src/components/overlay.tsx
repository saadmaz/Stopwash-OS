import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';

const overlayClass = 'fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px]';

interface OverlayBaseProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Optional trigger element (rendered with asChild). */
  trigger?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Hide the visible title (still announced to screen readers). */
  hideTitle?: boolean;
}

function Header({
  title,
  description,
  hideTitle,
}: Pick<OverlayBaseProps, 'title' | 'description' | 'hideTitle'>) {
  return (
    <div className={cn('pr-10', hideTitle && 'sr-only')}>
      <DialogPrimitive.Title className="font-display text-xl font-bold text-fg">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="mt-1 text-sm text-fg-muted">
          {description}
        </DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
      )}
    </div>
  );
}

function CloseButton() {
  return (
    <DialogPrimitive.Close
      className="absolute top-3 right-3 grid size-11 place-items-center rounded-md text-fg-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Close"
    >
      <X className="size-5" aria-hidden />
    </DialogPrimitive.Close>
  );
}

export interface DialogProps extends OverlayBaseProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const dialogSizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Dialog({
  size = 'md',
  trigger,
  footer,
  children,
  className,
  ...rest
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={rest.open} onOpenChange={rest.onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-6 text-fg shadow-lg',
            dialogSizes[size],
            className,
          )}
        >
          <Header {...rest} />
          {children}
          {footer && <div className="mt-2 flex flex-wrap justify-end gap-2">{footer}</div>}
          <CloseButton />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const sheetSides = cva(
  'fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-surface p-6 text-fg shadow-lg',
  {
    variants: {
      side: {
        right: 'inset-y-0 right-0 h-dvh w-full max-w-md border-l',
        left: 'inset-y-0 left-0 h-dvh w-full max-w-xs border-r',
        bottom: 'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl border-t',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

export interface SheetProps extends OverlayBaseProps {
  side?: 'right' | 'left' | 'bottom';
}

/** Side panel: checkout, order detail, mobile nav. */
export function Sheet({ side, trigger, footer, children, className, ...rest }: SheetProps) {
  return (
    <DialogPrimitive.Root open={rest.open} onOpenChange={rest.onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content className={cn(sheetSides({ side }), className)}>
          <Header {...rest} />
          <div className="flex-1">{children}</div>
          {footer && <div className="sticky bottom-0 flex gap-2 bg-surface pt-2">{footer}</div>}
          <CloseButton />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-surface-inverse px-2.5 py-1.5 text-xs font-medium text-fg-inverse shadow-md"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
