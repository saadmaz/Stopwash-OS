import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider, type SessionUser } from '@/lib/session';
import { ApprovalsPage } from './ApprovalsPage';

const DATA = {
  rows: [
    {
      shift: {
        id: 's1',
        status: 'CLOSED',
        supervisorName: 'Dilani',
        closedAt: '2026-11-15T12:00:00.000Z',
      },
      close: {
        cashSalesCents: 75000,
        cardSalesCents: 100000,
        otherSalesCents: 0,
        expectedCents: 970000,
        countedCents: 960000,
        varianceCents: -10000,
        vehicleCount: 2,
        notes: null,
      },
      approvals: [],
    },
  ],
  kpis: {
    pendingCount: 1,
    expectedCents: 970000,
    countedCents: 960000,
    expensesCents: 30000,
    varianceCents: -10000,
  },
};

const user = (role: SessionUser['role']): SessionUser => ({
  id: 'u',
  name: 'U',
  role,
  brandId: 'stopwash',
  locationIds: ['katubedda'],
});

function renderAs(role: SessionUser['role']) {
  render(
    <SessionProvider initialUser={user(role)}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ApprovalsPage />
      </QueryClientProvider>
    </SessionProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('ApprovalsPage', () => {
  it('shows KPIs and approves a shift', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(DATA))));
    renderAs('accounts');
    expect(await screen.findByText('LKR 300.00')).toBeInTheDocument(); // expenses KPI
    expect(screen.getByText('-LKR 100.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/shifts/s1/decision'))).toBe(
        true,
      ),
    );
  });

  it('hides approval actions from managers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(DATA))),
    );
    renderAs('manager');
    await screen.findByText('Dilani');
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
  });
});
