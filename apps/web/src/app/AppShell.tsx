import { Badge, Button, cn, Sheet, Skeleton } from '@stopwash/ui';
import { LogOut, Menu, Monitor, Moon, Search, Sun, WifiOff } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { LANGUAGES } from '@/i18n';
import { useOnline } from '@/lib/online';
import { useSession } from '@/lib/session';
import { AlertWatcher } from '@/features/alerts/AlertWatcher';
import { OutboxStatus } from '@/features/outbox/OutboxStatus';
import { useTheme, type ThemePref } from '@/lib/theme';
import { Logo } from './Logo';
import { NAV, NAV_GROUPS } from './nav';
import { CommandPalette, openCommandPalette } from './CommandPalette';
import { SHORTCUTS, shortcutLabel } from '@/lib/hotkeys';

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useSession();
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.main')} className="flex flex-col gap-5">
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
                  {t(`nav.${key}`)}
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
  const { t } = useTranslation();
  const Icon = THEME_ICON[pref];
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setPref(NEXT_THEME[pref])}
      aria-label={t('shell.theme.label', { theme: t(`shell.theme.${pref}`) })}
    >
      <Icon aria-hidden />
    </Button>
  );
}

export function OfflineBadge() {
  const online = useOnline();
  const { t } = useTranslation();
  if (online) return null;
  return (
    <Badge tone="warning" role="status">
      <WifiOff aria-hidden /> {t('shell.offline')}
    </Badge>
  );
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('shell.language')}
      className="flex rounded-md bg-surface-2 p-0.5"
    >
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={i18n.language === l.code}
          aria-label={l.name}
          onClick={() => void i18n.changeLanguage(l.code)}
          className={cn(
            'h-9 min-w-9 rounded px-2 text-xs font-semibold text-fg-muted focus-visible:outline-2 focus-visible:outline-ring',
            i18n.language === l.code && 'bg-surface text-fg shadow-xs',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useSession();
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('app.skipToContent')}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto bg-navy p-4 lg:flex">
        <Logo className="ml-2 text-lime" />
        <NavList />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label={t('nav.openMenu')}
          >
            <Menu aria-hidden />
          </Button>
          <Logo className="h-6 text-ink lg:hidden dark:text-lime" />
          <Button
            variant="outline"
            size="sm"
            className="ml-2 hidden text-fg-muted md:inline-flex"
            onClick={openCommandPalette}
          >
            <Search aria-hidden /> {t('palette.open')}
            <kbd className="ml-2 text-xs">{shortcutLabel(SHORTCUTS.palette)}</kbd>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <OfflineBadge />
            <OutboxStatus />
            <LanguageSwitcher />
            <ThemeToggle />
            {user && (
              <>
                <span className="hidden text-sm sm:inline">
                  <span className="font-semibold">{user.name}</span>{' '}
                  <span className="text-fg-muted">· {t(`role.${user.role}`)}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  aria-label={t('shell.switchUser')}
                >
                  <LogOut aria-hidden />
                </Button>
              </>
            )}
          </div>
        </header>
        <CommandPalette />
        <AlertWatcher />
        <main id="main" className="flex-1 p-3 sm:p-5 lg:p-8">
          <Suspense
            fallback={
              <div aria-busy="true" className="flex flex-col gap-4">
                <Skeleton className="h-9 w-56" />
                <Skeleton className="h-64" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Sheet
        side="left"
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t('nav.menu')}
        hideTitle
        className="bg-navy p-4"
      >
        <Logo className="mb-6 ml-2 text-lime" />
        <NavList onNavigate={() => setMenuOpen(false)} />
      </Sheet>
    </div>
  );
}
