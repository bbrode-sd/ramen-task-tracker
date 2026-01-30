'use client';

import { useEffect } from 'react';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';

interface ShortcutItem {
  keys: string[];
  description: string;
}

const shortcuts: { category: string; items: ShortcutItem[] }[] = [
  {
    category: 'Navigation',
    items: [
      { keys: ['←', '→'], description: 'Navigate between lists' },
      { keys: ['↑', '↓'], description: 'Navigate between cards in list' },
      { keys: ['Enter'], description: 'Open focused card' },
      { keys: ['/'], description: 'Focus search bar' },
    ],
  },
  {
    category: 'Actions',
    items: [
      { keys: ['n'], description: 'Add new card in focused list' },
      { keys: ['e'], description: 'Edit focused card' },
      { keys: ['c'], description: 'Archive hovered card' },
    ],
  },
  {
    category: 'General',
    items: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / Cancel editing' },
    ],
  },
];

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-mono font-medium text-slate-700 shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const { isHelpModalOpen, closeHelpModal } = useKeyboardShortcuts();

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHelpModalOpen) {
        closeHelpModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHelpModalOpen, closeHelpModal]);

  if (!isHelpModalOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
      onClick={closeHelpModal}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Keyboard Shortcuts</h2>
              <p className="text-xs text-slate-400">Navigate quickly with your keyboard</p>
            </div>
          </div>
          <button
            onClick={closeHelpModal}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors group"
          >
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm text-slate-600">{item.description}</span>
                    <div className="flex items-center gap-1.5">
                      {item.keys.map((key, keyIndex) => (
                        <KeyboardKey key={keyIndex}>{key}</KeyboardKey>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-500 text-center">
            Press <KeyboardKey>Esc</KeyboardKey> to close
          </p>
        </div>
      </div>
    </div>
  );
}
