import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection'),
  doc: vi.fn(() => 'mock-doc'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  writeBatch: () => ({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
  },
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

import { 
  createColumn, 
  updateColumn, 
  archiveColumn, 
  restoreColumn, 
  subscribeToColumns,
  subscribeToArchivedColumns,
} from '@/lib/firestore/columns';

describe('Column Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createColumn', () => {
    it('should create a new column and return its ID', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-column-id' });

      const columnId = await createColumn('board-123', 'Todo', 0);

      expect(columnId).toBe('new-column-id');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    it('should include correct column data', async () => {
      mockAddDoc.mockResolvedValue({ id: 'column-id' });

      await createColumn('board-id', 'In Progress', 1);

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          boardId: 'board-id',
          name: 'In Progress',
          order: 1,
          isArchived: false,
        })
      );
    });

    it('should include Japanese name when provided', async () => {
      mockAddDoc.mockResolvedValue({ id: 'column-id' });

      await createColumn('board-id', 'Todo', 0, 'やること');

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Todo',
          nameJa: 'やること',
        })
      );
    });

    it('should default nameJa to empty string when not provided', async () => {
      mockAddDoc.mockResolvedValue({ id: 'column-id' });

      await createColumn('board-id', 'Done', 2);

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          nameJa: '',
        })
      );
    });
  });

  describe('updateColumn', () => {
    it('should update column with provided updates', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateColumn('board-123', 'column-456', { name: 'Updated Name' });

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });

    it('should include updatedAt timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateColumn('board-123', 'column-456', { name: 'Updated' });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Updated',
          updatedAt: expect.anything(),
        })
      );
    });
  });

  describe('archiveColumn', () => {
    it('should set isArchived to true', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await archiveColumn('board-123', 'column-456');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isArchived: true,
        })
      );
    });
  });

  describe('restoreColumn', () => {
    it('should set isArchived to false', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await restoreColumn('board-123', 'column-456');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isArchived: false,
        })
      );
    });
  });

  describe('subscribeToColumns', () => {
    it('should set up a real-time subscription', () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockImplementation((q, callback) => {
        callback({
          docs: [
            { id: 'col-1', data: () => ({ name: 'Todo', order: 0 }) },
            { id: 'col-2', data: () => ({ name: 'Done', order: 1 }) },
          ],
        });
        return unsubscribe;
      });

      const callback = vi.fn();
      const result = subscribeToColumns('board-123', callback);

      expect(callback).toHaveBeenCalledWith([
        { id: 'col-1', name: 'Todo', order: 0 },
        { id: 'col-2', name: 'Done', order: 1 },
      ]);
      expect(result).toBe(unsubscribe);
    });

    it('should call onError when subscription fails', () => {
      mockOnSnapshot.mockImplementation((q, callback, errorCallback) => {
        errorCallback(new Error('Subscription failed'));
        return vi.fn();
      });

      const callback = vi.fn();
      const onError = vi.fn();
      
      subscribeToColumns('board-123', callback, onError);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('subscribeToArchivedColumns', () => {
    it('should set up a real-time subscription for archived columns', () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockImplementation((q, callback) => {
        callback({
          docs: [
            { id: 'col-1', data: () => ({ name: 'Archived Column', isArchived: true }) },
          ],
        });
        return unsubscribe;
      });

      const callback = vi.fn();
      const result = subscribeToArchivedColumns('board-123', callback);

      expect(callback).toHaveBeenCalledWith([
        { id: 'col-1', name: 'Archived Column', isArchived: true },
      ]);
      expect(result).toBe(unsubscribe);
    });
  });
});
