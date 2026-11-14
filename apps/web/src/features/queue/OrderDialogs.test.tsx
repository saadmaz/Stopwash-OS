import type { Order } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditOrderDialog, RefundDialog } from './OrderDialogs';

const order = {
  id: 'o1',
  ticket: 3,
  plateDisplay: 'WP CAB-1234',
  customerName: null,
  customerPhone: null,
  paidCents: 75000,
} as unknown as Order;

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

afterEach(() => vi.restoreAllMocks());

describe('order correction dialogs', () => {
  it('edit sends the corrected plate with a reason', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const onClose = vi.fn();
    wrap(<EditOrderDialog order={order} onClose={onClose} />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled(); // reason missing
    await userEvent.clear(screen.getByLabelText(/Vehicle plate/));
    await userEvent.type(screen.getByLabelText(/Vehicle plate/), 'WP CAB-1243');
    await userEvent.type(screen.getByLabelText(/What changed/), 'Typo');
    await userEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/orders\/o1$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toMatchObject({ plate: 'WP CAB-1243', reason: 'Typo' });
  });

  it('refund needs a reason and shows the amount', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    wrap(<RefundDialog order={order} onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Refund LKR 750.00' });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason for refund/), 'Unhappy');
    await userEvent.click(btn);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/orders\/o1\/refund$/);
  });
});
