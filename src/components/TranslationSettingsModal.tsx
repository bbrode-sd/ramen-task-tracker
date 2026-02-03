'use client';

import { useState } from 'react';
import { useTranslation, TranslationContextMode } from '@/contexts/TranslationContext';

interface TranslationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TranslationSettingsModal({ isOpen, onClose }: TranslationSettingsModalProps) {
  const { settings, updateSettings } = useTranslation();
  // Map 'pokemon' (the internal default) to 'general' for UI display
  // This hides the Pokémon branding while keeping it as the default behavior
  const getDisplayMode = (mode: TranslationContextMode): 'general' | 'custom' => 
    mode === 'custom' ? 'custom' : 'general';
  
  const [displayContextMode, setDisplayContextMode] = useState<'general' | 'custom'>(
    getDisplayMode(settings.contextMode)
  );
  const [customContext, setCustomContext] = useState(settings.customContext);

  if (!isOpen) return null;

  const handleSave = () => {
    // 'general' in UI maps to 'pokemon' internally (the optimized default)
    const actualContextMode: TranslationContextMode = 
      displayContextMode === 'custom' ? 'custom' : 'pokemon';
    
    updateSettings({
      contextMode: actualContextMode,
      customContext: displayContextMode === 'custom' ? customContext : settings.customContext,
    });
    onClose();
  };

  const contextOptions: { value: 'general' | 'custom'; label: string; description: string }[] = [
    {
      value: 'general',
      label: 'General',
      description: 'Optimized translations with game terminology',
    },
    {
      value: 'custom',
      label: 'Custom',
      description: 'Define your own translation context',
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900 dark:to-violet-800 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-violet-500 dark:text-violet-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Translation Settings</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Configure how translations work</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Translation Context */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Translation Context
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose a specialized context to improve translation accuracy
            </p>
            <div className="space-y-2">
              {contextOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDisplayContextMode(option.value)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3 ${
                    displayContextMode === option.value
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    displayContextMode === option.value
                      ? 'border-violet-500 bg-violet-500'
                      : 'border-slate-300 dark:border-slate-500'
                  }`}>
                    {displayContextMode === option.value && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-white">{option.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Context Input */}
          {displayContextMode === 'custom' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Custom Context Instructions
              </label>
              <textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="e.g., Use formal language. Technical terms should be translated accurately. Maintain brand names in English..."
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 min-h-[100px] resize-y text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These instructions will be included with every translation request.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-xl hover:from-violet-600 hover:to-violet-700 transition-all font-medium shadow-sm"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple button to open translation settings (can be used in header)
export function TranslationSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 hover:bg-slate-100 rounded-lg transition-colors group"
      title="Translation Settings"
    >
      <svg
        className="w-5 h-5 text-slate-500 group-hover:text-violet-600 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    </button>
  );
}
