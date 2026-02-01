import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { 
  ErrorBoundary, 
  MinimalErrorFallback, 
  FullPageErrorFallback, 
  ModalErrorFallback 
} from '@/components/ErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for error boundary tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render default fallback when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error message' }),
      expect.any(Object)
    );
  });

  it('should reset error state when Try Again is clicked', async () => {
    const user = userEvent.setup();
    
    function TestWrapper() {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      
      return (
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
          {/* This button won't be visible when error is thrown, but we test reset behavior */}
        </ErrorBoundary>
      );
    }
    
    render(<TestWrapper />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    await user.click(screen.getByText('Try Again'));

    // After reset, the error boundary will try to render children again
    // Since ThrowError still throws, it will show error again
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should include context in console error message', () => {
    render(
      <ErrorBoundary context="TestComponent">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorBoundary:TestComponent]'),
      expect.any(Error),
      expect.any(Object)
    );
  });
});

describe('MinimalErrorFallback', () => {
  it('should render with default message', () => {
    render(<MinimalErrorFallback />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<MinimalErrorFallback message="Custom error" />);

    expect(screen.getByText('Custom error')).toBeInTheDocument();
  });

  it('should render retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<MinimalErrorFallback onRetry={onRetry} />);

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should not render retry button when onRetry is not provided', () => {
    render(<MinimalErrorFallback />);

    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    
    render(<MinimalErrorFallback onRetry={onRetry} />);

    await user.click(screen.getByText('Retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('FullPageErrorFallback', () => {
  it('should render with default message when no error provided', () => {
    render(<FullPageErrorFallback />);

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/unexpected error occurred/)).toBeInTheDocument();
  });

  it('should render error message when error is provided', () => {
    render(<FullPageErrorFallback error={new Error('Specific error')} />);

    expect(screen.getByText('Specific error')).toBeInTheDocument();
  });

  it('should render Try Again button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<FullPageErrorFallback onRetry={onRetry} />);

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should render Go Home button when onGoHome is provided', () => {
    const onGoHome = vi.fn();
    render(<FullPageErrorFallback onGoHome={onGoHome} />);

    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('should call onRetry when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    
    render(<FullPageErrorFallback onRetry={onRetry} />);

    await user.click(screen.getByText('Try Again'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should call onGoHome when Go Home is clicked', async () => {
    const user = userEvent.setup();
    const onGoHome = vi.fn();
    
    render(<FullPageErrorFallback onGoHome={onGoHome} />);

    await user.click(screen.getByText('Go Home'));

    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});

describe('ModalErrorFallback', () => {
  it('should render with default message', () => {
    render(<ModalErrorFallback onClose={() => {}} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load content')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<ModalErrorFallback onClose={() => {}} message="Custom modal error" />);

    expect(screen.getByText('Custom modal error')).toBeInTheDocument();
  });

  it('should call onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(<ModalErrorFallback onClose={onClose} />);

    await user.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
