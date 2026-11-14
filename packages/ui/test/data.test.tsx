import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, pageItems, Pagination, StatCard } from '../src';

describe('pageItems', () => {
  it('matches the old queue pager shape', () => {
    expect(pageItems(1, 0)).toEqual([]);
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
    expect(pageItems(1, 10)).toEqual([1, 2, 'ellipsis', 10]);
    expect(pageItems(10, 10)).toEqual([1, 'ellipsis', 9, 10]);
  });
});

describe('Pagination', () => {
  it('marks the current page and moves between pages', async () => {
    const onChange = vi.fn();
    render(
      <Pagination
        page={2}
        pageCount={5}
        onPageChange={onChange}
        summary="Showing 11 to 20 of 45"
      />,
    );
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.getByText('Showing 11 to 20 of 45')).toBeInTheDocument();
  });

  it('disables previous on the first page', () => {
    render(<Pagination page={1} pageCount={2} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });
});

describe('EmptyState', () => {
  it('announces errors as alerts', () => {
    render(<EmptyState tone="danger" title="Could not load orders" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load orders');
  });
});

describe('StatCard', () => {
  it('shows value, delta and progress', () => {
    render(<StatCard label="Vehicles" value="9 / 15" deltaPct={-12.5} progress={60} />);
    expect(screen.getByText('9 / 15')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toHaveClass('text-danger');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
  });
});
