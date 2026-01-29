import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterProvider, useFilter } from '@/contexts/FilterContext';
import { createMockCard, createMockTimestamp } from '@/test/utils';
import { Card, CardPriority, SortBy, SortOrder } from '@/types';

// Test component that uses the filter context
function FilterTestComponent() {
  const {
    searchQuery,
    selectedLabels,
    selectedPriorities,
    showOnlyMyCards,
    sortBy,
    sortOrder,
    hasActiveFilters,
    setSearchQuery,
    toggleLabel,
    togglePriority,
    clearFilters,
    setShowOnlyMyCards,
    setSortBy,
    setSortOrder,
    filterCards,
    sortCards,
    filterAndSortCards,
    matchesFilter,
    getMatchCount,
  } = useFilter();

  const testCards = [
    createMockCard({ id: 'card1', titleEn: 'Buy groceries', titleJa: '買い物', labels: ['Shopping'], createdBy: 'user1' }),
    createMockCard({ id: 'card2', titleEn: 'Fix bug', titleJa: 'バグ修正', labels: ['Bug', 'Urgent'], createdBy: 'user2' }),
    createMockCard({ id: 'card3', titleEn: 'Write documentation', titleJa: 'ドキュメント作成', labels: ['Docs'], createdBy: 'user1', assigneeIds: ['user3'] }),
  ] as unknown as Card[];

  return (
    <div>
      <div data-testid="search-query">{searchQuery}</div>
      <div data-testid="selected-labels">{selectedLabels.join(',')}</div>
      <div data-testid="selected-priorities">{selectedPriorities.join(',')}</div>
      <div data-testid="show-my-cards">{showOnlyMyCards.toString()}</div>
      <div data-testid="sort-by">{sortBy}</div>
      <div data-testid="sort-order">{sortOrder}</div>
      <div data-testid="has-active-filters">{hasActiveFilters.toString()}</div>
      <div data-testid="match-count">{getMatchCount(testCards, 'user1')}</div>
      <div data-testid="filtered-cards">
        {filterCards(testCards, 'user1').map(c => c.id).join(',')}
      </div>
      <div data-testid="matches-card1">{matchesFilter(testCards[0], 'user1').toString()}</div>
      
      <button onClick={() => setSearchQuery('bug')}>Search Bug</button>
      <button onClick={() => toggleLabel('Urgent')}>Toggle Urgent</button>
      <button onClick={() => togglePriority('high')}>Toggle High Priority</button>
      <button onClick={() => togglePriority('urgent')}>Toggle Urgent Priority</button>
      <button onClick={() => setShowOnlyMyCards(true)}>Show My Cards</button>
      <button onClick={() => setSortBy('dueDate')}>Sort by Due Date</button>
      <button onClick={() => setSortBy('created')}>Sort by Created</button>
      <button onClick={() => setSortBy('title')}>Sort by Title</button>
      <button onClick={() => setSortBy('priority')}>Sort by Priority</button>
      <button onClick={() => setSortOrder('asc')}>Sort Ascending</button>
      <button onClick={() => setSortOrder('desc')}>Sort Descending</button>
      <button onClick={clearFilters}>Clear</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <FilterProvider>
      <FilterTestComponent />
    </FilterProvider>
  );
}

