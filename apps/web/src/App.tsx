import { Toaster, TooltipProvider } from '@stopwash/ui';
import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { createRouter } from './app/router';
import { SessionProvider, type SessionUser } from './lib/session';
import { ThemeProvider, useTheme } from './lib/theme';

// Temporary dev identity until PIN / email sign-in lands (step 3.7).
const DEV_USER: SessionUser = {
  id: 'dev-owner',
  name: 'Dev Owner',
  role: 'owner',
  brandId: 'stopwash',
  locationIds: ['katubedda'],
};

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} />;
}

export function App() {
  const [router] = useState(createRouter);
  return (
    <ThemeProvider>
      <SessionProvider initialUser={DEV_USER}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <ThemedToaster />
        </TooltipProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
