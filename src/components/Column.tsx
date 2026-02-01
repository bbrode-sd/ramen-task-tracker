'use client';

import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Column as ColumnType, Card as CardType, CardTemplate } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useFilter } from '@/contexts/FilterContext';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  updateColumn,
  archiveColumn,
  restoreColumn,
  archiveAllCardsInColumn,
  restoreCards,
  createCard,
  updateCard,
  archiveCard,
  restoreCard,
  getCard,
  logActivity,
  getCardTemplates,
  createCardFromTemplate,
} from '@/lib/firestore';
import { useToast } from '@/contexts/ToastContext';
import { Card } from './Card';
import { ColumnEmptyState } from './EmptyState';
import { TranslationIndicator } from './CardModal/TranslationIndicator';


interface ColumnProps {
  column: ColumnType;
  cards: CardType[];
  index: number;
  boardId: string;
  onCardClick: (cardId: string) => void;
  hasActiveFilters?: boolean;
  matchesFilter?: (card: CardType) => boolean;
  isFocused?: boolean;
  focusedCardIndex?: number | null;
  selectedCards?: Set<string>;
  onCardSelectToggle?: (cardId: string, shiftKey: boolean) => void;
  /** Embedded mode for sub-boards - uses narrower columns */
  embedded?: boolean;
}

/**
 * Column Component - Accessible draggable column/list
 * 
 * Accessibility Testing Points:
 * - VoiceOver/NVDA: Column should announce name and card count
 * - Menu should announce as popup menu
 * - Dropdown should use aria-expanded
 */
