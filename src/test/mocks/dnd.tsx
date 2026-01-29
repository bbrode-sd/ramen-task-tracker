import React from 'react';
import { vi } from 'vitest';

// Mock @hello-pangea/dnd for testing drag and drop
export const mockDragDropContext = {
  onDragEnd: vi.fn(),
  onDragStart: vi.fn(),
  onDragUpdate: vi.fn(),
};

// Mock DragDropContext component
export function MockDragDropContext({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Mock Droppable component
export function MockDroppable({
  children,
  droppableId,
}: {
  children: (provided: DroppableProvided) => React.ReactNode;
  droppableId: string;
}) {
  const provided: DroppableProvided = {
    innerRef: vi.fn(),
    droppableProps: {
      'data-rfd-droppable-id': droppableId,
      'data-rfd-droppable-context-id': '0',
    },
    placeholder: null,
  };
  return <>{children(provided)}</>;
}

// Mock Draggable component
export function MockDraggable({
  children,
  draggableId,
  index,
}: {
  children: (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => React.ReactNode;
  draggableId: string;
  index: number;
}) {
  const provided: DraggableProvided = {
    innerRef: vi.fn(),
    draggableProps: {
      'data-rfd-draggable-id': draggableId,
      'data-rfd-draggable-context-id': '0',
      style: {},
    },
    dragHandleProps: {
      'data-rfd-drag-handle-draggable-id': draggableId,
      'data-rfd-drag-handle-context-id': '0',
      role: 'button',
      tabIndex: 0,
      draggable: false,
      onDragStart: vi.fn(),
    },
  };
  const snapshot: DraggableStateSnapshot = {
    isDragging: false,
    isDropAnimating: false,
    isClone: false,
    dropAnimation: null,
    draggingOver: null,
    combineWith: null,
    combineTargetFor: null,
    mode: null,
  };
  return <>{children(provided, snapshot)}</>;
}

// Type definitions for mocks
interface DroppableProvided {
  innerRef: ReturnType<typeof vi.fn>;
  droppableProps: Record<string, string>;
  placeholder: React.ReactNode;
}

interface DraggableProvided {
  innerRef: ReturnType<typeof vi.fn>;
  draggableProps: Record<string, unknown>;
  dragHandleProps: Record<string, unknown>;
}

interface DraggableStateSnapshot {
  isDragging: boolean;
  isDropAnimating: boolean;
  isClone: boolean;
  dropAnimation: null;
  draggingOver: string | null;
  combineWith: string | null;
  combineTargetFor: string | null;
  mode: string | null;
}

// Mock the entire @hello-pangea/dnd module
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: MockDragDropContext,
  Droppable: MockDroppable,
  Draggable: MockDraggable,
}));
