/**
 * Performance Monitoring and Optimization Utilities
 * 
 * This module provides utilities for monitoring and improving performance
 * in the Ramen Task Tracker application.
 * 
 * React DevTools Profiler Integration:
 * - Use React DevTools Profiler to identify slow renders
 * - Components wrapped in memo() should show fewer re-renders
 * - Look for components with long render times (> 16ms)
 * 
 * Key Performance Metrics:
 * - LCP (Largest Contentful Paint): Should be < 2.5s
 * - FID (First Input Delay): Should be < 100ms
 * - CLS (Cumulative Layout Shift): Should be < 0.1
 */

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';
const isBrowser = typeof window !== 'undefined';

/**
 * Performance logging utility
 * Only logs in development mode and when render time exceeds threshold
 */
export const perfLog = (componentName: string, startTime: number, threshold = 16) => {
  if (isDev && isBrowser) {
    const duration = performance.now() - startTime;
    if (duration > threshold) {
      console.debug(
        `%c[Perf] ${componentName}%c took ${duration.toFixed(2)}ms`,
        'color: #ff6b35; font-weight: bold',
        'color: inherit'
      );
    }
  }
};

/**
 * Performance measurement wrapper
 * Wraps a function and logs its execution time
 */
export const withPerfMeasure = <T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T
): T => {
  if (!isDev) return fn;
  
  return ((...args: Parameters<T>) => {
    const start = performance.now();
    const result = fn(...args);
    perfLog(name, start);
    return result;
  }) as T;
};

/**
 * Debounce utility for expensive operations
 * Delays execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle utility for rate-limiting expensive operations
 * Ensures function is called at most once per wait period
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - lastTime);
    
    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastTime = now;
      func(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastTime = Date.now();
        timeoutId = null;
        func(...args);
      }, remaining);
    }
  };
}

/**
 * Request Animation Frame throttle
 * Throttles to animation frame rate (typically 60fps)
 * Best for scroll, resize, and drag handlers
 */
export function rafThrottle<T extends unknown[]>(
  func: (...args: T) => void
): (...args: T) => void {
  let rafId: number | null = null;
  let lastArgs: T | null = null;
  
  return (...args: T) => {
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          func(...lastArgs);
        }
        rafId = null;
      });
    }
  };
}

/**
 * Performance observer for Core Web Vitals
 * Only runs in development mode
 */
export const observeWebVitals = () => {
  if (!isDev || !isBrowser || !('PerformanceObserver' in window)) return;
  
  // Observe Largest Contentful Paint
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.debug(
        `%c[WebVitals] LCP: ${lastEntry.startTime.toFixed(0)}ms`,
        'color: #22c55e; font-weight: bold'
      );
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // LCP observation not supported
  }
  
  // Observe First Input Delay
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const fidEntry = entry as PerformanceEventTiming;
        const fid = fidEntry.processingStart - fidEntry.startTime;
        console.debug(
          `%c[WebVitals] FID: ${fid.toFixed(0)}ms`,
          fid < 100 ? 'color: #22c55e; font-weight: bold' : 'color: #ef4444; font-weight: bold'
        );
      });
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch {
    // FID observation not supported
  }
  
  // Observe Cumulative Layout Shift
  try {
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { hadRecentInput?: boolean; value?: number })[];
      entries.forEach((entry) => {
        if (!entry.hadRecentInput && entry.value) {
          clsScore += entry.value;
        }
      });
      console.debug(
        `%c[WebVitals] CLS: ${clsScore.toFixed(3)}`,
        clsScore < 0.1 ? 'color: #22c55e; font-weight: bold' : 'color: #ef4444; font-weight: bold'
      );
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // CLS observation not supported
  }
};

/**
 * Component render counter for debugging
 * Track how many times a component renders
 */
export const createRenderCounter = (componentName: string) => {
  if (!isDev) return () => {};
  
  let count = 0;
  return () => {
    count++;
    console.debug(`[Render] ${componentName}: ${count} renders`);
  };
};

/**
 * Measure and log function execution time
 */
export const measureTime = async <T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<T> => {
  if (!isDev) return fn();
  
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  
  console.debug(
    `%c[Timing] ${name}: ${duration.toFixed(2)}ms`,
    duration > 100 ? 'color: #ef4444' : 'color: #22c55e'
  );
  
  return result;
};

/**
 * Check if reduced motion is preferred
 * Use this to disable animations for accessibility
 */
export const prefersReducedMotion = (): boolean => {
  if (!isBrowser) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Memory usage logging (Chrome only)
 */
export const logMemoryUsage = () => {
  if (!isDev || !isBrowser) return;
  
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (memory) {
    const used = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    const total = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
    console.debug(`[Memory] ${used}MB / ${total}MB`);
  }
};
