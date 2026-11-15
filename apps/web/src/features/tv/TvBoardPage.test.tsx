import type { Order } from '@stopwash/shared';
import { render, screen, within } from '@testing-library/react';
import { BoardColumn } from './TvBoardPage';

const order = (id: string, ticket: number, plate: string) =>
  ({ id, ticket, plateDisplay: plate, customerName: 'Nimal Perera' }) as unknown as Order;

describe('TV board column', () => {
  it('shows ticket and plate but never the customer name', () => {
    render(
      <BoardColumn
        status="READY"
        orders={[order('a', 7, 'CAB-1234'), order('b', 9, 'WP KA-5678')]}
      />,
    );
    const col = screen.getByRole('region', { name: /Ready/ });
    expect(within(col).getByText('#7')).toBeInTheDocument();
    expect(within(col).getByText('WP KA-5678')).toBeInTheDocument();
    expect(screen.queryByText(/Nimal/)).not.toBeInTheDocument();
  });
});
