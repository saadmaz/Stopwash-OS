import type { Permission } from '@stopwash/shared';
import { EmptyState } from '@stopwash/ui';
import { Construction, Lock } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { useSession } from '@/lib/session';
import { AppShell } from './AppShell';
import { NAV } from './nav';
const DesignSystemPage = lazy(() =>
  import('@/pages/DesignSystem').then((m) => ({ default: m.DesignSystemPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const NewOrderPage = lazy(() =>
  import('@/features/pos/NewOrderPage').then((m) => ({ default: m.NewOrderPage })),
);
const QueuePage = lazy(() =>
  import('@/features/queue/QueuePage').then((m) => ({ default: m.QueuePage })),
);
const ShiftPage = lazy(() =>
  import('@/features/shift/ShiftPage').then((m) => ({ default: m.ShiftPage })),
);
const CashPage = lazy(() =>
  import('@/features/cash/CashPage').then((m) => ({ default: m.CashPage })),
);
const ApprovalsPage = lazy(() =>
  import('@/features/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
);
const StaffPage = lazy(() =>
  import('@/features/staff/StaffPage').then((m) => ({ default: m.StaffPage })),
);
const PayrollPage = lazy(() =>
  import('@/features/payroll/PayrollPage').then((m) => ({ default: m.PayrollPage })),
);
const LeavePage = lazy(() =>
  import('@/features/staff/LeavePage').then((m) => ({ default: m.LeavePage })),
);
const AttendancePage = lazy(() =>
  import('@/features/staff/AttendancePage').then((m) => ({ default: m.AttendancePage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const InvoicesPage = lazy(() =>
  import('@/features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })),
);
const VehiclesPage = lazy(() =>
  import('@/features/vehicles/VehiclesPage').then((m) => ({ default: m.VehiclesPage })),
);
const TvBoardPage = lazy(() =>
  import('@/features/tv/TvBoardPage').then((m) => ({ default: m.TvBoardPage })),
);
const CustomerDisplayPage = lazy(() =>
  import('@/features/display/CustomerDisplayPage').then((m) => ({
    default: m.CustomerDisplayPage,
  })),
);

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
  vehicles: () => <VehiclesPage />,
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
        <Suspense fallback={null}>
          <CustomerDisplayPage />
        </Suspense>
      </RequirePermission>
    ),
  },
  {
    path: '/tv',
    element: (
      <RequirePermission permission="order.read">
        <Suspense fallback={null}>
          <TvBoardPage />
        </Suspense>
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
