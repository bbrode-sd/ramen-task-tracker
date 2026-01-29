'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Column as ColumnType, Card as CardType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateColumn,
  archiveColumn,
  archiveAllCardsInColumn,
  createCard,
  updateCard,
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

  // Translate text to target language
  const translate = useCallback(async (text: string, targetLanguage: 'en' | 'ja'): Promise<string> => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage }),
      });
      const data = await response.json();
      return data.translation || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
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
    const titleEn = newCardTitleEn.trim();
    
    // Create card with English title first (Japanese shows loading state)
    const cardId = await createCard(
      boardId,
      column.id,
      titleEn,
      '', // Empty initially, will be filled after translation
      user.uid,
      maxOrder + 1
    );

    setNewCardTitleEn('');
    setIsAddingCard(false);

    // Translate to Japanese in the background and update the card
    if (cardId) {
      try {
        const titleJa = await translate(titleEn, 'ja');
        await updateCard(boardId, cardId, { titleJa });
      } catch (error) {
        console.error('Failed to translate card title:', error);
      }
    }
  };

  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex-shrink-0 w-[300px] bg-slate-100 rounded-2xl shadow-sm flex flex-col max-h-[calc(100vh-130px)] border border-slate-200/80 ${
            snapshot.isDragging ? 'shadow-xl ring-2 ring-orange-400/30 rotate-1' : ''
          }`}
        >
          {/* Column Header */}
          <div
            {...provided.dragHandleProps}
            className="px-3 py-3 flex items-center justify-between border-b border-slate-200/50"
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
                className="flex-1 px-3 py-1.5 text-sm font-semibold bg-white rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                autoFocus
              />
            ) : (
              <h3
                onClick={() => setIsEditing(true)}
                className="flex-1 px-2 py-1 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-200/70 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="truncate">{column.name}</span>
                <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-slate-500 bg-slate-200/80 rounded-full">
                  {cards.length}
                </span>
              </h3>
            )}

            {/* Column Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-slate-400"
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
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-10 overflow-hidden">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Rename list
                  </button>
                  <button
                    onClick={handleArchiveAllCards}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Archive all cards
                  </button>
                  <hr className="my-1.5 border-gray-100" />
                  <button
                    onClick={handleArchive}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
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
                className={`flex-1 overflow-y-auto px-2 py-2 min-h-[60px] transition-colors ${
                  snapshot.isDraggingOver ? 'bg-orange-50/50' : ''
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
          <div className="px-2 pb-2 pt-1">
            {isAddingCard ? (
              <div className="bg-white rounded-xl shadow-md border border-slate-200 p-3">
                <textarea
                  value={newCardTitleEn}
                  onChange={(e) => setNewCardTitleEn(e.target.value)}
                  placeholder="Enter a title for this card (English)..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none placeholder:text-slate-500"
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
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddCard}
                    disabled={!newCardTitleEn.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98]"
                  >
                    Add card
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingCard(false);
                      setNewCardTitleEn('');
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
                className="w-full px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl flex items-center gap-2 transition-all group"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-slate-200/80 group-hover:bg-orange-100 rounded-lg transition-colors">
                  <svg
                    className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors"
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
                Add a card
              </button>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
