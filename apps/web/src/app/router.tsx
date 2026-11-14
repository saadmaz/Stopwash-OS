import type { Permission } from '@stopwash/shared';
import { EmptyState } from '@stopwash/ui';
import { Construction, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { useSession } from '@/lib/session';
import { AppShell } from './AppShell';
import { NAV } from './nav';
import { DesignSystemPage } from '@/pages/DesignSystem';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NewOrderPage } from '@/features/pos/NewOrderPage';
import { QueuePage } from '@/features/queue/QueuePage';

/** Screens that are built; the rest show a placeholder. */
const PAGES: Record<string, () => ReactNode> = {
  settings: () => <SettingsPage />,
  newOrder: () => <NewOrderPage />,
  queue: () => <QueuePage />,
};

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useSession();
  const { t } = useTranslation();
  if (!can(permission)) {
    return (
      <EmptyState
        icon={<Lock />}
        tone="warning"
        title={t('state.noAccessTitle')}
        description={t('state.noAccessBody')}
      />
    );
  }
  return <>{children}</>;
}

function Placeholder({ navKey }: { navKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t(`nav.${navKey}`)}</h1>
      <EmptyState
        icon={<Construction />}
        title={t('state.comingSoon')}
        description={t('state.comingSoonBody')}
      />
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: 'design-system', element: <DesignSystemPage /> },
      ...NAV.map((n) => ({
        ...(n.to === '/' ? { index: true } : { path: n.to.slice(1) }),
        element: (
          <RequirePermission permission={n.permission}>
            {PAGES[n.key]?.() ?? <Placeholder navKey={n.key} />}
          </RequirePermission>
        ),
      })),
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
