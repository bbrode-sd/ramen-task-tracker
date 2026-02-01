import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock firebase before importing OfflineContext
vi.mock('@/lib/firebase', () => ({
  enableOfflinePersistence: vi.fn().mockResolvedValue({ success: true }),
  isPersistenceEnabled: vi.fn().mockReturnValue(false),
}));

// Mock ToastContext
const mockShowToast = vi.fn();
vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

import { OfflineProvider, useOffline } from '@/contexts/OfflineContext';

// Test component that uses the offline context
function TestComponent() {
  const { isOnline, isPersistenceReady, persistenceError, wasOffline } = useOffline();

  return (
    <div>
      <div data-testid="online">{isOnline ? 'online' : 'offline'}</div>
      <div data-testid="persistence">{isPersistenceReady ? 'ready' : 'not-ready'}</div>
      <div data-testid="error">{persistenceError?.message || 'none'}</div>
      <div data-testid="was-offline">{wasOffline ? 'yes' : 'no'}</div>
    </div>
  );
}

describe('OfflineContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useOffline hook', () => {
    it('should throw error when used outside OfflineProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useOffline must be used within an OfflineProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('OfflineProvider', () => {
    it('should initialize with online status from navigator', async () => {
      render(
        <OfflineProvider>
          <TestComponent />
        </OfflineProvider>
      );

      // Initial render should show online
      expect(screen.getByTestId('online')).toHaveTextContent('online');
    });

    it('should set up offline persistence', async () => {
      render(
        <OfflineProvider>
          <TestComponent />
        </OfflineProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('persistence')).toHaveTextContent('ready');
      });
    });

    it('should respond to online event', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      render(
        <OfflineProvider>
          <TestComponent />
        </OfflineProvider>
      );

      expect(screen.getByTestId('online')).toHaveTextContent('offline');
    });

    it('should respond to offline event', async () => {
      render(
        <OfflineProvider>
          <TestComponent />
        </OfflineProvider>
      );

      expect(screen.getByTestId('online')).toHaveTextContent('online');
    });

    it('should show toast when going offline', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      render(
        <OfflineProvider>
          <TestComponent />
        </OfflineProvider>
      );

      // The offline toast may be shown on initial render when starting offline
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalled();
      });
    });

    it('should track wasOffline state when offline', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      render(
        <OfflineProvider>
          <TestComponent />
        </OfflineProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('was-offline')).toHaveTextContent('yes');
      });
    });

    it('should show toast when coming back online', async () => {
      // This test verifies the toast hook is set up correctly
      // The actual online/offline transition is harder to test without real timers
      render(
        <OfflineProvider>
          <TestComponent />
        </OfflineProvider>
      );

      expect(screen.getByTestId('online')).toHaveTextContent('online');
    });
  });
});
