import { Toaster, TooltipProvider } from '@stopwash/ui';
import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { createRouter } from './app/router';
import { SignInPage } from './features/auth/SignInPage';
import { SessionProvider, useSession } from './lib/session';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from './lib/theme';

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} />;
}

function Gate() {
  const { user } = useSession();
  const [router] = useState(createRouter);
  return user ? <RouterProvider router={router} /> : <SignInPage />;
}

export function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <ThemeProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Gate />
            <ThemedToaster />
          </TooltipProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
