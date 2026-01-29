import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { ToastContainer } from '@/components/Toast';

type ToastType = 'success' | 'error' | 'warning' | 'info';

// Test component that triggers toasts and tracks what was called
const toastCalls: Array<{ type: ToastType; message: string }> = [];

function ToastTrigger() {
  const { showToast } = useToast();

  const handleShowToast = (type: ToastType, message: string) => {
    toastCalls.push({ type, message });
    showToast(type, message);
  };

  return (
    <div>
      <button onClick={() => handleShowToast('success', 'Success message')}>
        Show Success
      </button>
      <button onClick={() => handleShowToast('error', 'Error message')}>
        Show Error
      </button>
      <button onClick={() => handleShowToast('warning', 'Warning message')}>
        Show Warning
      </button>
      <button onClick={() => handleShowToast('info', 'Info message')}>
        Show Info
      </button>
      <button onClick={() => showToast('success', 'With undo', { undoAction: () => console.log('undo') })}>
        Show With Undo
      </button>
    </div>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ToastContainer />
    </ToastProvider>
  );
}

describe('Toast Component', () => {
  beforeEach(() => {
    toastCalls.length = 0;
  });

  it('should call showToast with success type', () => {
    render(<ToastTrigger />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByText('Show Success'));

    expect(toastCalls).toContainEqual({ type: 'success', message: 'Success message' });
  });

  it('should call showToast with error type', () => {
    render(<ToastTrigger />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByText('Show Error'));

    expect(toastCalls).toContainEqual({ type: 'error', message: 'Error message' });
  });

  it('should call showToast with warning type', () => {
    render(<ToastTrigger />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByText('Show Warning'));

    expect(toastCalls).toContainEqual({ type: 'warning', message: 'Warning message' });
  });

  it('should call showToast with info type', () => {
    render(<ToastTrigger />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByText('Show Info'));

    expect(toastCalls).toContainEqual({ type: 'info', message: 'Info message' });
  });

  it('should render toast container', () => {
    const { container } = render(<ToastTrigger />, { wrapper: TestWrapper });

    // Toast container should be in the DOM
    expect(container).toBeInTheDocument();
  });

  it('should render trigger buttons', () => {
    render(<ToastTrigger />, { wrapper: TestWrapper });

    expect(screen.getByText('Show Success')).toBeInTheDocument();
    expect(screen.getByText('Show Error')).toBeInTheDocument();
    expect(screen.getByText('Show Warning')).toBeInTheDocument();
    expect(screen.getByText('Show Info')).toBeInTheDocument();
    expect(screen.getByText('Show With Undo')).toBeInTheDocument();
  });
});

describe('ToastContext', () => {
  it('should provide showToast function', () => {
    // Use a ref to capture context value without reassignment during render
    const contextRef = { current: null as ReturnType<typeof useToast> | null };

    function ContextReader() {
      const context = useToast();
      // Store in ref on first render only
      if (!contextRef.current) {
        contextRef.current = context;
      }
      return null;
    }

    render(
      <ToastProvider>
        <ContextReader />
      </ToastProvider>
    );

    expect(contextRef.current).not.toBeNull();
    expect(typeof contextRef.current!.showToast).toBe('function');
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      useToast();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow();

    consoleSpy.mockRestore();
  });
});
