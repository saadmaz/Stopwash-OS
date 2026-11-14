import type { Order } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider, type SessionUser } from '@/lib/session';
import { QueuePage } from './QueuePage';

const order = (id: string, ticket: number, status: Order['status']): Order => ({
  id,
  brandId: 'stopwash',
  locationId: 'katubedda',
  createdAt: '2026-11-15T04:00:00.000Z',
  createdBy: 'u',
  updatedAt: null,
  updatedBy: null,
  number: null,
  ticket,
  plateKey: `WP${ticket}`,
  plateDisplay: `WP CAB-${ticket}`,
  customerId: null,
  customerName: 'Nimal',
  customerPhone: null,
  returning: ticket === 1,
  lines: [
    {
      itemId: 'small',
      kind: 'vehicleClass',
      code: 'SMALL',
      name: 'Small (Car)',
      unitPriceCents: 75000,
      qty: 1,
      totalCents: 75000,
    },
  ],
  subtotalCents: 75000,
  discountCents: 0,
  discountReason: null,
  loyaltyDiscountCents: 0,
  taxCents: 0,
  totalCents: 75000,
  paidCents: 0,
  status,
  statusHistory: [],
  assignedEmployeeId: null,
  shiftId: null,
  businessDate: '2026-11-15',
  completedAt: null,
  cancelReason: null,
  backdated: false,
  source: 'counter',
});

const PAGE = {
  items: [order('a', 1, 'READY'), order('b', 2, 'QUEUED')],
  total: 2,
  page: 1,
  pageCount: 1,
  date: '2026-11-15',
  target: { completed: 9, target: 15 },
};

const user = (role: SessionUser['role']): SessionUser => ({
  id: 'u',
  name: 'U',
  role,
  brandId: 'stopwash',
  locationIds: ['katubedda'],
});

function renderAs(role: SessionUser['role']) {
  return render(
    <SessionProvider initialUser={user(role)}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <QueuePage />
      </QueryClientProvider>
    </SessionProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('QueuePage', () => {
  it('shows orders, statuses and today’s target', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(PAGE)));
    renderAs('cashier');
    expect(await screen.findByText('WP CAB-1')).toBeInTheDocument();
    expect(screen.getByText('9 / 15')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getAllByText('Returning')).toHaveLength(1);
    expect(screen.getByText('Ready', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument(); // cashier
  });

  it('moves an order to the next floor step', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(PAGE))));
    renderAs('cashier');
    await userEvent.click(await screen.findByRole('button', { name: /Start/ }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u, i]) =>
            String(u).endsWith('/orders/b/status') &&
            JSON.parse(String(i?.body)).status === 'IN_PROGRESS',
        ),
      ).toBe(true),
    );
  });

  it('searches with the query string', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(PAGE))));
    renderAs('manager');
    await userEvent.type(await screen.findByRole('textbox', { name: 'Search' }), 'cab');
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('q=cab'))).toBe(true),
    );
    expect(screen.getAllByRole('button', { name: 'Cancel order' }).length).toBeGreaterThan(0); // manager
  });
});
