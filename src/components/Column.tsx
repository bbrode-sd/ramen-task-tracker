'use client';

import { useState, useRef, useEffect } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Column as ColumnType, Card as CardType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateColumn,
  archiveColumn,
  archiveAllCardsInColumn,
  createCard,
} from '@/lib/firestore';
import { Card } from './Card';

interface ColumnProps {
  column: ColumnType;
  cards: CardType[];
  index: number;
  boardId: string;
  onCardClick: (cardId: string) => void;
}

export function Column({ column, cards, index, boardId, onCardClick }: ColumnProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [showMenu, setShowMenu] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitleEn, setNewCardTitleEn] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRename = async () => {
    if (columnName.trim() && columnName !== column.name) {
      await updateColumn(boardId, column.id, { name: columnName.trim() });
    }
    setIsEditing(false);
  };

  const handleArchive = async () => {
    setShowMenu(false);
    await archiveColumn(boardId, column.id);
  };

  const handleArchiveAllCards = async () => {
    setShowMenu(false);
    await archiveAllCardsInColumn(boardId, column.id);
  };

  const handleAddCard = async () => {
    if (!newCardTitleEn.trim() || !user) return;

    const maxOrder = cards.length > 0 ? Math.max(...cards.map((c) => c.order)) : -1;
    
    // Create card with English title, Japanese will be translated
    await createCard(
      boardId,
      column.id,
      newCardTitleEn.trim(),
      '', // Japanese title will be filled via translation
      user.uid,
      maxOrder + 1
    );

    setNewCardTitleEn('');
    setIsAddingCard(false);
  };

  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex-shrink-0 w-72 bg-gray-200 rounded-xl shadow-md flex flex-col max-h-[calc(100vh-120px)] ${
            snapshot.isDragging ? 'shadow-xl' : ''
          }`}
        >
          {/* Column Header */}
          <div
            {...provided.dragHandleProps}
            className="px-3 py-2 flex items-center justify-between"
          >
            {isEditing ? (
              <input
                type="text"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') {
                    setColumnName(column.name);
                    setIsEditing(false);
                  }
                }}
                className="flex-1 px-2 py-1 text-sm font-semibold bg-white rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            ) : (
              <h3
                onClick={() => setIsEditing(true)}
                className="flex-1 px-2 py-1 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-300 rounded"
              >
                {column.name}
                <span className="ml-2 text-gray-500 font-normal">
                  {cards.length}
                </span>
              </h3>
            )}

            {/* Column Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-gray-300 rounded transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Rename list
                  </button>
                  <button
                    onClick={handleArchiveAllCards}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Archive all cards in list
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleArchive}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Archive list
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cards */}
          <Droppable droppableId={column.id} type="card">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-1 overflow-y-auto px-2 pb-2 min-h-[50px] ${
                  snapshot.isDraggingOver ? 'bg-gray-300/50' : ''
                }`}
              >
                {cards.map((card, cardIndex) => (
                  <Card
                    key={card.id}
                    card={card}
                    index={cardIndex}
                    boardId={boardId}
                    onClick={() => onCardClick(card.id)}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Add Card */}
          <div className="px-2 pb-2">
            {isAddingCard ? (
              <div className="bg-white rounded-lg shadow p-2">
                <textarea
                  value={newCardTitleEn}
                  onChange={(e) => setNewCardTitleEn(e.target.value)}
                  placeholder="Enter a title for this card (English)..."
                  className="w-full px-2 py-1 text-sm border-none focus:outline-none resize-none"
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
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAddCard}
                    disabled={!newCardTitleEn.trim()}
                    className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add card
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingCard(false);
                      setNewCardTitleEn('');
                    }}
                    className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingCard(true)}
                className="w-full px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-300 rounded flex items-center gap-1 transition-colors"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add a card
              </button>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
