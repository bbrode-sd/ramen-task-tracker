'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

interface SubKanbanBoardProps {
  subBoardId: string;
  parentCardId: string;
  parentBoardId: string;
  compact?: boolean; // For embedded view in CardModal
}

/**
 * SubKanbanBoard Component - Mini Kanban board for sub-boards within cards
 * A simplified version of KanbanBoard for embedding within card modals
 */
export function SubKanbanBoard({ subBoardId, parentCardId, parentBoardId, compact = false }: SubKanbanBoardProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t, locale } = useLocale();
  
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [addingCardToColumn, setAddingCardToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  
  // Pending updates ref to prevent subscription overwrites
  const pendingCardUpdatesRef = useRef<Map<string, { order: number; columnId: string; expiresAt: number }>>(new Map());

  // Fetch board data
  useEffect(() => {
    const fetchBoard = async () => {
      const boardData = await getBoard(subBoardId);
      setBoard(boardData);
    };
    fetchBoard();
  }, [subBoardId]);

  // Subscribe to columns
  useEffect(() => {
    const unsubscribe = subscribeToColumns(
      subBoardId,
      setColumns,
      (error) => {
        console.error('Error subscribing to sub-board columns:', error);
      }
    );
    return () => unsubscribe();
  }, [subBoardId]);

  // Subscribe to cards
  useEffect(() => {
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
        
        setCards(updatedCards);
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
  }, [subBoardId]);

  // Get cards for a specific column
  const getCardsForColumn = useCallback((columnId: string): CardType[] => {
    return cards
      .filter((card) => card.columnId === columnId)
      .sort((a, b) => a.order - b.order);
  }, [cards]);

  // Handle drag end
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'column') {
      // Column reordering
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);

      // Optimistic update
      flushSync(() => {
        setColumns(newColumns);
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
      const movedCard = cards.find((c) => c.id === cardId);
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
        setCards((prev) =>
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
    
    try {
      const maxOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) : -1;
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
    if (!newCardTitle.trim() || !user) return;
    
    try {
      const columnCards = getCardsForColumn(columnId);
      const maxOrder = columnCards.length > 0 ? Math.max(...columnCards.map((c) => c.order)) : -1;
      await createCard(subBoardId, columnId, newCardTitle.trim(), '', user.uid, maxOrder + 1);
      setNewCardTitle('');
      setAddingCardToColumn(null);

      // Update approved count if this was added to the approval column
      if (board?.approvalColumnName) {
        const column = columns.find((c) => c.id === columnId);
        if (column?.name.toLowerCase() === board.approvalColumnName.toLowerCase()) {
          await recalculateAndUpdateApprovedCount(parentBoardId, parentCardId, subBoardId, board.approvalColumnName);
        }
      }
    } catch (error) {
      console.error('Failed to add card:', error);
      showToast('error', t('subBoard.toast.addCardFailed'));
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
                        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700/50"
                      >
                        <span className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate">
                          {locale === 'ja' && column.nameJa ? column.nameJa : column.name}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                          {getCardsForColumn(column.id).length}
                        </span>
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
                                    className={`bg-white dark:bg-slate-900/70 rounded-lg p-2 text-xs shadow-sm border border-slate-200 dark:border-slate-700/50 cursor-grab ${
                                      snapshot.isDragging ? 'shadow-lg ring-2 ring-purple-400' : 'hover:shadow-md'
                                    }`}
                                  >
                                    <span className="text-slate-700 dark:text-slate-200 line-clamp-2">
                                      {locale === 'ja' && card.titleJa ? card.titleJa : card.titleEn}
                                    </span>
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