// Column component - wrapped in memo to prevent unnecessary re-renders
// React DevTools Profiler: This component should only re-render when its specific column's props change
function ColumnComponent({ 
  column, 
  cards, 
  index, 
  boardId, 
  onCardClick,
  embedded = false, 
  hasActiveFilters: hasActiveFiltersProp = false, 
  matchesFilter: matchesFilterProp, 
  isFocused = false, 
  focusedCardIndex = null,
  selectedCards = new Set(),
  onCardSelectToggle,
}: ColumnProps) {
  const renderStart = process.env.NODE_ENV === 'development' ? performance.now() : 0;
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLocale();
  const { triggerAddCard, setTriggerAddCard, addCardInputRefs } = useKeyboardShortcuts();
  const { 
    debouncedTranslate, 
    translationState, 
    cancelTranslation,
    clearError,
    retryTranslation,
  } = useTranslation();
  
  // Use filter context directly to ensure re-render when filters change
  const { hasActiveFilters: hasActiveFiltersContext, matchesFilter: matchesFilterContext } = useFilter();
  
  // Prefer context values over props for reactivity
  const hasActiveFilters = hasActiveFiltersContext || hasActiveFiltersProp;
  const matchesFilter = (card: CardType) => matchesFilterContext(card, user?.uid);
  const [editingField, setEditingField] = useState<'en' | 'ja' | null>(null);
  const [columnName, setColumnName] = useState(column.name);
  const [columnNameJa, setColumnNameJa] = useState(column.nameJa || '');
  // Track which language is the original (undefined = 'en' for backwards compatibility)
  const [nameOriginalLanguage, setNameOriginalLanguage] = useState<'en' | 'ja'>(column.nameOriginalLanguage || 'en');
  
  // Translation field keys for this column
  const fieldKeys = useMemo(() => ({
    nameEn: `column-${column.id}-name-en`,
    nameJa: `column-${column.id}-name-ja`,
  }), [column.id]);
  const [showMenu, setShowMenu] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitleEn, setNewCardTitleEn] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const addCardTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Template state
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  // Handle triggerAddCard from keyboard shortcut
  useEffect(() => {
    if (triggerAddCard === index) {
      setIsAddingCard(true);
      setTriggerAddCard(null);
      // Focus the textarea after it renders
      setTimeout(() => {
        addCardTextareaRef.current?.focus();
      }, 0);
    }
  }, [triggerAddCard, index, setTriggerAddCard]);

  // Register the add card textarea ref
  useEffect(() => {
    addCardInputRefs.current.set(index, addCardTextareaRef.current);
    return () => {
      addCardInputRefs.current.delete(index);
    };
  }, [index, addCardInputRefs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch card templates when dropdown opens
  useEffect(() => {
    const fetchTemplates = async () => {
      if (showTemplateDropdown && user) {
        setIsLoadingTemplates(true);
        try {
          const templates = await getCardTemplates(user.uid);
          setCardTemplates(templates);
        } catch (error) {
          console.error('Failed to fetch templates:', error);
        } finally {
          setIsLoadingTemplates(false);
        }
      }
    };
    fetchTemplates();
  }, [showTemplateDropdown, user]);

  // Cancel translations when unmounting
  useEffect(() => {
    return () => {
      cancelTranslation(fieldKeys.nameEn);
      cancelTranslation(fieldKeys.nameJa);
    };
  }, [cancelTranslation, fieldKeys]);

  // Sync column name states when column prop changes
  useEffect(() => {
    setColumnName(column.name);
    setColumnNameJa(column.nameJa || '');
    setNameOriginalLanguage(column.nameOriginalLanguage || 'en');
  }, [column.name, column.nameJa, column.nameOriginalLanguage]);

  // Handle saving English name
  // Only translate to Japanese if English is the original language
  const handleSaveNameEn = async (value: string) => {
    const trimmedValue = value.trim();
    setColumnName(trimmedValue);
    setEditingField(null);
    
    if (!trimmedValue) return;
    
    // Check if this is the first time setting a name (no Japanese yet) or if English is the original
    const isOriginal = nameOriginalLanguage === 'en' || (!column.nameJa && !columnNameJa);
    
    if (isOriginal) {
      // English is the original - update and translate to Japanese
      setNameOriginalLanguage('en');
      await updateColumn(boardId, column.id, { name: trimmedValue, nameOriginalLanguage: 'en' });
      
      // Auto-translate to Japanese with debouncing
      debouncedTranslate(trimmedValue, 'ja', fieldKeys.nameJa, async (result) => {
        if (!result.error) {
          setColumnNameJa(result.translation);
          await updateColumn(boardId, column.id, { nameJa: result.translation });
        }
      });
    } else {
      // English is the translation - just save without translating back to Japanese
      await updateColumn(boardId, column.id, { name: trimmedValue });
    }
  };

  // Handle saving Japanese name
  // Only translate to English if Japanese is the original language
  const handleSaveNameJa = async (value: string) => {
    const trimmedValue = value.trim();
    setColumnNameJa(trimmedValue);
    setEditingField(null);
    
    if (!trimmedValue) return;
    
    // Check if Japanese is the original language
    const isOriginal = nameOriginalLanguage === 'ja';
    
    if (isOriginal) {
      // Japanese is the original - update and translate to English
      await updateColumn(boardId, column.id, { nameJa: trimmedValue });
      
      // Auto-translate to English with debouncing
      debouncedTranslate(trimmedValue, 'en', fieldKeys.nameEn, async (result) => {
        if (!result.error) {
          setColumnName(result.translation);
          await updateColumn(boardId, column.id, { name: result.translation });
        }
      });
    } else {
      // Japanese is the translation - just save without translating back to English
      await updateColumn(boardId, column.id, { nameJa: trimmedValue });
    }
  };

  // Retry handlers for failed translations
  const handleRetryNameJa = useCallback(async () => {
    clearError(fieldKeys.nameJa);
    const result = await retryTranslation(columnName, 'ja', fieldKeys.nameJa);
    if (!result.error) {
      setColumnNameJa(result.translation);
      await updateColumn(boardId, column.id, { nameJa: result.translation });
    }
  }, [columnName, fieldKeys.nameJa, clearError, retryTranslation, boardId, column.id]);

  const handleRetryNameEn = useCallback(async () => {
    clearError(fieldKeys.nameEn);
    const result = await retryTranslation(columnNameJa, 'en', fieldKeys.nameEn);
    if (!result.error) {
      setColumnName(result.translation);
      await updateColumn(boardId, column.id, { name: result.translation });
    }
  }, [columnNameJa, fieldKeys.nameEn, clearError, retryTranslation, boardId, column.id]);

  // Cancel editing helper
  const cancelEditing = useCallback(() => {
    setColumnName(column.name);
    setColumnNameJa(column.nameJa || '');
    setEditingField(null);
  }, [column.name, column.nameJa]);

  const handleArchive = async () => {
    setShowMenu(false);
    try {
      await archiveColumn(boardId, column.id);
      showToast('success', `List "${column.name}" archived`, {
        undoAction: async () => {
          await restoreColumn(boardId, column.id);
        },
      });
    } catch (error) {
      console.error('Failed to archive column:', error);
      showToast('error', 'Failed to archive list');
    }
  };

  const handleArchiveAllCards = async () => {
    setShowMenu(false);
    try {
      const archivedCardIds = await archiveAllCardsInColumn(boardId, column.id);
      if (archivedCardIds.length > 0) {
        showToast('success', `${archivedCardIds.length} card${archivedCardIds.length > 1 ? 's' : ''} archived`, {
          undoAction: async () => {
            await restoreCards(boardId, archivedCardIds);
          },
        });
      } else {
        showToast('info', 'No cards to archive');
      }
    } catch (error) {
      console.error('Failed to archive cards:', error);
      showToast('error', 'Failed to archive cards');
    }
  };

  const handleAddCard = async () => {
    if (!newCardTitleEn.trim() || !user) return;

    const maxOrder = cards.length > 0 ? Math.max(...cards.map((c) => c.order)) : -1;
    const titleEn = newCardTitleEn.trim();
    
    // Create card with English title first (Japanese shows loading state)
    // Mark EN as the original language since user typed in English
    const cardId = await createCard(
      boardId,
      column.id,
      titleEn,
      '', // Empty initially, will be filled after translation
      user.uid,
      maxOrder + 1,
      { titleDetectedLanguage: 'en' }
    );

    setNewCardTitleEn('');
    setIsAddingCard(false);

    // Log activity
    if (cardId) {
      await logActivity(boardId, {
        cardId,
        cardTitle: titleEn,
        type: 'card_created',
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL,
        metadata: { columnName: column.name },
      });

      // Translate to Japanese in the background and update the card
      debouncedTranslate(titleEn, 'ja', `card-${cardId}-title-ja`, async (result) => {
        if (!result.error) {
          await updateCard(boardId, cardId, { titleJa: result.translation });
        }
      });
    }
  };

  const handleCreateFromTemplate = async (template: CardTemplate) => {
    if (!user) return;
    
    setIsCreatingFromTemplate(true);
    try {
      const maxOrder = cards.length > 0 ? Math.max(...cards.map((c) => c.order)) : -1;
      const cardId = await createCardFromTemplate(
        boardId,
        column.id,
        template.id,
        user.uid,
        maxOrder + 1
      );
      
      // Log activity
      if (cardId) {
        await logActivity(boardId, {
          cardId,
          cardTitle: template.titleEn,
          type: 'card_created',
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          userPhoto: user.photoURL,
          metadata: { columnName: column.name, fromTemplate: template.name },
        });
      }
      
      showToast('success', `Card created from "${template.name}" template`);
      setShowTemplateDropdown(false);
    } catch (error) {
      console.error('Failed to create card from template:', error);
      showToast('error', 'Failed to create card from template');
    } finally {
      setIsCreatingFromTemplate(false);
    }
  };

  // Handler for archiving a single card
  const handleArchiveCard = useCallback(async (cardId: string) => {
    const cardToArchive = cards.find(c => c.id === cardId);
    if (!cardToArchive) return;
    
    try {
      await archiveCard(boardId, cardId);
      showToast('success', `Card archived`, {
        undoAction: async () => {
          await restoreCard(boardId, cardId);
        },
      });
      
      // Log activity
      if (user) {
        await logActivity(boardId, {
          cardId,
          cardTitle: cardToArchive.titleEn || 'Untitled',
          type: 'card_archived',
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          userPhoto: user.photoURL,
          metadata: { columnName: column.name },
        });
      }
    } catch (error) {
      console.error('Failed to archive card:', error);
      showToast('error', 'Failed to archive card');
    }
  }, [boardId, cards, column.name, showToast, user]);

  // Handler for duplicating a card
  const handleDuplicateCard = useCallback(async (cardId: string) => {
    const cardToDuplicate = cards.find(c => c.id === cardId);
    if (!cardToDuplicate || !user) return;
    
    try {
      // Get the full card data
      const fullCard = await getCard(boardId, cardId);
      if (!fullCard) {
        showToast('error', 'Card not found');
        return;
      }
      
      // Calculate the new order (insert right after the original card)
      const originalIndex = cards.findIndex(c => c.id === cardId);
      const newOrder = cardToDuplicate.order + 0.5; // Will be normalized on save
      
      // Create a new card with the same content
      // Preserve the original card's titleDetectedLanguage
      const newCardId = await createCard(
        boardId,
        column.id,
        fullCard.titleEn ? `${fullCard.titleEn} (copy)` : '',
        fullCard.titleJa ? `${fullCard.titleJa} (コピー)` : '',
        user.uid,
        newOrder,
        fullCard.titleDetectedLanguage ? { titleDetectedLanguage: fullCard.titleDetectedLanguage } : undefined
      );
      
      // Update with additional properties if present
      if (newCardId) {
        const updates: Partial<CardType> = {};
        
        if (fullCard.descriptionEn) updates.descriptionEn = fullCard.descriptionEn;
        if (fullCard.descriptionJa) updates.descriptionJa = fullCard.descriptionJa;
        // Preserve title translator info if present
        if (fullCard.titleTranslatorEn) updates.titleTranslatorEn = fullCard.titleTranslatorEn;
        if (fullCard.titleTranslatorJa) updates.titleTranslatorJa = fullCard.titleTranslatorJa;
        if (fullCard.labels && fullCard.labels.length > 0) updates.labels = fullCard.labels;
        if (fullCard.priority) updates.priority = fullCard.priority;
        if (fullCard.checklists && fullCard.checklists.length > 0) {
          // Reset checklist items completion status
          updates.checklists = fullCard.checklists.map(checklist => ({
            ...checklist,
            id: `checklist-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            items: checklist.items.map(item => ({
              ...item,
              id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              isCompleted: false,
            })),
          }));
        }
        
        if (Object.keys(updates).length > 0) {
          await updateCard(boardId, newCardId, updates);
        }
        
        // Log activity
        await logActivity(boardId, {
          cardId: newCardId,
          cardTitle: fullCard.titleEn ? `${fullCard.titleEn} (copy)` : 'Untitled',
          type: 'card_created',
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          userPhoto: user.photoURL,
          metadata: { columnName: column.name, duplicatedFrom: cardId },
        });
        
        showToast('success', 'Card duplicated');
      }
    } catch (error) {
      console.error('Failed to duplicate card:', error);
      showToast('error', 'Failed to duplicate card');
    }
  }, [boardId, cards, column.id, column.name, showToast, user]);

  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided, snapshot) => (
        <section
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-column-id={column.id}
          tabIndex={isFocused ? 0 : -1}
          role="region"
          aria-label={`${column.name} list with ${cards.length} cards`}
          aria-describedby={`column-drag-instructions-${column.id}`}
          style={{
            ...provided.draggableProps.style,
            // IMPORTANT: Do NOT add rotate() or scale() transforms here - they conflict with
            // the library's cursor-based positioning and cause the element to appear offset.
            // Visual effects are handled via the column-dragging CSS class.
            transition: snapshot.isDragging 
              ? 'none' 
              : snapshot.isDropAnimating 
                ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' 
                : provided.draggableProps.style?.transition,
          }}
          className={`flex-shrink-0 ${embedded ? 'w-[200px]' : 'w-[280px] sm:w-[300px]'} bg-[var(--surface)] rounded-2xl flex flex-col border ${
            snapshot.isDragging 
              ? 'column-dragging drag-shadow z-50' 
              : 'shadow-md transition-all duration-300'
          } ${snapshot.isDropAnimating ? 'animate-drop' : ''} ${
            isFocused && !snapshot.isDragging ? 'ring-2 ring-[var(--primary)] border-[var(--primary)] shadow-lg' : 'border-[var(--border)]'
          }`}
        >
          {/* Screen reader drag instructions for column */}
          <span id={`column-drag-instructions-${column.id}`} className="sr-only">
            Drag to reorder lists. Press space bar to lift, use arrow keys to move, space bar to drop.
          </span>
          {/* Column Header */}
          <div
            {...provided.dragHandleProps}
            className="px-3 py-3.5 border-b border-[var(--border-subtle)]"
          >
            <div className="flex items-start gap-2.5">
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* English name */}
                <div className="flex items-center gap-1.5">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-4 text-[8px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded border border-sky-200/60 dark:border-sky-700/50">
                    EN
                  </span>
                  {editingField === 'en' ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={columnName}
                        onChange={(e) => setColumnName(e.target.value)}
                        onBlur={() => handleSaveNameEn(columnName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveNameEn(columnName);
                          }
                          if (e.key === 'Escape') {
                            cancelEditing();
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm font-semibold bg-[var(--surface)] text-[var(--text-primary)] rounded-lg border-2 border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                        autoFocus
                        placeholder="List name (English)"
                      />
                      <TranslationIndicator
                        isTranslating={translationState.isTranslating[fieldKeys.nameEn] || false}
                        hasError={translationState.errors[fieldKeys.nameEn]}
                        onRetry={handleRetryNameEn}
                        language="en"
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => setEditingField('en')}
                      className="flex-1 flex items-center gap-1.5 cursor-pointer group"
                    >
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {column.name || '—'}
                      </span>
                      <TranslationIndicator
                        isTranslating={translationState.isTranslating[fieldKeys.nameEn] || false}
                        hasError={translationState.errors[fieldKeys.nameEn]}
                        onRetry={handleRetryNameEn}
                        language="en"
                      />
                      <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Japanese name */}
                <div className="flex items-center gap-1.5">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-4 text-[8px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 rounded border border-rose-200/60 dark:border-rose-700/50">
                    JP
                  </span>
                  {editingField === 'ja' ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={columnNameJa}
                        onChange={(e) => setColumnNameJa(e.target.value)}
                        onBlur={() => handleSaveNameJa(columnNameJa)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveNameJa(columnNameJa);
                          }
                          if (e.key === 'Escape') {
                            cancelEditing();
                          }
                        }}
                        className="flex-1 px-2 py-1 text-xs bg-[var(--surface)] text-[var(--text-primary)] rounded-lg border-2 border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                        autoFocus
                        placeholder="リスト名（日本語）"
                      />
                      <TranslationIndicator
                        isTranslating={translationState.isTranslating[fieldKeys.nameJa] || false}
                        hasError={translationState.errors[fieldKeys.nameJa]}
                        onRetry={handleRetryNameJa}
                        language="ja"
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => setEditingField('ja')}
                      className="flex-1 flex items-center gap-1.5 cursor-pointer group"
                    >
                      {translationState.isTranslating[fieldKeys.nameJa] && !columnNameJa ? (
                        <span className="text-xs text-[var(--text-muted)] italic flex items-center gap-1">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          翻訳中...
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-[var(--text-secondary)] truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                            {columnNameJa || '—'}
                          </span>
                          <TranslationIndicator
                            isTranslating={translationState.isTranslating[fieldKeys.nameJa] || false}
                            hasError={translationState.errors[fieldKeys.nameJa]}
                            onRetry={handleRetryNameJa}
                            language="ja"
                          />
                          <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Column Menu */}
              <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  aria-expanded={showMenu}
                  aria-haspopup="menu"
                  aria-label={`${column.name} list actions menu`}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>

                {showMenu && (
                  <div 
                    role="menu"
                    aria-label={`Actions for ${column.name} list`}
                    className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1.5 z-10 overflow-hidden"
                  >
                    <button
                      role="menuitem"
                      onClick={handleArchiveAllCards}
                      className="w-full px-4 py-3 sm:py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors min-h-[48px] sm:min-h-0"
                    >
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Archive all cards
                    </button>
                    <hr className="my-1.5 border-gray-100 dark:border-slate-700" aria-hidden="true" />
                    <button
                      role="menuitem"
                      onClick={handleArchive}
                      className="w-full px-4 py-3 sm:py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors min-h-[48px] sm:min-h-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      Archive list
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cards */}
          <Droppable droppableId={column.id} type="card">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-1 px-2 py-2 min-h-[60px] transition-colors duration-200 column-drop-zone rounded-lg ${
                  snapshot.isDraggingOver 
                    ? 'dragging-over bg-gradient-to-b from-emerald-50/60 to-emerald-100/40 dark:from-emerald-900/30 dark:to-emerald-800/20' 
                    : ''
                }`}
              >
                {(() => {
                  // Filter cards when filters are active - hide non-matching cards instead of dimming
                  const visibleCards = hasActiveFilters && matchesFilter 
                    ? cards.filter(card => matchesFilter(card))
                    : cards;
                  
                  if (visibleCards.length === 0) {
                    return (
                      <ColumnEmptyState 
                        isDraggingOver={snapshot.isDraggingOver} 
                        showTip={index === 0 && !hasActiveFilters} // Only show tip in first column when no filters
                      />
                    );
                  }
                  
                  return visibleCards.map((card, cardIndex) => (
                    <Card
                      key={card.id}
                      card={card}
                      index={cards.indexOf(card)} // Use original index for drag-drop ordering
                      boardId={boardId}
                      onClick={() => onCardClick(card.id)}
                      isDimmed={false}
                      isFocused={focusedCardIndex === cardIndex}
                      isSelected={selectedCards.has(card.id)}
                      selectedCount={selectedCards.size}
                      onSelectToggle={onCardSelectToggle}
                      onArchive={handleArchiveCard}
                      onDuplicate={handleDuplicateCard}
                      commentCount={card.commentCount || 0}
                      data-onboarding={cardIndex === 0 ? "card" : undefined}
                    />
                  ));
                })()}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Add Card */}
          <div className="px-2 pb-2 pt-1">
            {isAddingCard ? (
              <div className="bg-white dark:bg-slate-700 rounded-xl shadow-md border border-slate-200 dark:border-slate-600 p-3" role="form" aria-label="Add new card">
                <label htmlFor={`add-card-${column.id}`} className="sr-only">
                  Enter card title in English
                </label>
                <textarea
                  id={`add-card-${column.id}`}
                  ref={addCardTextareaRef}
                  value={newCardTitleEn}
                  onChange={(e) => setNewCardTitleEn(e.target.value)}
                  placeholder="Enter a title for this card (English)..."
                  aria-describedby={`add-card-help-${column.id}`}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  rows={2}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddCard();
                    }
                    if (e.key === 'Escape') {
                      setIsAddingCard(false);
                      setNewCardTitleEn('');
                    }
                  }}
                />
                <span id={`add-card-help-${column.id}`} className="sr-only">
                  Press Enter to add card, Escape to cancel. The card will be automatically translated to Japanese.
                </span>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddCard}
                    disabled={!newCardTitleEn.trim()}
                    aria-label="Add card to list"
                    className="px-4 py-2.5 sm:py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98] touch-manipulation min-h-[44px] sm:min-h-0"
                  >
                    Add card
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingCard(false);
                      setNewCardTitleEn('');
                    }}
                    aria-label="Cancel adding card"
                    className="p-2.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
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
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsAddingCard(true)}
                  data-onboarding="add-card"
                  aria-label={`Add a card to ${column.name}`}
                  className="flex-1 px-3 py-3 sm:py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl flex items-center gap-2 transition-all group touch-manipulation min-h-[48px] sm:min-h-0"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-slate-200/80 dark:bg-slate-700/80 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 rounded-lg transition-colors" aria-hidden="true">
                    <svg
                      className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </span>
                  {t('column.addCard')}
                </button>
                
                {/* Create from template - small icon button with tooltip */}
                <div className="relative group/template" ref={templateDropdownRef}>
                  <button
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    aria-expanded={showTemplateDropdown}
                    aria-haspopup="menu"
                    aria-label="Create card from template"
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-lg transition-all touch-manipulation"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                      />
                    </svg>
                  </button>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover/template:opacity-100 pointer-events-none transition-opacity duration-150 z-30">
                    Create from template...
                  </div>
                  
                  {showTemplateDropdown && (
                    <div className="absolute bottom-full right-0 mb-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-20">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Card Templates</h4>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {isLoadingTemplates ? (
                          <div className="px-4 py-3 text-sm text-slate-400 text-center">
                            <svg className="w-4 h-4 animate-spin mx-auto mb-1" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading...
                          </div>
                        ) : cardTemplates.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-400 text-center">
                            <p>No templates yet</p>
                            <p className="text-xs mt-1">Save a card as template to use here</p>
                          </div>
                        ) : (
                          cardTemplates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => handleCreateFromTemplate(template)}
                              disabled={isCreatingFromTemplate}
                              className="w-full px-4 py-3 sm:py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 border-b border-slate-50 dark:border-slate-700/50 last:border-0 min-h-[48px] sm:min-h-0"
                            >
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{template.name}</p>
                              <p className="text-xs text-slate-400 truncate">{template.titleEn}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </Draggable>
  );
}

// Shallow array comparison - much faster than JSON.stringify
function shallowArrayEqual<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Export memoized Column component with custom comparison
// Only re-renders when the column itself or its cards change
export const Column = memo(ColumnComponent, (prevProps, nextProps) => {
  // Quick reference equality checks first
  if (prevProps.column !== nextProps.column) return false;
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.boardId !== nextProps.boardId) return false;
  if (prevProps.hasActiveFilters !== nextProps.hasActiveFilters) return false;
  if (prevProps.isFocused !== nextProps.isFocused) return false;
  if (prevProps.focusedCardIndex !== nextProps.focusedCardIndex) return false;
  
  // Fast comparison for cards array - compare by ID and order only for drag/drop
  // Individual card content changes are handled by the Card component's memo
  if (prevProps.cards.length !== nextProps.cards.length) return false;
  
  for (let i = 0; i < prevProps.cards.length; i++) {
    const prevCard = prevProps.cards[i];
    const nextCard = nextProps.cards[i];
    // Only check identity and position - Card component handles content changes
    if (
      prevCard.id !== nextCard.id ||
      prevCard.order !== nextCard.order ||
      prevCard.columnId !== nextCard.columnId ||
      prevCard.updatedAt !== nextCard.updatedAt
    ) {
      return false;
    }
  }
  
  // Check selectedCards set - use size comparison first for quick rejection
  if (prevProps.selectedCards?.size !== nextProps.selectedCards?.size) return false;
  
  return true;
});
