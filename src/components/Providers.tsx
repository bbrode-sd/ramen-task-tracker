'use client';

import dynamic from 'next/dynamic';
import { AuthProvider } from '@/contexts/AuthContext';
import { FilterProvider } from '@/contexts/FilterContext';
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <TranslationProvider>
              <SyncProvider>
                <OfflineProvider>
                  <FilterProvider>
                    <KeyboardShortcutsProvider>
                      <OnboardingProvider>
                        <OfflineIndicator position="top" />
                        {children}
                        <ToastContainer />
                        <KeyboardShortcutsHelp />
                        <OnboardingTour />
                      </OnboardingProvider>
                    </KeyboardShortcutsProvider>
                  </FilterProvider>
                </OfflineProvider>
              </SyncProvider>
            </TranslationProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
