import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, ColumnEmptyState, SearchEmptyState, CommentsEmptyState } from '@/components/EmptyState';

describe('EmptyState Component', () => {
  describe('Generic EmptyState', () => {
    it('should render with title and description', () => {
      render(
        <EmptyState
          title="No items"
          description="There are no items to display"
        />
      );

      expect(screen.getByText('No items')).toBeInTheDocument();
      expect(screen.getByText('There are no items to display')).toBeInTheDocument();
    });

    it('should render action button when provided', async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();

      render(
        <EmptyState
          title="No items"
          description="There are no items"
          actionLabel="Add item"
          action={onAction}
        />
      );

      const button = screen.getByText('Add item');
      expect(button).toBeInTheDocument();

      await user.click(button);
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('should render small variant', () => {
      render(
        <EmptyState
          title="No items"
          description="There are no items"
          size="sm"
        />
      );

      // Small variant should have smaller text class
      const title = screen.getByText('No items');
      expect(title.className).toContain('text-sm');
    });

    it('should render large variant', () => {
      render(
        <EmptyState
          title="No items"
          description="There are no items"
          size="lg"
        />
      );

      const title = screen.getByText('No items');
      expect(title.className).toContain('text-2xl');
    });

    it('should render custom icon when provided', () => {
      render(
        <EmptyState
          title="Custom"
          description="Custom message"
          icon={<svg data-testid="custom-icon" />}
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should render secondary action when provided', async () => {
      const onAction = vi.fn();
      const onSecondaryAction = vi.fn();
      const user = userEvent.setup();

      render(
        <EmptyState
          title="No items"
          action={onAction}
          actionLabel="Primary"
          secondaryAction={onSecondaryAction}
          secondaryActionLabel="Secondary"
        />
      );

      const primaryButton = screen.getByText('Primary');
      const secondaryButton = screen.getByText('Secondary');
      
      expect(primaryButton).toBeInTheDocument();
      expect(secondaryButton).toBeInTheDocument();

      await user.click(secondaryButton);
      expect(onSecondaryAction).toHaveBeenCalledTimes(1);
    });

    it('should apply variant styles', () => {
      const { container } = render(
        <EmptyState
          variant="boards"
          title="No boards"
        />
      );

      // Should render an SVG-based illustration for the boards variant
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe('ColumnEmptyState', () => {
    it('should render column empty state', () => {
      render(<ColumnEmptyState />);

      expect(screen.getByText('No cards yet')).toBeInTheDocument();
    });

    it('should show tip by default', () => {
      render(<ColumnEmptyState />);

      expect(screen.getByText(/Drag cards here or click/)).toBeInTheDocument();
    });

    it('should hide tip when showTip is false', () => {
      render(<ColumnEmptyState showTip={false} />);

      expect(screen.queryByText(/Drag cards here or click/)).not.toBeInTheDocument();
    });

    it('should show drop state when isDraggingOver is true', () => {
      const { container } = render(<ColumnEmptyState isDraggingOver={true} />);

      expect(screen.getByText('Drop card here')).toBeInTheDocument();
      // Should have an SVG icon for the drop indicator
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('should apply dragging over styles', () => {
      const { container } = render(<ColumnEmptyState isDraggingOver={true} />);

      const emptyState = container.firstChild;
      expect(emptyState).toHaveClass('border-emerald-400');
      expect(emptyState).toHaveClass('bg-emerald-50/60');
    });
  });

  describe('SearchEmptyState', () => {
    it('should render search empty state with query', () => {
      render(<SearchEmptyState searchQuery="test search" />);

      expect(screen.getByText('No matching cards found')).toBeInTheDocument();
      expect(screen.getByText(/No cards match "test search"/)).toBeInTheDocument();
    });

    it('should call onClearSearch when clear button is clicked', async () => {
      const onClear = vi.fn();
      const user = userEvent.setup();

      render(<SearchEmptyState searchQuery="test" onClearSearch={onClear} />);

      const clearButton = screen.getByText('Clear Search');
      await user.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should not show clear button when onClearSearch is not provided', () => {
      render(<SearchEmptyState searchQuery="test" />);

      expect(screen.queryByText('Clear Search')).not.toBeInTheDocument();
    });
  });

  describe('CommentsEmptyState', () => {
    it('should render comments empty state', () => {
      render(<CommentsEmptyState />);

      expect(screen.getByText('No comments yet')).toBeInTheDocument();
      expect(screen.getByText('Be the first to start the conversation')).toBeInTheDocument();
    });

    it('should show comments SVG icon', () => {
      const { container } = render(<CommentsEmptyState />);

      // Should render an SVG-based comments icon
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });
});
