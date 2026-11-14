import type { ChecklistItem } from '@stopwash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertLinks, ChecklistForm, type ChecklistResult } from './ChecklistForm';

const item = (id: string, kind: ChecklistItem['kind'], en: string): ChecklistItem =>
  ({
    id,
    kind,
    name: { en },
    okLabel: { en: kind === 'stock' ? 'Have stock' : 'Working' },
    faultLabel: { en: kind === 'stock' ? 'Running low' : 'Faulty' },
    active: true,
  }) as ChecklistItem;

const ITEMS = [
  item('s1', 'stock', 'Shampoo'),
  item('s2', 'stock', 'Tyre shine'),
  item('e1', 'equipment', 'Pressure gun'),
];

afterEach(() => vi.restoreAllMocks());

describe('ChecklistForm', () => {
  it('submits every answer on a pre-shift check', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ checklist: {}, alerts: [], whatsapp: [] }), { status: 201 }),
      );
    const onDone = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChecklistForm items={ITEMS} mode="PRE_SHIFT" onDone={onDone} />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getAllByRole('radio', { name: 'Running low' })[0]!);
    await userEvent.click(screen.getByRole('radio', { name: 'Faulty' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).entries).toEqual([
      { itemId: 's1', status: 'FAULT' },
      { itemId: 's2', status: 'OK' },
      { itemId: 'e1', status: 'FAULT' },
    ]);
  });

  it('request mode shows only stock and needs a low item', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChecklistForm items={ITEMS} mode="REQUEST" onDone={() => {}} />
      </QueryClientProvider>,
    );
    expect(screen.queryByText('Pressure gun')).not.toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Send stock request' });
    expect(send).toBeDisabled();
    await userEvent.click(screen.getAllByRole('radio', { name: 'Running low' })[1]!);
    expect(send).toBeEnabled();
  });

  it('offers one WhatsApp link per configured number', () => {
    const result = {
      alerts: [{ id: 'a', message: 'Faulty: Pressure gun' }],
      whatsapp: [
        { kind: 'equipment', phone: '+94772222222', url: 'https://wa.me/94772222222?text=x' },
      ],
    } as unknown as ChecklistResult;
    render(<AlertLinks result={result} />);
    expect(
      screen.getByRole('link', { name: /WhatsApp \+94772222222 \(equipment\)/ }),
    ).toHaveAttribute('href', 'https://wa.me/94772222222?text=x');
  });
});
