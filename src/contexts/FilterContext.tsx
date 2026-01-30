'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Card, CardPriority, SortBy, SortOrder } from '@/types';

interface FilterContextType {
  // State
  searchQuery: string;
  selectedLabels: string[];
  selectedPriorities: CardPriority[];
  showOnlyMyCards: boolean;
  sortBy: SortBy;
  sortOrder: SortOrder;
  
  // Methods
  setSearchQuery: (query: string) => void;
  toggleLabel: (label: string) => void;
  togglePriority: (priority: CardPriority) => void;
  clearFilters: () => void;
  setShowOnlyMyCards: (show: boolean) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (sortOrder: SortOrder) => void;
  
  // Computed
  hasActiveFilters: boolean;
  filterCards: (cards: Card[], userId?: string) => Card[];
  sortCards: (cards: Card[]) => Card[];
  filterAndSortCards: (cards: Card[], userId?: string) => Card[];
  matchesFilter: (card: Card, userId?: string) => boolean;
  getMatchCount: (cards: Card[], userId?: string) => number;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

// Priority values for sorting (higher number = higher priority)
const PRIORITY_VALUES: Record<string, number> = {
  'urgent': 4,
  'high': 3,
  'medium': 2,
  'low': 1,
};

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQueryState] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<CardPriority[]>([]);
  const [showOnlyMyCards, setShowOnlyMyCards] = useState(false);
  // Default: sort by priority (high to low)
  const [sortBy, setSortByState] = useState<SortBy>('priority');
  const [sortOrder, setSortOrderState] = useState<SortOrder>('desc');

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  const toggleLabel = useCallback((label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }, []);

  const togglePriority = useCallback((priority: CardPriority) => {
    setSelectedPriorities((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQueryState('');
    setSelectedLabels([]);
    setSelectedPriorities([]);
    setShowOnlyMyCards(false);
    // Reset to default sort
    setSortByState('priority');
    setSortOrderState('desc');
  }, []);

  const setSortBy = useCallback((newSortBy: SortBy) => {
    setSortByState(newSortBy);
    // Set sensible default order for each sort type
    if (newSortBy === 'priority') {
      setSortOrderState('desc'); // High to low
    } else if (newSortBy === 'dueDate') {
      setSortOrderState('asc'); // Soonest first
    } else if (newSortBy === 'created') {
      setSortOrderState('desc'); // Newest first
    } else if (newSortBy === 'title') {
      setSortOrderState('asc'); // A to Z
    }
  }, []);

  const setSortOrder = useCallback((newSortOrder: SortOrder) => {
    setSortOrderState(newSortOrder);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return searchQuery.length > 0 || selectedLabels.length > 0 || selectedPriorities.length > 0 || showOnlyMyCards;
  }, [searchQuery, selectedLabels, selectedPriorities, showOnlyMyCards]);

  const matchesFilter = useCallback(
    (card: Card, userId?: string): boolean => {
      // Check "my cards" filter - now also checks assignees
      if (showOnlyMyCards && userId) {
        const isCreator = card.createdBy === userId;
        const isAssignee = card.assigneeIds?.includes(userId) ?? false;
        if (!isCreator && !isAssignee) {
          return false;
        }
      }

      // Check label filter
      if (selectedLabels.length > 0) {
        const cardLabels = card.labels || [];
        const hasMatchingLabel = selectedLabels.some((label) =>
          cardLabels.includes(label)
        );
        if (!hasMatchingLabel) {
          return false;
        }
      }

      // Check priority filter
      if (selectedPriorities.length > 0) {
        const cardPriority = card.priority ?? null;
        if (!selectedPriorities.includes(cardPriority)) {
          return false;
        }
      }

      // Check search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const searchableText = [
          card.titleEn || '',
          card.titleJa || '',
          card.descriptionEn || '',
          card.descriptionJa || '',
        ]
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    },
    [searchQuery, selectedLabels, selectedPriorities, showOnlyMyCards]
  );

  const filterCards = useCallback(
    (cards: Card[], userId?: string): Card[] => {
      if (!hasActiveFilters) {
        return cards;
      }
      return cards.filter((card) => matchesFilter(card, userId));
    },
    [hasActiveFilters, matchesFilter]
  );

  const sortCards = useCallback(
    (cards: Card[]): Card[] => {
      return [...cards].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'priority': {
            const priorityA = PRIORITY_VALUES[a.priority ?? ''] ?? 0;
            const priorityB = PRIORITY_VALUES[b.priority ?? ''] ?? 0;
            comparison = priorityA - priorityB;
            break;
          }
          case 'dueDate': {
            // Cards without due date go to the end
            if (!a.dueDate && !b.dueDate) {
              comparison = 0;
            } else if (!a.dueDate) {
              comparison = 1;
            } else if (!b.dueDate) {
              comparison = -1;
            } else {
              const dateA = a.dueDate.toMillis();
              const dateB = b.dueDate.toMillis();
              comparison = dateA - dateB;
            }
            break;
          }
          case 'created': {
            const createdA = a.createdAt?.toMillis() ?? 0;
            const createdB = b.createdAt?.toMillis() ?? 0;
            comparison = createdA - createdB;
            break;
          }
          case 'title': {
            const titleA = (a.titleEn || a.titleJa || '').toLowerCase();
            const titleB = (b.titleEn || b.titleJa || '').toLowerCase();
            comparison = titleA.localeCompare(titleB);
            break;
          }
        }

        // Apply sort order
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    },
    [sortBy, sortOrder]
  );

  const filterAndSortCards = useCallback(
    (cards: Card[], userId?: string): Card[] => {
      const filtered = filterCards(cards, userId);
      return sortCards(filtered);
    },
    [filterCards, sortCards]
  );

  const getMatchCount = useCallback(
    (cards: Card[], userId?: string): number => {
      return filterCards(cards, userId).length;
    },
    [filterCards]
  );

  return (
    <FilterContext.Provider
      value={{
        searchQuery,
        selectedLabels,
        selectedPriorities,
        showOnlyMyCards,
        sortBy,
        sortOrder,
        setSearchQuery,
        toggleLabel,
        togglePriority,
        clearFilters,
        setShowOnlyMyCards,
        setSortBy,
        setSortOrder,
        hasActiveFilters,
        filterCards,
        sortCards,
        filterAndSortCards,
        matchesFilter,
        getMatchCount,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}

// Optional version that returns null when not in a FilterProvider
// Use this for components that may be rendered outside of board context (e.g., Header)
export function useFilterOptional(): FilterContextType | null {
  const context = useContext(FilterContext);
  return context ?? null;
}
