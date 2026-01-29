'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Card } from '@/types';

interface FilterContextType {
  // State
  searchQuery: string;
  selectedLabels: string[];
  showOnlyMyCards: boolean;
  
  // Methods
  setSearchQuery: (query: string) => void;
  toggleLabel: (label: string) => void;
  clearFilters: () => void;
  setShowOnlyMyCards: (show: boolean) => void;
  
  // Computed
  hasActiveFilters: boolean;
  filterCards: (cards: Card[], userId?: string) => Card[];
  matchesFilter: (card: Card, userId?: string) => boolean;
  getMatchCount: (cards: Card[], userId?: string) => number;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQueryState] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [showOnlyMyCards, setShowOnlyMyCards] = useState(false);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  const toggleLabel = useCallback((label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQueryState('');
    setSelectedLabels([]);
    setShowOnlyMyCards(false);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return searchQuery.length > 0 || selectedLabels.length > 0 || showOnlyMyCards;
  }, [searchQuery, selectedLabels, showOnlyMyCards]);

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
    [searchQuery, selectedLabels, showOnlyMyCards]
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
        showOnlyMyCards,
        setSearchQuery,
        toggleLabel,
        clearFilters,
        setShowOnlyMyCards,
        hasActiveFilters,
        filterCards,
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
