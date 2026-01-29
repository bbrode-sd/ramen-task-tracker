'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error' | 'offline-pending';

interface QueuedOperation {
  id: string;
  operation: () => Promise<void>;
  description: string;
  createdAt: number;
  retryCount: number;
}

interface SyncContextType {
  status: SyncStatus;
  pendingOperations: number;
  queuedOperations: number;
  lastError: Error | null;
  isOnline: boolean;
  startSync: () => void;
  endSync: (success: boolean, error?: Error) => void;
  retry: () => Promise<void>;
  setRetryHandler: (handler: () => Promise<void>) => void;
  queueOperation: (operation: () => Promise<void>, description?: string) => string;
  flushQueue: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const SAVED_DISPLAY_DURATION = 2000; // 2 seconds
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pendingOperations, setPendingOperations] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedOperations, setQueuedOperations] = useState(0);
  
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const operationQueueRef = useRef<QueuedOperation[]>([]);
  const isFlushingRef = useRef(false);
  const operationIdCounter = useRef(0);

  // Track online status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      // Update status based on online state and queue
      if (!online && operationQueueRef.current.length > 0) {
        setStatus('offline-pending');
      }
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Auto-flush queue when coming back online
  useEffect(() => {
    if (isOnline && operationQueueRef.current.length > 0 && !isFlushingRef.current) {
      // Small delay to ensure network is stable
      const timeout = setTimeout(() => {
        flushQueue();
      }, 500);
      return () => clearTimeout(timeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const startSync = useCallback(() => {
    // Clear any pending reset timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    setPendingOperations((prev) => prev + 1);
    setStatus('syncing');
    setLastError(null);
  }, []);

  const endSync = useCallback((success: boolean, error?: Error) => {
    setPendingOperations((prev) => {
      const newCount = Math.max(0, prev - 1);
      
      if (success) {
        // Only show 'saved' if this was the last pending operation
        if (newCount === 0 && operationQueueRef.current.length === 0) {
          setStatus('saved');
          setLastError(null);
          
          // Auto-reset to idle after 2 seconds
          resetTimeoutRef.current = setTimeout(() => {
            setStatus('idle');
          }, SAVED_DISPLAY_DURATION);
        } else if (operationQueueRef.current.length > 0 && !navigator.onLine) {
          setStatus('offline-pending');
        }
      } else {
        // Check if it's a network error and we're offline
        const isNetworkError = error?.message?.includes('network') || 
                               error?.message?.includes('offline') ||
                               error?.message?.includes('Failed to fetch') ||
                               !navigator.onLine;
        
        if (isNetworkError && !navigator.onLine) {
          setStatus('offline-pending');
        } else {
          setStatus('error');
          setLastError(error || new Error('Sync failed'));
        }
      }
      
      return newCount;
    });
  }, []);

  const setRetryHandler = useCallback((handler: () => Promise<void>) => {
    retryHandlerRef.current = handler;
  }, []);

  const retry = useCallback(async () => {
    if (retryHandlerRef.current) {
      setLastError(null);
      setStatus('idle');
      await retryHandlerRef.current();
    }
  }, []);

  /**
   * Queue an operation for later execution (useful when offline)
   * Firestore already handles offline writes with its cache, but this is useful
   * for tracking and displaying pending operations to the user.
   */
  const queueOperation = useCallback((operation: () => Promise<void>, description = 'Operation'): string => {
    const id = `op-${++operationIdCounter.current}-${Date.now()}`;
    
    const queuedOp: QueuedOperation = {
      id,
      operation,
      description,
      createdAt: Date.now(),
      retryCount: 0,
    };

    operationQueueRef.current.push(queuedOp);
    setQueuedOperations(operationQueueRef.current.length);

    if (!navigator.onLine) {
      setStatus('offline-pending');
    }

    return id;
  }, []);

  /**
   * Flush the operation queue (execute all pending operations)
   * Called automatically when coming back online
   */
  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current || operationQueueRef.current.length === 0) {
      return;
    }

    isFlushingRef.current = true;
    setStatus('syncing');

    const queue = [...operationQueueRef.current];
    const failedOperations: QueuedOperation[] = [];

    for (const op of queue) {
      try {
        await op.operation();
        // Remove successful operation from queue
        operationQueueRef.current = operationQueueRef.current.filter((o) => o.id !== op.id);
        setQueuedOperations(operationQueueRef.current.length);
      } catch (error) {
        console.error(`[Sync] Failed to execute queued operation: ${op.description}`, error);
        
        op.retryCount++;
        if (op.retryCount < MAX_RETRY_COUNT) {
          failedOperations.push(op);
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          // Max retries reached, remove from queue
          operationQueueRef.current = operationQueueRef.current.filter((o) => o.id !== op.id);
          setQueuedOperations(operationQueueRef.current.length);
          setLastError(error as Error);
        }
      }
    }

    isFlushingRef.current = false;

    if (operationQueueRef.current.length === 0) {
      setStatus('saved');
      resetTimeoutRef.current = setTimeout(() => {
        setStatus('idle');
      }, SAVED_DISPLAY_DURATION);
    } else if (!navigator.onLine) {
      setStatus('offline-pending');
    } else if (failedOperations.length > 0) {
      setStatus('error');
    }
  }, []);

  return (
    <SyncContext.Provider
      value={{
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
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
