import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '@/lib/session';
import { CashPage } from './CashPage';

const CONFIG = {
  locationId: 'katubedda',
  settings: DEFAULT_SETTINGS, // approval above LKR 5,000
  catalog: [],
  checklistItems: [],
  cashCategories: [
    { id: 'c1', type: 'EXPENSE', code: 'E001', name: { en: 'Cleaning supplies' }, active: true },
    { id: 'c2', type: 'DEPOSIT', code: 'D001', name: { en: 'Bank deposit' }, active: true },
  ],
};

function mockApi(shift: unknown = { id: 's1' }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const u = String(url);
    const json = (b: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(b), { status }));
    if (u.includes('/config')) return json(CONFIG);
    if (u.includes('/shifts/current')) return json({ shift });
    if (u.endsWith('/auth/device/staff'))
      return json({ staff: [{ id: 'e2', name: 'Dilani', role: 'manager' }] });
    if (u.endsWith('/cash-movements') && init?.method === 'POST') return json({ id: 'm1' }, 201);
    if (u.includes('/cash-movements')) return json({ items: [] });
    return json({}, 404);
  });
}

function renderPage() {
  render(
    <SessionProvider
      initialUser={{
        id: 'u',
        name: 'U',
        role: 'cashier',
        brandId: 'stopwash',
        locationIds: ['katubedda'],
      }}
    >
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <CashPage />
        </MemoryRouter>
      </QueryClientProvider>
    </SessionProvider>,
  );
}

beforeEach(() =>
  localStorage.setItem(
    'sw:device',
    JSON.stringify({ deviceId: 'd', deviceSecret: 'x'.repeat(20) }),
  ),
);
afterEach(() => vi.restoreAllMocks());

describe('CashPage', () => {
  it('asks to start a shift first', async () => {
    mockApi(null);
    renderPage();
    expect(
      await screen.findByText('Start a shift to record expenses and deposits'),
    ).toBeInTheDocument();
  });

  it('records an expense in cents', async () => {
    const fetchMock = mockApi();
    renderPage();
    await userEvent.click(await screen.findByRole('combobox', { name: /Category/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'E001 · Cleaning supplies' }));
    await userEvent.type(screen.getByLabelText(/Amount/), '1,500');
    await userEvent.type(screen.getByLabelText(/Paid to/), 'Hardware store');
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u, i]) => String(u).endsWith('/cash-movements') && i?.method === 'POST',
        ),
      ).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(
      ([u, i]) => String(u).endsWith('/cash-movements') && i?.method === 'POST',
    )!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: 'EXPENSE',
      categoryId: 'c1',
      amountCents: 150000,
      override: null,
    });
  });

  it('shows manager approval above the threshold', async () => {
    mockApi();
    renderPage();
    await userEvent.type(await screen.findByLabelText(/Amount/), '6000');
    expect(screen.getByText('Above LKR 5,000.00 needs a manager to approve.')).toBeInTheDocument();
  });
});
