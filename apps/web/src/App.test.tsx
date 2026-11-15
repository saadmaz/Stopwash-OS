import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './app/router';
import { SessionProvider, type SessionUser } from './lib/session';
import { ThemeProvider } from './lib/theme';

const user = (role: SessionUser['role']): SessionUser => ({
  id: 'u1',
  name: 'Test User',
  role,
  brandId: 'stopwash',
  locationIds: ['katubedda'],
});

function renderAt(path: string, role: SessionUser['role']) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <SessionProvider initialUser={user(role)}>
        <QueryClientProvider client={new QueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('app shell', () => {
  beforeAll(() => {
    window.matchMedia ??= (() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });

  it('shows only the navigation a cashier may use', () => {
    renderAt('/shift', 'cashier');
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    expect(nav).toHaveTextContent('New order');
    expect(nav).toHaveTextContent('Queue');
    expect(nav).not.toHaveTextContent('Payroll');
    expect(nav).not.toHaveTextContent('Settings');
  });

  it('blocks pages the role cannot open', () => {
    renderAt('/payroll', 'cashier');
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('lets accounts reach approvals', () => {
    renderAt('/approvals', 'accounts');
    expect(screen.queryByText("You don't have access to this page")).not.toBeInTheDocument();
  });
});

describe('language switch', () => {
  it('translates the navigation to Sinhala and back', async () => {
    const { default: i18n } = await import('./i18n');
    renderAt('/shift', 'cashier');
    await act(() => i18n.changeLanguage('si'));
    expect(screen.getAllByRole('link', { name: 'පෝලිම' }).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe('si');
    await act(() => i18n.changeLanguage('en'));
    expect(screen.getAllByRole('link', { name: 'Queue' }).length).toBeGreaterThan(0);
  });
});

describe('command palette', () => {
  it('opens with Ctrl+K and lists only permitted pages', async () => {
    renderAt('/shift', 'cashier');
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Command menu' });
    expect(dialog).toHaveTextContent('New order');
    expect(dialog).not.toHaveTextContent('Payroll');
  });
});

describe('home route', () => {
  it('sends cashiers to the new order screen', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
    renderAt('/', 'cashier');
    const links = await screen.findAllByRole('link', { name: 'New order' });
    expect(links.some((l) => l.getAttribute('aria-current') === 'page')).toBe(true);
    vi.restoreAllMocks();
  });
});
