'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Card, CardPriority } from '@/types';

// Due date filter options matching Trello
export type DueDateFilter = 
  | 'none'           // No dates
  | 'overdue'        // Overdue
  | 'due_day'        // Due in the next day
  | 'due_week'       // Due in the next week
  | 'due_month';     // Due in the next month

// Member filter options
export type MemberFilter = 
  | 'none'           // No members assigned
  | 'me'             // Cards assigned to me
  | string;          // Specific member ID

interface FilterContextType {
  // State
  searchQuery: string;
  selectedLabels: string[];
  selectedPriorities: CardPriority[]; // @deprecated - use selectedTagIds
  selectedTagIds: string[]; // Custom tag IDs for filtering
  showOnlyMyCards: boolean;
  selectedMembers: MemberFilter[];
  selectedDueDates: DueDateFilter[];
  showComplete: boolean | null;  // null = any, true = complete, false = incomplete
  
  // Methods
  setSearchQuery: (query: string) => void;
  toggleLabel: (label: string) => void;
  togglePriority: (priority: CardPriority) => void; // @deprecated - use toggleTag
  toggleTag: (tagId: string) => void;
  toggleMember: (member: MemberFilter) => void;
  toggleDueDate: (dueDate: DueDateFilter) => void;
  setShowComplete: (value: boolean | null) => void;
  clearFilters: () => void;
  setShowOnlyMyCards: (show: boolean) => void;
  
