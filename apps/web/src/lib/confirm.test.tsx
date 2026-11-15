import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from './confirm';

function Harness({
  onResult,
  reason,
}: {
  onResult: (v: string | false) => void;
  reason?: boolean;
}) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={() =>
        void confirm({
          title: 'Void invoice 55100?',
          reasonLabel: reason ? 'Why?' : undefined,
        }).then(onResult)
      }
    >
      go
    </button>
  );
}

describe('useConfirm', () => {
  it('resolves false on cancel and Escape', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Harness onResult={onResult} />
      </ConfirmProvider>,
    );
    await userEvent.click(screen.getByText('go'));
    expect(screen.getByRole('dialog', { name: 'Void invoice 55100?' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('requires a reason before confirming and returns it', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Harness onResult={onResult} reason />
      </ConfirmProvider>,
    );
    await userEvent.click(screen.getByText('go'));
    const ok = screen.getByRole('button', { name: 'Confirm' });
    expect(ok).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Why\?/), 'Wrong customer');
    await userEvent.click(ok);
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('Wrong customer'));
  });
});
