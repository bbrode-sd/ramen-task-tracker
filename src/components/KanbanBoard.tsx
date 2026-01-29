'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '@/contexts/AuthContext';
import { Board, Column as ColumnType, Card as CardType } from '@/types';
import {
  subscribeToColumns,
  subscribeToCards,
  createColumn,
  reorderColumns,
  reorderCards,
  updateBoard,
} from '@/lib/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from './Header';
import { Column } from './Column';
import { CardModal } from './CardModal';

interface KanbanBoardProps {
  boardId: string;
  selectedCardId?: string | null;
}

export function KanbanBoard({ boardId, selectedCardId }: KanbanBoardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // Fetch board data
  useEffect(() => {
    const fetchBoard = async () => {
      const boardDoc = await getDoc(doc(db, 'boards', boardId));
      if (boardDoc.exists()) {
        setBoard({ id: boardDoc.id, ...boardDoc.data() } as Board);
      }
    };
    fetchBoard();
  }, [boardId]);

  // Subscribe to columns
  useEffect(() => {
    const unsubscribe = subscribeToColumns(boardId, (fetchedColumns) => {
      setColumns(fetchedColumns);
    });
    return () => unsubscribe();
  }, [boardId]);

  // Subscribe to cards
  useEffect(() => {
    const unsubscribe = subscribeToCards(boardId, (fetchedCards) => {
      setCards(fetchedCards);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [boardId]);

  const handleBoardNameChange = useCallback(
    async (name: string) => {
      if (!board) return;
      setBoard({ ...board, name });
      await updateBoard(boardId, { name });
    },
    [board, boardId]
  );

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;

    const maxOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) : -1;
    await createColumn(boardId, newColumnName.trim(), maxOrder + 1);
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  const getCardsForColumn = (columnId: string) => {
    return cards
      .filter((card) => card.columnId === columnId)
      .sort((a, b) => a.order - b.order);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Handle column reordering
    if (type === 'column') {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);

      const columnUpdates = newColumns.map((col, index) => ({
        id: col.id,
        order: index,
      }));

      setColumns(newColumns.map((col, index) => ({ ...col, order: index })));
      await reorderColumns(boardId, columnUpdates);
      return;
    }

    // Handle card reordering
    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;

    const sourceCards = getCardsForColumn(sourceColumnId);
    const destCards =
      sourceColumnId === destColumnId ? sourceCards : getCardsForColumn(destColumnId);

    const draggedCard = cards.find((c) => c.id === draggableId);
    if (!draggedCard) return;

    // Remove from source
    const newSourceCards = sourceCards.filter((c) => c.id !== draggableId);

    // Add to destination
    const newDestCards =
      sourceColumnId === destColumnId ? newSourceCards : [...destCards];
    newDestCards.splice(destination.index, 0, draggedCard);

    // Calculate updates
    const cardUpdates: { id: string; order: number; columnId?: string }[] = [];

    // Update source column cards
    newSourceCards.forEach((card, index) => {
      if (card.order !== index) {
        cardUpdates.push({ id: card.id, order: index });
      }
    });

    // Update destination column cards
    newDestCards.forEach((card, index) => {
      const update: { id: string; order: number; columnId?: string } = {
        id: card.id,
        order: index,
      };
      if (card.id === draggableId && sourceColumnId !== destColumnId) {
        update.columnId = destColumnId;
      }
      if (card.order !== index || card.id === draggableId) {
        cardUpdates.push(update);
      }
    });

    // Optimistic update
    setCards((prevCards) =>
      prevCards.map((card) => {
        const update = cardUpdates.find((u) => u.id === card.id);
        if (update) {
          return {
            ...card,
            order: update.order,
            columnId: update.columnId || card.columnId,
          };
        }
        return card;
      })
    );

    await reorderCards(boardId, cardUpdates);
  };

  const handleCardClick = useCallback((cardId: string) => {
    router.push(`/boards/${boardId}?card=${cardId}`);
  }, [router, boardId]);

  const handleCloseCard = useCallback(() => {
    router.push(`/boards/${boardId}`);
  }, [router, boardId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
        <Header boardName={board?.name} boardId={boardId} />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="relative">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-orange-200 border-t-orange-500"></div>
            <span className="absolute inset-0 flex items-center justify-center text-xl">🍜</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 flex flex-col">
      <Header
        boardName={board?.name}
        onBoardNameChange={handleBoardNameChange}
        boardId={boardId}
      />
      
      <main className="flex-1 overflow-x-auto p-4 sm:p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="board" type="column" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex gap-5 h-full items-start pb-4"
              >
                {columns.map((column, index) => (
                  <Column
                    key={column.id}
                    column={column}
                    cards={getCardsForColumn(column.id)}
                    index={index}
                    boardId={boardId}
                    onCardClick={handleCardClick}
                  />
                ))}
                {provided.placeholder}

                {/* Add column button */}
                <div className="flex-shrink-0 w-[300px]">
                  {isAddingColumn ? (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Enter list name..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3 placeholder:text-slate-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddColumn();
                          if (e.key === 'Escape') {
                            setIsAddingColumn(false);
                            setNewColumnName('');
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddColumn}
                          disabled={!newColumnName.trim()}
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98]"
                        >
                          Add List
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingColumn(false);
                            setNewColumnName('');
                          }}
                          className="px-4 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingColumn(true)}
                      className="w-full px-4 py-3.5 bg-white/60 hover:bg-white backdrop-blur-sm rounded-2xl text-slate-500 hover:text-slate-700 transition-all flex items-center gap-3 shadow-sm hover:shadow-md border border-slate-200/50 hover:border-slate-200 group"
                    >
                      <span className="w-8 h-8 flex items-center justify-center bg-slate-100 group-hover:bg-orange-100 rounded-xl transition-colors">
                        <svg
                          className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </span>
                      <span className="font-medium">Add another list</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </main>

      {selectedCardId && (
        <CardModal
          boardId={boardId}
          cardId={selectedCardId}
          onClose={handleCloseCard}
        />
      )}
    </div>
  );
}
