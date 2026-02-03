'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { useToast } from './ToastContext';

export type TranslationContextMode = 'general' | 'pokemon' | 'custom';
export type PrimaryLanguage = 'en' | 'ja' | 'auto';
export type UserTextDisplayMode = 'en' | 'ja' | 'both';

interface TranslationSettings {
  primaryLanguage: PrimaryLanguage;
  contextMode: TranslationContextMode;
  customContext: string;
  userTextDisplayMode: UserTextDisplayMode;
}

interface TranslationState {
  isTranslating: Record<string, boolean>;
  errors: Record<string, string | null>;
}

interface TranslationResult {
  translation: string;
  isPlaceholder?: boolean;
  error?: string;
}

interface TranslationContextType {
  // Settings
  settings: TranslationSettings;
  updateSettings: (settings: Partial<TranslationSettings>) => void;
  
  // Translation state
  translationState: TranslationState;
  
  // Translation functions
  translate: (
    text: string,
    targetLanguage: 'en' | 'ja',
    fieldKey: string,
    signal?: AbortSignal
  ) => Promise<TranslationResult>;
  
  translateWithAutoDetect: (
    text: string,
    fieldKey: string,
    signal?: AbortSignal
  ) => Promise<{
    detectedLanguage: 'en' | 'ja';
    original: string;
    translation: string;
    error?: string;
  }>;
  
  // Debounced translation
  debouncedTranslate: (
    text: string,
    targetLanguage: 'en' | 'ja',
    fieldKey: string,
    onComplete: (result: TranslationResult) => void,
    delay?: number
  ) => void;
  
  // Cancel pending translation
  cancelTranslation: (fieldKey: string) => void;
  
  // Clear error
  clearError: (fieldKey: string) => void;
  
  // Retry failed translation
  retryTranslation: (
    text: string,
    targetLanguage: 'en' | 'ja',
    fieldKey: string
  ) => Promise<TranslationResult>;
  
  // Batch translation
  batchTranslate: (
    items: Array<{ id: string; text: string; targetLanguage: 'en' | 'ja' }>,
    onProgress: (completed: number, total: number, currentItem?: string) => void,
    onItemComplete: (id: string, result: TranslationResult) => void
  ) => Promise<void>;
  
