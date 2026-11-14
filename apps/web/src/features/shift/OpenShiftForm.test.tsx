import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenShiftForm } from './OpenShiftForm';

beforeEach(() =>
  localStorage.setItem(
    'sw:device',
    JSON.stringify({ deviceId: 'd', deviceSecret: 'x'.repeat(20) }),
  ),
);
afterEach(() => vi.restoreAllMocks());

describe('OpenShiftForm', () => {
  it('starts a shift with the counted float and chosen supervisor', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(
        String(url).endsWith('/auth/device/staff')
          ? new Response(
              JSON.stringify({
                staff: [
                  { id: 'e2', name: 'Dilani', canOpenShift: true },
                  { id: 'e9', name: 'Washer', canOpenShift: false },
                ],
              }),
            )
          : new Response(JSON.stringify({ openingCents: 1300000 }), { status: 201 }),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <OpenShiftForm denominations={DEFAULT_SETTINGS.denominations} checklistId="chk1" />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('Number of LKR 5,000 notes'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Number of LKR 1,000 notes'), {
      target: { value: '3' },
    });
    const start = screen.getByRole('button', { name: 'Start shift · LKR 13,000.00' });
    expect(start).toBeDisabled(); // no supervisor yet
    await userEvent.click(screen.getByRole('combobox', { name: /Supervisor/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Dilani' }));
    expect(screen.queryByRole('option', { name: 'Washer' })).not.toBeInTheDocument();
    await userEvent.click(start);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/shifts'))).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/shifts'))!;
    expect(JSON.parse(String(init?.body))).toEqual({
      supervisorEmployeeId: 'e2',
      checklistId: 'chk1',
      openingCount: { notes: { '500000': 2, '100000': 3 }, coinsCents: 0 },
      carryoverNotes: '',
    });
  });
});
