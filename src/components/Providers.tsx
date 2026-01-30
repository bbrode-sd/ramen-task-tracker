'use client';

import dynamic from 'next/dynamic';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { KeyboardShortcutsProvider } from '@/contexts/KeyboardShortcutsContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { OfflineProvider } from '@/contexts/OfflineContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { ToastContainer } from './Toast';
import { OfflineIndicator } from './OfflineIndicator';
import { ErrorBoundary } from './ErrorBoundary';

// Lazy load modal components that are only shown conditionally
// KeyboardShortcutsHelp - shown when user presses ?
const KeyboardShortcutsHelp = dynamic(
  () => import('./KeyboardShortcutsHelp').then(mod => ({ default: mod.KeyboardShortcutsHelp })),
  { ssr: false, loading: () => null }
);

// OnboardingTour - shown only for new users
const OnboardingTour = dynamic(
  () => import('./OnboardingTour').then(mod => ({ default: mod.OnboardingTour })),
  { ssr: false, loading: () => null }
);

/**
 * Global providers for the application
 * 
 * Note: FilterProvider is NOT included here - it's scoped to individual board pages
 * to prevent filter state from leaking between boards.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary context="App">
      <LocaleProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <TranslationProvider>
                <SyncProvider>
                  <OfflineProvider>
                    <KeyboardShortcutsProvider>
                      <OnboardingProvider>
                        <OfflineIndicator position="top" />
                        {children}
                        <ToastContainer />
                        <KeyboardShortcutsHelp />
                        <OnboardingTour />
                      </OnboardingProvider>
                    </KeyboardShortcutsProvider>
                  </OfflineProvider>
                </SyncProvider>
              </TranslationProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}
