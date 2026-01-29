'use client';

import { useState, useRef, useEffect } from 'react';
import { BoardBackground } from '@/types';

// Gradient presets
export const GRADIENT_PRESETS = [
  {
    name: 'Default',
    value: 'from-orange-500 via-orange-500 to-red-500',
    preview: 'linear-gradient(to right, #f97316, #f97316, #ef4444)',
  },
  {
    name: 'Ocean',
    value: 'from-blue-500 via-cyan-500 to-teal-500',
    preview: 'linear-gradient(to right, #3b82f6, #06b6d4, #14b8a6)',
  },
  {
    name: 'Sunset',
    value: 'from-orange-400 via-pink-500 to-purple-500',
    preview: 'linear-gradient(to right, #fb923c, #ec4899, #a855f7)',
  },
  {
    name: 'Forest',
    value: 'from-green-500 via-emerald-500 to-teal-500',
    preview: 'linear-gradient(to right, #22c55e, #10b981, #14b8a6)',
  },
  {
    name: 'Lavender',
    value: 'from-purple-500 via-violet-500 to-indigo-500',
    preview: 'linear-gradient(to right, #a855f7, #8b5cf6, #6366f1)',
  },
  {
    name: 'Midnight',
    value: 'from-slate-700 via-slate-800 to-slate-900',
    preview: 'linear-gradient(to right, #334155, #1e293b, #0f172a)',
  },
  {
    name: 'Rose',
    value: 'from-rose-400 via-pink-500 to-red-500',
    preview: 'linear-gradient(to right, #fb7185, #ec4899, #ef4444)',
  },
  {
    name: 'Aurora',
    value: 'from-green-400 via-blue-500 to-purple-500',
    preview: 'linear-gradient(to right, #4ade80, #3b82f6, #a855f7)',
  },
];

// Solid color presets
export const COLOR_PRESETS = [
  { name: 'Slate', value: 'bg-slate-600', hex: '#475569' },
  { name: 'Gray', value: 'bg-gray-600', hex: '#4b5563' },
  { name: 'Red', value: 'bg-red-600', hex: '#dc2626' },
  { name: 'Orange', value: 'bg-orange-600', hex: '#ea580c' },
  { name: 'Amber', value: 'bg-amber-600', hex: '#d97706' },
  { name: 'Green', value: 'bg-green-600', hex: '#16a34a' },
  { name: 'Teal', value: 'bg-teal-600', hex: '#0d9488' },
  { name: 'Blue', value: 'bg-blue-600', hex: '#2563eb' },
  { name: 'Indigo', value: 'bg-indigo-600', hex: '#4f46e5' },
  { name: 'Purple', value: 'bg-purple-600', hex: '#9333ea' },
  { name: 'Pink', value: 'bg-pink-600', hex: '#db2777' },
  { name: 'Rose', value: 'bg-rose-600', hex: '#e11d48' },
];

interface BackgroundPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentBackground?: BoardBackground;
  onSelect: (background: BoardBackground) => void;
}

export function BackgroundPicker({
  isOpen,
  onClose,
  currentBackground,
  onSelect,
}: BackgroundPickerProps) {
  const [selectedType, setSelectedType] = useState<'gradient' | 'color'>(
    currentBackground?.type === 'color' ? 'color' : 'gradient'
  );
  const [previewBackground, setPreviewBackground] = useState<BoardBackground | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Reset preview when opened
  useEffect(() => {
    if (isOpen) {
      setPreviewBackground(null);
      setSelectedType(currentBackground?.type === 'color' ? 'color' : 'gradient');
    }
  }, [isOpen, currentBackground]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGradientSelect = (gradient: typeof GRADIENT_PRESETS[0]) => {
    const background: BoardBackground = { type: 'gradient', value: gradient.value };
    onSelect(background);
    onClose();
  };

  const handleColorSelect = (color: typeof COLOR_PRESETS[0]) => {
    const background: BoardBackground = { type: 'color', value: color.value };
    onSelect(background);
    onClose();
  };

  const isSelected = (type: 'gradient' | 'color', value: string) => {
    if (!currentBackground) {
      // Default is the orange/red gradient
      return type === 'gradient' && value === GRADIENT_PRESETS[0].value;
    }
    return currentBackground.type === type && currentBackground.value === value;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      {/* Picker Panel */}
      <div
        ref={pickerRef}
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Board Background</h3>
              <p className="text-sm text-slate-500">Choose a gradient or solid color</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setSelectedType('gradient')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                selectedType === 'gradient'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Gradients
            </button>
            <button
              onClick={() => setSelectedType('color')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                selectedType === 'color'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Solid Colors
            </button>
          </div>
        </div>

        {/* Preview */}
        {previewBackground && (
          <div className="px-5 pt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Preview</div>
            <div
              className={`h-16 rounded-xl ${
                previewBackground.type === 'gradient'
                  ? `bg-gradient-to-r ${previewBackground.value}`
                  : previewBackground.value
              } transition-all duration-300`}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-5 max-h-80 overflow-y-auto">
          {selectedType === 'gradient' ? (
            <div className="grid grid-cols-2 gap-3">
              {GRADIENT_PRESETS.map((gradient) => (
                <button
                  key={gradient.name}
                  onClick={() => handleGradientSelect(gradient)}
                  onMouseEnter={() => setPreviewBackground({ type: 'gradient', value: gradient.value })}
                  onMouseLeave={() => setPreviewBackground(null)}
                  className={`group relative rounded-xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isSelected('gradient', gradient.value)
                      ? 'ring-2 ring-orange-500 ring-offset-2'
                      : 'ring-1 ring-slate-200 hover:ring-slate-300'
                  }`}
                >
                  <div
                    className={`h-20 bg-gradient-to-r ${gradient.value}`}
                  />
                  <div className="absolute inset-0 flex items-end">
                    <div className="w-full px-3 py-2 bg-gradient-to-t from-black/50 to-transparent">
                      <span className="text-sm font-medium text-white drop-shadow-sm">
                        {gradient.name}
                      </span>
                    </div>
                  </div>
                  {isSelected('gradient', gradient.value) && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                      <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => handleColorSelect(color)}
                  onMouseEnter={() => setPreviewBackground({ type: 'color', value: color.value })}
                  onMouseLeave={() => setPreviewBackground(null)}
                  className={`group relative aspect-square rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                    isSelected('color', color.value)
                      ? 'ring-2 ring-orange-500 ring-offset-2'
                      : 'ring-1 ring-slate-200 hover:ring-slate-300'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {isSelected('color', color.value) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                        <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {/* Tooltip */}
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {color.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Changes are saved automatically
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
