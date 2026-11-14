import { DEFAULT_SETTINGS, type CatalogItem } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewOrderPage } from './NewOrderPage';

const item = (
  code: string,
  kind: CatalogItem['kind'],
  priceCents: number,
  icon: string | null = null,
  maxQty = 1,
): CatalogItem => ({
  id: `stopwash__${code.toLowerCase()}`,
  brandId: 'stopwash',
  createdAt: '2026-11-15T00:00:00.000Z',
  createdBy: 'seed',
  updatedAt: null,
  updatedBy: null,
  kind,
  code,
  name: { en: code.charAt(0) + code.slice(1).toLowerCase() },
  description: null,
  priceCents,
  maxQty,
  locationIds: null,
  icon,
  sort: 0,
  active: true,
});

const CONFIG = {
  locationId: 'katubedda',
  settings: DEFAULT_SETTINGS,
  catalog: [
    item('BIKE', 'vehicleClass', 50000, 'bike'),
    item('SMALL', 'vehicleClass', 75000, 'car'),
    item('WAX', 'addon', 25000),
    item('FRESHENER', 'product', 50000, null, 10),
  ],
  checklistItems: [],
  cashCategories: [],
};

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const u = String(url);
    if (u.includes('/config')) return Promise.resolve(new Response(JSON.stringify(CONFIG)));
    if (u.includes('/lookup'))
      return Promise.resolve(new Response(JSON.stringify({ vehicles: [], customers: [] })));
    if (u.endsWith('/orders') && init?.method === 'POST') {
      return Promise.resolve(
        new Response(JSON.stringify({ ticket: 7, plateDisplay: 'WP CAB-1234' }), { status: 201 }),
      );
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NewOrderPage />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('NewOrderPage', () => {
  it('builds an order with live totals and submits it with an idempotency key', async () => {
    const fetchMock = mockApi();
    renderPage();
    const plate = await screen.findByLabelText('Vehicle plate');
    expect(screen.getByRole('button', { name: /Add order/ })).toBeDisabled();
    await userEvent.type(plate, 'wp cab-1234');
    await userEvent.click(screen.getByRole('radio', { name: /Small/ }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Increase' })[0]!); // wax
    await userEvent.click(screen.getAllByRole('button', { name: 'Increase' })[1]!); // freshener ×2
    await userEvent.click(screen.getAllByRole('button', { name: 'Increase' })[1]!);
    expect(screen.getByText('LKR 2,000.00')).toBeInTheDocument(); // 750 + 250 + 500×2
    await userEvent.click(screen.getByRole('button', { name: /Add order/ }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u, i]) => String(u).endsWith('/orders') && i?.method === 'POST',
        ),
      ).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/orders'))!;
    const body = JSON.parse(String(init?.body));
    expect(body.plate).toBe('wp cab-1234');
    expect(body.lines).toEqual([
      { itemId: 'stopwash__small', qty: 1 },
      { itemId: 'stopwash__wax', qty: 1 },
      { itemId: 'stopwash__freshener', qty: 2 },
    ]);
    expect((init?.headers as Record<string, string>)['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(plate).toHaveValue(''));
  });

  it('explains why an add-on alone cannot be ordered', async () => {
    mockApi();
    renderPage();
    await userEvent.type(await screen.findByLabelText('Vehicle plate'), 'X1');
    await userEvent.click(screen.getAllByRole('button', { name: 'Increase' })[0]!);
    expect(screen.getByText('Add-ons need a vehicle class or a product')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add order/ })).toBeDisabled();
  });

  it('selects a vehicle class with number keys', async () => {
    mockApi();
    renderPage();
    await screen.findByLabelText('Vehicle plate');
    fireEvent.keyDown(window, { key: '2', code: 'Digit2' });
    expect(screen.getByRole('radio', { name: /Small/ })).toHaveAttribute('aria-checked', 'true');
  });
});
