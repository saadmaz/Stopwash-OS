import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Check } from 'lucide-react';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '../cn';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const Checkbox = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer grid size-5 shrink-0 place-items-center rounded-sm border border-border-strong bg-surface',
      'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg',
      'disabled:opacity-50',
      focusRing,
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator>
      <Check className="size-3.5" strokeWidth={3} aria-hidden />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export const Switch = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent bg-border-strong transition-colors',
      'data-[state=checked]:bg-accent disabled:opacity-50',
      focusRing,
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block size-6 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5 dark:data-[state=checked]:bg-ink" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

export interface ChoiceOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
  'children'
> {
  options: ChoiceOption[];
}

export function RadioGroup({ options, className, ...props }: RadioGroupProps) {
  const base = useId();
  return (
    <RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props}>
      {options.map((o) => {
        const id = `${base}-${o.value}`;
        return (
          <div key={o.value} className="flex items-start gap-3">
            <RadioGroupPrimitive.Item
              id={id}
              value={o.value}
              disabled={o.disabled}
              className={cn(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border-strong bg-surface',
                'data-[state=checked]:border-accent disabled:opacity-50',
                focusRing,
              )}
            >
              <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-accent" />
            </RadioGroupPrimitive.Item>
            <label htmlFor={id} className="text-sm">
              <span className="font-medium text-fg">{o.label}</span>
              {o.description && <span className="block text-fg-muted">{o.description}</span>}
            </label>
          </div>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}

export interface SegmentedControlProps {
  options: ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'md' | 'lg';
  className?: string;
  'aria-label': string;
}

/** Single-choice pill group (cash/card, expense/deposit, period tabs). Never empty. */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      aria-label={ariaLabel}
      className={cn('inline-flex w-full rounded-lg bg-surface-2 p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            'flex-1 rounded-md px-3 font-semibold text-fg-muted transition-colors',
            size === 'lg' ? 'h-12 text-base' : 'h-9 text-sm',
            'data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-sm',
            'disabled:opacity-50',
            focusRing,
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
