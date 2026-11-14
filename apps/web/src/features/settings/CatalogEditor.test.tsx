import type { CatalogItem } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogEditor } from './CatalogEditor';

const item = (code: string, kind: CatalogItem['kind'], priceCents: number): CatalogItem => ({
  id: `stopwash__${code.toLowerCase()}`,
  brandId: 'stopwash',
  createdAt: '2026-11-15T00:00:00.000Z',
  createdBy: 'seed',
  updatedAt: null,
  updatedBy: null,
  kind,
  code,
  name: { en: code === 'WAX' ? 'Wax' : 'Small (Car)' },
  description: null,
  priceCents,
  maxQty: 1,
  locationIds: null,
  icon: null,
  sort: 0,
  active: true,
});

afterEach(() => vi.restoreAllMocks());

describe('CatalogEditor', () => {
  it('lists items with formatted prices', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CatalogEditor
          items={[item('WAX', 'addon', 25000), item('SMALL', 'vehicleClass', 75000)]}
        />
      </QueryClientProvider>,
    );
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]!).getByText('Small (Car)')).toBeInTheDocument(); // vehicle classes first
    expect(screen.getByText('LKR 250.00')).toBeInTheDocument();
  });

  it('reprices an item in rupees and sends cents', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(item('WAX', 'addon', 30000)), { status: 200 }),
      );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CatalogEditor items={[item('WAX', 'addon', 25000)]} />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit Wax' }));
    const price = screen.getByLabelText(/Price/);
    expect(price).toHaveValue('250.00');
    await userEvent.clear(price);
    await userEvent.type(price, '300');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/catalog\/stopwash__wax$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body)).priceCents).toBe(30000);
  });
});
