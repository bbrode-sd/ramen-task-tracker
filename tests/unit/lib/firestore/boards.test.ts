import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockWriteBatch = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection'),
  doc: vi.fn(() => 'mock-doc'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: vi.fn(),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  writeBatch: () => mockWriteBatch(),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
  },
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('@/lib/firestore/users', () => ({
  getUserProfiles: vi.fn().mockResolvedValue(new Map()),
  getUserByEmail: vi.fn(),
}));

import { createBoard, updateBoard, getBoard, subscribeToBoards, getBoardMembers } from '@/lib/firestore/boards';

describe('Board Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBoard', () => {
    it('should create a new board and return its ID', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-board-id' });

      const boardId = await createBoard('Test Board', 'user-123');

      expect(boardId).toBe('new-board-id');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    it('should include correct board data', async () => {
      mockAddDoc.mockResolvedValue({ id: 'board-id' });

      await createBoard('My Board', 'owner-id');

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'My Board',
          ownerId: 'owner-id',
          memberIds: ['owner-id'],
          isArchived: false,
        })
      );
    });
  });

  describe('updateBoard', () => {
    it('should update board with provided updates', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateBoard('board-123', { name: 'Updated Name' });

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });

    it('should include updatedAt timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateBoard('board-123', { name: 'Updated' });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Updated',
          updatedAt: expect.anything(),
        })
      );
    });
  });

  describe('getBoard', () => {
    it('should return board when it exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'board-123',
        data: () => ({
          name: 'Test Board',
          ownerId: 'user-1',
          memberIds: ['user-1'],
        }),
      });

      const board = await getBoard('board-123');

      expect(board).toEqual({
        id: 'board-123',
        name: 'Test Board',
        ownerId: 'user-1',
        memberIds: ['user-1'],
      });
    });

    it('should return null when board does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const board = await getBoard('nonexistent');

      expect(board).toBeNull();
    });
  });

  describe('subscribeToBoards', () => {
    it('should set up a real-time subscription', () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockImplementation((q, callback) => {
        callback({
          docs: [
            { id: 'board-1', data: () => ({ name: 'Board 1' }) },
            { id: 'board-2', data: () => ({ name: 'Board 2' }) },
          ],
        });
        return unsubscribe;
      });

      const callback = vi.fn();
      const result = subscribeToBoards('user-123', callback);

      expect(callback).toHaveBeenCalledWith([
        { id: 'board-1', name: 'Board 1' },
        { id: 'board-2', name: 'Board 2' },
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
      
      subscribeToBoards('user-123', callback, onError);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getBoardMembers', () => {
    it('should return empty array when board does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const members = await getBoardMembers('nonexistent');

      expect(members).toEqual([]);
    });
  });
});
