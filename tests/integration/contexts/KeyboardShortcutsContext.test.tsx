import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';

// Test component that uses the keyboard shortcuts context
function TestComponent() {
  const {
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
    triggerAddCard,
    setTriggerAddCard,
    isInputFocused,
  } = useKeyboardShortcuts();

  React.useEffect(() => {
    registerColumns(3);
    registerCardsInColumn(0, 5);
    registerCardsInColumn(1, 3);
    registerCardsInColumn(2, 2);
  }, [registerColumns, registerCardsInColumn]);

  return (
    <div>
      <div data-testid="column-index">{focusedColumnIndex ?? 'null'}</div>
      <div data-testid="card-index">{focusedCardIndex ?? 'null'}</div>
      <div data-testid="help-open">{isHelpModalOpen ? 'open' : 'closed'}</div>
      <div data-testid="hovered-card">{hoveredCardId ?? 'null'}</div>
      <div data-testid="trigger-add">{triggerAddCard ?? 'null'}</div>
      <div data-testid="input-focused">{isInputFocused() ? 'yes' : 'no'}</div>
      
      <button onClick={() => setFocusedColumnIndex(0)}>Focus Column 0</button>
      <button onClick={() => setFocusedCardIndex(0)}>Focus Card 0</button>
      <button onClick={focusNextColumn}>Next Column</button>
      <button onClick={focusPrevColumn}>Prev Column</button>
      <button onClick={focusNextCard}>Next Card</button>
      <button onClick={focusPrevCard}>Prev Card</button>
      <button onClick={openHelpModal}>Open Help</button>
      <button onClick={closeHelpModal}>Close Help</button>
      <button onClick={toggleHelpModal}>Toggle Help</button>
      <button onClick={() => setHoveredCardId('card-1')}>Hover Card</button>
      <button onClick={() => setTriggerAddCard(0)}>Trigger Add Card</button>
      
      <input type="text" data-testid="test-input" />
    </div>
  );
}

describe('KeyboardShortcutsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useKeyboardShortcuts hook', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('KeyboardShortcutsProvider', () => {
    it('should initialize with null focus state', () => {
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      expect(screen.getByTestId('column-index')).toHaveTextContent('null');
      expect(screen.getByTestId('card-index')).toHaveTextContent('null');
    });

    it('should initialize with help modal closed', () => {
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      expect(screen.getByTestId('help-open')).toHaveTextContent('closed');
    });

    it('should set focused column index', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Focus Column 0'));

      expect(screen.getByTestId('column-index')).toHaveTextContent('0');
    });

    it('should navigate to next column', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Focus Column 0'));
      await user.click(screen.getByText('Next Column'));

      expect(screen.getByTestId('column-index')).toHaveTextContent('1');
    });

    it('should navigate to previous column', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Focus Column 0'));
      await user.click(screen.getByText('Next Column'));
      await user.click(screen.getByText('Prev Column'));

      expect(screen.getByTestId('column-index')).toHaveTextContent('0');
    });

    it('should not go past last column', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Focus Column 0'));
      await user.click(screen.getByText('Next Column'));
      await user.click(screen.getByText('Next Column'));
      await user.click(screen.getByText('Next Column')); // Try to go past
      await user.click(screen.getByText('Next Column')); // Try again

      expect(screen.getByTestId('column-index')).toHaveTextContent('2');
    });

    it('should not go before first column', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Focus Column 0'));
      await user.click(screen.getByText('Prev Column')); // Try to go before first

      expect(screen.getByTestId('column-index')).toHaveTextContent('0');
    });

    it('should navigate to next card', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Focus Column 0'));
      await user.click(screen.getByText('Focus Card 0'));
      await user.click(screen.getByText('Next Card'));

      expect(screen.getByTestId('card-index')).toHaveTextContent('1');
    });

    it('should navigate to previous card', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Focus Column 0'));
      await user.click(screen.getByText('Focus Card 0'));
      await user.click(screen.getByText('Next Card'));
      await user.click(screen.getByText('Prev Card'));

      expect(screen.getByTestId('card-index')).toHaveTextContent('0');
    });

    it('should open help modal', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Open Help'));

      expect(screen.getByTestId('help-open')).toHaveTextContent('open');
    });

    it('should close help modal', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Open Help'));
      await user.click(screen.getByText('Close Help'));

      expect(screen.getByTestId('help-open')).toHaveTextContent('closed');
    });

    it('should toggle help modal', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Toggle Help'));
      expect(screen.getByTestId('help-open')).toHaveTextContent('open');

      await user.click(screen.getByText('Toggle Help'));
      expect(screen.getByTestId('help-open')).toHaveTextContent('closed');
    });

    it('should toggle help modal with ? key', async () => {
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      expect(screen.getByTestId('help-open')).toHaveTextContent('closed');

      act(() => {
        fireEvent.keyDown(document, { key: '?' });
      });

      expect(screen.getByTestId('help-open')).toHaveTextContent('open');
    });

    it('should not toggle help when input is focused', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      // Focus the input
      await user.click(screen.getByTestId('test-input'));

      act(() => {
        fireEvent.keyDown(document, { key: '?' });
      });

      expect(screen.getByTestId('help-open')).toHaveTextContent('closed');
    });

    it('should track hovered card id', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Hover Card'));

      expect(screen.getByTestId('hovered-card')).toHaveTextContent('card-1');
    });

    it('should trigger add card', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Trigger Add Card'));

      expect(screen.getByTestId('trigger-add')).toHaveTextContent('0');
    });

    it('should reset card focus when changing columns', async () => {
      const user = userEvent.setup();
      
      render(
        <KeyboardShortcutsProvider>
          <TestComponent />
        </KeyboardShortcutsProvider>
      );

      await user.click(screen.getByText('Focus Column 0'));
      await user.click(screen.getByText('Focus Card 0'));
      expect(screen.getByTestId('card-index')).toHaveTextContent('0');

      await user.click(screen.getByText('Next Column'));
      expect(screen.getByTestId('card-index')).toHaveTextContent('null');
    });
  });
});
