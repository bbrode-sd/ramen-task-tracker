'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, DropResult, DragStart, DragUpdate } from '@hello-pangea/dnd';
import { useAuth } from '@/contexts/AuthContext';
import { useFilter } from '@/contexts/FilterContext';
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
        <span className="absolute inset-0 flex items-center justify-center text-2xl">🍜</span>
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
}

/**
 * KanbanBoard Component - Main accessible board view
 * 
 * Accessibility Testing Points:
 * - VoiceOver/NVDA: Main content should be announced
 * - Drag operations should announce to aria-live region
 * - Filter results should be announced
 */
export function KanbanBoard({ boardId, selectedCardId }: KanbanBoardProps) {
  const { user } = useAuth();
  const { filterCards, getMatchCount, hasActiveFilters, matchesFilter, sortCards } = useFilter();
  const {
    focusedColumnIndex,
    focusedCardIndex,
    setFocusedColumnIndex,
    setFocusedCardIndex,
    focusNextColumn,
    focusPrevColumn,
    focusNextCard,
    focusPrevCard,
    toggleHelpModal,
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
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
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
  const pendingCardUpdatesRef = useRef<Map<string, { order: number; columnId: string; timestamp: number }>>(new Map());
  const OPTIMISTIC_UPDATE_TTL = 3000; // How long to protect optimistic updates (ms)
  
  // Track if we're in the middle of a drag operation - skip ALL subscription updates during drag
  const isDraggingRef = useRef(false);
  
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
    const fetchBoard = async () => {
      try {
        const boardDoc = await getDoc(doc(db, 'boards', boardId));
        if (boardDoc.exists()) {
          const boardData = { id: boardDoc.id, ...boardDoc.data() } as Board;
          // Check if user is a member of the board
          if (user && !boardData.memberIds.includes(user.uid)) {
            setAccessError('You do not have access to this board.');
            setLoading(false);
            return;
          }
          setBoard(boardData);
        } else {
          setAccessError('Board not found.');
          setLoading(false);
        }
      } catch (error) {
        const firebaseError = error as { code?: string; message?: string };
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
  }, [boardId, user]);

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
  // CRITICAL: Skip updates during drag operations to prevent UI flickering
  useEffect(() => {
    if (!board || accessError) return;
    
    const unsubscribe = subscribeToCards(
      boardId,
      (fetchedCards) => {
        // CRITICAL: Skip ALL subscription updates while dragging
        // The optimistic update already has the correct state
        if (isDraggingRef.current) {
          return;
        }
        
        const now = Date.now();
        const pendingUpdates = pendingCardUpdatesRef.current;
        
        // Clean up expired pending updates
        for (const [cardId, update] of pendingUpdates.entries()) {
          if (now - update.timestamp > OPTIMISTIC_UPDATE_TTL) {
            pendingUpdates.delete(cardId);
          }
        }
        
        // If no pending updates, just use server data directly
        if (pendingUpdates.size === 0) {
          setCards(fetchedCards);
          setLoading(false);
          return;
        }
        
        // Merge server data with pending optimistic updates
        // Pending updates take priority to prevent UI flickering
        const mergedCards = fetchedCards.map(card => {
          const pendingUpdate = pendingUpdates.get(card.id);
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
  useEffect(() => {
    columns.forEach((column, index) => {
      const columnCards = cards.filter((card) => card.columnId === column.id);
      registerCardsInColumn(index, columnCards.length);
    });
  }, [columns, cards, registerCardsInColumn]);

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
    if (!board?.background) {
      // Default premium background with subtle warmth
      return 'bg-gradient-to-br from-stone-50 via-amber-50/30 to-orange-50/20 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950';
    }
    
    if (board.background.type === 'gradient') {
      return `bg-gradient-to-r ${board.background.value}`;
    }
    
    if (board.background.type === 'color') {
      return board.background.value;
    }
    
    return 'bg-gradient-to-br from-stone-50 via-amber-50/30 to-orange-50/20 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950';
  };

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;

    const maxOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) : -1;
    await createColumn(boardId, newColumnName.trim(), maxOrder + 1);
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  const getCardsForColumn = useCallback((columnId: string) => {
    const columnCards = cards
      .filter((card) => card.columnId === columnId)
      .sort((a, b) => a.order - b.order);
    // Apply sorting from filter context
    return sortCards(columnCards);
  }, [cards, sortCards]);

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
    isDraggingRef.current = true; // Block subscription updates during drag
    
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
    const startTime = performance.now();
    
    // CRITICAL: Set isDragging to false immediately - this is a React state
    // that controls our custom drag styling, separate from the DnD library's state
    setIsDragging(false);
    stopEdgeScroll();
    
    const { destination, source, draggableId, type } = result;

    // Handle early returns - always clear isDraggingRef
    if (!destination) {
      setSelectedCards(new Set());
      isDraggingRef.current = false;
      announceToScreenReader('Drop cancelled. Item returned to original position.');
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      isDraggingRef.current = false;
      return;
    }
    
    // Wrap the rest in try-catch to ensure cleanup always happens
    try {

    // Handle column reordering
    if (type === 'column') {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);

      const columnUpdates = newColumns.map((col, index) => ({
        id: col.id,
        order: index,
      }));

      // Optimistic update for columns
      setColumns(newColumns.map((col, index) => ({ ...col, order: index })));
      
      // Fire and forget - but keep subscription blocked until write completes
      // This prevents stale subscription data from overwriting the optimistic update
      reorderColumns(boardId, columnUpdates)
        .then(() => {
          isDraggingRef.current = false;
        })
        .catch((error) => {
          console.error('Failed to reorder columns:', error);
          isDraggingRef.current = false;
        });
      
      // Accessibility: Announce column move
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
    if (!draggedCard) {
      isDraggingRef.current = false; // Re-enable subscription updates
      return;
    }

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

    // Create a Map for O(1) lookup instead of O(n) find() calls
    const updateMap = new Map(cardUpdates.map(u => [u.id, u]));

    // Register pending updates BEFORE optimistic update
    // This prevents the Firestore subscription from overwriting our changes
    const now = Date.now();
    cardUpdates.forEach((update) => {
      pendingCardUpdatesRef.current.set(update.id, {
        order: update.order,
        columnId: update.columnId || draggedCard.columnId,
        timestamp: now,
      });
    });

    // Optimistic update - immediate UI response
    setCards((prevCards) =>
      prevCards.map((card) => {
        const update = updateMap.get(card.id);
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

    console.log(`[DnD] handleDragEnd sync portion took ${performance.now() - startTime}ms`);

    // Fire and forget - but keep subscription blocked until write completes
    // This prevents stale subscription data from overwriting the optimistic update
    const firestoreStartTime = performance.now();
    reorderCards(boardId, cardUpdates)
      .then(() => {
        console.log(`[DnD] Firestore reorderCards took ${performance.now() - firestoreStartTime}ms`);
        // Clear pending updates and re-enable subscription after successful save
        cardUpdates.forEach((update) => {
          pendingCardUpdatesRef.current.delete(update.id);
        });
        isDraggingRef.current = false;
      })
      .catch((error) => {
        console.error('Failed to save card reorder:', error);
        console.log(`[DnD] Firestore reorderCards FAILED after ${performance.now() - firestoreStartTime}ms`);
        // Clear pending updates and re-enable subscription on error too
        cardUpdates.forEach((update) => {
          pendingCardUpdatesRef.current.delete(update.id);
        });
        isDraggingRef.current = false;
      });
    
    // Log activity if card was moved to a different column (fire and forget)
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
      
      // Accessibility: Announce card move to different column
      announceToScreenReader(`Card ${draggedCard.titleEn} moved from ${sourceColumn?.name} to ${destColumn?.name}.`);
    } else {
      // Accessibility: Announce card reorder within same column
      announceToScreenReader(`Card ${draggedCard.titleEn} moved to position ${destination.index + 1}.`);
    }
    
    // Clear selection after successful drop
    setSelectedCards(new Set());
    } catch (error) {
      // Ensure cleanup happens even if there's an error
      console.error('[DnD] Error in handleDragEnd:', error);
      isDraggingRef.current = false;
      pendingCardUpdatesRef.current.clear();
    }
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
        case '?':
          e.preventDefault();
          toggleHelpModal();
          break;
          
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
              const card = columnCards[focusedCardIndex];
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
              const card = columnCards[focusedCardIndex];
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
    toggleHelpModal,
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
  ]);

  // Show access error state
  if (accessError) {
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
    return (
      <div className={`min-h-screen transition-colors duration-500 ${getBackgroundClasses()}`}>
        <Header 
          boardName={board?.name} 
          boardId={boardId}
          availableLabels={availableLabels}
          totalCards={cards.length}
          matchingCards={matchingCardsCount}
          onActivityClick={() => setShowActivityPanel(true)}
          currentBackground={board?.background}
          onBackgroundChange={handleBackgroundChange}
          dueDateStats={dueDateStats}
        />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)] animate-spin"></div>
            <span className="absolute inset-0 flex items-center justify-center text-2xl">🍜</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${getBackgroundClasses()}`}>
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
        className="flex-1 overflow-x-auto p-4 sm:p-6"
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
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                          placeholder="Enter list name..."
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                            className="px-4 py-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors"
                          >
                            Cancel
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
                        <span className="font-medium">Add another list</span>
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
