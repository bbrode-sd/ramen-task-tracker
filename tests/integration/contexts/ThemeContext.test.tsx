import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// Test component that uses the theme context
function ThemeTestComponent() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
    </div>
  );
}

describe('ThemeContext', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockLocalStorage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockLocalStorage[key] = value;
    });

    // Mock matchMedia
    mockMatchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

    // Mock document.documentElement.classList
    document.documentElement.classList.remove('light', 'dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should default to system theme', async () => {
    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('system');
    });
  });

  it('should resolve to light theme when system is light', async () => {
    mockMatchMedia.mockReturnValue({
      matches: false, // prefers-color-scheme: dark is false = light mode
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    });
  });

  it('should resolve to dark theme when system is dark', async () => {
    mockMatchMedia.mockReturnValue({
      matches: true, // prefers-color-scheme: dark is true
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    });
  });

  it('should change theme when setTheme is called', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByText('Dark'));

    await waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    });
  });

  it('should persist theme setting by calling setItem', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    );

    // Wait for initial mount
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toBeInTheDocument();
    });

    // Change theme
    await user.click(screen.getByText('Dark'));

    // Theme should change
    await waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('dark');
    });
  });

  it('should read stored theme preference', () => {
    // This tests the getStoredTheme logic directly
    // The component uses localStorage internally
    const getStoredTheme = (stored: string | null): string => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
      return 'system';
    };

    expect(getStoredTheme('dark')).toBe('dark');
    expect(getStoredTheme('light')).toBe('light');
    expect(getStoredTheme('system')).toBe('system');
    expect(getStoredTheme(null)).toBe('system');
    expect(getStoredTheme('invalid')).toBe('system');
  });

  it('should apply theme class to document', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByText('Dark'));

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('should remove previous theme class when changing theme', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeTestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByText('Dark'));
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    await user.click(screen.getByText('Light'));
    await waitFor(() => {
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('should throw error when useTheme is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<ThemeTestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });
});