describe('FilterContext', () => {
  describe('Initial State', () => {
    it('should have empty search query by default', () => {
      renderWithProvider();
      expect(screen.getByTestId('search-query').textContent).toBe('');
    });

    it('should have no selected labels by default', () => {
      renderWithProvider();
      expect(screen.getByTestId('selected-labels').textContent).toBe('');
    });

    it('should not show only my cards by default', () => {
      renderWithProvider();
      expect(screen.getByTestId('show-my-cards').textContent).toBe('false');
    });

    it('should have no active filters by default', () => {
      renderWithProvider();
      expect(screen.getByTestId('has-active-filters').textContent).toBe('false');
    });

    it('should return all cards when no filters are active', () => {
      renderWithProvider();
      expect(screen.getByTestId('match-count').textContent).toBe('3');
      expect(screen.getByTestId('filtered-cards').textContent).toBe('card1,card2,card3');
    });
  });

  describe('Search Filtering', () => {
    it('should filter cards by search query', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      await user.click(screen.getByText('Search Bug'));

      expect(screen.getByTestId('search-query').textContent).toBe('bug');
      expect(screen.getByTestId('has-active-filters').textContent).toBe('true');
      expect(screen.getByTestId('filtered-cards').textContent).toBe('card2');
    });

    it('should search in both English and Japanese titles', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <FilterProvider>
          <FilterTestComponent />
        </FilterProvider>
      );

      // The test component searches for "bug" which matches "Fix bug" (English)
      await user.click(screen.getByText('Search Bug'));
      expect(screen.getByTestId('match-count').textContent).toBe('1');
    });
  });

  describe('Label Filtering', () => {
    it('should filter cards by label', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      await user.click(screen.getByText('Toggle Urgent'));

      expect(screen.getByTestId('selected-labels').textContent).toBe('Urgent');
      expect(screen.getByTestId('has-active-filters').textContent).toBe('true');
      expect(screen.getByTestId('filtered-cards').textContent).toBe('card2');
    });

    it('should toggle label off when clicked again', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      await user.click(screen.getByText('Toggle Urgent'));
      expect(screen.getByTestId('selected-labels').textContent).toBe('Urgent');

      await user.click(screen.getByText('Toggle Urgent'));
      expect(screen.getByTestId('selected-labels').textContent).toBe('');
    });
  });

  describe('My Cards Filtering', () => {
    it('should filter to only show user\'s cards', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      await user.click(screen.getByText('Show My Cards'));

      expect(screen.getByTestId('show-my-cards').textContent).toBe('true');
      expect(screen.getByTestId('has-active-filters').textContent).toBe('true');
      // user1 created card1 and card3
      expect(screen.getByTestId('filtered-cards').textContent).toBe('card1,card3');
    });

    it('should include cards where user is assignee', async () => {
      const user = userEvent.setup();
      
      // Custom component to test assignee filtering
      function AssigneeTestComponent() {
        const { filterCards, setShowOnlyMyCards, showOnlyMyCards } = useFilter();
        const cards = [
          createMockCard({ id: 'card1', createdBy: 'user2', assigneeIds: ['user1'] }),
          createMockCard({ id: 'card2', createdBy: 'user2', assigneeIds: ['user2'] }),
        ] as unknown as import('@/types').Card[];
        
        return (
          <div>
            <div data-testid="filtered">{filterCards(cards, 'user1').map(c => c.id).join(',')}</div>
            <div data-testid="show-my">{showOnlyMyCards.toString()}</div>
            <button onClick={() => setShowOnlyMyCards(true)}>My Cards</button>
          </div>
        );
      }

      render(
        <FilterProvider>
          <AssigneeTestComponent />
        </FilterProvider>
      );

      await user.click(screen.getByText('My Cards'));
      
      // Should include card1 where user1 is assignee
      expect(screen.getByTestId('filtered').textContent).toBe('card1');
    });
  });

  describe('Combined Filters', () => {
    it('should apply multiple filters together', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      await user.click(screen.getByText('Show My Cards'));
      await user.click(screen.getByText('Toggle Urgent'));

      // Only cards created by user1 with Urgent label - none match
      expect(screen.getByTestId('filtered-cards').textContent).toBe('');
    });
  });

  describe('Clear Filters', () => {
    it('should clear all filters', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      // Apply some filters
      await user.click(screen.getByText('Search Bug'));
      await user.click(screen.getByText('Toggle Urgent'));
      await user.click(screen.getByText('Show My Cards'));

      expect(screen.getByTestId('has-active-filters').textContent).toBe('true');

      // Clear all filters
      await user.click(screen.getByText('Clear'));

      expect(screen.getByTestId('search-query').textContent).toBe('');
      expect(screen.getByTestId('selected-labels').textContent).toBe('');
      expect(screen.getByTestId('show-my-cards').textContent).toBe('false');
      expect(screen.getByTestId('has-active-filters').textContent).toBe('false');
    });
  });

  describe('useFilter Hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<FilterTestComponent />);
      }).toThrow('useFilter must be used within a FilterProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Priority Filtering', () => {
    it('should have no selected priorities by default', () => {
      renderWithProvider();
      expect(screen.getByTestId('selected-priorities').textContent).toBe('');
    });

    it('should filter cards by priority', async () => {
      const user = userEvent.setup();
      
      function PriorityTestComponent() {
        const { filterCards, togglePriority, selectedPriorities, hasActiveFilters } = useFilter();
        const cards = [
          createMockCard({ id: 'card1', priority: 'high' }),
          createMockCard({ id: 'card2', priority: 'low' }),
          createMockCard({ id: 'card3', priority: 'urgent' }),
          createMockCard({ id: 'card4', priority: null }),
        ] as unknown as Card[];
        
        return (
          <div>
            <div data-testid="filtered">{filterCards(cards).map(c => c.id).join(',')}</div>
            <div data-testid="priorities">{selectedPriorities.join(',')}</div>
            <div data-testid="has-filters">{hasActiveFilters.toString()}</div>
            <button onClick={() => togglePriority('high')}>Toggle High</button>
            <button onClick={() => togglePriority('urgent')}>Toggle Urgent</button>
          </div>
        );
      }

      render(
        <FilterProvider>
          <PriorityTestComponent />
        </FilterProvider>
      );

      // Initially all cards shown
      expect(screen.getByTestId('filtered').textContent).toBe('card1,card2,card3,card4');
      expect(screen.getByTestId('has-filters').textContent).toBe('false');

      // Filter by high priority
      await user.click(screen.getByText('Toggle High'));
      expect(screen.getByTestId('priorities').textContent).toBe('high');
      expect(screen.getByTestId('filtered').textContent).toBe('card1');
      expect(screen.getByTestId('has-filters').textContent).toBe('true');
    });

    it('should filter by multiple priorities', async () => {
      const user = userEvent.setup();
      
      function MultiPriorityTestComponent() {
        const { filterCards, togglePriority, selectedPriorities } = useFilter();
        const cards = [
          createMockCard({ id: 'card1', priority: 'high' }),
          createMockCard({ id: 'card2', priority: 'low' }),
          createMockCard({ id: 'card3', priority: 'urgent' }),
          createMockCard({ id: 'card4', priority: 'medium' }),
        ] as unknown as Card[];
        
        return (
          <div>
            <div data-testid="filtered">{filterCards(cards).map(c => c.id).join(',')}</div>
            <div data-testid="priorities">{selectedPriorities.join(',')}</div>
            <button onClick={() => togglePriority('high')}>Toggle High</button>
            <button onClick={() => togglePriority('urgent')}>Toggle Urgent</button>
          </div>
        );
      }

      render(
        <FilterProvider>
          <MultiPriorityTestComponent />
        </FilterProvider>
      );

      // Filter by high and urgent
      await user.click(screen.getByText('Toggle High'));
      await user.click(screen.getByText('Toggle Urgent'));
      
      expect(screen.getByTestId('priorities').textContent).toBe('high,urgent');
      expect(screen.getByTestId('filtered').textContent).toBe('card1,card3');
    });

    it('should toggle priority off when clicked again', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      await user.click(screen.getByText('Toggle High Priority'));
      expect(screen.getByTestId('selected-priorities').textContent).toBe('high');

      await user.click(screen.getByText('Toggle High Priority'));
      expect(screen.getByTestId('selected-priorities').textContent).toBe('');
    });

    it('should filter cards without priority when null is selected', async () => {
      const user = userEvent.setup();
      
      function NullPriorityTestComponent() {
        const { filterCards, togglePriority, selectedPriorities } = useFilter();
        const cards = [
          createMockCard({ id: 'card1', priority: 'high' }),
          createMockCard({ id: 'card2', priority: null }),
          createMockCard({ id: 'card3' }), // No priority set
        ] as unknown as Card[];
        
        return (
          <div>
            <div data-testid="filtered">{filterCards(cards).map(c => c.id).join(',')}</div>
            <div data-testid="priorities">{selectedPriorities.map(p => p === null ? 'null' : p).join(',')}</div>
            <button onClick={() => togglePriority(null)}>Toggle No Priority</button>
          </div>
        );
      }

      render(
        <FilterProvider>
          <NullPriorityTestComponent />
        </FilterProvider>
      );

      await user.click(screen.getByText('Toggle No Priority'));
      
      // Should show cards with null/undefined priority
      expect(screen.getByTestId('filtered').textContent).toBe('card2,card3');
    });
  });

  describe('Sorting', () => {
    describe('Initial State', () => {
      it('should default to sorting by priority descending', () => {
        renderWithProvider();
        expect(screen.getByTestId('sort-by').textContent).toBe('priority');
        expect(screen.getByTestId('sort-order').textContent).toBe('desc');
      });
    });

    describe('Sort By Priority', () => {
      it('should sort cards by priority (high to low by default)', async () => {
        const user = userEvent.setup();
        
        function PrioritySortTestComponent() {
          const { sortCards, sortBy, sortOrder } = useFilter();
          const cards = [
            createMockCard({ id: 'card1', priority: 'low' }),
            createMockCard({ id: 'card2', priority: 'urgent' }),
            createMockCard({ id: 'card3', priority: 'medium' }),
            createMockCard({ id: 'card4', priority: 'high' }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
              <div data-testid="sort-by">{sortBy}</div>
              <div data-testid="sort-order">{sortOrder}</div>
            </div>
          );
        }

        render(
          <FilterProvider>
            <PrioritySortTestComponent />
          </FilterProvider>
        );

        // Default: priority desc (urgent > high > medium > low)
        expect(screen.getByTestId('sorted').textContent).toBe('card2,card4,card3,card1');
      });

      it('should sort cards by priority ascending when order is asc', async () => {
        const user = userEvent.setup();
        
        function PrioritySortAscTestComponent() {
          const { sortCards, setSortOrder } = useFilter();
          const cards = [
            createMockCard({ id: 'card1', priority: 'low' }),
            createMockCard({ id: 'card2', priority: 'urgent' }),
            createMockCard({ id: 'card3', priority: 'high' }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
              <button onClick={() => setSortOrder('asc')}>Sort Ascending</button>
            </div>
          );
        }

        render(
          <FilterProvider>
            <PrioritySortAscTestComponent />
          </FilterProvider>
        );

        await user.click(screen.getByText('Sort Ascending'));
        
        // Ascending: low > high > urgent
        expect(screen.getByTestId('sorted').textContent).toBe('card1,card3,card2');
      });

      it('should handle cards without priority (treated as lowest)', async () => {
        function NoPrioritySortTestComponent() {
          const { sortCards } = useFilter();
          const cards = [
            createMockCard({ id: 'card1', priority: 'high' }),
            createMockCard({ id: 'card2', priority: null }),
            createMockCard({ id: 'card3' }), // No priority
            createMockCard({ id: 'card4', priority: 'low' }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
            </div>
          );
        }

        render(
          <FilterProvider>
            <NoPrioritySortTestComponent />
          </FilterProvider>
        );

        // Cards without priority should be at the end (lowest priority value = 0)
        expect(screen.getByTestId('sorted').textContent).toBe('card1,card4,card2,card3');
      });
    });

    describe('Sort By Due Date', () => {
      it('should sort cards by due date (soonest first by default)', async () => {
        const user = userEvent.setup();
        
        function DueDateSortTestComponent() {
          const { sortCards, setSortBy, sortOrder } = useFilter();
          const cards = [
            createMockCard({ id: 'card1', dueDate: createMockTimestamp(new Date('2026-03-15')) }),
            createMockCard({ id: 'card2', dueDate: createMockTimestamp(new Date('2026-01-01')) }),
            createMockCard({ id: 'card3', dueDate: createMockTimestamp(new Date('2026-02-10')) }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
              <div data-testid="sort-order">{sortOrder}</div>
              <button onClick={() => setSortBy('dueDate')}>Sort by Due Date</button>
            </div>
          );
        }

        render(
          <FilterProvider>
            <DueDateSortTestComponent />
          </FilterProvider>
        );

        await user.click(screen.getByText('Sort by Due Date'));
        
        // Default for dueDate is asc (soonest first)
        expect(screen.getByTestId('sort-order').textContent).toBe('asc');
        expect(screen.getByTestId('sorted').textContent).toBe('card2,card3,card1');
      });

      it('should put cards without due date at the end', async () => {
        const user = userEvent.setup();
        
        function NoDueDateSortTestComponent() {
          const { sortCards, setSortBy } = useFilter();
          const cards = [
            createMockCard({ id: 'card1', dueDate: createMockTimestamp(new Date('2026-03-15')) }),
            createMockCard({ id: 'card2', dueDate: null }),
            createMockCard({ id: 'card3' }), // No dueDate
            createMockCard({ id: 'card4', dueDate: createMockTimestamp(new Date('2026-01-01')) }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
              <button onClick={() => setSortBy('dueDate')}>Sort by Due Date</button>
            </div>
          );
        }

        render(
          <FilterProvider>
            <NoDueDateSortTestComponent />
          </FilterProvider>
        );

        await user.click(screen.getByText('Sort by Due Date'));
        
        // Cards without due date at the end
        expect(screen.getByTestId('sorted').textContent).toBe('card4,card1,card2,card3');
      });

      it('should handle all cards without due dates', async () => {
        const user = userEvent.setup();
        
        function AllNoDueDateTestComponent() {
          const { sortCards, setSortBy } = useFilter();
          const cards = [
            createMockCard({ id: 'card1' }),
            createMockCard({ id: 'card2', dueDate: null }),
            createMockCard({ id: 'card3' }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
              <button onClick={() => setSortBy('dueDate')}>Sort by Due Date</button>
            </div>
          );
        }

        render(
          <FilterProvider>
            <AllNoDueDateTestComponent />
          </FilterProvider>
        );

        await user.click(screen.getByText('Sort by Due Date'));
        
        // Order should be maintained when all cards lack due dates
        expect(screen.getByTestId('sorted').textContent).toBe('card1,card2,card3');
      });
    });

    describe('Sort By Created Date', () => {
      it('should sort cards by created date (newest first by default)', async () => {
        const user = userEvent.setup();
        
        function CreatedSortTestComponent() {
          const { sortCards, setSortBy, sortOrder } = useFilter();
          const cards = [
            createMockCard({ id: 'card1', createdAt: createMockTimestamp(new Date('2026-01-15')) }),
            createMockCard({ id: 'card2', createdAt: createMockTimestamp(new Date('2026-01-20')) }),
            createMockCard({ id: 'card3', createdAt: createMockTimestamp(new Date('2026-01-10')) }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
              <div data-testid="sort-order">{sortOrder}</div>
              <button onClick={() => setSortBy('created')}>Sort by Created</button>
            </div>
          );
        }

        render(
          <FilterProvider>
            <CreatedSortTestComponent />
          </FilterProvider>
        );

        await user.click(screen.getByText('Sort by Created'));
        
        // Default for created is desc (newest first)
        expect(screen.getByTestId('sort-order').textContent).toBe('desc');
        expect(screen.getByTestId('sorted').textContent).toBe('card2,card1,card3');
      });
    });

    describe('Sort By Title', () => {
      it('should sort cards by title alphabetically (A-Z by default)', async () => {
        const user = userEvent.setup();
        
        function TitleSortTestComponent() {
          const { sortCards, setSortBy, sortOrder } = useFilter();
          const cards = [
            createMockCard({ id: 'card1', titleEn: 'Zebra task' }),
            createMockCard({ id: 'card2', titleEn: 'Alpha task' }),
            createMockCard({ id: 'card3', titleEn: 'Middle task' }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
              <div data-testid="sort-order">{sortOrder}</div>
              <button onClick={() => setSortBy('title')}>Sort by Title</button>
            </div>
          );
        }

        render(
          <FilterProvider>
            <TitleSortTestComponent />
          </FilterProvider>
        );

        await user.click(screen.getByText('Sort by Title'));
        
        // Default for title is asc (A-Z)
        expect(screen.getByTestId('sort-order').textContent).toBe('asc');
        expect(screen.getByTestId('sorted').textContent).toBe('card2,card3,card1');
      });

      it('should fall back to Japanese title if English is empty', async () => {
        const user = userEvent.setup();
        
        function JapaneseTitleSortTestComponent() {
          const { sortCards, setSortBy } = useFilter();
          const cards = [
            createMockCard({ id: 'card1', titleEn: '', titleJa: 'タスクC' }),
            createMockCard({ id: 'card2', titleEn: 'Task A', titleJa: '' }),
            createMockCard({ id: 'card3', titleEn: '', titleJa: 'タスクB' }),
          ] as unknown as Card[];
          
          return (
            <div>
              <div data-testid="sorted">{sortCards(cards).map(c => c.id).join(',')}</div>
              <button onClick={() => setSortBy('title')}>Sort by Title</button>
            </div>
          );
        }

        render(
          <FilterProvider>
            <JapaneseTitleSortTestComponent />
          </FilterProvider>
        );

        await user.click(screen.getByText('Sort by Title'));
        
        // Task A < タスクB < タスクC (alphabetically with localeCompare)
        expect(screen.getByTestId('sorted').textContent).toBe('card2,card3,card1');
      });
    });

    describe('Sort Order', () => {
      it('should allow manually setting sort order', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        // Default is desc for priority
        expect(screen.getByTestId('sort-order').textContent).toBe('desc');

        await user.click(screen.getByText('Sort Ascending'));
        expect(screen.getByTestId('sort-order').textContent).toBe('asc');

        await user.click(screen.getByText('Sort Descending'));
        expect(screen.getByTestId('sort-order').textContent).toBe('desc');
      });

      it('should set sensible default order when changing sort type', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        // Priority: desc
        expect(screen.getByTestId('sort-by').textContent).toBe('priority');
        expect(screen.getByTestId('sort-order').textContent).toBe('desc');

        // Due Date: asc (soonest first)
        await user.click(screen.getByText('Sort by Due Date'));
        expect(screen.getByTestId('sort-order').textContent).toBe('asc');

        // Created: desc (newest first)
        await user.click(screen.getByText('Sort by Created'));
        expect(screen.getByTestId('sort-order').textContent).toBe('desc');

        // Title: asc (A-Z)
        await user.click(screen.getByText('Sort by Title'));
        expect(screen.getByTestId('sort-order').textContent).toBe('asc');

        // Back to Priority: desc
        await user.click(screen.getByText('Sort by Priority'));
        expect(screen.getByTestId('sort-order').textContent).toBe('desc');
      });
    });
  });

  describe('Filter and Sort Combined', () => {
    it('should filter and then sort cards with filterAndSortCards', async () => {
      const user = userEvent.setup();
      
      function FilterAndSortTestComponent() {
        const { filterAndSortCards, togglePriority, setSortBy } = useFilter();
        const cards = [
          createMockCard({ id: 'card1', priority: 'high', labels: ['bug'] }),
          createMockCard({ id: 'card2', priority: 'low', labels: ['bug'] }),
          createMockCard({ id: 'card3', priority: 'urgent', labels: ['feature'] }),
          createMockCard({ id: 'card4', priority: 'medium', labels: ['bug'] }),
        ] as unknown as Card[];
        
        return (
          <div>
            <div data-testid="result">{filterAndSortCards(cards).map(c => c.id).join(',')}</div>
            <button onClick={() => togglePriority('high')}>Toggle High</button>
            <button onClick={() => togglePriority('medium')}>Toggle Medium</button>
          </div>
        );
      }

      render(
        <FilterProvider>
          <FilterAndSortTestComponent />
        </FilterProvider>
      );

      // Initially all cards sorted by priority (default: desc)
      expect(screen.getByTestId('result').textContent).toBe('card3,card1,card4,card2');

      // Filter by high and medium priority
      await user.click(screen.getByText('Toggle High'));
      await user.click(screen.getByText('Toggle Medium'));

      // Should show only high and medium priority cards, sorted by priority
      expect(screen.getByTestId('result').textContent).toBe('card1,card4');
    });

    it('should combine label filter with priority filter', async () => {
      const user = userEvent.setup();
      
      function CombinedFiltersTestComponent() {
        const { filterCards, toggleLabel, togglePriority, hasActiveFilters } = useFilter();
        const cards = [
          createMockCard({ id: 'card1', priority: 'high', labels: ['bug'] }),
          createMockCard({ id: 'card2', priority: 'high', labels: ['feature'] }),
          createMockCard({ id: 'card3', priority: 'low', labels: ['bug'] }),
          createMockCard({ id: 'card4', priority: 'urgent', labels: ['bug'] }),
        ] as unknown as Card[];
        
        return (
          <div>
            <div data-testid="filtered">{filterCards(cards).map(c => c.id).join(',')}</div>
            <div data-testid="has-filters">{hasActiveFilters.toString()}</div>
            <button onClick={() => toggleLabel('bug')}>Toggle Bug Label</button>
            <button onClick={() => togglePriority('high')}>Toggle High Priority</button>
          </div>
        );
      }

      render(
        <FilterProvider>
          <CombinedFiltersTestComponent />
        </FilterProvider>
      );

      // Filter by bug label
      await user.click(screen.getByText('Toggle Bug Label'));
      expect(screen.getByTestId('filtered').textContent).toBe('card1,card3,card4');

      // Also filter by high priority
      await user.click(screen.getByText('Toggle High Priority'));
      // Only card1 has both bug label AND high priority
      expect(screen.getByTestId('filtered').textContent).toBe('card1');
      expect(screen.getByTestId('has-filters').textContent).toBe('true');
    });

    it('should combine search, label, priority, and my cards filters', async () => {
      const user = userEvent.setup();
      
      function AllFiltersTestComponent() {
        const { filterCards, setSearchQuery, toggleLabel, togglePriority, setShowOnlyMyCards } = useFilter();
        const cards = [
          createMockCard({ id: 'card1', titleEn: 'Fix login bug', priority: 'high', labels: ['bug'], createdBy: 'user1' }),
          createMockCard({ id: 'card2', titleEn: 'Fix logout bug', priority: 'high', labels: ['bug'], createdBy: 'user2' }),
          createMockCard({ id: 'card3', titleEn: 'Add feature', priority: 'high', labels: ['feature'], createdBy: 'user1' }),
          createMockCard({ id: 'card4', titleEn: 'Fix signup bug', priority: 'low', labels: ['bug'], createdBy: 'user1' }),
        ] as unknown as Card[];
        
        return (
          <div>
            <div data-testid="filtered">{filterCards(cards, 'user1').map(c => c.id).join(',')}</div>
            <button onClick={() => setSearchQuery('fix')}>Search Fix</button>
            <button onClick={() => toggleLabel('bug')}>Toggle Bug Label</button>
            <button onClick={() => togglePriority('high')}>Toggle High Priority</button>
            <button onClick={() => setShowOnlyMyCards(true)}>Show My Cards</button>
          </div>
        );
      }

      render(
        <FilterProvider>
          <AllFiltersTestComponent />
        </FilterProvider>
      );

      // Apply all filters
      await user.click(screen.getByText('Search Fix'));
      await user.click(screen.getByText('Toggle Bug Label'));
      await user.click(screen.getByText('Toggle High Priority'));
      await user.click(screen.getByText('Show My Cards'));

      // Only card1 matches all criteria:
      // - contains "fix" in title
      // - has "bug" label
      // - has "high" priority
      // - created by user1
      expect(screen.getByTestId('filtered').textContent).toBe('card1');
    });
  });

  describe('Clear Filters with Priority and Sort', () => {
    it('should clear priorities and reset sort when clearing filters', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      // Apply priority filter and change sort
      await user.click(screen.getByText('Toggle High Priority'));
      await user.click(screen.getByText('Sort by Due Date'));
      
      expect(screen.getByTestId('selected-priorities').textContent).toBe('high');
      expect(screen.getByTestId('sort-by').textContent).toBe('dueDate');
      expect(screen.getByTestId('sort-order').textContent).toBe('asc');

      // Clear all
      await user.click(screen.getByText('Clear'));

      expect(screen.getByTestId('selected-priorities').textContent).toBe('');
      expect(screen.getByTestId('sort-by').textContent).toBe('priority');
      expect(screen.getByTestId('sort-order').textContent).toBe('desc');
      expect(screen.getByTestId('has-active-filters').textContent).toBe('false');
    });
  });
});
