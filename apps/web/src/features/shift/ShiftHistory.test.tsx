import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/lib/session';
import { ShiftHistory } from './ShiftHistory';

const PAGE = {
  items: [
    {
      shift: {
        id: 's1',
        status: 'CLOSED',
        supervisorName: 'Dilani',
        openedAt: '2026-11-15T02:30:00.000Z',
        openingCents: 1000000,
        backdated: false,
      },
      close: null,
      latest: {
        kind: 'CLOSE',
        cashSalesCents: 75000,
        cardSalesCents: 0,
        countedCents: 1045000,
        varianceCents: -30000,
      },
    },
  ],
  total: 1,
  page: 1,
  pageCount: 1,
};

afterEach(() => vi.restoreAllMocks());

describe('ShiftHistory', () => {
  it('lists shifts and lets a manager add an adjustment with a corrected count', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((url) =>
        Promise.resolve(
          new Response(
            JSON.stringify(String(url).endsWith('/adjust') ? { varianceCents: 0 } : PAGE),
          ),
        ),
      );
    render(
      <SessionProvider
        initialUser={{
          id: 'u',
          name: 'M',
          role: 'manager',
          brandId: 'stopwash',
          locationIds: ['katubedda'],
        }}
      >
        <QueryClientProvider client={new QueryClient()}>
          <ShiftHistory />
        </QueryClientProvider>
      </SessionProvider>,
    );
    expect(await screen.findByText('-LKR 300.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    await userEvent.type(screen.getByLabelText(/Corrected cash count/), '10,750');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Recounted the safe bag');
    await userEvent.click(screen.getByRole('button', { name: 'Adjust' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/s1/adjust'))).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/adjust'))!;
    expect(JSON.parse(String(init?.body))).toEqual({
      reason: 'Recounted the safe bag',
      countedCents: 1075000,
    });
  });
});
