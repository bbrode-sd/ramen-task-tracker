import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle, rafThrottle, prefersReducedMotion } from '@/lib/performance';

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);
      debouncedFn(); // Reset timer
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the function', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should use latest arguments when called multiple times', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });
  });

  describe('throttle', () => {
    it('should execute immediately on first call', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throttle subsequent calls', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2); // Trailing call
    });

    it('should allow calls after wait period', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      vi.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to the function', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn('arg1', 'arg2');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('rafThrottle', () => {
    beforeEach(() => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        setTimeout(cb, 16); // Simulate ~60fps
        return 1;
      });
    });

    it('should throttle to animation frame rate', () => {
      const fn = vi.fn();
      const rafThrottledFn = rafThrottle(fn);

      rafThrottledFn('first');
      rafThrottledFn('second');
      rafThrottledFn('third');

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(16);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third'); // Should use latest args
    });

    it('should allow new calls after animation frame', () => {
      const fn = vi.fn();
      const rafThrottledFn = rafThrottle(fn);

      rafThrottledFn();
      vi.advanceTimersByTime(16);
      expect(fn).toHaveBeenCalledTimes(1);

      rafThrottledFn();
      vi.advanceTimersByTime(16);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('prefersReducedMotion', () => {
    it('should return false when motion is not reduced', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: false,
      } as MediaQueryList);

      expect(prefersReducedMotion()).toBe(false);
    });

    it('should return true when motion is reduced', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true,
      } as MediaQueryList);

      expect(prefersReducedMotion()).toBe(true);
    });
  });
});
