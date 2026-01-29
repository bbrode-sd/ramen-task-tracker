import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { FilterProvider } from '@/contexts/FilterContext';

// Minimal test providers that don't require Firebase
function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <FilterProvider>
          {children}
        </FilterProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// Custom render with providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: TestProviders, ...options }),
  };
}

// Render without providers (for isolated component testing)
function renderWithoutProviders(
  ui: ReactElement,
  options?: RenderOptions
) {
  return {
    user: userEvent.setup(),
    ...render(ui, options),
  };
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render, renderWithoutProviders };

// Test data factories
export function createMockUser(overrides = {}) {
  return {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

export function createMockBoard(overrides = {}) {
  return {
    id: 'test-board-id',
    name: 'Test Board',
    ownerId: 'test-user-id',
    memberIds: ['test-user-id'],
    createdAt: { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
    isArchived: false,
    ...overrides,
  };
}

export function createMockColumn(overrides = {}) {
  return {
    id: 'test-column-id',
    boardId: 'test-board-id',
    name: 'Test Column',
    order: 0,
    createdAt: { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
    isArchived: false,
    ...overrides,
  };
}

export function createMockCard(overrides = {}) {
  return {
    id: 'test-card-id',
    boardId: 'test-board-id',
    columnId: 'test-column-id',
    titleEn: 'Test Card',
    titleJa: 'テストカード',
    descriptionEn: 'Test description',
    descriptionJa: 'テストの説明',
    order: 0,
    createdAt: { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
    createdBy: 'test-user-id',
    isArchived: false,
    attachments: [],
    labels: [],
    assigneeIds: [],
    checklists: [],
    ...overrides,
  };
}

export function createMockComment(overrides = {}) {
  return {
    id: 'test-comment-id',
    cardId: 'test-card-id',
    content: 'Test comment',
    contentEn: 'Test comment',
    contentJa: 'テストコメント',
    detectedLanguage: 'en' as const,
    createdAt: { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
    createdBy: 'test-user-id',
    createdByName: 'Test User',
    createdByPhoto: null,
    attachments: [],
    ...overrides,
  };
}

// Wait utility for async operations
export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Create a mock Timestamp
export function createMockTimestamp(date = new Date()) {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1000000,
  };
}
