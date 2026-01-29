import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockCard, createMockTimestamp } from '@/test/utils';

// Mock all dependencies before importing Card
vi.mock('@hello-pangea/dnd', () => ({
  Draggable: ({ children }: { children: (provided: unknown, snapshot: unknown) => React.ReactNode }) => {
    const provided = {
      innerRef: vi.fn(),
      draggableProps: { style: {} },
      dragHandleProps: {},
    };
    const snapshot = { isDragging: false, isDropAnimating: false };
    return <>{children(provided, snapshot)}</>;
  },
}));

vi.mock('@/contexts/FilterContext', () => ({
  useFilter: () => ({ searchQuery: '' }),
}));

vi.mock('next/image', () => ({
  default: function MockImage({ src, alt, ...props }: { src: string; alt: string }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Import Card after mocks
import { Card } from '@/components/Card';
import type { Card as CardType } from '@/types';

describe('Card Component', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCard = (cardOverrides = {}, props = {}) => {
    const card = createMockCard(cardOverrides) as unknown as CardType;
    return render(
      <Card
        card={card}
        index={0}
        boardId="test-board"
        onClick={mockOnClick}
        {...props}
      />
    );
  };

  it('should render card with English and Japanese titles', () => {
    renderCard({
      titleEn: 'Test Task',
      titleJa: 'テストタスク',
    });

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('テストタスク')).toBeInTheDocument();
  });

  it('should display EN and JP language badges', () => {
    renderCard();

    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('JP')).toBeInTheDocument();
  });

  it('should render labels when present', () => {
    renderCard({
      labels: ['Bug', 'Urgent', 'Frontend'],
    });

    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('should show translation in progress when Japanese title is missing', () => {
    renderCard({
      titleEn: 'English Only',
      titleJa: '',
    });

    expect(screen.getByText('English Only')).toBeInTheDocument();
    expect(screen.getByText('翻訳中...')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', async () => {
    const user = userEvent.setup();
    renderCard();

    const cardElement = screen.getByRole('button');
    await user.click(cardElement);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should apply dimmed styles when isDimmed is true', () => {
    renderCard({}, { isDimmed: true });

    const cardElement = screen.getByRole('button');
    expect(cardElement.className).toContain('opacity-40');
  });

  it('should apply focused styles when isFocused is true', () => {
    renderCard({}, { isFocused: true });

    const cardElement = screen.getByRole('button');
    expect(cardElement.className).toContain('ring-2');
    expect(cardElement.className).toContain('ring-orange-500');
  });

  it('should apply selected styles when isSelected is true', () => {
    renderCard({}, { isSelected: true });

    const cardElement = screen.getByRole('button');
    expect(cardElement.className).toContain('ring-2');
    expect(cardElement.className).toContain('bg-orange-50/50');
  });

  it('should display due date when present', () => {
    const today = new Date();
    renderCard({
      dueDate: createMockTimestamp(today),
    });

    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should display overdue styling for past due dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    renderCard({
      dueDate: createMockTimestamp(pastDate),
    });

    const dueDateElement = screen.getByTitle(/^Due:/);
    expect(dueDateElement.className).toContain('bg-red-100');
  });

  it('should display checklist progress when checklists exist', () => {
    renderCard({
      checklists: [
        {
          id: 'checklist1',
          title: 'Tasks',
          items: [
            { id: 'item1', text: 'Task 1', isCompleted: true, order: 0 },
            { id: 'item2', text: 'Task 2', isCompleted: false, order: 1 },
            { id: 'item3', text: 'Task 3', isCompleted: true, order: 2 },
          ],
        },
      ],
    });

    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('should display attachment count when attachments exist', () => {
    renderCard({
      attachments: [
        { id: 'att1', type: 'image', url: 'http://example.com/img.png', name: 'img.png', createdAt: createMockTimestamp(), createdBy: 'user1' },
        { id: 'att2', type: 'file', url: 'http://example.com/doc.pdf', name: 'doc.pdf', createdAt: createMockTimestamp(), createdBy: 'user1' },
      ],
    });

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should have correct accessibility attributes', () => {
    renderCard({
      titleEn: 'Accessible Card',
      titleJa: 'アクセシブルカード',
    });

    const cardElement = screen.getByRole('button');
    expect(cardElement).toHaveAttribute('aria-label', 'Accessible Card, Japanese: アクセシブルカード');
    expect(cardElement).toHaveAttribute('aria-grabbed', 'false');
  });

  it('should display cover color when set', () => {
    renderCard({
      coverImage: { color: '#ff5733' },
    });

    const cardElement = screen.getByRole('button');
    const coverDiv = cardElement.querySelector('[style*="background-color"]');
    expect(coverDiv).toBeInTheDocument();
  });
});
