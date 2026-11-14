import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  'aria-label': string;
  className?: string;
}

/** Underlined tabs for back-office pages. Scrolls horizontally on phones. */
export function Tabs({ items, className, 'aria-label': ariaLabel, ...rest }: TabsProps) {
  return (
    <TabsPrimitive.Root
      defaultValue={rest.defaultValue ?? items[0]?.value}
      value={rest.value}
      onValueChange={rest.onValueChange}
      className={cn('flex flex-col gap-6', className)}
    >
      <TabsPrimitive.List
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {items.map((t) => (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              '-mb-px h-11 shrink-0 border-b-2 border-transparent px-4 text-sm font-semibold whitespace-nowrap text-fg-muted',
              'hover:text-fg focus-visible:outline-2 focus-visible:outline-ring',
              'data-[state=active]:border-accent data-[state=active]:text-fg',
            )}
          >
            {t.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((t) => (
        <TabsPrimitive.Content key={t.value} value={t.value} className="focus-visible:outline-none">
          {t.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
