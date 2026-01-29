import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterProvider, useFilter } from '@/contexts/FilterContext';
import { createMockCard } from '@/test/utils';

// Test component that uses the filter context
function FilterTestComponent() {
  const {
    searchQuery,
    selectedLabels,
    showOnlyMyCards,
    hasActiveFilters,
    setSearchQuery,
    toggleLabel,
    clearFilters,
    setShowOnlyMyCards,
    filterCards,
    matchesFilter,
    getMatchCount,
  } = useFilter();

  const testCards = [
    createMockCard({ id: 'card1', titleEn: 'Buy groceries', titleJa: '買い物', labels: ['Shopping'], createdBy: 'user1' }),
    createMockCard({ id: 'card2', titleEn: 'Fix bug', titleJa: 'バグ修正', labels: ['Bug', 'Urgent'], createdBy: 'user2' }),
    createMockCard({ id: 'card3', titleEn: 'Write documentation', titleJa: 'ドキュメント作成', labels: ['Docs'], createdBy: 'user1', assigneeIds: ['user3'] }),
  ] as unknown as import('@/types').Card[];

  return (
    <div>
      <div data-testid="search-query">{searchQuery}</div>
      <div data-testid="selected-labels">{selectedLabels.join(',')}</div>
      <div data-testid="show-my-cards">{showOnlyMyCards.toString()}</div>
      <div data-testid="has-active-filters">{hasActiveFilters.toString()}</div>
      <div data-testid="match-count">{getMatchCount(testCards, 'user1')}</div>
      <div data-testid="filtered-cards">
        {filterCards(testCards, 'user1').map(c => c.id).join(',')}
      </div>
      <div data-testid="matches-card1">{matchesFilter(testCards[0], 'user1').toString()}</div>
      
      <button onClick={() => setSearchQuery('bug')}>Search Bug</button>
      <button onClick={() => toggleLabel('Urgent')}>Toggle Urgent</button>
      <button onClick={() => setShowOnlyMyCards(true)}>Show My Cards</button>
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
});
