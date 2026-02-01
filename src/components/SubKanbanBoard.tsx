'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useToast } from '@/contexts/ToastContext';
import { Board, Column as ColumnType, Card as CardType } from '@/types';
import {
  subscribeToColumns,
  subscribeToCards,
  createColumn,
  createCard,
  reorderColumns,
  reorderCards,
  recalculateAndUpdateApprovedCount,
  getBoard,
} from '@/lib/firestore';

// Template mode column/card types (for local state management)
export interface TemplateColumn {
  id: string;
  name: string;
  nameJa?: string;
  order: number;
  cards: TemplateCard[];
}

export interface TemplateCard {
  id: string;
  titleEn: string;
  titleJa?: string;
  order: number;
}

interface SubKanbanBoardBaseProps {
  compact?: boolean; // For embedded view in CardModal
}

interface FirestoreModeProps extends SubKanbanBoardBaseProps {
  templateMode?: false;
  subBoardId: string;
  parentCardId: string;
  parentBoardId: string;
}

interface TemplateModeProps extends SubKanbanBoardBaseProps {
  templateMode: true;
  columns: TemplateColumn[];
  onColumnsChange: (columns: TemplateColumn[]) => void;
  onDeleteColumn?: (columnId: string) => void;
  onDeleteCard?: (columnId: string, cardId: string) => void;
}

type SubKanbanBoardProps = FirestoreModeProps | TemplateModeProps;

const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * SubKanbanBoard Component - Mini Kanban board for sub-boards within cards
 * A simplified version of KanbanBoard for embedding within card modals
 * 
 * Supports two modes:
 * 1. Firestore mode (default): Connects to a real sub-board in Firestore
 * 2. Template mode: Works with local state for template editing
 */
