import type { Permission } from '@stopwash/shared';
import { EmptyState } from '@stopwash/ui';
import { Construction, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { useSession } from '@/lib/session';
import { AppShell } from './AppShell';
import { NAV } from './nav';

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useSession();
  if (!can(permission)) {
    return (
      <EmptyState
        icon={<Lock />}
        tone="warning"
        title="You don't have access to this page"
        description="Ask a manager if you need it."
      />
    );
  }
  return <>{children}</>;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <EmptyState
        icon={<Construction />}
        title="Coming soon"
        description="This screen is being built."
      />
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: NAV.map((n) => ({
      ...(n.to === '/' ? { index: true } : { path: n.to.slice(1) }),
      element: (
        <RequirePermission permission={n.permission}>
          <Placeholder title={n.key} />
        </RequirePermission>
      ),
    })),
  },
];

export const createRouter = () => createBrowserRouter(routes);
