import { Toaster as SonnerToaster, toast } from 'sonner';

export interface ToasterProps {
  theme: 'light' | 'dark';
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';
}

/** Mount once near the app root. Use `toast.success(…)`, `toast.error(…)`, `toast.warning(…)`. */
export function Toaster({ theme, position = 'top-right' }: ToasterProps) {
  return (
    <SonnerToaster
      theme={theme}
      position={position}
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast: 'font-sans rounded-lg! border-border! shadow-lg!',
          title: 'font-semibold',
        },
      }}
    />
  );
}

export { toast };
