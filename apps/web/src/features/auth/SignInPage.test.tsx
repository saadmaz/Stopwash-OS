import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider } from '@/lib/theme';
import { SignInPage } from './SignInPage';

const STAFF = [
  { id: 'e1', name: 'Kasun Perera', code: 'SW001', jobTitle: 'Washer', initials: 'KP' },
];

function json(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function WhoAmI() {
  const { user } = useSession();
  return <output data-testid="who">{user?.name ?? 'nobody'}</output>;
}

function renderPage() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <SignInPage />
          <WhoAmI />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>,
  );
}

beforeAll(() => {
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('SignInPage', () => {
  it('asks to register the device first', async () => {
    renderPage();
    expect(screen.getByText('Register this device')).toBeInTheDocument();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => json(200, { staff: STAFF }));
    await userEvent.type(screen.getByLabelText(/Device ID/), 'dev-counter');
    await userEvent.type(screen.getByLabelText(/Device secret/), 'counter-secret-0123456789');
    await userEvent.click(screen.getByRole('button', { name: 'Save device' }));
    expect(await screen.findByText('Kasun Perera')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/auth\/device\/staff$/);
  });

  it('signs in with the PIN and keeps the session for this tab', async () => {
    localStorage.setItem(
      'sw:device',
      JSON.stringify({ deviceId: 'd', deviceSecret: 'x'.repeat(20) }),
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      String(url).endsWith('/auth/pin')
        ? json(200, {
            token: 'tok',
            expiresAt: '2030-01-01T00:00:00Z',
            user: {
              id: 'emp:e1',
              name: 'Kasun Perera',
              role: 'cashier',
              brandId: 'stopwash',
              locationIds: ['katubedda'],
            },
          })
        : json(200, { staff: STAFF }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Kasun Perera/ }));
    expect(screen.getByText('Hi Kasun Perera, enter your PIN')).toBeInTheDocument();
    await userEvent.keyboard('4826');
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('Kasun Perera'));
    expect(JSON.parse(sessionStorage.getItem('sw:session')!).token).toBe('tok');
  });

  it('shows a translated error for a wrong PIN and clears the pad', async () => {
    localStorage.setItem(
      'sw:device',
      JSON.stringify({ deviceId: 'd', deviceSecret: 'x'.repeat(20) }),
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      String(url).endsWith('/auth/pin')
        ? json(401, { error: { code: 'PIN_INVALID', message: 'Incorrect PIN' } })
        : json(200, { staff: STAFF }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Kasun Perera/ }));
    await userEvent.keyboard('1112');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect PIN');
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
  });
});
