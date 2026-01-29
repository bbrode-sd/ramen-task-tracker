'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Card } from '@/types';
import { updateCard } from '@/lib/firestore';

interface BatchTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  boardId: string;
}

interface TranslationItem {
  cardId: string;
  cardTitle: string;
  field: 'titleJa' | 'titleEn' | 'descriptionJa' | 'descriptionEn';
  sourceText: string;
  targetLanguage: 'en' | 'ja';
  status: 'pending' | 'translating' | 'completed' | 'error';
  result?: string;
  error?: string;
}

export function BatchTranslationModal({ isOpen, onClose, cards, boardId }: BatchTranslationModalProps) {
  const { batchTranslate, cancelBatch, isBatchRunning, settings } = useTranslation();
  const [progress, setProgress] = useState<{ completed: number; total: number; current?: string }>({ completed: 0, total: 0 });
  const [translationItems, setTranslationItems] = useState<TranslationItem[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<'en-to-ja' | 'ja-to-en' | 'both'>('both');

  // Find cards that need translation
  const cardsNeedingTranslation = useMemo(() => {
    return cards.filter(card => {
      if (selectedDirection === 'en-to-ja') {
        return (card.titleEn && !card.titleJa) || (card.descriptionEn && !card.descriptionJa);
      } else if (selectedDirection === 'ja-to-en') {
        return (card.titleJa && !card.titleEn) || (card.descriptionJa && !card.descriptionEn);
      } else {
        // both directions
        return (card.titleEn && !card.titleJa) || 
               (card.titleJa && !card.titleEn) ||
               (card.descriptionEn && !card.descriptionJa) ||
               (card.descriptionJa && !card.descriptionEn);
      }
    });
  }, [cards, selectedDirection]);

  // Build translation items
  const buildTranslationItems = useCallback((): TranslationItem[] => {
    const items: TranslationItem[] = [];
    
    cardsNeedingTranslation.forEach(card => {
      // Title translations
      if (selectedDirection === 'en-to-ja' || selectedDirection === 'both') {
        if (card.titleEn && !card.titleJa) {
          items.push({
            cardId: card.id,
            cardTitle: card.titleEn,
            field: 'titleJa',
            sourceText: card.titleEn,
            targetLanguage: 'ja',
            status: 'pending',
          });
        }
        if (card.descriptionEn && !card.descriptionJa) {
          items.push({
            cardId: card.id,
            cardTitle: card.titleEn || card.titleJa || 'Untitled',
            field: 'descriptionJa',
            sourceText: card.descriptionEn,
            targetLanguage: 'ja',
            status: 'pending',
          });
        }
      }
      
      if (selectedDirection === 'ja-to-en' || selectedDirection === 'both') {
        if (card.titleJa && !card.titleEn) {
          items.push({
            cardId: card.id,
            cardTitle: card.titleJa,
            field: 'titleEn',
            sourceText: card.titleJa,
            targetLanguage: 'en',
            status: 'pending',
          });
        }
        if (card.descriptionJa && !card.descriptionEn) {
          items.push({
            cardId: card.id,
            cardTitle: card.titleEn || card.titleJa || 'Untitled',
            field: 'descriptionEn',
            sourceText: card.descriptionJa,
            targetLanguage: 'en',
            status: 'pending',
          });
        }
      }
    });
    
    return items;
  }, [cardsNeedingTranslation, selectedDirection]);

  const handleStartTranslation = async () => {
    const items = buildTranslationItems();
    setTranslationItems(items);
    setProgress({ completed: 0, total: items.length });
    setIsComplete(false);

    if (items.length === 0) {
      setIsComplete(true);
      return;
    }

    // Prepare batch items
    const batchItems = items.map((item, index) => ({
      id: `${item.cardId}-${item.field}-${index}`,
      text: item.sourceText,
      targetLanguage: item.targetLanguage,
    }));

    await batchTranslate(
      batchItems,
      (completed, total, currentItem) => {
        setProgress({ completed, total, current: currentItem });
      },
      async (id, result) => {
        const index = batchItems.findIndex(item => item.id === id);
        if (index === -1) return;
        
        const originalItem = items[index];
        
        setTranslationItems(prev => 
          prev.map((item, i) => 
            i === index
              ? {
                  ...item,
                  status: result.error ? 'error' : 'completed',
                  result: result.translation,
                  error: result.error,
                }
              : item
          )
        );

        // Update the card in Firestore if successful
        if (!result.error && result.translation) {
          try {
            await updateCard(boardId, originalItem.cardId, {
              [originalItem.field]: result.translation,
            });
          } catch (error) {
            console.error('Failed to update card:', error);
          }
        }
      }
    );

    setIsComplete(true);
  };

  const handleClose = () => {
    if (isBatchRunning) {
      cancelBatch();
    }
    setTranslationItems([]);
    setProgress({ completed: 0, total: 0 });
    setIsComplete(false);
    onClose();
  };

  if (!isOpen) return null;

  const successCount = translationItems.filter(item => item.status === 'completed').length;
  const errorCount = translationItems.filter(item => item.status === 'error').length;
  const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Batch Translation</h2>
              <p className="text-xs text-slate-400">Translate all cards missing translations</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {!isBatchRunning && !isComplete ? (
            <div className="space-y-6">
              {/* Direction selector */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Translation Direction
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedDirection('en-to-ja')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedDirection === 'en-to-ja'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-800">EN → JP</div>
                    <div className="text-[10px] text-slate-500">English to Japanese</div>
                  </button>
                  <button
                    onClick={() => setSelectedDirection('ja-to-en')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedDirection === 'ja-to-en'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-800">JP → EN</div>
                    <div className="text-[10px] text-slate-500">Japanese to English</div>
                  </button>
                  <button
                    onClick={() => setSelectedDirection('both')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedDirection === 'both'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-800">Both</div>
                    <div className="text-[10px] text-slate-500">Fill all missing</div>
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Cards to translate:</span>
                  <span className="text-lg font-bold text-emerald-600">{cardsNeedingTranslation.length}</span>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Total items to translate: {buildTranslationItems().length}</p>
                  <p>Translation context: <span className="font-medium capitalize">{settings.contextMode}</span></p>
                </div>
                {cardsNeedingTranslation.length === 0 && (
                  <div className="mt-3 text-sm text-emerald-600 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    All cards are fully translated!
                  </div>
                )}
              </div>

              {/* Preview of cards needing translation */}
              {cardsNeedingTranslation.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Cards ({cardsNeedingTranslation.length})
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2">
                    {cardsNeedingTranslation.slice(0, 20).map(card => (
                      <div key={card.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm">
                        <span className="text-slate-700 truncate flex-1">
                          {card.titleEn || card.titleJa || 'Untitled'}
                        </span>
                        {!card.titleJa && card.titleEn && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">+JP title</span>
                        )}
                        {!card.titleEn && card.titleJa && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">+EN title</span>
                        )}
                      </div>
                    ))}
                    {cardsNeedingTranslation.length > 20 && (
                      <div className="text-xs text-slate-400 text-center py-1">
                        And {cardsNeedingTranslation.length - 20} more...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {isComplete ? 'Translation Complete' : 'Translating...'}
                  </span>
                  <span className="text-sm font-bold text-emerald-600">
                    {progress.completed} / {progress.total}
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isComplete && errorCount > 0
                        ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {!isComplete && progress.current && (
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </p>
                )}
              </div>

              {/* Results summary */}
              {isComplete && (
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-emerald-600">{successCount}</div>
                      <div className="text-[10px] text-slate-500">Translated</div>
                    </div>
                  </div>
                  {errorCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600">{errorCount}</div>
                        <div className="text-[10px] text-slate-500">Failed</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Translation items list */}
              <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2">
                {translationItems.map((item, index) => (
                  <div
                    key={`${item.cardId}-${item.field}-${index}`}
                    className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                      item.status === 'completed' ? 'bg-emerald-50' :
                      item.status === 'error' ? 'bg-red-50' :
                      item.status === 'translating' ? 'bg-blue-50' :
                      'bg-slate-50'
                    }`}
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {item.status === 'completed' && (
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {item.status === 'error' && (
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {item.status === 'translating' && (
                        <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {item.status === 'pending' && (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-slate-700">{item.cardTitle}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.field.replace(/([A-Z])/g, ' $1').trim()} → {item.targetLanguage.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors font-medium"
          >
            {isComplete ? 'Close' : 'Cancel'}
          </button>
          {!isBatchRunning && !isComplete && cardsNeedingTranslation.length > 0 && (
            <button
              onClick={handleStartTranslation}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all font-medium shadow-sm"
            >
              Start Translation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
