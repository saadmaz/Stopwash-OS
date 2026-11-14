import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge, Button, Field, Input, Textarea } from '../src';

describe('Button', () => {
  it('defaults to type=button so it never submits forms by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('is disabled and busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Pay
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Pay' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders as its child with asChild', () => {
    render(
      <Button asChild>
        <a href="/orders">Orders</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveClass('bg-primary');
  });
});

describe('Badge', () => {
  it('renders the tone classes', () => {
    render(<Badge tone="success">Paid</Badge>);
    expect(screen.getByText('Paid')).toHaveClass('bg-success-subtle');
  });
});

describe('Field', () => {
  it('links label, control and error for assistive tech', () => {
    render(
      <Field label="Plate" error="Plate is required" required>
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: /plate/i });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Plate is required');
  });

  it('shows a hint when there is no error', () => {
    render(
      <Field label="Notes" hint="Optional">
        {(p) => <Textarea {...p} />}
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveAccessibleDescription('Optional');
  });
});
