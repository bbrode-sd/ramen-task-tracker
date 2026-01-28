'use client';

import { useState, useEffect, useCallback } from 'react';
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
  onBackToBoards: () => void;
}

export function KanbanBoard({ boardId, onBackToBoards }: KanbanBoardProps) {
  const { user } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header boardName={board?.name} onBackToBoards={onBackToBoards} />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header
        boardName={board?.name}
        onBoardNameChange={handleBoardNameChange}
        onBackToBoards={onBackToBoards}
      />
      
      <main className="flex-1 overflow-x-auto p-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="board" type="column" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex gap-4 h-full items-start"
              >
                {columns.map((column, index) => (
                  <Column
                    key={column.id}
                    column={column}
                    cards={getCardsForColumn(column.id)}
                    index={index}
                    boardId={boardId}
                    onCardClick={setSelectedCardId}
                  />
                ))}
                {provided.placeholder}

                {/* Add column button */}
                <div className="flex-shrink-0 w-72">
                  {isAddingColumn ? (
                    <div className="bg-white rounded-xl shadow-md p-3">
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Enter list name..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-2"
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
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Add List
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingColumn(false);
                            setNewColumnName('');
                          }}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingColumn(true)}
                      className="w-full px-4 py-3 bg-white/50 hover:bg-white rounded-xl text-gray-600 hover:text-gray-800 transition-all flex items-center gap-2 shadow-md"
                    >
                      <svg
                        className="w-5 h-5"
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
                      Add another list
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
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </div>
  );
}
