import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockWriteBatch = vi.fn();
const mockGetDocs = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection'),
  doc: vi.fn(() => 'mock-doc'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
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

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

import { 
  createCard, 
  updateCard, 
  getCard, 
  archiveCard, 
  restoreCard, 
  moveCard,
  subscribeToCards,
  addAttachment,
  removeAttachment,
  addChecklist,
  deleteChecklist,
  toggleCardWatch,
} from '@/lib/firestore/cards';

describe('Card Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCard', () => {
    it('should create a new card and return its ID', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-card-id' });

      const cardId = await createCard(
        'board-123',
        'column-456',
        'Test Card',
        'テストカード',
        'user-789',
        0
      );

      expect(cardId).toBe('new-card-id');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    it('should include correct card data', async () => {
      mockAddDoc.mockResolvedValue({ id: 'card-id' });

      await createCard('board-id', 'column-id', 'Title EN', 'Title JA', 'user-id', 0);

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          boardId: 'board-id',
          columnId: 'column-id',
          titleEn: 'Title EN',
          titleJa: 'Title JA',
          createdBy: 'user-id',
          order: 0,
          isArchived: false,
          attachments: [],
          labels: [],
        })
      );
    });

    it('should include detected language when provided', async () => {
      mockAddDoc.mockResolvedValue({ id: 'card-id' });

      await createCard('board-id', 'column-id', 'Title', '', 'user-id', 0, {
        titleDetectedLanguage: 'en',
      });

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          titleDetectedLanguage: 'en',
        })
      );
    });
  });

  describe('updateCard', () => {
    it('should update card with provided updates', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateCard('board-123', 'card-456', { titleEn: 'Updated Title' });

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCard', () => {
    it('should return card when it exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'card-123',
        data: () => ({
          titleEn: 'Test Card',
          titleJa: 'テストカード',
          columnId: 'column-1',
        }),
      });

      const card = await getCard('board-123', 'card-123');

      expect(card).toEqual({
        id: 'card-123',
        titleEn: 'Test Card',
        titleJa: 'テストカード',
        columnId: 'column-1',
      });
    });

    it('should return null when card does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const card = await getCard('board-123', 'nonexistent');

      expect(card).toBeNull();
    });
  });

  describe('archiveCard', () => {
    it('should set isArchived to true', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await archiveCard('board-123', 'card-456');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isArchived: true,
        })
      );
    });
  });

  describe('restoreCard', () => {
    it('should set isArchived to false', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await restoreCard('board-123', 'card-456');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isArchived: false,
        })
      );
    });
  });

  describe('moveCard', () => {
    it('should update columnId and order', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await moveCard('board-123', 'card-456', 'new-column', 5);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          columnId: 'new-column',
          order: 5,
        })
      );
    });
  });

  describe('subscribeToCards', () => {
    it('should set up a real-time subscription', () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockImplementation((q, callback) => {
        callback({
          docs: [
            { id: 'card-1', data: () => ({ titleEn: 'Card 1' }) },
            { id: 'card-2', data: () => ({ titleEn: 'Card 2' }) },
          ],
        });
        return unsubscribe;
      });

      const callback = vi.fn();
      const result = subscribeToCards('board-123', callback);

      expect(callback).toHaveBeenCalledWith([
        { id: 'card-1', titleEn: 'Card 1' },
        { id: 'card-2', titleEn: 'Card 2' },
      ]);
      expect(result).toBe(unsubscribe);
    });
  });

  describe('addAttachment', () => {
    it('should add attachment to card', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ attachments: [] }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addAttachment('board-123', 'card-456', {
        type: 'image',
        url: 'https://example.com/image.png',
        name: 'image.png',
        createdBy: 'user-123',
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              id: 'mock-uuid',
              type: 'image',
              url: 'https://example.com/image.png',
              name: 'image.png',
            }),
          ]),
        })
      );
    });
  });

  describe('removeAttachment', () => {
    it('should remove attachment from card', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          attachments: [
            { id: 'att-1', name: 'keep.png' },
            { id: 'att-2', name: 'remove.png' },
          ],
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await removeAttachment('board-123', 'card-456', 'att-2');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attachments: [{ id: 'att-1', name: 'keep.png' }],
        })
      );
    });
  });

  describe('addChecklist', () => {
    it('should add checklist to card and return its ID', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ checklists: [] }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const checklistId = await addChecklist('board-123', 'card-456', 'Todo List');

      expect(checklistId).toBe('mock-uuid');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          checklists: expect.arrayContaining([
            expect.objectContaining({
              id: 'mock-uuid',
              title: 'Todo List',
              titleEn: 'Todo List',
              items: [],
            }),
          ]),
        })
      );
    });
  });

  describe('deleteChecklist', () => {
    it('should remove checklist from card', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          checklists: [
            { id: 'cl-1', title: 'Keep' },
            { id: 'cl-2', title: 'Remove' },
          ],
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await deleteChecklist('board-123', 'card-456', 'cl-2');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          checklists: [{ id: 'cl-1', title: 'Keep' }],
        })
      );
    });
  });

  describe('toggleCardWatch', () => {
    it('should add user to watchers if not watching', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ watcherIds: [] }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const isWatching = await toggleCardWatch('board-123', 'card-456', 'user-789');

      expect(isWatching).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          watcherIds: ['user-789'],
        })
      );
    });

    it('should remove user from watchers if already watching', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ watcherIds: ['user-789'] }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const isWatching = await toggleCardWatch('board-123', 'card-456', 'user-789');

      expect(isWatching).toBe(false);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          watcherIds: [],
        })
      );
    });
  });
});
