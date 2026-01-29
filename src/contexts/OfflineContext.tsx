'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { enableOfflinePersistence, isPersistenceEnabled } from '@/lib/firebase';
import { useToast } from './ToastContext';

interface OfflineContextType {
  isOnline: boolean;
  isPersistenceReady: boolean;
  persistenceError: Error | null;
  wasOffline: boolean; // Track if we were recently offline (for reconnection messages)
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

// Debounce time to prevent rapid online/offline toggling from spamming notifications
const ONLINE_STATUS_DEBOUNCE_MS = 1000;

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  // Initialize with true on server, will update on client
  const [isOnline, setIsOnline] = useState(true);
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState<Error | null>(null);
  const [wasOffline, setWasOffline] = useState(false);
  
  const { showToast } = useToast();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownInitialOfflineToast = useRef(false);
  const previousOnlineState = useRef(true);

  // Enable Firestore offline persistence on mount
  useEffect(() => {
    const setupPersistence = async () => {
      const result = await enableOfflinePersistence();
      setIsPersistenceReady(result.success || isPersistenceEnabled());
      if (result.error) {
        setPersistenceError(result.error);
      }
    };

    setupPersistence();
  }, []);

  // Handle online/offline status changes
  const handleOnlineStatusChange = useCallback((online: boolean) => {
    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce the status change to prevent rapid toggling
    debounceTimeoutRef.current = setTimeout(() => {
      setIsOnline(online);

      // Show appropriate toast notification
      if (!online && previousOnlineState.current) {
        // Just went offline
        setWasOffline(true);
        showToast('warning', "You're offline. Changes will sync when reconnected.", { duration: 5000 });
        hasShownInitialOfflineToast.current = true;
      } else if (online && !previousOnlineState.current) {
        // Just came back online
        showToast('success', "You're back online! Syncing changes...", { duration: 3000 });
        // Reset wasOffline after a short delay to allow UI to update
        setTimeout(() => setWasOffline(false), 5000);
      }

      previousOnlineState.current = online;
    }, ONLINE_STATUS_DEBOUNCE_MS);
  }, [showToast]);

  // Set up online/offline event listeners
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Set initial state
    const initialOnline = navigator.onLine;
    setIsOnline(initialOnline);
    previousOnlineState.current = initialOnline;

    // Show initial offline toast if starting offline
    if (!initialOnline && !hasShownInitialOfflineToast.current) {
      setWasOffline(true);
      // Small delay to ensure toast context is ready
      setTimeout(() => {
        showToast('warning', "You're offline. Changes will sync when reconnected.", { duration: 5000 });
        hasShownInitialOfflineToast.current = true;
      }, 100);
    }

    const handleOnline = () => handleOnlineStatusChange(true);
    const handleOffline = () => handleOnlineStatusChange(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [handleOnlineStatusChange, showToast]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isPersistenceReady,
        persistenceError,
        wasOffline,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
