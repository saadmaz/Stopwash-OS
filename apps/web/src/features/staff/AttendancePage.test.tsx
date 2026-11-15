import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/lib/session';
import { AttendancePage, attendancePdf } from './AttendancePage';

const ROSTER = {
  items: [
    { employeeId: 'e1', name: 'Kasun', code: 'SW001', jobTitle: 'Washer', status: null },
    { employeeId: 'e2', name: 'Nimal', code: 'SW002', jobTitle: 'Washer', status: 'LEAVE' },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('AttendancePage', () => {
  it('marks everyone present (keeping leave) and saves', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((url, init) =>
        Promise.resolve(
          new Response(JSON.stringify(init?.method === 'PUT' ? { saved: 1 } : ROSTER)),
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
          <AttendancePage />
        </QueryClientProvider>
      </SessionProvider>,
    );
    await screen.findByText('Kasun');
    await userEvent.click(screen.getByRole('button', { name: 'All Present' }));
    const kasun = screen.getByRole('radiogroup', { name: 'Attendance for Kasun' });
    expect(kasun.querySelector('[aria-checked="true"]')).toHaveTextContent('Present');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(JSON.parse(String(init?.body)).entries).toEqual([
      { employeeId: 'e1', status: 'PRESENT' },
      { employeeId: 'e2', status: 'LEAVE' },
    ]);
  });

  it('builds the colour-coded attendance PDF', async () => {
    const blob = await attendancePdf(
      [{ date: '2026-11-15', employeeId: 'e1', status: 'LATE' } as never],
      new Map([['e1', 'Kasun']]),
      '2026-11-01',
      '2026-11-15',
    );
    expect(blob.type).toBe('application/pdf');
  });
});
