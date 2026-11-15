import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BusinessProfileForm } from './BusinessProfileForm';

afterEach(() => vi.restoreAllMocks());

describe('BusinessProfileForm', () => {
  it('saves bank details and clears empty fields to null', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(DEFAULT_SETTINGS), { status: 200 }));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BusinessProfileForm settings={DEFAULT_SETTINGS} />
      </QueryClientProvider>,
    );
    await userEvent.type(screen.getByLabelText(/Bank details/), 'BOC 0001234');
    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.business).toMatchObject({ bankDetails: 'BOC 0001234', email: null });
    expect(body.invoice.nextNumberSeed).toBe(55100);
  });
});
