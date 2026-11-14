import type { Order } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutSheet } from './CheckoutSheet';

const ORDER = {
  id: 'o1',
  ticket: 4,
  plateDisplay: 'WP CAB-1234',
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
    {
      itemId: 'wax',
      kind: 'addon',
      code: 'WAX',
      name: 'Wax',
      unitPriceCents: 25000,
      qty: 1,
      totalCents: 25000,
    },
  ],
} as unknown as Order;

function mock() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const u = String(url);
    if (u.includes('/quote')) {
      const d = Number(new URL(u).searchParams.get('discountCents'));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            subtotalCents: 100000,
            loyaltyDiscountCents: 0,
            discountCents: d,
            taxCents: 0,
            totalCents: 100000 - d,
            discountNeedsApproval: d > 20000,
          }),
        ),
      );
    }
    if (u.endsWith('/checkout')) {
      return Promise.resolve(
        new Response(JSON.stringify({ order: { number: '1511001' }, payments: [] })),
      );
    }
    if (u.endsWith('/auth/device/staff')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            staff: [
              { id: 'e2', name: 'Dilani', role: 'manager' },
              { id: 'e1', name: 'Kasun', role: 'cashier' },
            ],
          }),
        ),
      );
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

function renderSheet(onPaid = vi.fn()) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CheckoutSheet order={ORDER} onClose={() => {}} onPaid={onPaid} />
    </QueryClientProvider>,
  );
  return onPaid;
}

beforeEach(() =>
  localStorage.setItem(
    'sw:device',
    JSON.stringify({ deviceId: 'd', deviceSecret: 'x'.repeat(20) }),
  ),
);
afterEach(() => vi.restoreAllMocks());

describe('CheckoutSheet', () => {
  it('shows change for cash and pays a split exactly', async () => {
    const fetchMock = mock();
    const onPaid = renderSheet();
    expect(
      await screen.findByText('LKR 1,000.00', { selector: 'span[aria-live]' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Cash received'), '1500');
    expect(screen.getByText('Change: LKR 500.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Split' }));
    await userEvent.type(screen.getByLabelText('Cash part'), '400');
    expect(screen.getByText('Card part: LKR 600.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Take LKR 1,000.00/ }));
    await waitFor(() => expect(onPaid).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/checkout'))!;
    expect(JSON.parse(String(init?.body)).tenders).toEqual([
      { method: 'CASH', amountCents: 40000 },
      { method: 'CARD', amountCents: 60000 },
    ]);
  });

  it('asks for a reason and a manager PIN on a large discount', async () => {
    mock();
    renderSheet();
    await screen.findByText('LKR 1,000.00', { selector: 'span[aria-live]' });
    await userEvent.click(screen.getByText('Add a discount'));
    await userEvent.type(screen.getByLabelText('Discount'), '500');
    expect(
      await screen.findByText('This discount needs a manager to approve it.'),
    ).toBeInTheDocument();
    const pay = screen.getByRole('button', { name: /Take LKR 500.00/ });
    expect(pay).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason for discount/), 'Complaint');
    await userEvent.type(screen.getByLabelText('Manager PIN'), '7391');
    expect(pay).toBeDisabled(); // no manager chosen yet
  });
});
