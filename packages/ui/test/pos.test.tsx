import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  AddOnStepper,
  countTotal,
  DenominationCounter,
  PinPad,
  VehicleClassTile,
  type DenominationCount,
} from '../src';

const DENOMS = [500000, 200000, 100000, 50000, 10000, 5000, 2000];

describe('countTotal', () => {
  it('sums notes and coins in integer cents', () => {
    expect(countTotal(DENOMS, { notes: { '500000': 2, '2000': 3 }, coinsCents: 1250 })).toBe(
      1007250,
    );
    expect(countTotal(DENOMS, { notes: {}, coinsCents: 0 })).toBe(0);
  });
});

describe('DenominationCounter', () => {
  function Harness() {
    const [v, setV] = useState<DenominationCount>({ notes: {}, coinsCents: 0 });
    return <DenominationCounter denominations={DENOMS} value={v} onChange={setV} />;
  }

  it('updates the live total as counts are typed', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Number of LKR 1,000 notes'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Coins (total value)'), { target: { value: '12.5' } });
    expect(screen.getByText('LKR 3,012.50')).toBeInTheDocument();
  });

  it('ignores negative counts', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Number of LKR 500 notes'), { target: { value: '-4' } });
    expect(screen.getByText('LKR 0.00')).toBeInTheDocument();
  });
});

describe('VehicleClassTile', () => {
  it('is a radio showing the price', async () => {
    const onSelect = vi.fn();
    render(
      <VehicleClassTile name="Small car" priceCents={75000} selected={false} onSelect={onSelect} />,
    );
    const tile = screen.getByRole('radio', { name: /small car/i });
    expect(tile).toHaveAttribute('aria-checked', 'false');
    expect(tile).toHaveTextContent('LKR 750');
    await userEvent.click(tile);
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('AddOnStepper', () => {
  it('steps within bounds', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AddOnStepper name="Wax" unitPriceCents={25000} qty={0} max={1} onChange={onChange} />,
    );
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(onChange).toHaveBeenCalledWith(1);
    rerender(
      <AddOnStepper name="Wax" unitPriceCents={25000} qty={1} max={1} onChange={onChange} />,
    );
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled();
  });
});

describe('PinPad', () => {
  function Harness({ onComplete }: { onComplete: (p: string) => void }) {
    const [v, setV] = useState('');
    return <PinPad value={v} onChange={setV} onComplete={onComplete} />;
  }

  it('completes after 4 digits from taps or the keyboard', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.keyboard('29');
    await userEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    await userEvent.keyboard('77');
    expect(onComplete).toHaveBeenCalledWith('1277');
  });
});

describe('PinPad keyboard scope', () => {
  it('ignores typing inside other inputs on the page', async () => {
    const onChange = vi.fn();
    render(
      <>
        <input aria-label="Plate" />
        <PinPad value="" onChange={onChange} />
      </>,
    );
    await userEvent.type(screen.getByLabelText('Plate'), '12');
    expect(onChange).not.toHaveBeenCalled();
  });
});
