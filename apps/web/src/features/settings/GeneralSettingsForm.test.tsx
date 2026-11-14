import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeneralSettingsForm } from './GeneralSettingsForm';

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <GeneralSettingsForm settings={DEFAULT_SETTINGS} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('GeneralSettingsForm', () => {
  it('shows rupee amounts and saves cents', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(DEFAULT_SETTINGS), { status: 200 }));
    renderForm();
    expect(screen.getByLabelText('Variance needing an explanation')).toHaveValue('500.00');
    const target = screen.getByLabelText('Daily vehicle target');
    await userEvent.clear(target);
    await userEvent.type(target, '20');
    await userEvent.type(screen.getByLabelText('Low stock'), '077 123 4567');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.dailyVehicleTarget).toBe(20);
    expect(body.variance).toEqual({ explainAboveCents: 50000, overrideAboveCents: 200000 });
    expect(body.notificationNumbers.stock).toEqual(['+94771234567']);
  });

  it('blocks an override threshold below the explanation threshold', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderForm();
    const override = screen.getByLabelText('Variance needing a manager override');
    await userEvent.clear(override);
    await userEvent.type(override, '100');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Must be at least the explanation amount')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
