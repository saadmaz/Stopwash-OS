import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoyaltyForm } from './LoyaltyForm';

afterEach(() => vi.restoreAllMocks());

describe('LoyaltyForm', () => {
  it('turns loyalty on with a custom cadence', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(DEFAULT_SETTINGS), { status: 200 }));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LoyaltyForm settings={DEFAULT_SETTINGS} />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByLabelText('Loyalty rewards on'));
    const nth = screen.getByLabelText('Reward every Nth visit');
    await userEvent.clear(nth);
    await userEvent.type(nth, '5');
    expect(screen.getByText(/Every 5th completed visit/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.loyalty).toEqual({ enabled: true, everyNth: 5, rewardPct: 50 });
  });

  it('rejects a cadence of 1', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LoyaltyForm settings={DEFAULT_SETTINGS} />
      </QueryClientProvider>,
    );
    const nth = screen.getByLabelText(/Reward every Nth visit/);
    await userEvent.clear(nth);
    await userEvent.type(nth, '1');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
