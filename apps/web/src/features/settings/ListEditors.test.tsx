import type { CashCategory } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CashCategoryEditor } from './ListEditors';

const cat = (code: string, en: string): CashCategory => ({
  id: `stopwash__${code.toLowerCase()}`,
  brandId: 'stopwash',
  createdAt: '2026-11-15T00:00:00.000Z',
  createdBy: 'seed',
  updatedAt: null,
  updatedBy: null,
  type: code.startsWith('E') ? 'EXPENSE' : 'DEPOSIT',
  code,
  name: { en },
  sort: 0,
  active: true,
});

afterEach(() => vi.restoreAllMocks());

describe('CashCategoryEditor', () => {
  it('adds the next E-code', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 201 }));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CashCategoryEditor
          items={[
            cat('E001', 'Cleaning supplies'),
            cat('E007', 'Misc'),
            cat('D001', 'Bank deposit'),
          ]}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByText('Bank deposit')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New category (E008)'), 'Generator fuel');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      type: 'EXPENSE',
      code: 'E008',
      name: { en: 'Generator fuel' },
    });
  });
});
