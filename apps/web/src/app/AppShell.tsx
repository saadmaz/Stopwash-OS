import { Badge, Button, cn, Sheet } from '@stopwash/ui';
import { LogOut, Menu, Monitor, Moon, Sun, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useOnline } from '@/lib/online';
import { useSession } from '@/lib/session';
import { useTheme, type ThemePref } from '@/lib/theme';
import { NAV, NAV_GROUPS } from './nav';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  newOrder: 'New order',
  queue: 'Queue',
  shift: 'Shift',
  cash: 'Cash out',
  approvals: 'Approvals',
  reports: 'Reports',
  invoices: 'Invoices',
  staff: 'Staff',
  attendance: 'Attendance',
  leave: 'Leave',
  payroll: 'Payroll',
  audit: 'Audit log',
  settings: 'Settings',
};

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 font-display text-lg font-bold', className)}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-lime text-xs font-black text-ink">
        SW
      </span>
      <span>
        STOP<span className="text-lime">WASH</span>
      </span>
    </span>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useSession();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV_GROUPS.map((g) => {
        const items = NAV.filter((n) => n.group === g && can(n.permission));
        if (!items.length) return null;
        return (
          <ul key={g} className="flex flex-col gap-0.5">
            {items.map(({ to, key, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white',
                      isActive && 'bg-lime text-ink hover:bg-lime hover:text-ink',
                    )
                  }
                >
                  <Icon className="size-5" aria-hidden />
                  {LABELS[key] ?? key}
                </NavLink>
              </li>
            ))}
          </ul>
        );
      })}
    </nav>
  );
}

const NEXT_THEME: Record<ThemePref, ThemePref> = { light: 'dark', dark: 'system', system: 'light' };
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle() {
  const { pref, setPref } = useTheme();
  const Icon = THEME_ICON[pref];
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setPref(NEXT_THEME[pref])}
      aria-label={`Theme: ${pref}. Switch theme`}
    >
      <Icon aria-hidden />
    </Button>
  );
}

export function OfflineBadge() {
  const online = useOnline();
  if (online) return null;
  return (
    <Badge tone="warning" role="status">
      <WifiOff aria-hidden /> Offline
    </Badge>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useSession();
  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto bg-navy p-4 lg:flex">
        <Wordmark className="px-2 text-white" />
        <NavList />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu aria-hidden />
          </Button>
          <Wordmark className="lg:hidden" />
          <div className="ml-auto flex items-center gap-2">
            <OfflineBadge />
            <ThemeToggle />
            {user && (
              <>
                <span className="hidden text-sm sm:inline">
                  <span className="font-semibold">{user.name}</span>{' '}
                  <span className="text-fg-muted capitalize">· {user.role}</span>
                </span>
                <Button variant="ghost" size="icon" onClick={signOut} aria-label="Switch user">
                  <LogOut aria-hidden />
                </Button>
              </>
            )}
          </div>
        </header>
        <main id="main" className="flex-1 p-3 sm:p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Sheet
        side="left"
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Menu"
        hideTitle
        className="bg-navy p-4"
      >
        <Wordmark className="mb-6 px-2 text-white" />
        <NavList onNavigate={() => setMenuOpen(false)} />
      </Sheet>
    </div>
  );
}
