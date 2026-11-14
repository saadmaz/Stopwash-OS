import * as LabelPrimitive from '@radix-ui/react-label';
import {
  forwardRef,
  useId,
  type ComponentPropsWithoutRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../cn';

const controlBase = [
  'w-full rounded-md border border-input bg-surface text-fg placeholder:text-fg-subtle',
  'transition-[border-color,box-shadow] duration-(--duration-fast)',
  'focus-visible:outline-none focus-visible:border-ring focus-visible:shadow-(--shadow-focus)',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-danger aria-invalid:focus-visible:shadow-[0_0_0_3px_var(--sw-danger-subtle)]',
].join(' ');

export const Label = forwardRef<
  HTMLLabelElement,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-medium text-fg peer-disabled:opacity-50', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'md' | 'lg' | 'xl';
  /** Content shown inside the field on the left (icon, "LKR"). */
  leading?: ReactNode;
  trailing?: ReactNode;
}

const inputSizes = { md: 'h-11 px-3', lg: 'h-14 px-4 text-lg', xl: 'h-20 px-5 text-3xl font-bold' };

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize = 'md', leading, trailing, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        className={cn(
          controlBase,
          inputSizes[inputSize],
          leading && 'pl-10',
          trailing && 'pr-10',
          className,
        )}
        {...props}
      />
    );
    if (!leading && !trailing) return input;
    return (
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle">
            {leading}
          </span>
        )}
        {input}
        {trailing && (
          <span className="absolute inset-y-0 right-3 flex items-center text-fg-subtle">
            {trailing}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(controlBase, 'px-3 py-2', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  /** Receives the generated id and aria props to spread on the control. */
  children: (props: {
    id: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
    required?: boolean;
  }) => ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        required,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
