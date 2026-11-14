import { DEFAULT_SETTINGS, type Shift } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/lib/session';
import { CloseShiftSheet } from './CloseShiftSheet';

const SHIFT = { id: 's1', supervisorName: 'Dilani' } as Shift;
const SUMMARY = {
  shift: SHIFT,
  reconciliation: {
    openingCents: 1_000_000,
    cashSalesCents: 75_000,
    cardSalesCents: 100_000,
    otherSalesCents: 0,
    totalSalesCents: 175_000,
    expensesCents: 20_000,
    depositsCents: 0,
    expectedCents: 1_055_000,
    countedCents: null,
    varianceCents: null,
    label: null,
    needsExplanation: false,
    needsOverride: false,
  },
  vehicleCount: 2,
  openOrders: 1,
};

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const u = String(url);
    const json = (b: unknown) => Promise.resolve(new Response(JSON.stringify(b)));
    if (u.includes('/summary')) return json(SUMMARY);
    if (u.includes('/config'))
      return json({
        settings: DEFAULT_SETTINGS,
        catalog: [],
        checklistItems: [],
        cashCategories: [],
      });
    if (u.endsWith('/auth/device/staff'))
      return json({
        staff: [
          { id: 'e1', name: 'Kasun', role: 'cashier', canOpenShift: true },
          { id: 'e2', name: 'Dilani', role: 'manager', canOpenShift: true },
        ],
      });
    if (u.endsWith('/close'))
      return json({
        close: { id: 'c1', varianceCents: -55000 },
        reconciliation: SUMMARY.reconciliation,
        whatsapp: [],
      });
    return json({});
  });
}

function renderSheet(onClosed = vi.fn()) {
  render(
    <SessionProvider
      initialUser={{
        id: 'emp:e1',
        name: 'Kasun',
        role: 'cashier',
        brandId: 'stopwash',
        locationIds: ['katubedda'],
        employeeId: 'e1',
      }}
    >
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CloseShiftSheet shift={SHIFT} onClose={() => {}} onClosed={onClosed} />
      </QueryClientProvider>
    </SessionProvider>,
  );
  return onClosed;
}

beforeEach(() =>
  localStorage.setItem(
    'sw:device',
    JSON.stringify({ deviceId: 'd', deviceSecret: 'x'.repeat(20) }),
  ),
);
afterEach(() => vi.restoreAllMocks());

describe('CloseShiftSheet', () => {
  it('shows expected cash, a live shortage and requires an explanation and handover', async () => {
    const fetchMock = mockApi();
    const onClosed = renderSheet();
    expect(await screen.findByText('LKR 10,550.00')).toBeInTheDocument();
    expect(screen.getByText('1 car is still in the queue.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Number of LKR 1,000 notes'), {
      target: { value: '10' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Shortage');
    expect(screen.getByRole('status')).toHaveTextContent('-LKR 550.00');
    const closeBtn = screen.getByRole('button', { name: 'Close & sign off' });
    expect(closeBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Notes \/ explanation/), 'Gave change twice');
    await userEvent.click(screen.getByRole('combobox', { name: /Incoming supervisor/ }));
    expect(screen.queryByRole('option', { name: 'Kasun' })).not.toBeInTheDocument(); // not yourself
    await userEvent.click(await screen.findByRole('option', { name: 'Dilani' }));
    await userEvent.type(screen.getByLabelText('Their PIN'), '7391');
    await userEvent.click(closeBtn);
    await waitFor(() => expect(onClosed).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/close'))!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      closingCount: { notes: { '100000': 10 } },
      notes: 'Gave change twice',
      handover: { employeeId: 'e2', pin: '7391' },
      override: null,
    });
  });
});
