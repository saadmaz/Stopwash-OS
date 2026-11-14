import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Checkbox, RadioGroup, SegmentedControl, Select, Switch } from '../src';

describe('Checkbox and Switch', () => {
  it('toggle with the keyboard-accessible roles', async () => {
    render(
      <>
        <Checkbox aria-label="All good" />
        <Switch aria-label="Dark mode" />
      </>,
    );
    const cb = screen.getByRole('checkbox', { name: 'All good' });
    await userEvent.click(cb);
    expect(cb).toHaveAttribute('data-state', 'checked');
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('RadioGroup', () => {
  it('selects by label', async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        aria-label="Type"
        onValueChange={onChange}
        options={[
          { value: 'EXPENSE', label: 'Expense' },
          { value: 'DEPOSIT', label: 'Deposit' },
        ]}
      />,
    );
    await userEvent.click(screen.getByLabelText('Deposit'));
    expect(onChange).toHaveBeenCalledWith('DEPOSIT');
  });
});

describe('SegmentedControl', () => {
  function Harness() {
    const [v, setV] = useState('CASH');
    return (
      <>
        <SegmentedControl
          aria-label="Method"
          value={v}
          onValueChange={setV}
          options={[
            { value: 'CASH', label: 'Cash' },
            { value: 'CARD', label: 'Card' },
          ]}
        />
        <output>{v}</output>
      </>
    );
  }

  it('changes value and never becomes empty', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Card' }));
    expect(screen.getByRole('status')).toHaveTextContent('CARD');
    await userEvent.click(screen.getByRole('radio', { name: 'Card' }));
    expect(screen.getByRole('status')).toHaveTextContent('CARD');
  });
});

describe('Select', () => {
  it('renders a labelled combobox with the placeholder', () => {
    render(
      <Select
        aria-label="Category"
        placeholder="Choose…"
        options={[{ value: 'E001', label: 'Cleaning' }]}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('Choose…');
  });
});
