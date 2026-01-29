'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  undoAction?: () => Promise<void> | void;
  duration?: number;
  createdAt: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (
    type: ToastType,
    message: string,
    options?: { undoAction?: () => Promise<void> | void; duration?: number }
  ) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DEFAULT_DURATION = 5000; // 5 seconds
const UNDO_DURATION = 8000; // 8 seconds for toasts with undo

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissToast = useCallback((id: string) => {
    // Clear the timeout if it exists
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (
      type: ToastType,
      message: string,
      options?: { undoAction?: () => Promise<void> | void; duration?: number }
    ): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const hasUndo = !!options?.undoAction;
      const duration = options?.duration ?? (hasUndo ? UNDO_DURATION : DEFAULT_DURATION);

      const newToast: Toast = {
        id,
        type,
        message,
        undoAction: options?.undoAction,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => [...prev, newToast]);

      // Set up auto-dismiss
      const timeout = setTimeout(() => {
        dismissToast(id);
      }, duration);

      timeoutRefs.current.set(id, timeout);

      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
