import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Languages, Moon, Palette, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { LANGUAGES } from '@/i18n';
import { SHORTCUTS, shortcutLabel, useHotkeys } from '@/lib/hotkeys';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { NAV } from './nav';

const OPEN_EVENT = 'sw:open-palette';
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

const NAV_SHORTCUT: Record<string, string> = {
  '/pos': SHORTCUTS.newOrder,
  '/queue': SHORTCUTS.queue,
  '/shift': SHORTCUTS.shift,
};

function Item({
  onSelect,
  icon,
  children,
  shortcut,
}: {
  onSelect: () => void;
  icon: ReactNode;
  children: ReactNode;
  shortcut?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex h-11 cursor-default items-center gap-3 rounded-md px-3 text-sm text-fg data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-fg-muted"
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <kbd className="rounded border border-border px-1.5 text-xs text-fg-muted">
          {shortcutLabel(shortcut)}
        </kbd>
      )}
    </Command.Item>
  );
}

/** Ctrl/⌘K palette plus the global navigation shortcuts. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { setPref } = useTheme();
  const items = NAV.filter((n) => can(n.permission));

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    void navigate(to);
  };

  useHotkeys({
    [SHORTCUTS.palette]: () => setOpen((o) => !o),
    ...Object.fromEntries(
      Object.entries(NAV_SHORTCUT)
        .filter(([to]) => items.some((n) => n.to === to))
        .map(([to, combo]) => [combo, () => go(to)]),
    ),
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <DialogPrimitive.Content className="fixed top-[15vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <DialogPrimitive.Title className="sr-only">{t('palette.title')}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t('palette.hint')}
          </DialogPrimitive.Description>
          <Command label={t('palette.title')} loop>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-fg-subtle" aria-hidden />
              <Command.Input
                placeholder={t('palette.placeholder')}
                className="h-12 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              <Command.Empty className="p-4 text-center text-sm text-fg-muted">
                {t('palette.empty')}
              </Command.Empty>
              <Command.Group heading={t('palette.goTo')}>
                {items.map(({ to, key, icon: Icon }) => (
                  <Item
                    key={to}
                    onSelect={() => go(to)}
                    icon={<Icon />}
                    shortcut={NAV_SHORTCUT[to]}
                  >
                    {t(`nav.${key}`)}
                  </Item>
                ))}
                <Item onSelect={() => go('/design-system')} icon={<Palette />}>
                  {t('palette.designSystem')}
                </Item>
              </Command.Group>
              <Command.Group heading={t('palette.preferences')}>
                {(['light', 'dark', 'system'] as const).map((p) => (
                  <Item
                    key={p}
                    onSelect={() => {
                      setPref(p);
                      setOpen(false);
                    }}
                    icon={<Moon />}
                  >
                    {t('palette.theme', { theme: t(`shell.theme.${p}`) })}
                  </Item>
                ))}
                {LANGUAGES.map((l) => (
                  <Item
                    key={l.code}
                    onSelect={() => {
                      void i18n.changeLanguage(l.code);
                      setOpen(false);
                    }}
                    icon={<Languages />}
                  >
                    {l.name}
                  </Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
