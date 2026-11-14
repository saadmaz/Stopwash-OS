import { act, render, screen } from '@testing-library/react';
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
        <RouterProvider router={router} />
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
    renderAt('/queue', 'cashier');
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
    renderAt('/queue', 'cashier');
    await act(() => i18n.changeLanguage('si'));
    expect(screen.getAllByRole('link', { name: 'පෝලිම' }).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe('si');
    await act(() => i18n.changeLanguage('en'));
    expect(screen.getAllByRole('link', { name: 'Queue' }).length).toBeGreaterThan(0);
  });
});
