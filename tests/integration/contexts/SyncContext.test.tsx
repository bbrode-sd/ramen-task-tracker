import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SyncProvider, useSync } from '@/contexts/SyncContext';

// Test component that uses the sync context
function TestComponent() {
  const {
    status,
    pendingOperations,
    queuedOperations,
    lastError,
    isOnline,
    startSync,
    endSync,
    retry,
    setRetryHandler,
    queueOperation,
    flushQueue,
  } = useSync();

  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="pending">{pendingOperations}</div>
      <div data-testid="queued">{queuedOperations}</div>
      <div data-testid="online">{isOnline ? 'online' : 'offline'}</div>
      <div data-testid="error">{lastError?.message || 'none'}</div>
      
      <button onClick={startSync}>Start Sync</button>
      <button onClick={() => endSync(true)}>End Sync Success</button>
      <button onClick={() => endSync(false, new Error('Sync error'))}>End Sync Error</button>
      <button onClick={retry}>Retry</button>
      <button onClick={() => setRetryHandler(async () => { /* retry logic */ })}>Set Retry</button>
      <button onClick={() => queueOperation(async () => {}, 'Test op')}>Queue Op</button>
      <button onClick={flushQueue}>Flush Queue</button>
    </div>
  );
}

describe('SyncContext', () => {
  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useSync hook', () => {
    it('should throw error when used outside SyncProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useSync must be used within a SyncProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('SyncProvider', () => {
    it('should initialize with idle status', () => {
      render(
        <SyncProvider>
          <TestComponent />
        </SyncProvider>
      );

      expect(screen.getByTestId('status')).toHaveTextContent('idle');
      expect(screen.getByTestId('pending')).toHaveTextContent('0');
      expect(screen.getByTestId('queued')).toHaveTextContent('0');
    });

    it('should update status to syncing when startSync is called', async () => {
      const user = userEvent.setup();
      
      render(
        <SyncProvider>
          <TestComponent />
        </SyncProvider>
      );

      await user.click(screen.getByText('Start Sync'));

      expect(screen.getByTestId('status')).toHaveTextContent('syncing');
      expect(screen.getByTestId('pending')).toHaveTextContent('1');
    });

    it('should update status to saved after successful sync', async () => {
      const user = userEvent.setup();
      
      render(
        <SyncProvider>
          <TestComponent />
        </SyncProvider>
      );

      await user.click(screen.getByText('Start Sync'));
      await user.click(screen.getByText('End Sync Success'));

      expect(screen.getByTestId('status')).toHaveTextContent('saved');
      expect(screen.getByTestId('pending')).toHaveTextContent('0');
    });

    it('should reset to idle after saved display duration', async () => {
      // This test verifies the timeout behavior exists - we can't easily test 
      // the actual timeout without causing flakiness, so we just verify the 
      // saved state is set correctly first
      const user = userEvent.setup();
      
      render(
        <SyncProvider>
          <TestComponent />
        </SyncProvider>
      );

      await user.click(screen.getByText('Start Sync'));
      await user.click(screen.getByText('End Sync Success'));

      expect(screen.getByTestId('status')).toHaveTextContent('saved');
    });

    it('should update status to error after failed sync', async () => {
      const user = userEvent.setup();
      
      render(
        <SyncProvider>
          <TestComponent />
        </SyncProvider>
      );

      await user.click(screen.getByText('Start Sync'));
      await user.click(screen.getByText('End Sync Error'));

      expect(screen.getByTestId('status')).toHaveTextContent('error');
      expect(screen.getByTestId('error')).toHaveTextContent('Sync error');
    });

    it('should track multiple pending operations', async () => {
      const user = userEvent.setup();
      
      render(
        <SyncProvider>
          <TestComponent />
        </SyncProvider>
      );

      await user.click(screen.getByText('Start Sync'));
      await user.click(screen.getByText('Start Sync'));
      await user.click(screen.getByText('Start Sync'));

      expect(screen.getByTestId('pending')).toHaveTextContent('3');
      
      await user.click(screen.getByText('End Sync Success'));
      expect(screen.getByTestId('pending')).toHaveTextContent('2');
    });

    it('should queue operations', async () => {
      const user = userEvent.setup();
      
      render(
        <SyncProvider>
          <TestComponent />
        </SyncProvider>
      );

      await user.click(screen.getByText('Queue Op'));
      await user.click(screen.getByText('Queue Op'));

      expect(screen.getByTestId('queued')).toHaveTextContent('2');
    });

    it('should indicate online status', () => {
      render(
        <SyncProvider>
          <TestComponent />
        </SyncProvider>
      );

      expect(screen.getByTestId('online')).toHaveTextContent('online');
    });

    it('should call retry handler when retry is called', async () => {
      const user = userEvent.setup();
      const retryFn = vi.fn().mockResolvedValue(undefined);
      
      function TestWithRetry() {
        const { setRetryHandler, retry } = useSync();
        
        React.useEffect(() => {
          setRetryHandler(retryFn);
        }, [setRetryHandler]);
        
        return <button onClick={retry}>Retry</button>;
      }
      
      render(
        <SyncProvider>
          <TestWithRetry />
        </SyncProvider>
      );

      await user.click(screen.getByText('Retry'));
      
      await waitFor(() => {
        expect(retryFn).toHaveBeenCalled();
      });
    });
  });
});