  // Cancel batch
  cancelBatch: () => void;
  isBatchRunning: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const STORAGE_KEY = 'tomobodo-translation-settings';

const DEFAULT_SETTINGS: TranslationSettings = {
  primaryLanguage: 'auto',
  contextMode: 'pokemon',
  customContext: '',
  userTextDisplayMode: 'both',
};

export function TranslationProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<TranslationSettings>(DEFAULT_SETTINGS);
  const [translationState, setTranslationState] = useState<TranslationState>({
    isTranslating: {},
    errors: {},
  });
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  
  // Refs for debouncing and cancellation
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});
  const batchAbortController = useRef<AbortController | null>(null);
  
  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } else {
        // Auto-detect user's primary language preference
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('ja')) {
          setSettings(prev => ({ ...prev, primaryLanguage: 'ja' }));
        }
      }
    } catch (e) {
      console.error('Failed to load translation settings:', e);
    }
  }, []);
  
  // Save settings to localStorage when they change
  const updateSettings = useCallback((newSettings: Partial<TranslationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save translation settings:', e);
      }
      return updated;
    });
  }, []);
  
  // Set translating state for a field
  const setTranslating = useCallback((fieldKey: string, isTranslating: boolean) => {
    setTranslationState(prev => ({
      ...prev,
      isTranslating: { ...prev.isTranslating, [fieldKey]: isTranslating },
    }));
  }, []);
  
  // Set error state for a field
  const setError = useCallback((fieldKey: string, error: string | null) => {
    setTranslationState(prev => ({
      ...prev,
      errors: { ...prev.errors, [fieldKey]: error },
    }));
  }, []);
  
  // Clear error for a field
  const clearError = useCallback((fieldKey: string) => {
    setError(fieldKey, null);
  }, [setError]);
  
  // Cancel pending translation for a field
  const cancelTranslation = useCallback((fieldKey: string) => {
    // Clear debounce timer
    if (debounceTimers.current[fieldKey]) {
      clearTimeout(debounceTimers.current[fieldKey]);
      delete debounceTimers.current[fieldKey];
    }
    
    // Abort pending request
    if (abortControllers.current[fieldKey]) {
      abortControllers.current[fieldKey].abort();
      delete abortControllers.current[fieldKey];
    }
    
    setTranslating(fieldKey, false);
  }, [setTranslating]);
  
  // Core translation function
  const translate = useCallback(async (
    text: string,
    targetLanguage: 'en' | 'ja',
    fieldKey: string,
    signal?: AbortSignal
  ): Promise<TranslationResult> => {
    if (!text.trim()) {
      return { translation: '' };
    }
    
    setTranslating(fieldKey, true);
    clearError(fieldKey);
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetLanguage,
          contextMode: settings.contextMode,
          customContext: settings.customContext,
        }),
        signal,
      });
      
      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setTranslating(fieldKey, false);
      return {
        translation: data.translation || text,
        isPlaceholder: data.isPlaceholder,
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled, don't treat as error
        setTranslating(fieldKey, false);
        return { translation: text };
      }
      
      const errorMessage = (error as Error).message || 'Translation failed';
      setError(fieldKey, errorMessage);
      setTranslating(fieldKey, false);
      
      return { translation: text, error: errorMessage };
    }
  }, [settings.contextMode, settings.customContext, setTranslating, clearError, setError]);
  
  // Translation with auto-detect
  const translateWithAutoDetect = useCallback(async (
    text: string,
    fieldKey: string,
    signal?: AbortSignal
  ): Promise<{
    detectedLanguage: 'en' | 'ja';
    original: string;
    translation: string;
    error?: string;
  }> => {
    if (!text.trim()) {
      return { detectedLanguage: 'en', original: text, translation: '' };
    }
    
    setTranslating(fieldKey, true);
    clearError(fieldKey);
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          autoDetect: true,
          contextMode: settings.contextMode,
          customContext: settings.customContext,
        }),
        signal,
      });
      
      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setTranslating(fieldKey, false);
      return {
        detectedLanguage: data.detectedLanguage || 'en',
        original: data.original || text,
        translation: data.translation || text,
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setTranslating(fieldKey, false);
        return { detectedLanguage: 'en', original: text, translation: text };
      }
      
      const errorMessage = (error as Error).message || 'Translation failed';
      setError(fieldKey, errorMessage);
      setTranslating(fieldKey, false);
      
      return { detectedLanguage: 'en', original: text, translation: text, error: errorMessage };
    }
  }, [settings.contextMode, settings.customContext, setTranslating, clearError, setError]);
  
  // Debounced translation
  const debouncedTranslate = useCallback((
    text: string,
    targetLanguage: 'en' | 'ja',
    fieldKey: string,
    onComplete: (result: TranslationResult) => void,
    delay: number = 500
  ) => {
    // Cancel any pending translation for this field
    cancelTranslation(fieldKey);
    
    if (!text.trim()) {
      onComplete({ translation: '' });
      return;
    }
    
    // Show translating state immediately
    setTranslating(fieldKey, true);
    
    // Set up new debounce timer
    debounceTimers.current[fieldKey] = setTimeout(async () => {
      // Create new abort controller
      const controller = new AbortController();
      abortControllers.current[fieldKey] = controller;
      
      const result = await translate(text, targetLanguage, fieldKey, controller.signal);
      
      // Clean up
      delete abortControllers.current[fieldKey];
      delete debounceTimers.current[fieldKey];
      
      onComplete(result);
    }, delay);
  }, [cancelTranslation, setTranslating, translate]);
  
  // Retry failed translation
  const retryTranslation = useCallback(async (
    text: string,
    targetLanguage: 'en' | 'ja',
    fieldKey: string
  ): Promise<TranslationResult> => {
    return translate(text, targetLanguage, fieldKey);
  }, [translate]);
  
  // Cancel batch translation
  const cancelBatch = useCallback(() => {
    if (batchAbortController.current) {
      batchAbortController.current.abort();
      batchAbortController.current = null;
    }
    setIsBatchRunning(false);
  }, []);
  
  // Batch translation
  const batchTranslate = useCallback(async (
    items: Array<{ id: string; text: string; targetLanguage: 'en' | 'ja' }>,
    onProgress: (completed: number, total: number, currentItem?: string) => void,
    onItemComplete: (id: string, result: TranslationResult) => void
  ): Promise<void> => {
    if (items.length === 0) return;
    
    setIsBatchRunning(true);
    batchAbortController.current = new AbortController();
    
    let completed = 0;
    const total = items.length;
    
    onProgress(0, total);
    
    for (const item of items) {
      if (batchAbortController.current?.signal.aborted) {
        break;
      }
      
      onProgress(completed, total, item.id);
      
      try {
        const result = await translate(
          item.text,
          item.targetLanguage,
          `batch-${item.id}`,
          batchAbortController.current?.signal
        );
        
        onItemComplete(item.id, result);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          break;
        }
        onItemComplete(item.id, { translation: item.text, error: 'Translation failed' });
      }
      
      completed++;
      onProgress(completed, total);
      
      // Small delay between requests to avoid rate limiting
      if (completed < total && !batchAbortController.current?.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setIsBatchRunning(false);
    batchAbortController.current = null;
    
    if (completed === total) {
      showToast('success', `Translated ${completed} items`);
    } else {
      showToast('info', `Translated ${completed} of ${total} items`);
    }
  }, [translate, showToast]);
  
  return (
    <TranslationContext.Provider
      value={{
        settings,
        updateSettings,
        translationState,
        translate,
        translateWithAutoDetect,
        debouncedTranslate,
        cancelTranslation,
        clearError,
        retryTranslation,
        batchTranslate,
        cancelBatch,
        isBatchRunning,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
