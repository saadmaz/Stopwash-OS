import { act, render, screen } from '@testing-library/react';
import { publishDisplay } from './channel';
import { CustomerDisplayPage, DisplayView } from './CustomerDisplayPage';

describe('customer display', () => {
  it('shows order lines and the total', () => {
    render(
      <DisplayView
        state={{
          kind: 'order',
          plate: 'CAB-1234',
          lines: [{ name: 'Car wash', qty: 1, totalCents: 150000 }],
          subtotalCents: 150000,
          discountCents: 10000,
          totalCents: 140000,
        }}
      />,
    );
    expect(screen.getByText('CAB-1234')).toBeInTheDocument();
    expect(screen.getByText('Car wash')).toBeInTheDocument();
    expect(screen.getByText(/1,400\.00/)).toBeInTheDocument();
  });

  it('holds the thank-you screen when the checkout closes', async () => {
    if (typeof BroadcastChannel === 'undefined') return;
    render(<CustomerDisplayPage />);
    expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    await act(async () => {
      publishDisplay({ kind: 'paid', totalCents: 140000 });
      await new Promise((r) => setTimeout(r, 20));
      publishDisplay({ kind: 'idle' });
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
  });
});
