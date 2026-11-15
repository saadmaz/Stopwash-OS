import type { Permission } from '@stopwash/shared';
import { EmptyState } from '@stopwash/ui';
import { Construction, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { useSession } from '@/lib/session';
import { AppShell } from './AppShell';
import { NAV } from './nav';
import { DesignSystemPage } from '@/pages/DesignSystem';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NewOrderPage } from '@/features/pos/NewOrderPage';
import { QueuePage } from '@/features/queue/QueuePage';
import { ShiftPage } from '@/features/shift/ShiftPage';
import { CashPage } from '@/features/cash/CashPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { StaffPage } from '@/features/staff/StaffPage';
import { PayrollPage } from '@/features/payroll/PayrollPage';
import { LeavePage } from '@/features/staff/LeavePage';
import { AttendancePage } from '@/features/staff/AttendancePage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { TvBoardPage } from '@/features/tv/TvBoardPage';
import { CustomerDisplayPage } from '@/features/display/CustomerDisplayPage';

/** Screens that are built; the rest show a placeholder. */
const PAGES: Record<string, () => ReactNode> = {
  settings: () => <SettingsPage />,
  newOrder: () => <NewOrderPage />,
  queue: () => <QueuePage />,
  shift: () => <ShiftPage />,
  cash: () => <CashPage />,
  approvals: () => <ApprovalsPage />,
  staff: () => <StaffPage />,
  payroll: () => <PayrollPage />,
  leave: () => <LeavePage />,
  attendance: () => <AttendancePage />,
  reports: () => <ReportsPage />,
  dashboard: () => <DashboardPage />,
  invoices: () => <InvoicesPage />,
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
    path: '/display',
    element: (
      <RequirePermission permission="order.create">
        <CustomerDisplayPage />
      </RequirePermission>
    ),
  },
  {
    path: '/tv',
    element: (
      <RequirePermission permission="order.read">
        <TvBoardPage />
      </RequirePermission>
    ),
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: 'design-system', element: <DesignSystemPage /> },
      ...NAV.map((n) => ({
        ...(n.to === '/' ? { index: true } : { path: n.to.slice(1) }),
        element:
          n.to === '/' ? (
            <Home />
          ) : (
            <RequirePermission permission={n.permission}>
              {PAGES[n.key]?.() ?? <Placeholder navKey={n.key} />}
            </RequirePermission>
          ),
      })),
    ],
  },
];

/** Owners/managers/accounts land on the dashboard; counter staff go straight to their first screen. */
function Home() {
  const { can } = useSession();
  if (can('analytics.read')) return <>{PAGES.dashboard?.()}</>;
  const first = NAV.find((n) => n.to !== '/' && can(n.permission));
  return first ? <Navigate to={first.to} replace /> : <Placeholder navKey="dashboard" />;
}

export const createRouter = () => createBrowserRouter(routes);
