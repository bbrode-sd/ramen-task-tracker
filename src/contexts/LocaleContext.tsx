'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import enTranslations from '@/locales/en.json';
import jaTranslations from '@/locales/ja.json';

export type Locale = 'en' | 'ja';

type TranslationKeys = keyof typeof enTranslations;
type NestedTranslationKeys<T> = T extends object
  ? { [K in keyof T]: K extends string ? (T[K] extends object ? `${K}.${NestedTranslationKeys<T[K]>}` : K) : never }[keyof T]
  : never;

type AllTranslationKeys = NestedTranslationKeys<typeof enTranslations>;

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const STORAGE_KEY = 'tomobodo-locale';

const translations: Record<Locale, typeof enTranslations> = {
  en: enTranslations,
  ja: jaTranslations as typeof enTranslations,
};

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return typeof current === 'string' ? current : undefined;
}

function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  
  const browserLang = navigator.language.toLowerCase();
  
  // Check if browser language starts with 'ja' (Japanese)
  if (browserLang.startsWith('ja')) {
    return 'ja';
  }
  
  return 'en';
}

function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'ja') {
    return stored;
  }
  return null;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  // Initialize locale from storage or browser detection
  useEffect(() => {
    const stored = getStoredLocale();
    if (stored) {
      setLocaleState(stored);
    } else {
      // Auto-detect from browser
      const detected = detectBrowserLocale();
      setLocaleState(detected);
      // Save the detected locale so it persists
      localStorage.setItem(STORAGE_KEY, detected);
    }
    setMounted(true);
  }, []);

  // Set locale and persist to localStorage
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    
    // Update the html lang attribute
    document.documentElement.lang = newLocale;
  }, []);

  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const translation = getNestedValue(translations[locale] as Record<string, unknown>, key);
    
    if (!translation) {
      // Fallback to English if key not found in current locale
      const fallback = getNestedValue(translations.en as Record<string, unknown>, key);
      if (!fallback) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
      return interpolateParams(fallback, params);
    }
    
    return interpolateParams(translation, params);
  }, [locale]);

  // Prevent hydration mismatch by rendering with default locale until mounted
  if (!mounted) {
    return (
      <LocaleContext.Provider value={{ locale: 'en', setLocale: () => {}, t: (key) => key }}>
        {children}
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

// Helper to interpolate parameters into translation strings
function interpolateParams(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
