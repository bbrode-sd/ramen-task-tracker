'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface TooltipProps {
  children: ReactNode;
  content: string;
  shortcut?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({
  children,
  content,
  shortcut,
  position = 'top',
  delay = 300,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (!triggerRef.current) return;

    timeoutRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - 8;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + 8;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - 8;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + 8;
          break;
      }

      setCoords({ top, left });
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const positionClasses: Record<string, string> = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800',
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={className}
      >
        {children}
      </div>

      {mounted &&
        isVisible &&
        createPortal(
          <div
            className={`fixed z-[200] px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-lg pointer-events-none transition-opacity duration-200 max-w-xs ${positionClasses[position]}`}
            style={{
              top: coords.top,
              left: coords.left,
            }}
          >
            <span className="flex items-center gap-2">
              {content}
              {shortcut && (
                <kbd className="px-1.5 py-0.5 bg-slate-600 text-slate-200 rounded text-[10px] font-mono">
                  {shortcut}
                </kbd>
              )}
            </span>
            <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
          </div>,
          document.body
        )}
    </>
  );
}

// Dismissible tip component with keyboard shortcut hints
interface TipProps {
  id: string;
  children: ReactNode;
  tip: string;
  shortcut?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showOnce?: boolean;
  className?: string;
}

export function Tip({
  id,
  children,
  tip,
  shortcut,
  position = 'top',
  showOnce = true,
  className = '',
}: TipProps) {
  const { showTips, tipsDismissed, dismissTip } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const isDismissed = showOnce && tipsDismissed.includes(id);
  const shouldShow = showTips && !isDismissed;

  useEffect(() => {
    setMounted(true);
  }, []);

  const showTip = () => {
    if (!triggerRef.current || !shouldShow) return;

    const rect = triggerRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - 8;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + 8;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - 8;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 8;
        break;
    }

    setCoords({ top, left });
    setIsVisible(true);
  };

  const hideTip = () => {
    setIsVisible(false);
    if (showOnce) {
      dismissTip(id);
    }
  };

  const positionClasses: Record<string, string> = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-emerald-500',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-emerald-500',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-emerald-500',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-emerald-500',
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        className={className}
      >
        {children}
      </div>

      {mounted &&
        isVisible &&
        shouldShow &&
        createPortal(
          <div
            className={`fixed z-[200] px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-xl shadow-lg pointer-events-none transition-all duration-200 max-w-xs ${positionClasses[position]}`}
            style={{
              top: coords.top,
              left: coords.left,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <span>{tip}</span>
              {shortcut && (
                <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono">
                  {shortcut}
                </kbd>
              )}
            </div>
            <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
          </div>,
          document.body
        )}
    </>
  );
}

// Keyboard shortcut hint badge
export function ShortcutHint({
  shortcut,
  label,
  className = '',
}: {
  shortcut: string;
  label?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] ${className}`}>
      {label && <span>{label}</span>}
      <kbd className="px-1.5 py-0.5 bg-[var(--surface-hover)] text-[var(--text-tertiary)] rounded border border-[var(--border)] font-mono text-[10px]">
        {shortcut}
      </kbd>
    </span>
  );
}