export function SubKanbanBoard(props: SubKanbanBoardProps) {
  const { compact = false } = props;
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t, locale } = useLocale();
  
  // Firestore mode state
  const [board, setBoard] = useState<Board | null>(null);
  const [firestoreColumns, setFirestoreColumns] = useState<ColumnType[]>([]);
  const [firestoreCards, setFirestoreCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(!props.templateMode);
  
  // Shared UI state
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [addingCardToColumn, setAddingCardToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  
  // Pending updates ref to prevent subscription overwrites (Firestore mode only)
  const pendingCardUpdatesRef = useRef<Map<string, { order: number; columnId: string; expiresAt: number }>>(new Map());

  // Extract props based on mode
  const isTemplateMode = props.templateMode === true;
  const subBoardId = !isTemplateMode ? props.subBoardId : '';
  const parentCardId = !isTemplateMode ? props.parentCardId : '';
  const parentBoardId = !isTemplateMode ? props.parentBoardId : '';
  const templateColumns = isTemplateMode ? props.columns : [];
  const onColumnsChange = isTemplateMode ? props.onColumnsChange : undefined;
  const onDeleteColumn = isTemplateMode ? props.onDeleteColumn : undefined;
  const onDeleteCard = isTemplateMode ? props.onDeleteCard : undefined;

  // Fetch board data (Firestore mode only)
  useEffect(() => {
    if (isTemplateMode) return;
    const fetchBoard = async () => {
      const boardData = await getBoard(subBoardId);
      setBoard(boardData);
    };
    fetchBoard();
  }, [subBoardId, isTemplateMode]);

  // Subscribe to columns (Firestore mode only)
  useEffect(() => {
    if (isTemplateMode) return;
    const unsubscribe = subscribeToColumns(
      subBoardId,
      setFirestoreColumns,
      (error) => {
        console.error('Error subscribing to sub-board columns:', error);
      }
    );
    return () => unsubscribe();
  }, [subBoardId, isTemplateMode]);

  // Subscribe to cards (Firestore mode only)
  useEffect(() => {
    if (isTemplateMode) return;
    const unsubscribe = subscribeToCards(
      subBoardId,
      (newCards) => {
        // Apply pending updates to avoid overwriting optimistic updates
        const now = Date.now();
        const updatedCards = newCards.map((card) => {
          const pending = pendingCardUpdatesRef.current.get(card.id);
          if (pending && pending.expiresAt > now) {
            return { ...card, order: pending.order, columnId: pending.columnId };
          }
          return card;
        });
        
        // Clean up expired pending updates
        pendingCardUpdatesRef.current.forEach((value, key) => {
          if (value.expiresAt <= now) {
            pendingCardUpdatesRef.current.delete(key);
          }
        });
        
        setFirestoreCards(updatedCards);
        setLoading(false);
      },
      {
        onError: (error) => {
          console.error('Error subscribing to sub-board cards:', error);
          setLoading(false);
        }
      }
    );
    return () => unsubscribe();
  }, [subBoardId, isTemplateMode]);

  // Get the active columns based on mode
  const columns = isTemplateMode 
    ? templateColumns.map(tc => ({
        id: tc.id,
        boardId: '',
        name: tc.name,
        nameJa: tc.nameJa,
        order: tc.order,
        isArchived: false,
        createdAt: null as unknown as import('firebase/firestore').Timestamp,
        updatedAt: null as unknown as import('firebase/firestore').Timestamp,
      }))
    : firestoreColumns;

  // Get cards for a specific column
  const getCardsForColumn = useCallback((columnId: string): CardType[] => {
    if (isTemplateMode) {
      const col = templateColumns.find(c => c.id === columnId);
      if (!col) return [];
      return col.cards.map(card => ({
        id: card.id,
        boardId: '',
        columnId,
        titleEn: card.titleEn,
        titleJa: card.titleJa || '',
        titleDetectedLanguage: 'en' as const,
        descriptionEn: '',
        descriptionJa: '',
        order: card.order,
        isArchived: false,
        createdBy: '',
        attachments: [],
        labels: [],
        createdAt: null as unknown as import('firebase/firestore').Timestamp,
        updatedAt: null as unknown as import('firebase/firestore').Timestamp,
      }));
    }
    return firestoreCards
      .filter((card) => card.columnId === columnId)
      .sort((a, b) => a.order - b.order);
  }, [isTemplateMode, templateColumns, firestoreCards]);

  // Handle drag end
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (isTemplateMode && onColumnsChange) {
      // Template mode: update local state
      if (type === 'column') {
        const newColumns = [...templateColumns].sort((a, b) => a.order - b.order);
        const [removed] = newColumns.splice(source.index, 1);
        newColumns.splice(destination.index, 0, removed);
        onColumnsChange(newColumns.map((col, idx) => ({ ...col, order: idx })));
      } else if (type === 'card') {
        const sourceColId = source.droppableId;
        const destColId = destination.droppableId;
        
        const newColumns = templateColumns.map(col => ({
          ...col,
          cards: [...col.cards],
        }));
        
        const sourceCol = newColumns.find(c => c.id === sourceColId);
        const destCol = newColumns.find(c => c.id === destColId);
        if (!sourceCol || !destCol) return;
        
        // Find and remove card from source
        const cardIndex = sourceCol.cards.findIndex(c => c.id === draggableId);
        if (cardIndex === -1) return;
        const [movedCard] = sourceCol.cards.splice(cardIndex, 1);
        
        // Add to destination
        destCol.cards.splice(destination.index, 0, movedCard);
        
        // Re-order cards
        sourceCol.cards.forEach((card, idx) => { card.order = idx; });
        if (sourceColId !== destColId) {
          destCol.cards.forEach((card, idx) => { card.order = idx; });
        }
        
        onColumnsChange(newColumns);
      }
      return;
    }

    // Firestore mode
    if (type === 'column') {
      // Column reordering
      const newColumns = Array.from(firestoreColumns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);

      // Optimistic update
      flushSync(() => {
        setFirestoreColumns(newColumns);
      });

      // Persist to Firestore
      const updates = newColumns.map((col, idx) => ({ id: col.id, order: idx }));
      await reorderColumns(subBoardId, updates);
    } else if (type === 'card') {
      // Card reordering
      const sourceColId = source.droppableId;
      const destColId = destination.droppableId;
      const cardId = draggableId;

      // Get current cards in source and destination columns
      const sourceCards = getCardsForColumn(sourceColId);
      const destCards = sourceColId === destColId ? sourceCards : getCardsForColumn(destColId);

      // Find the moved card
      const movedCard = firestoreCards.find((c) => c.id === cardId);
      if (!movedCard) return;

      // Calculate new card order
      const newSourceCards = sourceCards.filter((c) => c.id !== cardId);
      const newDestCards = sourceColId === destColId ? newSourceCards : [...destCards];
      newDestCards.splice(destination.index, 0, movedCard);

      // Build updates
      const cardUpdates: { id: string; order: number; columnId?: string }[] = [];
      const now = Date.now();
      const updateExpiry = now + 5000; // 5 second expiry

      newDestCards.forEach((card, idx) => {
        const update = { id: card.id, order: idx, columnId: destColId };
        cardUpdates.push(update);
        pendingCardUpdatesRef.current.set(card.id, { order: idx, columnId: destColId, expiresAt: updateExpiry });
      });

      if (sourceColId !== destColId) {
        newSourceCards.forEach((card, idx) => {
          const update = { id: card.id, order: idx };
          cardUpdates.push(update);
          pendingCardUpdatesRef.current.set(card.id, { order: idx, columnId: sourceColId, expiresAt: updateExpiry });
        });
      }

      // Optimistic update
      flushSync(() => {
        setFirestoreCards((prev) =>
          prev.map((card) => {
            const update = cardUpdates.find((u) => u.id === card.id);
            if (update) {
              return { ...card, order: update.order, columnId: update.columnId || card.columnId };
            }
            return card;
          })
        );
      });

      // Persist to Firestore
      await reorderCards(subBoardId, cardUpdates);

      // Update approved count on parent card
      if (board?.approvalColumnName) {
        await recalculateAndUpdateApprovedCount(parentBoardId, parentCardId, subBoardId, board.approvalColumnName);
      }
    }
  };

  // Add column
  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    
    if (isTemplateMode && onColumnsChange) {
      // Template mode: add to local state
      const maxOrder = templateColumns.length > 0 ? Math.max(...templateColumns.map((c) => c.order)) : -1;
      const newColumn: TemplateColumn = {
        id: generateId(),
        name: newColumnName.trim(),
        nameJa: newColumnName.trim(),
        order: maxOrder + 1,
        cards: [],
      };
      onColumnsChange([...templateColumns, newColumn]);
      setNewColumnName('');
      setIsAddingColumn(false);
      return;
    }
    
    // Firestore mode
    try {
      const maxOrder = firestoreColumns.length > 0 ? Math.max(...firestoreColumns.map((c) => c.order)) : -1;
      await createColumn(subBoardId, newColumnName.trim(), maxOrder + 1);
      setNewColumnName('');
      setIsAddingColumn(false);
    } catch (error) {
      console.error('Failed to add column:', error);
      showToast('error', t('subBoard.toast.addColumnFailed'));
    }
  };

  // Add card
  const handleAddCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return;
    
    if (isTemplateMode && onColumnsChange) {
      // Template mode: add to local state
      const newColumns = templateColumns.map(col => {
        if (col.id !== columnId) return col;
        const maxOrder = col.cards.length > 0 ? Math.max(...col.cards.map((c) => c.order)) : -1;
        return {
          ...col,
          cards: [
            ...col.cards,
            {
              id: generateId(),
              titleEn: newCardTitle.trim(),
              titleJa: newCardTitle.trim(),
              order: maxOrder + 1,
            },
          ],
        };
      });
      onColumnsChange(newColumns);
      setNewCardTitle('');
      setAddingCardToColumn(null);
      return;
    }
    
    // Firestore mode
    if (!user) return;
    try {
      const columnCards = getCardsForColumn(columnId);
      const maxOrder = columnCards.length > 0 ? Math.max(...columnCards.map((c) => c.order)) : -1;
      await createCard(subBoardId, columnId, newCardTitle.trim(), '', user.uid, maxOrder + 1);
      setNewCardTitle('');
      setAddingCardToColumn(null);

      // Update approved count if this was added to the approval column
      if (board?.approvalColumnName) {
        const column = firestoreColumns.find((c) => c.id === columnId);
        if (column?.name.toLowerCase() === board.approvalColumnName.toLowerCase()) {
          await recalculateAndUpdateApprovedCount(parentBoardId, parentCardId, subBoardId, board.approvalColumnName);
        }
      }
    } catch (error) {
      console.error('Failed to add card:', error);
      showToast('error', t('subBoard.toast.addCardFailed'));
    }
  };
  
  // Delete column (template mode only)
  const handleDeleteColumn = (columnId: string) => {
    if (isTemplateMode && onDeleteColumn) {
      onDeleteColumn(columnId);
    }
  };
  
  // Delete card (template mode only)
  const handleDeleteCard = (columnId: string, cardId: string) => {
    if (isTemplateMode && onDeleteCard) {
      onDeleteCard(columnId, cardId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${compact ? 'max-h-80' : ''}`}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sub-board" type="column" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-3 pb-2 min-w-max"
            >
              {columns.map((column, index) => (
                <Draggable key={column.id} draggableId={column.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex-shrink-0 ${compact ? 'w-48' : 'w-64'} bg-slate-100 dark:bg-slate-800/70 rounded-xl ${
                        snapshot.isDragging ? 'shadow-xl ring-2 ring-purple-400' : 'shadow-sm'
                      }`}
                    >
                      {/* Column Header */}
                      <div
                        {...provided.dragHandleProps}
                        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700/50 cursor-grab active:cursor-grabbing"
                      >
                        <span className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate flex-1">
                          {locale === 'ja' && column.nameJa ? column.nameJa : column.name}
                        </span>
                        <div className="flex items-center gap-1 ml-2">
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {getCardsForColumn(column.id).length}
                          </span>
                          {isTemplateMode && onDeleteColumn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteColumn(column.id);
                              }}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title={t('subBoardTemplate.removeColumn')}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Column Cards */}
                      <Droppable droppableId={column.id} type="card">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`p-2 min-h-[60px] max-h-48 overflow-y-auto space-y-1.5 ${
                              snapshot.isDraggingOver ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                            }`}
                          >
                            {getCardsForColumn(column.id).map((card, cardIndex) => (
                              <Draggable key={card.id} draggableId={card.id} index={cardIndex}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`group bg-white dark:bg-slate-900/70 rounded-lg p-2 text-xs shadow-sm border border-slate-200 dark:border-slate-700/50 cursor-grab active:cursor-grabbing ${
                                      snapshot.isDragging ? 'shadow-lg ring-2 ring-purple-400' : 'hover:shadow-md'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="text-slate-700 dark:text-slate-200 line-clamp-2 flex-1">
                                        {locale === 'ja' && card.titleJa ? card.titleJa : card.titleEn}
                                      </span>
                                      {isTemplateMode && onDeleteCard && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCard(column.id, card.id);
                                          }}
                                          className="p-0.5 text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                                          title={t('subBoardTemplate.removeCard')}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      {/* Add Card */}
                      {addingCardToColumn === column.id ? (
                        <div className="p-2 border-t border-slate-200 dark:border-slate-700/50">
                          <input
                            type="text"
                            value={newCardTitle}
                            onChange={(e) => setNewCardTitle(e.target.value)}
                            placeholder={t('subBoard.addCardPlaceholder')}
                            className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddCard(column.id);
                              if (e.key === 'Escape') {
                                setAddingCardToColumn(null);
                                setNewCardTitle('');
                              }
                            }}
                          />
                          <div className="flex gap-1 mt-1.5">
                            <button
                              onClick={() => handleAddCard(column.id)}
                              disabled={!newCardTitle.trim()}
                              className="flex-1 px-2 py-1 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-xs rounded-lg"
                            >
                              {t('subBoard.add')}
                            </button>
                            <button
                              onClick={() => {
                                setAddingCardToColumn(null);
                                setNewCardTitle('');
                              }}
                              className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                            >
                              {t('subBoard.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingCardToColumn(column.id)}
                          className="w-full px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700/50 flex items-center gap-1.5 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          {t('subBoard.addCard')}
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add Column */}
              {isAddingColumn ? (
                <div className={`flex-shrink-0 ${compact ? 'w-48' : 'w-64'} bg-slate-100 dark:bg-slate-800/70 rounded-xl p-3`}>
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder={t('subBoard.columnNamePlaceholder')}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddColumn();
                      if (e.key === 'Escape') {
                        setIsAddingColumn(false);
                        setNewColumnName('');
                      }
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleAddColumn}
                      disabled={!newColumnName.trim()}
                      className="flex-1 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-sm rounded-lg"
                    >
                      {t('subBoard.addColumn')}
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingColumn(false);
                        setNewColumnName('');
                      }}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                      {t('subBoard.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingColumn(true)}
                  className={`flex-shrink-0 ${compact ? 'w-48' : 'w-64'} h-10 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors border-2 border-dashed border-slate-300 dark:border-slate-600`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t('subBoard.addColumnButton')}
                </button>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

export default SubKanbanBoard;
