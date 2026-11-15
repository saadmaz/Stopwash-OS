import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/lib/session';
import { IncentiveRulesTab } from './IncentiveRulesTab';

afterEach(() => vi.restoreAllMocks());

describe('IncentiveRulesTab', () => {
  it('creates a rule with tiers in rupees sent as cents', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((url, init) =>
        Promise.resolve(new Response(JSON.stringify(init?.method === 'POST' ? {} : { items: [] }))),
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
          <IncentiveRulesTab />
        </QueryClientProvider>
      </SessionProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Add rule' }));
    await userEvent.type(screen.getByLabelText(/Rule name/), 'Standard');
    const targets = screen.getAllByLabelText('Vehicles (at least)');
    const bonuses = screen.getAllByLabelText('Bonus (LKR)');
    await userEvent.type(targets[0]!, '10');
    await userEvent.type(bonuses[0]!, '250');
    await userEvent.type(targets[1]!, '15');
    await userEvent.type(bonuses[1]!, '500');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Standard',
      weekdayTiers: [{ target: 10, bonusCents: 25000 }],
      weekendTiers: [{ target: 15, bonusCents: 50000 }],
    });
  });
});
