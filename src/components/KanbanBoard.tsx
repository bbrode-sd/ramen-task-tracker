'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { DragDropContext, Droppable, DropResult, DragStart, DragUpdate } from '@hello-pangea/dnd';
import { useAuth } from '@/contexts/AuthContext';
import { useFilter } from '@/contexts/FilterContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import { useToast } from '@/contexts/ToastContext';
import { Board, Column as ColumnType, Card as CardType, BoardBackground } from '@/types';
import {
  subscribeToColumns,
  subscribeToCards,
  createColumn,
  reorderColumns,
  reorderCards,
  updateBoard,
  logActivity,
  archiveCard,
  restoreCard,
} from '@/lib/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from './Header';
import { Column } from './Column';
import { EmptyState, SearchEmptyState } from './EmptyState';

// Lazy load heavy components for better initial load performance
// CardModal is only loaded when a card is selected - significant bundle reduction
const CardModal = dynamic(() => import('./CardModal').then(mod => ({ default: mod.CardModal })), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-white/30 border-t-white"></div>
        <span className="absolute inset-0 flex items-center justify-center">
          <img src="/logo-white.png" alt="Loading" width={28} height={28} className="opacity-50" />
        </span>
      </div>
    </div>
  ),
});

// BoardActivityPanel is only loaded when activity panel is opened
const BoardActivityPanel = dynamic(() => import('./BoardActivityPanel').then(mod => ({ default: mod.BoardActivityPanel })), {
  ssr: false,
  loading: () => null,
});

// Edge scroll configuration
const EDGE_SCROLL_THRESHOLD = 100; // pixels from edge to start scrolling
const MAX_SCROLL_SPEED = 25; // max pixels per frame
const SCROLL_ACCELERATION = 0.5; // how fast scroll speed increases

interface KanbanBoardProps {
  boardId: string;
  selectedCardId?: string | null;
  /** 
   * Embedded mode for displaying within other components (e.g., CardModal sub-boards)
   * - Hides the header
   * - Uses compact column widths
   * - Constrains max height
   * - Disables keyboard shortcuts at board level
   */
  embedded?: boolean;
  /** Max height for embedded mode */
  maxHeight?: string;
}

/**
 * KanbanBoard Component - Main accessible board view
 * 
 * Accessibility Testing Points:
 * - VoiceOver/NVDA: Main content should be announced
 * - Drag operations should announce to aria-live region
 * - Filter results should be announced
 */
