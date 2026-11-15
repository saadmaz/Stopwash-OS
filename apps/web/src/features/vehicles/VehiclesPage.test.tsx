import type { Order, Vehicle } from '@stopwash/shared';
import { render, screen } from '@testing-library/react';
import { VehicleHistory } from './VehiclesPage';

describe('VehicleHistory', () => {
  it('shows visit stats and past orders', () => {
    const vehicle = {
      plateDisplay: 'CAB-1234',
      vehicleClassCode: 'SMALL',
      visitCount: 3,
      totalSpentCents: 450000,
      firstSeenAt: '2026-09-01T04:00:00.000Z',
      lastSeenAt: '2026-11-15T04:00:00.000Z',
    } as Vehicle;
    const order = {
      id: 'o1',
      createdAt: '2026-11-15T04:00:00.000Z',
      lines: [{ name: 'Car wash', qty: 1 }],
      number: '15110001',
      status: 'COMPLETED',
      totalCents: 150000,
    } as unknown as Order;
    render(
      <VehicleHistory
        data={{
          vehicle,
          customer: { name: 'Nimal', phone: '+94771234567' } as never,
          orders: [order],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'CAB-1234' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Car wash')).toBeInTheDocument();
    expect(screen.getByText('#15110001')).toBeInTheDocument();
  });
});
