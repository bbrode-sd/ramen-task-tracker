'use client';

import { useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Droppable } from '@hello-pangea/dnd';
import { Card as CardType } from '@/types';
import { Card } from './Card';
import { ColumnEmptyState } from './EmptyState';

interface VirtualizedCardListProps {
  columnId: string;
  cards: CardType[];
  boardId: string;
  onCardClick: (cardId: string) => void;
  hasActiveFilters: boolean;
  matchesFilter?: (card: CardType) => boolean;
  focusedCardIndex: number | null;
  isDraggingOver?: boolean;
  onArchive?: (cardId: string) => void;
  onDuplicate?: (cardId: string) => void;
}

// Estimated card height for virtualization (adjust based on actual card sizes)
const ESTIMATED_CARD_HEIGHT = 120;
const OVERSCAN_COUNT = 5; // Number of items to render outside viewport

// Virtualized card list for columns with many cards (50+)
// Uses @tanstack/react-virtual for efficient rendering
function VirtualizedCardListComponent({
  columnId,
  cards,
  boardId,
  onCardClick,
  hasActiveFilters,
  matchesFilter,
  focusedCardIndex,
  isDraggingOver = false,
  onArchive,
  onDuplicate,
}: VirtualizedCardListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  const handleCardClick = useCallback((cardId: string) => () => {
    onCardClick(cardId);
  }, [onCardClick]);

  if (cards.length === 0) {
    return (
      <Droppable droppableId={columnId} type="card">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto px-2 py-2 min-h-[60px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-orange-50/50' : ''
            }`}
          >
            <ColumnEmptyState 
              isDraggingOver={snapshot.isDraggingOver} 
              showTip={false}
            />
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  }

  // For small lists (< 50 cards), use regular rendering
  // Virtualization overhead isn't worth it for small lists
  if (cards.length < 50) {
    return (
      <Droppable droppableId={columnId} type="card">
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
                onClick={handleCardClick(card.id)}
                isDimmed={hasActiveFilters && matchesFilter ? !matchesFilter(card) : false}
                isFocused={focusedCardIndex === cardIndex}
                onArchive={onArchive}
                onDuplicate={onDuplicate}
                data-onboarding={cardIndex === 0 ? "card" : undefined}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  }

  // For large lists (50+ cards), use virtualization
  // Note: Virtualization with drag-and-drop is complex and may have limitations
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <Droppable droppableId={columnId} type="card" mode="virtual" renderClone={(provided, snapshot, rubric) => {
      const card = cards[rubric.source.index];
      return (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card
            card={card}
            index={rubric.source.index}
            boardId={boardId}
            onClick={() => {}}
            isDimmed={false}
            isFocused={false}
          />
        </div>
      );
    }}>
      {(provided, snapshot) => (
        <div
          ref={(el) => {
            provided.innerRef(el);
            (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }}
          {...provided.droppableProps}
          className={`flex-1 overflow-y-auto px-2 py-2 min-h-[60px] transition-colors ${
            snapshot.isDraggingOver ? 'bg-orange-50/50' : ''
          }`}
          style={{ height: '100%' }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const card = cards[virtualItem.index];
              return (
                <div
                  key={card.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                >
                  <Card
                    card={card}
                    index={virtualItem.index}
                    boardId={boardId}
                    onClick={handleCardClick(card.id)}
                    isDimmed={hasActiveFilters && matchesFilter ? !matchesFilter(card) : false}
                    isFocused={focusedCardIndex === virtualItem.index}
                    onArchive={onArchive}
                    onDuplicate={onDuplicate}
                    data-onboarding={virtualItem.index === 0 ? "card" : undefined}
                  />
                </div>
              );
            })}
          </div>
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

// Memoized export - only re-render when cards or focus changes
export const VirtualizedCardList = memo(VirtualizedCardListComponent);

// Hook to check if virtualization should be used
export function useVirtualization(cardCount: number, threshold: number = 50): boolean {
  return cardCount >= threshold;
}
