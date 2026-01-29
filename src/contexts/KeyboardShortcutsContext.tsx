'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface KeyboardShortcutsContextType {
  // Focus state
  focusedColumnIndex: number | null;
  focusedCardIndex: number | null;
  isHelpModalOpen: boolean;
  
  // Hover state for card actions
  hoveredCardId: string | null;
  setHoveredCardId: (cardId: string | null) => void;
  
  // Navigation methods
  setFocusedColumnIndex: (index: number | null) => void;
  setFocusedCardIndex: (index: number | null) => void;
  focusNextColumn: () => void;
  focusPrevColumn: () => void;
  focusNextCard: () => void;
  focusPrevCard: () => void;
  
  // Modal control
  openHelpModal: () => void;
  closeHelpModal: () => void;
  toggleHelpModal: () => void;
  
  // Registration for dynamic column/card counts
  registerColumns: (count: number) => void;
  registerCardsInColumn: (columnIndex: number, count: number) => void;
  
  // Refs for focusing
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  addCardInputRefs: React.MutableRefObject<Map<number, HTMLTextAreaElement | null>>;
  
  // State setters for add card functionality
  triggerAddCard: number | null;
  setTriggerAddCard: (columnIndex: number | null) => void;
  
  // Search expand callback
  expandSearchCallback: React.MutableRefObject<(() => void) | null>;
  
  // Check if we should handle shortcuts
  isInputFocused: () => boolean;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [focusedColumnIndex, setFocusedColumnIndex] = useState<number | null>(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [columnCount, setColumnCount] = useState(0);
  const [cardsPerColumn, setCardsPerColumn] = useState<Map<number, number>>(new Map());
  const [triggerAddCard, setTriggerAddCard] = useState<number | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const addCardInputRefs = useRef<Map<number, HTMLTextAreaElement | null>>(new Map());
  const expandSearchCallback = useRef<(() => void) | null>(null);

  const registerColumns = useCallback((count: number) => {
    setColumnCount(count);
  }, []);

  const registerCardsInColumn = useCallback((columnIndex: number, count: number) => {
    setCardsPerColumn((prev) => {
      const next = new Map(prev);
      next.set(columnIndex, count);
      return next;
    });
  }, []);

  const isInputFocused = useCallback(() => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    
    const tagName = activeElement.tagName.toLowerCase();
    const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';
    
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isContentEditable;
  }, []);

  const focusNextColumn = useCallback(() => {
    if (columnCount === 0) return;
    
    setFocusedColumnIndex((prev) => {
      if (prev === null) return 0;
      return Math.min(prev + 1, columnCount - 1);
    });
    setFocusedCardIndex(null); // Reset card focus when changing columns
  }, [columnCount]);

  const focusPrevColumn = useCallback(() => {
    if (columnCount === 0) return;
    
    setFocusedColumnIndex((prev) => {
      if (prev === null) return columnCount - 1;
      return Math.max(prev - 1, 0);
    });
    setFocusedCardIndex(null); // Reset card focus when changing columns
  }, [columnCount]);

  const focusNextCard = useCallback(() => {
    if (focusedColumnIndex === null) {
      setFocusedColumnIndex(0);
      setFocusedCardIndex(0);
      return;
    }
    
    const cardCount = cardsPerColumn.get(focusedColumnIndex) || 0;
    if (cardCount === 0) return;
    
    setFocusedCardIndex((prev) => {
      if (prev === null) return 0;
      return Math.min(prev + 1, cardCount - 1);
    });
  }, [focusedColumnIndex, cardsPerColumn]);

  const focusPrevCard = useCallback(() => {
    if (focusedColumnIndex === null) {
      setFocusedColumnIndex(0);
      return;
    }
    
    const cardCount = cardsPerColumn.get(focusedColumnIndex) || 0;
    if (cardCount === 0) return;
    
    setFocusedCardIndex((prev) => {
      if (prev === null) return cardCount - 1;
      return Math.max(prev - 1, 0);
    });
  }, [focusedColumnIndex, cardsPerColumn]);

  const openHelpModal = useCallback(() => {
    setIsHelpModalOpen(true);
  }, []);

  const closeHelpModal = useCallback(() => {
    setIsHelpModalOpen(false);
  }, []);

  const toggleHelpModal = useCallback(() => {
    setIsHelpModalOpen((prev) => !prev);
  }, []);

  // Clear focus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't clear focus if clicking on a card or column
      if (target.closest('[data-card-id]') || target.closest('[data-column-id]')) {
        return;
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        focusedColumnIndex,
        focusedCardIndex,
        isHelpModalOpen,
        hoveredCardId,
        setHoveredCardId,
        setFocusedColumnIndex,
        setFocusedCardIndex,
        focusNextColumn,
        focusPrevColumn,
        focusNextCard,
        focusPrevCard,
        openHelpModal,
        closeHelpModal,
        toggleHelpModal,
        registerColumns,
        registerCardsInColumn,
        searchInputRef,
        addCardInputRefs,
        triggerAddCard,
        setTriggerAddCard,
        expandSearchCallback,
        isInputFocused,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (context === undefined) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}
