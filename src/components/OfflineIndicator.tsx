'use client';

import { useState, useEffect } from 'react';
import { useOffline } from '@/contexts/OfflineContext';
import { useSync } from '@/contexts/SyncContext';

interface OfflineIndicatorProps {
  position?: 'top' | 'header';
}

export function OfflineIndicator({ position = 'top' }: OfflineIndicatorProps) {
  const { isOnline, wasOffline } = useOffline();
  const { pendingOperations } = useSync();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (!isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  // Show reconnected message briefly when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timeout = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, wasOffline]);

  // Don't show if online and not recently reconnected
  if (isOnline && !showReconnected) {
    return null;
  }

  // Don't show if dismissed (but will reappear if still offline after a while)
  if (isDismissed && isOnline) {
    return null;
  }

  // Top banner position (full width)
  if (position === 'top') {
    return (
      <div
        className={`offline-banner fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isOnline && showReconnected
            ? 'bg-green-500 text-white'
            : 'bg-amber-500 text-amber-950'
        }`}
        role="alert"
        aria-live="polite"
      >
        <div className="px-4 py-2.5 flex items-center justify-center gap-3">
          {isOnline && showReconnected ? (
            <>
              {/* Online/Connected icon */}
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm font-medium">
                Back online! {pendingOperations > 0 ? `Syncing ${pendingOperations} change${pendingOperations !== 1 ? 's' : ''}...` : 'All changes synced.'}
              </span>
            </>
          ) : (
            <>
              {/* Offline/Disconnected icon */}
              <svg
                className="w-5 h-5 flex-shrink-0 animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                />
              </svg>
              <span className="text-sm font-medium">
                You&apos;re offline. Changes will sync when reconnected.
                {pendingOperations > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-600/30 text-amber-950">
                    {pendingOperations} pending
                  </span>
                )}
              </span>
              {!isDismissed && (
                <button
                  onClick={() => setIsDismissed(true)}
                  className="ml-2 p-1 hover:bg-amber-600/30 rounded-lg transition-colors"
                  aria-label="Dismiss"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Header badge position (compact)
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-300 ${
        isOnline && showReconnected
          ? 'bg-green-500/20 text-green-200'
          : 'bg-amber-500/20 text-amber-200'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOnline && showReconnected ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="hidden sm:inline">Synced</span>
        </>
      ) : (
        <>
          <svg
            className="w-3.5 h-3.5 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 2.829a1 1 0 111.414 1.414"
            />
          </svg>
          <span className="hidden sm:inline">Offline</span>
          {pendingOperations > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-amber-500 text-amber-950 rounded-full">
              {pendingOperations}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Compact offline badge for the header
 * Shows only when offline with minimal visual footprint
 */
export function OfflineBadge() {
  const { isOnline } = useOffline();
  const { pendingOperations } = useSync();

  if (isOnline && pendingOperations === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium backdrop-blur-sm border transition-all duration-300 ${
        isOnline
          ? 'bg-white/10 border-white/20 text-white/80'
          : 'bg-amber-500/20 border-amber-500/30 text-amber-200'
      }`}
      title={isOnline ? `${pendingOperations} changes syncing...` : `Offline - ${pendingOperations} changes pending`}
    >
      {!isOnline && (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07"
          />
        </svg>
      )}
      {pendingOperations > 0 && (
        <span className="flex items-center gap-1">
          <span className={`${isOnline ? '' : 'hidden sm:inline'}`}>
            {pendingOperations}
          </span>
          <svg
            className={`w-3 h-3 ${isOnline ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </span>
      )}
    </div>
  );
}
