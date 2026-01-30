'use client';

interface TranslationIndicatorProps {
  isTranslating: boolean;
  hasError?: string | null;
  onRetry?: () => void;
  language: 'en' | 'ja';
}

/**
 * Shows translation status (loading spinner or error with retry)
 */
export function TranslationIndicator({ 
  isTranslating, 
  hasError, 
  onRetry, 
  language 
}: TranslationIndicatorProps) {
  if (isTranslating) {
    return (
      <span className="animate-pulse text-xs text-slate-400 flex items-center gap-1">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {language === 'ja' ? '翻訳中...' : 'Translating...'}
      </span>
    );
  }
  
  if (hasError) {
    return (
      <span className="text-xs text-red-500 flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="hidden sm:inline">{language === 'ja' ? '翻訳失敗' : 'Translation failed'}</span>
        {onRetry && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            className="text-red-600 hover:text-red-700 underline ml-1"
          >
            {language === 'ja' ? '再試行' : 'Retry'}
          </button>
        )}
      </span>
    );
  }
  
  return null;
}
