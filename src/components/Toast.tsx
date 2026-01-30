'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast, Toast as ToastType, ToastType as ToastVariant } from '@/contexts/ToastContext';

// Icons for each toast type
function ToastIcon({ type }: { type: ToastVariant }) {
  switch (type) {
    case 'success':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

// Get color classes for each toast type
function getToastColors(type: ToastVariant) {
  switch (type) {
    case 'success':
      return {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        icon: 'bg-emerald-500 text-white',
        text: 'text-emerald-700',
        progress: 'bg-emerald-500',
      };
    case 'error':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: 'bg-red-500 text-white',
        text: 'text-red-700',
        progress: 'bg-red-500',
      };
    case 'warning':
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        icon: 'bg-amber-500 text-white',
        text: 'text-amber-700',
        progress: 'bg-amber-500',
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: 'bg-blue-500 text-white',
        text: 'text-blue-700',
        progress: 'bg-blue-500',
      };
  }
}

// Individual toast item
function ToastItem({ toast }: { toast: ToastType }) {
  const { dismissToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [progress, setProgress] = useState(100);

  const colors = getToastColors(toast.type);

  // Handle dismiss with animation
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      dismissToast(toast.id);
    }, 200);
  }, [dismissToast, toast.id]);

  // Handle undo action
  const handleUndo = async () => {
    if (!toast.undoAction || isUndoing) return;

    setIsUndoing(true);
    try {
      await toast.undoAction();
      handleDismiss();
    } catch (error) {
      console.error('Undo action failed:', error);
      setIsUndoing(false);
    }
  };

  // Progress bar animation
  useEffect(() => {
    const duration = toast.duration || 5000;
    const interval = 50; // Update every 50ms
    const step = (100 * interval) / duration;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        return next <= 0 ? 0 : next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast.duration]);

  return (
    <div
      className={`
        relative overflow-hidden
        w-full max-w-sm
        backdrop-blur-xl
        ${colors.bg}
        border ${colors.border}
        rounded-xl shadow-lg
        transform transition-all duration-200 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        animate-in slide-in-from-right-5 fade-in duration-200
      `}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${colors.icon} flex items-center justify-center`}>
          <ToastIcon type={toast.type} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className={`text-sm font-medium ${colors.text}`}>{toast.message}</p>

          {/* Undo button */}
          {toast.undoAction && (
            <button
              onClick={handleUndo}
              disabled={isUndoing}
              className={`
                mt-2 text-sm font-semibold
                ${colors.text} hover:opacity-80
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-opacity
              `}
            >
              {isUndoing ? 'Undoing...' : 'Undo'}
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
        >
          <svg
            className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-black/5">
        <div
          className={`h-full ${colors.progress} transition-all duration-50 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// Toast container that renders the stack
export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