  // Computed
  hasActiveFilters: boolean;
  activeFilterCount: number;
  filterCards: (cards: Card[], userId?: string) => Card[];
  matchesFilter: (card: Card, userId?: string) => boolean;
  getMatchCount: (cards: Card[], userId?: string) => number;
  searchCards: (cards: Card[], query: string) => Card[];
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQueryState] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<CardPriority[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showOnlyMyCards, setShowOnlyMyCards] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<MemberFilter[]>([]);
  const [selectedDueDates, setSelectedDueDates] = useState<DueDateFilter[]>([]);
  const [showComplete, setShowCompleteState] = useState<boolean | null>(null);

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

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }, []);

  const toggleMember = useCallback((member: MemberFilter) => {
    setSelectedMembers((prev) =>
      prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]
    );
  }, []);

  const toggleDueDate = useCallback((dueDate: DueDateFilter) => {
    setSelectedDueDates((prev) =>
      prev.includes(dueDate) ? prev.filter((d) => d !== dueDate) : [...prev, dueDate]
    );
  }, []);

  const setShowComplete = useCallback((value: boolean | null) => {
    setShowCompleteState(value);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQueryState('');
    setSelectedLabels([]);
    setSelectedPriorities([]);
    setSelectedTagIds([]);
    setShowOnlyMyCards(false);
    setSelectedMembers([]);
    setSelectedDueDates([]);
    setShowCompleteState(null);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.length > 0 || 
      selectedLabels.length > 0 || 
      selectedPriorities.length > 0 || 
      selectedTagIds.length > 0 ||
      showOnlyMyCards ||
      selectedMembers.length > 0 ||
      selectedDueDates.length > 0 ||
      showComplete !== null
    );
  }, [searchQuery, selectedLabels, selectedPriorities, selectedTagIds, showOnlyMyCards, selectedMembers, selectedDueDates, showComplete]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.length > 0) count++;
    count += selectedLabels.length;
    count += selectedPriorities.length;
    count += selectedTagIds.length;
    if (showOnlyMyCards) count++;
    count += selectedMembers.length;
    count += selectedDueDates.length;
    if (showComplete !== null) count++;
    return count;
  }, [searchQuery, selectedLabels, selectedPriorities, selectedTagIds, showOnlyMyCards, selectedMembers, selectedDueDates, showComplete]);

  // Helper to check if card is complete (all checklists done)
  const isCardComplete = useCallback((card: Card): boolean => {
    if (!card.checklists || card.checklists.length === 0) {
      return false;
    }
    return card.checklists.every(checklist => 
      checklist.items.length > 0 && checklist.items.every(item => item.isCompleted)
    );
  }, []);

  // Helper to check due date filter
  const matchesDueDateFilter = useCallback((card: Card, filters: DueDateFilter[]): boolean => {
    if (filters.length === 0) return true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);

    return filters.some(filter => {
      switch (filter) {
        case 'none':
          return !card.dueDate;
        case 'overdue':
          if (!card.dueDate) return false;
          return card.dueDate.toDate() < today;
        case 'due_day':
          if (!card.dueDate) return false;
          const dueDay = card.dueDate.toDate();
          return dueDay >= today && dueDay < tomorrow;
        case 'due_week':
          if (!card.dueDate) return false;
          const dueWeek = card.dueDate.toDate();
          return dueWeek >= today && dueWeek < nextWeek;
        case 'due_month':
          if (!card.dueDate) return false;
          const dueMonth = card.dueDate.toDate();
          return dueMonth >= today && dueMonth < nextMonth;
        default:
          return true;
      }
    });
  }, []);

  // Helper to check member filter
  const matchesMemberFilter = useCallback((card: Card, filters: MemberFilter[], userId?: string): boolean => {
    if (filters.length === 0) return true;

    return filters.some(filter => {
      switch (filter) {
        case 'none':
          return !card.assigneeIds || card.assigneeIds.length === 0;
        case 'me':
          return userId ? (card.assigneeIds?.includes(userId) ?? false) : false;
        default:
          // Specific member ID
          return card.assigneeIds?.includes(filter) ?? false;
      }
    });
  }, []);

  // Search cards without filtering - returns matching cards for dropdown
  const searchCards = useCallback((cards: Card[], query: string): Card[] => {
    if (!query.trim()) return [];
    
    const searchTerm = query.toLowerCase().trim();
    return cards.filter(card => {
      const searchableText = [
        card.titleEn || '',
        card.titleJa || '',
        card.descriptionEn || '',
        card.descriptionJa || '',
        ...(card.labels || []),
      ].join(' ').toLowerCase();
      
      return searchableText.includes(searchTerm);
    }).slice(0, 10); // Limit to 10 results for dropdown
  }, []);

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

      // Check member filter
      if (!matchesMemberFilter(card, selectedMembers, userId)) {
        return false;
      }

      // Check due date filter
      if (!matchesDueDateFilter(card, selectedDueDates)) {
        return false;
      }

      // Check completion status
      if (showComplete !== null) {
        const complete = isCardComplete(card);
        if (showComplete && !complete) return false;
        if (!showComplete && complete) return false;
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

      // Check priority filter (deprecated - for backwards compatibility)
      if (selectedPriorities.length > 0) {
        const cardPriority = card.priority ?? null;
        if (!selectedPriorities.includes(cardPriority)) {
          return false;
        }
      }

      // Check tag filter
      if (selectedTagIds.length > 0) {
        const cardTagIds = card.tagIds || [];
        // Card must have at least one of the selected tags
        const hasMatchingTag = selectedTagIds.some((tagId) =>
          cardTagIds.includes(tagId)
        );
        if (!hasMatchingTag) {
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
    [searchQuery, selectedLabels, selectedPriorities, selectedTagIds, showOnlyMyCards, selectedMembers, selectedDueDates, showComplete, matchesMemberFilter, matchesDueDateFilter, isCardComplete]
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
        selectedPriorities,
        selectedTagIds,
        showOnlyMyCards,
        selectedMembers,
        selectedDueDates,
        showComplete,
        setSearchQuery,
        toggleLabel,
        togglePriority,
        toggleTag,
        toggleMember,
        toggleDueDate,
        setShowComplete,
        clearFilters,
        setShowOnlyMyCards,
        hasActiveFilters,
        activeFilterCount,
        filterCards,
        matchesFilter,
        getMatchCount,
        searchCards,
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
