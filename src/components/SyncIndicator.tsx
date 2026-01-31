'use client';

import { useSync } from '@/contexts/SyncContext';

export function SyncIndicator() {
  const { status, retry, pendingOperations, queuedOperations, isOnline } = useSync();
  
  // Calculate total pending (active syncing + queued)
  const totalPending = pendingOperations + queuedOperations;

  // Don't render anything in idle state (or render a very subtle indicator)
  if (status === 'idle') {
    return (
      <div 
        className="flex items-center gap-1.5 px-2 py-1.5 text-white/40 transition-opacity duration-300 opacity-0 hover:opacity-100"
        title="All changes saved to cloud"
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
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
          />
        </svg>
      </div>
    );
  }

  // Offline with pending changes
  if (status === 'offline-pending' || (!isOnline && totalPending > 0)) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-amber-200 bg-amber-500/20 rounded-xl transition-all duration-300"
        title={`${totalPending} change${totalPending !== 1 ? 's' : ''} pending - will sync when online`}
      >
        {/* Offline icon */}
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
            d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07"
          />
        </svg>
        <span className="text-xs font-medium hidden sm:inline">
          {totalPending > 0 ? `${totalPending} pending` : 'Offline'}
        </span>
        {totalPending > 0 && (
          <span className="flex sm:hidden items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-amber-500 text-amber-950 rounded-full">
            {totalPending}
          </span>
        )}
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-white/80 animate-pulse">
        <svg
          className="w-4 h-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-xs font-medium hidden sm:inline">
          {totalPending > 1 ? `Saving ${totalPending}...` : 'Saving...'}
        </span>
      </div>
    );
  }

  if (status === 'saved') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-green-200 transition-all duration-300">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="text-xs font-medium hidden sm:inline">Saved</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <button
        onClick={retry}
        className="flex items-center gap-1.5 px-2 py-1.5 text-red-200 hover:text-red-100 hover:bg-red-500/20 rounded-lg transition-all duration-200 group"
        title="Click to retry"
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-xs font-medium hidden sm:inline">
          Sync failed
        </span>
        <svg
          className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
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
      </button>
    );
  }

  return null;
}
