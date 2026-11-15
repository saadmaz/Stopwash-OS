import { render, screen } from '@testing-library/react';
import { HourHeatmap, SplitBar } from './charts';

describe('dashboard charts', () => {
  it('labels both parts of the retention bar (never colour alone)', () => {
    render(
      <SplitBar
        parts={[
          { label: 'Returning', value: 2, pct: 67 },
          { label: 'New', value: 1, pct: 33 },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Returning 67%, New 33%' })).toBeInTheDocument();
    expect(screen.getByText('Returning')).toBeInTheDocument();
  });

  it('gives every heatmap cell an accessible value', () => {
    const cents = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    cents[6]![10] = 125000;
    render(<HourHeatmap cents={cents} caption="Revenue by hour" />);
    expect(screen.getByRole('table', { name: 'Revenue by hour' })).toBeInTheDocument();
    expect(screen.getByText('Sat 10:00 LKR 1,250.00')).toBeInTheDocument();
  });
});
