'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { KeyboardShortcutsProvider } from '@/contexts/KeyboardShortcutsContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { OfflineProvider } from '@/contexts/OfflineContext';
import { ToastContainer } from './Toast';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { OnboardingTour } from './OnboardingTour';
import { OfflineIndicator } from './OfflineIndicator';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
