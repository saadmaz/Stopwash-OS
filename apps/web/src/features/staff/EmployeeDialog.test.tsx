import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider, type SessionUser } from '@/lib/session';
import { EmployeeDialog } from './EmployeeDialog';

const as = (role: SessionUser['role']): SessionUser => ({
  id: 'u',
  name: 'U',
  role,
  brandId: 'stopwash',
  locationIds: ['katubedda'],
});

function renderAs(role: SessionUser['role'], onClose = vi.fn()) {
  render(
    <SessionProvider initialUser={as(role)}>
      <QueryClientProvider client={new QueryClient()}>
        <EmployeeDialog employee={null} onClose={onClose} />
      </QueryClientProvider>
    </SessionProvider>,
  );
  return onClose;
}

afterEach(() => vi.restoreAllMocks());

describe('EmployeeDialog', () => {
  it('creates an employee with salary in cents and a PIN', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 201 }));
    const onClose = renderAs('manager');
    await userEvent.type(screen.getByLabelText(/Code/), 'sw010');
    await userEvent.type(screen.getByLabelText(/Full name/), 'Amal Silva');
    await userEvent.type(screen.getByLabelText(/Phone/), '0771112222');
    await userEvent.type(screen.getByLabelText(/Monthly base salary/), '40,000');
    await userEvent.type(screen.getByLabelText(/^PIN/), '3579');
    expect(
      screen.getByText('Basic net (before bonus and one-off items): LKR 40,000.00'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      code: 'SW010',
      baseSalaryCents: 4000000,
      recurringAdditionCents: 0,
      systemRole: null,
      pin: '3579',
      locationIds: ['katubedda'],
    });
  });

  it('only owners can offer manager access', async () => {
    renderAs('manager');
    await userEvent.click(screen.getByRole('combobox', { name: /POS access/ }));
    expect(screen.queryByRole('option', { name: 'Manager' })).not.toBeInTheDocument();
  });
});
