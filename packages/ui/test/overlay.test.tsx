import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Dialog, Sheet } from '../src';

describe('Dialog', () => {
  it('opens from its trigger, is labelled, and closes', async () => {
    render(
      <Dialog
        title="Cancel order"
        description="This needs a reason."
        trigger={<Button>Cancel</Button>}
      >
        <p>Body</p>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel order' });
    expect(dialog).toHaveAccessibleDescription('This needs a reason.');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when controlled open', () => {
    render(<Dialog open title="Hi" onOpenChange={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Hi' })).toBeInTheDocument();
  });
});

describe('Sheet', () => {
  it('renders title and footer when open', () => {
    render(
      <Sheet open onOpenChange={() => {}} title="Checkout" footer={<Button>Pay</Button>}>
        lines
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Checkout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument();
  });
});