export function KanbanBoard({ boardId, selectedCardId, embedded = false, maxHeight = '400px' }: KanbanBoardProps) {
  const { user } = useAuth();
  const { filterCards, getMatchCount, hasActiveFilters, matchesFilter } = useFilter();
  const {
    focusedColumnIndex,
    focusedCardIndex,
    setFocusedColumnIndex,
    setFocusedCardIndex,
    focusNextColumn,
    focusPrevColumn,
    focusNextCard,
    focusPrevCard,
    isHelpModalOpen,
    registerColumns,
    registerCardsInColumn,
    searchInputRef,
    setTriggerAddCard,
    expandSearchCallback,
    isInputFocused,
    hoveredCardId,
  } = useKeyboardShortcuts();
  const { showToast } = useToast();
  const { t } = useLocale();
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  
  // Parent card info for sub-boards
  const [parentCard, setParentCard] = useState<{ 
    id: string; 
    titleEn: string; 
    titleJa: string; 
    boardId: string;
  } | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const edgeScrollRef = useRef({ left: false, right: false });
  
  // Track pending optimistic updates to prevent subscription from overwriting them
  const pendingCardUpdatesRef = useRef<Map<string, { order: number; columnId: string; expiresAt: number }>>(new Map());
  
  
  // Accessibility: Screen reader announcement state
  const [srAnnouncement, setSrAnnouncement] = useState('');
  
  // Accessibility: Announce to screen readers
  const announceToScreenReader = useCallback((message: string) => {
    setSrAnnouncement(message);
    // Clear after announcement is read
    setTimeout(() => setSrAnnouncement(''), 1000);
  }, []);

  // Extract all unique labels from cards
  const availableLabels = useMemo(() => {
    const labelsSet = new Set<string>();
    cards.forEach((card) => {
      card.labels?.forEach((label) => labelsSet.add(label));
    });
    return Array.from(labelsSet).sort();
  }, [cards]);

  // Get filtered cards count
  const matchingCardsCount = useMemo(() => {
    return getMatchCount(cards, user?.uid);
  }, [cards, getMatchCount, user?.uid]);

  // Calculate due date stats for the header
  const dueDateStats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let overdue = 0;
    let todayCount = 0;
    let tomorrow = 0;
    let thisWeek = 0;
    
    cards.forEach((card) => {
      if (!card.dueDate || card.isArchived) return;
      
      const dueDate = card.dueDate.toDate();
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const diffMs = dueDateOnly.getTime() - today.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      if (diffMs < 0) {
        overdue++;
      } else if (diffDays === 0) {
        todayCount++;
      } else if (diffDays === 1) {
        tomorrow++;
      } else if (diffDays <= 7) {
        thisWeek++;
      }
    });
    
    return { overdue, today: todayCount, tomorrow, thisWeek };
  }, [cards]);

  // Fetch board data
  useEffect(() => {
    const fetchBoard = async (retryCount = 0) => {
      try {
        const boardDoc = await getDoc(doc(db, 'boards', boardId));
        if (boardDoc.exists()) {
          const boardData = { id: boardDoc.id, ...boardDoc.data() } as Board;
          // Check if user is a member of the board
          if (user && !boardData.memberIds.includes(user.uid)) {
            // In embedded mode, retry a few times as the board may have just been created
            if (embedded && retryCount < 3) {
              setTimeout(() => fetchBoard(retryCount + 1), 500 * (retryCount + 1));
              return;
            }
            setAccessError('You do not have access to this board.');
            setLoading(false);
            return;
          }
          setBoard(boardData);
          
          // If this is a sub-board, fetch parent card info
          if (boardData.parentCardId && boardData.parentBoardId) {
            try {
              const parentCardDoc = await getDoc(
                doc(db, 'boards', boardData.parentBoardId, 'cards', boardData.parentCardId)
              );
              if (parentCardDoc.exists()) {
                const cardData = parentCardDoc.data();
                setParentCard({
                  id: boardData.parentCardId,
                  titleEn: cardData.titleEn || '',
                  titleJa: cardData.titleJa || '',
                  boardId: boardData.parentBoardId,
                });
              }
            } catch (parentError) {
              console.error('Error fetching parent card:', parentError);
              // Continue without parent info - not critical
            }
          }
        } else {
          // In embedded mode, retry a few times as the board may have just been created
          if (embedded && retryCount < 3) {
            setTimeout(() => fetchBoard(retryCount + 1), 500 * (retryCount + 1));
            return;
          }
          setAccessError('Board not found.');
          setLoading(false);
        }
      } catch (error) {
        const firebaseError = error as { code?: string; message?: string };
        // In embedded mode, retry on permission-denied as the board may have just been created
        if (embedded && firebaseError.code === 'permission-denied' && retryCount < 3) {
          setTimeout(() => fetchBoard(retryCount + 1), 500 * (retryCount + 1));
          return;
        }
        if (firebaseError.code === 'permission-denied') {
          setAccessError('You do not have access to this board.');
        } else {
          setAccessError('Failed to load board. Please try again.');
          console.error('Error fetching board:', error);
        }
        setLoading(false);
      }
    };
    if (user) {
      fetchBoard();
    }
  }, [boardId, user, embedded]);

  // Subscribe to columns - only if we have board access
  useEffect(() => {
    if (!board || accessError) return;
    
    const unsubscribe = subscribeToColumns(
      boardId,
      (fetchedColumns) => {
        setColumns(fetchedColumns);
      },
      (error) => {
        console.error('Error subscribing to columns:', error);
        const firebaseError = error as { code?: string };
        if (firebaseError.code === 'permission-denied') {
          setAccessError('You do not have access to this board.');
        }
      }
    );
    return () => unsubscribe();
  }, [boardId, board, accessError]);

  // Subscribe to cards - only if we have board access
  useEffect(() => {
    if (!board || accessError) return;
    
    const unsubscribe = subscribeToCards(
      boardId,
      (fetchedCards) => {
        const now = Date.now();
        const pending = pendingCardUpdatesRef.current;
        
        // Clean up expired pending updates
        for (const [cardId, update] of pending.entries()) {
          if (now >= update.expiresAt) {
            pending.delete(cardId);
          }
        }
        
        // If no pending updates, use server data directly
        if (pending.size === 0) {
          setCards(fetchedCards);
          setLoading(false);
          return;
        }
        
        // Merge server data with pending optimistic updates
        // Pending updates take priority to prevent snap-back
        const mergedCards = fetchedCards.map(card => {
          const pendingUpdate = pending.get(card.id);
          if (pendingUpdate) {
            return {
              ...card,
              order: pendingUpdate.order,
              columnId: pendingUpdate.columnId,
            };
          }
          return card;
        });
        
        setCards(mergedCards);
        setLoading(false);
      },
      {
        onError: (error) => {
          console.error('Error subscribing to cards:', error);
          const firebaseError = error as { code?: string };
          if (firebaseError.code === 'permission-denied') {
            setAccessError('You do not have access to this board.');
          }
          setLoading(false);
        },
      }
    );
    return () => unsubscribe();
  }, [boardId, board, accessError]);

  // Register columns count for keyboard navigation
  useEffect(() => {
    registerColumns(columns.length);
  }, [columns.length, registerColumns]);

  // Register cards per column for keyboard navigation
  // Use filtered cards when filters are active so keyboard navigation matches visible cards
  useEffect(() => {
    columns.forEach((column, index) => {
      const columnCards = cards.filter((card) => card.columnId === column.id);
      // Apply the same filtering logic as the Column component uses for display
      const visibleCards = hasActiveFilters 
        ? columnCards.filter(card => matchesFilter(card, user?.uid))
        : columnCards;
      registerCardsInColumn(index, visibleCards.length);
    });
  }, [columns, cards, registerCardsInColumn, hasActiveFilters, matchesFilter, user?.uid]);

  const handleBoardNameChange = useCallback(
    async (name: string) => {
      if (!board) return;
      setBoard({ ...board, name });
      await updateBoard(boardId, { name });
    },
    [board, boardId]
  );

  const handleBackgroundChange = useCallback(
    async (background: BoardBackground) => {
      if (!board) return;
      setBoard({ ...board, background });
      await updateBoard(boardId, { background });
    },
    [board, boardId]
  );

  // Helper to get background classes
  const getBackgroundClasses = () => {
    // Default premium background with subtle warmth (theme-aware)
    const defaultBackground = 'bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950';
    
    if (!board?.background || !board.background.value) {
      return defaultBackground;
    }
    
    if (board.background.type === 'gradient') {
      return `bg-gradient-to-r ${board.background.value}`;
    }
    
    if (board.background.type === 'color') {
      return board.background.value;
    }
    
    return defaultBackground;
  };

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

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;

    const maxOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) : -1;
    const columnNameEn = newColumnName.trim();
    
    // Create column with English name first
    const columnId = await createColumn(boardId, columnNameEn, maxOrder + 1);
    setNewColumnName('');
    setIsAddingColumn(false);
    
    // Translate to Japanese in the background and update the column
    if (columnId) {
      try {
        const { updateColumn } = await import('@/lib/firestore');
        const nameJa = await translate(columnNameEn, 'ja');
        await updateColumn(boardId, columnId, { nameJa });
      } catch (error) {
        console.error('Failed to translate column name:', error);
      }
    }
  };

  const getCardsForColumn = useCallback((columnId: string) => {
    // Cards are sorted only by their manual order - users drag to reorder
    return cards
      .filter((card) => card.columnId === columnId)
      .sort((a, b) => a.order - b.order);
  }, [cards]);

  // Edge scrolling during drag
  const startEdgeScroll = useCallback(() => {
    const container = boardContainerRef.current;
    if (!container) return;

    const scroll = () => {
      if (!edgeScrollRef.current.left && !edgeScrollRef.current.right) {
        scrollAnimationRef.current = null;
        return;
      }

      const scrollAmount = edgeScrollRef.current.left ? -MAX_SCROLL_SPEED : MAX_SCROLL_SPEED;
      container.scrollLeft += scrollAmount;
      
      scrollAnimationRef.current = requestAnimationFrame(scroll);
    };

    if (!scrollAnimationRef.current) {
      scrollAnimationRef.current = requestAnimationFrame(scroll);
    }
  }, []);

  const stopEdgeScroll = useCallback(() => {
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    edgeScrollRef.current = { left: false, right: false };
  }, []);

  // Handle mouse move during drag for edge scrolling
  const handleDragMouseMove = useCallback((e: MouseEvent) => {
    const container = boardContainerRef.current;
    if (!container || !isDragging) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX;

    const distanceFromLeft = mouseX - rect.left;
    const distanceFromRight = rect.right - mouseX;

    edgeScrollRef.current = {
      left: distanceFromLeft < EDGE_SCROLL_THRESHOLD && container.scrollLeft > 0,
      right: distanceFromRight < EDGE_SCROLL_THRESHOLD && 
        container.scrollLeft < container.scrollWidth - container.clientWidth,
    };

    if (edgeScrollRef.current.left || edgeScrollRef.current.right) {
      startEdgeScroll();
    }
  }, [isDragging, startEdgeScroll]);

  // Attach/detach edge scroll listener
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMouseMove);
      document.body.classList.add('dragging-cursor');
    } else {
      document.removeEventListener('mousemove', handleDragMouseMove);
      document.body.classList.remove('dragging-cursor');
      stopEdgeScroll();
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMouseMove);
      document.body.classList.remove('dragging-cursor');
      stopEdgeScroll();
    };
  }, [isDragging, handleDragMouseMove, stopEdgeScroll]);

  // Handle drag start
  const handleDragStart = useCallback((start: DragStart) => {
    setIsDragging(true);
    
    // If we're dragging a card that's not selected, clear selection and select just this one
    if (start.type === 'card' && !selectedCards.has(start.draggableId)) {
      setSelectedCards(new Set([start.draggableId]));
    }
    
    // Accessibility: Announce drag start to screen readers
    if (start.type === 'card') {
      const card = cards.find(c => c.id === start.draggableId);
      if (card) {
        announceToScreenReader(`Picked up card: ${card.titleEn}. Use arrow keys to move, space to drop.`);
      }
    } else if (start.type === 'column') {
      const column = columns.find(c => c.id === start.draggableId);
      if (column) {
        announceToScreenReader(`Picked up list: ${column.name}. Use arrow keys to reorder, space to drop.`);
      }
    }
  }, [selectedCards, cards, columns, announceToScreenReader]);

  // Handle drag update (for future enhancements like drop preview)
  const handleDragUpdate = useCallback((update: DragUpdate) => {
    // Could be used for live drop preview indicators
  }, []);

  // Multi-select toggle handler
  const handleCardSelectToggle = useCallback((cardId: string, shiftKey: boolean) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }, []);

  // Get cards for column with filter state (for display purposes)
  const getCardsForColumnWithFilterState = useCallback((columnId: string) => {
    const columnCards = getCardsForColumn(columnId);
    return columnCards.map((card) => ({
      ...card,
      matchesFilter: matchesFilter(card, user?.uid),
    }));
  }, [getCardsForColumn, matchesFilter, user?.uid]);

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);
    stopEdgeScroll();
    
    const { destination, source, draggableId, type } = result;

    if (!destination) {
      setSelectedCards(new Set());
      announceToScreenReader('Drop cancelled. Item returned to original position.');
      return;
    }

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

      flushSync(() => {
        setColumns(newColumns.map((col, index) => ({ ...col, order: index })));
      });
      reorderColumns(boardId, columnUpdates).catch(console.error);
      announceToScreenReader(`List ${removed.name} moved to position ${destination.index + 1}.`);
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

    newSourceCards.forEach((card, index) => {
      if (card.order !== index) {
        cardUpdates.push({ id: card.id, order: index });
      }
    });

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

    // Register pending updates BEFORE optimistic update
    // This prevents the Firestore subscription from overwriting our changes
    // Updates expire after 10 seconds as a safety net
    const expiresAt = Date.now() + 10000;
    cardUpdates.forEach((update) => {
      // For each card, use the new columnId if specified, otherwise preserve the card's existing columnId
      // Bug fix: Previously used draggedCard.columnId as fallback, which incorrectly moved
      // other cards to the source column when dragging between columns
      const existingCard = cards.find(c => c.id === update.id);
      const columnId = update.columnId !== undefined ? update.columnId : existingCard?.columnId;
      pendingCardUpdatesRef.current.set(update.id, {
        order: update.order,
        columnId: columnId!,
        expiresAt,
      });
    });

    // Optimistic update - use flushSync to force immediate render
    // This prevents React 18's automatic batching from deferring the visual update
    flushSync(() => {
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
    });

    // Save to Firestore (fire and forget)
    // Clear pending updates after Firestore confirms
    reorderCards(boardId, cardUpdates)
      .then(() => {
        // Clear the pending updates for these cards
        cardUpdates.forEach((update) => {
          pendingCardUpdatesRef.current.delete(update.id);
        });
      })
      .catch((error) => {
        console.error('Failed to save card reorder:', error);
        // Clear pending on error too - subscription will restore correct state
        cardUpdates.forEach((update) => {
          pendingCardUpdatesRef.current.delete(update.id);
        });
      });
    
    // Log activity if card was moved to a different column
    if (sourceColumnId !== destColumnId && user) {
      const sourceColumn = columns.find(c => c.id === sourceColumnId);
      const destColumn = columns.find(c => c.id === destColumnId);
      
      logActivity(boardId, {
        cardId: draggableId,
        cardTitle: draggedCard.titleEn,
        type: 'card_moved',
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL,
        metadata: {
          from: sourceColumn?.name || 'Unknown',
          to: destColumn?.name || 'Unknown',
        },
      }).catch(console.error);
      
      announceToScreenReader(`Card ${draggedCard.titleEn} moved from ${sourceColumn?.name} to ${destColumn?.name}.`);
    } else {
      announceToScreenReader(`Card ${draggedCard.titleEn} moved to position ${destination.index + 1}.`);
    }
    
    setSelectedCards(new Set());
  };

  const handleCardClick = useCallback((cardId: string) => {
    router.push(`/boards/${boardId}?card=${cardId}`);
  }, [router, boardId]);

  const handleCloseCard = useCallback(() => {
    router.push(`/boards/${boardId}`);
  }, [router, boardId]);

  // Keyboard shortcuts handler (must be after handleCardClick is defined)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (isInputFocused()) return;
      
      // Don't handle if a card modal is open (let it handle its own escape)
      if (selectedCardId && e.key === 'Escape') return;
      
      // Don't handle if help modal is open (it handles its own escape)
      if (isHelpModalOpen && e.key !== 'Escape') return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          focusPrevColumn();
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          focusNextColumn();
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          focusPrevCard();
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          focusNextCard();
          break;
          
        case 'Enter':
          if (focusedColumnIndex !== null && focusedCardIndex !== null) {
            e.preventDefault();
            const column = columns[focusedColumnIndex];
            if (column) {
              const columnCards = cards
                .filter((card) => card.columnId === column.id)
                .sort((a, b) => a.order - b.order);
              // Apply the same filtering as display when filters are active
              const visibleCards = hasActiveFilters 
                ? columnCards.filter(card => matchesFilter(card, user?.uid))
                : columnCards;
              const card = visibleCards[focusedCardIndex];
              if (card) {
                handleCardClick(card.id);
              }
            }
          }
          break;
          
        case 'e':
          if (focusedColumnIndex !== null && focusedCardIndex !== null) {
            e.preventDefault();
            const column = columns[focusedColumnIndex];
            if (column) {
              const columnCards = cards
                .filter((card) => card.columnId === column.id)
                .sort((a, b) => a.order - b.order);
              // Apply the same filtering as display when filters are active
              const visibleCards = hasActiveFilters 
                ? columnCards.filter(card => matchesFilter(card, user?.uid))
                : columnCards;
              const card = visibleCards[focusedCardIndex];
              if (card) {
                handleCardClick(card.id);
              }
            }
          }
          break;
          
        case 'n':
          if (focusedColumnIndex !== null) {
            e.preventDefault();
            setTriggerAddCard(focusedColumnIndex);
          }
          break;
          
        case '/':
          e.preventDefault();
          // First expand the search if needed
          if (expandSearchCallback.current) {
            expandSearchCallback.current();
          }
          // Then focus after a short delay to ensure input is rendered
          setTimeout(() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus();
            }
          }, 0);
          break;
          
        case 'c':
        case 'C':
          // Archive the hovered card
          if (hoveredCardId) {
            e.preventDefault();
            const cardToArchive = cards.find(c => c.id === hoveredCardId);
            if (cardToArchive) {
              archiveCard(boardId, hoveredCardId).then(() => {
                showToast('success', 'Card archived', {
                  undoAction: async () => {
                    await restoreCard(boardId, hoveredCardId);
                  },
                });
                
                // Log activity
                if (user) {
                  logActivity(boardId, {
                    cardId: hoveredCardId,
                    cardTitle: cardToArchive.titleEn,
                    type: 'card_archived',
                    userId: user.uid,
                    userName: user.displayName || 'Anonymous',
                    userPhoto: user.photoURL,
                  });
                }
              }).catch((error) => {
                console.error('Failed to archive card:', error);
                showToast('error', 'Failed to archive card');
              });
            }
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          setFocusedColumnIndex(null);
          setFocusedCardIndex(null);
          setIsAddingColumn(false);
          setNewColumnName('');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isInputFocused,
    isHelpModalOpen,
    selectedCardId,
    focusedColumnIndex,
    focusedCardIndex,
    columns,
    cards,
    focusPrevColumn,
    focusNextColumn,
    focusPrevCard,
    focusNextCard,
    setFocusedColumnIndex,
    setFocusedCardIndex,
    setTriggerAddCard,
    searchInputRef,
    expandSearchCallback,
    handleCardClick,
    hoveredCardId,
    boardId,
    showToast,
    user,
    hasActiveFilters,
    matchesFilter,
  ]);

  // Show access error state
  if (accessError) {
    if (embedded) {
      return (
        <div className="p-4 text-center text-red-500">
          {accessError}
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="bg-[var(--surface)] rounded-2xl shadow-xl border border-[var(--border)] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-[var(--error-bg)] rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Access Denied</h2>
          <p className="text-[var(--text-secondary)] mb-6">{accessError}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-md hover:shadow-lg"
          >
            Go to My Boards
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        </div>
      );
    }
    return (
      <div className={`min-h-screen transition-colors duration-500 ${getBackgroundClasses()}`}>
        <Header 
          boardName={board?.name} 
          boardId={boardId}
          availableLabels={availableLabels}
          totalCards={cards.length}
          matchingCards={matchingCardsCount}
          onActivityClick={() => setShowActivityPanel(prev => !prev)}
          currentBackground={board?.background}
          onBackgroundChange={handleBackgroundChange}
          dueDateStats={dueDateStats}
          parentCard={parentCard}
          isTemplate={board?.isTemplate}
          templateForBoardId={board?.templateForBoardId}
        />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)] animate-spin"></div>
            <span className="absolute inset-0 flex items-center justify-center">
              <Image src="/logo-white.png" alt="Loading" width={32} height={32} className="opacity-30 dark:opacity-50" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Embedded mode: compact view for sub-boards in card modals
  if (embedded) {
    return (
      <div 
        className="overflow-x-auto" 
        style={{ maxHeight }}
        ref={boardContainerRef}
      >
        <DragDropContext 
          onDragStart={handleDragStart}
          onDragUpdate={handleDragUpdate}
          onDragEnd={handleDragEnd}
        >
          <Droppable droppableId="board" type="column" direction="horizontal">
            {(provided, boardSnapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex gap-3 pb-2 min-w-max ${
                  boardSnapshot.isDraggingOver ? 'gap-4' : ''
                }`}
              >
                {columns.map((column, index) => (
                  <Column
                    key={column.id}
                    column={column}
                    cards={getCardsForColumn(column.id)}
                    index={index}
                    boardId={boardId}
                    onCardClick={handleCardClick}
                    hasActiveFilters={false}
                    matchesFilter={() => true}
                    isFocused={false}
                    focusedCardIndex={null}
                    selectedCards={selectedCards}
                    onCardSelectToggle={handleCardSelectToggle}
                  />
                ))}
                {provided.placeholder}

                {/* Add column button */}
                <div className="flex-shrink-0 w-64">
                  {isAddingColumn ? (
                    <div className="bg-slate-100 dark:bg-slate-800/70 rounded-xl p-3">
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder={t('column.enterListName')}
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
                          {t('column.addList')}
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingColumn(false);
                            setNewColumnName('');
                          }}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingColumn(true)}
                      className="w-full h-10 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors border-2 border-dashed border-slate-300 dark:border-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {t('column.addAnotherList')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    );
  }

  // Full board view
  return (
    <div className={`min-h-screen transition-colors duration-500 ${getBackgroundClasses()}`}>
      <Header
        boardName={board?.name}
        onBoardNameChange={handleBoardNameChange}
        boardId={boardId}
        availableLabels={availableLabels}
        totalCards={cards.length}
        matchingCards={matchingCardsCount}
        onActivityClick={() => setShowActivityPanel(true)}
        currentBackground={board?.background}
        onBackgroundChange={handleBackgroundChange}
        dueDateStats={dueDateStats}
        parentCard={parentCard}
        isTemplate={board?.isTemplate}
        templateForBoardId={board?.templateForBoardId}
      />

      {/* Accessibility: Live region for screen reader announcements */}
      <div 
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {srAnnouncement}
      </div>
      
      <main 
        id="main-content"
        ref={boardContainerRef}
        className="overflow-x-auto p-4 sm:p-6"
        aria-label={`${board?.name || 'Board'} with ${columns.length} lists and ${cards.length} cards`}
      >
        {/* Edge scroll indicators */}
        {isDragging && (
          <>
            <div className={`edge-scroll-left ${edgeScrollRef.current.left ? 'active' : ''}`} />
            <div className={`edge-scroll-right ${edgeScrollRef.current.right ? 'active' : ''}`} />
          </>
        )}
        
        <DragDropContext 
          onDragStart={handleDragStart}
          onDragUpdate={handleDragUpdate}
          onDragEnd={handleDragEnd}
        >
          <Droppable droppableId="board" type="column" direction="horizontal">
            {(provided, boardSnapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex gap-5 h-full items-start pb-4 transition-all duration-200 ${
                  boardSnapshot.isDraggingOver ? 'gap-6' : ''
                }`}
              >
                {/* Empty state when no columns */}
                {columns.length === 0 && !isAddingColumn && (
                  <div className="flex items-center justify-center w-full min-h-[300px]">
                    <EmptyState
                      variant="columns"
                      title="No lists yet"
                      description="Add your first list to start organizing cards. Lists help you track work through different stages."
                      action={() => setIsAddingColumn(true)}
                      actionLabel="Add Your First List"
                      size="lg"
                    />
                  </div>
                )}

                {/* Add list form when no columns exist */}
                {columns.length === 0 && isAddingColumn && (
                  <div className="flex items-center justify-center w-full min-h-[300px]">
                    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 dark:border-slate-700/60 p-4 w-[300px]">
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Enter list name..."
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98]"
                        >
                          Add List
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingColumn(false);
                            setNewColumnName('');
                          }}
                          className="px-4 py-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search empty state when filters active but no results */}
                {columns.length > 0 && hasActiveFilters && matchingCardsCount === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-sm z-10 rounded-xl">
                    <SearchEmptyState
                      searchQuery={searchInputRef.current?.value || 'filter'}
                      onClearSearch={() => {
                        // Clear search from header
                        if (searchInputRef.current) {
                          searchInputRef.current.value = '';
                          // Trigger input event to update filter
                          searchInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                      }}
                    />
                  </div>
                )}

                {columns.map((column, index) => (
                  <Column
                    key={column.id}
                    column={column}
                    cards={getCardsForColumn(column.id)}
                    index={index}
                    boardId={boardId}
                    onCardClick={handleCardClick}
                    hasActiveFilters={hasActiveFilters}
                    matchesFilter={(card) => matchesFilter(card, user?.uid)}
                    isFocused={focusedColumnIndex === index}
                    focusedCardIndex={focusedColumnIndex === index ? focusedCardIndex : null}
                    selectedCards={selectedCards}
                    onCardSelectToggle={handleCardSelectToggle}
                  />
                ))}
                {provided.placeholder}

                {/* Add column button - positioned after all columns */}
                {columns.length > 0 && (
                  <div className="flex-shrink-0 w-[300px]">
                    {isAddingColumn ? (
                      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 dark:border-slate-700/60 p-4">
                        <input
                          type="text"
                          value={newColumnName}
                          onChange={(e) => setNewColumnName(e.target.value)}
                          placeholder={t('column.enterListName')}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98]"
                          >
                            {t('column.addList')}
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingColumn(false);
                              setNewColumnName('');
                            }}
                            className="px-4 py-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingColumn(true)}
                        data-onboarding="add-column"
                        className="w-full px-4 py-3.5 bg-[var(--surface)]/80 hover:bg-[var(--surface)] backdrop-blur-sm rounded-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-3 shadow-sm hover:shadow-md border border-[var(--border-subtle)] hover:border-[var(--border)] group"
                      >
                        <span className="w-8 h-8 flex items-center justify-center bg-[var(--surface-hover)] group-hover:bg-[var(--primary-light)] rounded-xl transition-colors">
                          <svg
                            className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors"
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
                        <span className="font-medium">{t('column.addAnotherList')}</span>
                      </button>
                    )}
                  </div>
                )}
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

      <BoardActivityPanel
        boardId={boardId}
        isOpen={showActivityPanel}
        onClose={() => setShowActivityPanel(false)}
        onCardClick={handleCardClick}
      />
    </div>
  );
}
