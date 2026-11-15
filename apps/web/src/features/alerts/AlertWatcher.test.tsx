import { toast } from '@stopwash/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { SessionProvider, type SessionUser } from '@/lib/session';
import { AlertWatcher } from './AlertWatcher';

const user = (role: SessionUser['role']): SessionUser => ({
  id: 'u',
  name: 'U',
  role,
  brandId: 'stopwash',
  locationIds: ['katubedda'],
});

const mount = (role: SessionUser['role']) =>
  render(
    <SessionProvider initialUser={user(role)}>
      <QueryClientProvider client={new QueryClient()}>
        <AlertWatcher />
      </QueryClientProvider>
    </SessionProvider>,
  );

afterEach(() => vi.restoreAllMocks());

describe('AlertWatcher', () => {
  it('raises one toast per new alert for managers', async () => {
    const alert = {
      id: 'a1',
      kind: 'VARIANCE',
      severity: 'danger',
      message: 'Variance LKR 900.00',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [alert] }), { status: 200 }),
    );
    const err = vi.spyOn(toast, 'error');
    mount('manager');
    await waitFor(() => expect(err).toHaveBeenCalledTimes(1));
    expect(err.mock.calls[0]?.[0]).toBe('Cash variance');
  });

  it('does not poll for cashiers', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    mount('cashier');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
