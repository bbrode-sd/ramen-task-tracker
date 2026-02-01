import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Firestore
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection'),
  doc: vi.fn(() => 'mock-doc'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
  },
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

import { 
  getUserProfile, 
  getUserProfiles, 
  saveUserProfile, 
  getUserByEmail,
  getUsersByIds,
  clearUserCache,
} from '@/lib/firestore/users';

describe('User Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearUserCache();
  });

  describe('getUserProfile', () => {
    it('should return user profile when it exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'user-123',
        data: () => ({
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: 'https://example.com/photo.jpg',
        }),
      });

      const profile = await getUserProfile('user-123');

      expect(profile).toEqual({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      });
    });

    it('should return null when user does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const profile = await getUserProfile('nonexistent');

      expect(profile).toBeNull();
    });

    it('should cache user profiles', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'user-123',
        data: () => ({
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: null,
        }),
      });

      // First call
      await getUserProfile('user-123');
      // Second call should use cache
      await getUserProfile('user-123');

      // Should only have called Firestore once
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserProfiles', () => {
    it('should return map of user profiles', async () => {
      mockGetDoc.mockImplementation(() => {
        return Promise.resolve({
          exists: () => true,
          id: 'user-1',
          data: () => ({
            email: 'user1@example.com',
            displayName: 'User One',
            photoURL: null,
          }),
        });
      });

      const profiles = await getUserProfiles(['user-1']);

      expect(profiles.size).toBe(1);
      expect(profiles.get('user-1')).toEqual({
        uid: 'user-1',
        email: 'user1@example.com',
        displayName: 'User One',
        photoURL: null,
      });
    });

    it('should use cache for already fetched users', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'user-1',
        data: () => ({
          email: 'test@example.com',
          displayName: 'Test',
          photoURL: null,
        }),
      });

      // First call to populate cache
      await getUserProfile('user-1');
      
      // Clear mock to track new calls
      mockGetDoc.mockClear();
      
      // Second call through getUserProfiles should use cache
      await getUserProfiles(['user-1']);

      expect(mockGetDoc).not.toHaveBeenCalled();
    });
  });

  describe('saveUserProfile', () => {
    it('should create new user if does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValue(undefined);

      await saveUserProfile({
        uid: 'new-user',
        email: 'new@example.com',
        displayName: 'New User',
        photoURL: null,
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          uid: 'new-user',
          email: 'new@example.com',
          displayName: 'New User',
        })
      );
    });

    it('should update existing user', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await saveUserProfile({
        uid: 'existing-user',
        email: 'existing@example.com',
        displayName: 'Updated Name',
        photoURL: 'https://example.com/new-photo.jpg',
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          email: 'existing@example.com',
          displayName: 'Updated Name',
          photoURL: 'https://example.com/new-photo.jpg',
        })
      );
    });

    it('should not save user without email', async () => {
      await saveUserProfile({
        uid: 'user-no-email',
        email: null,
        displayName: 'No Email',
        photoURL: null,
      });

      expect(mockGetDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found by email', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              uid: 'user-123',
              email: 'test@example.com',
              displayName: 'Test User',
              photoURL: null,
            }),
          },
        ],
      });

      const user = await getUserByEmail('test@example.com');

      expect(user).toEqual({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      });
    });

    it('should return null when user not found', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const user = await getUserByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });
  });

  describe('getUsersByIds', () => {
    it('should return empty array for empty input', async () => {
      const users = await getUsersByIds([]);

      expect(users).toEqual([]);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('should return users by their IDs', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            data: () => ({
              uid: 'user-1',
              email: 'user1@example.com',
              displayName: 'User 1',
              photoURL: null,
            }),
          },
          {
            data: () => ({
              uid: 'user-2',
              email: 'user2@example.com',
              displayName: 'User 2',
              photoURL: null,
            }),
          },
        ],
      });

      const users = await getUsersByIds(['user-1', 'user-2']);

      expect(users).toHaveLength(2);
      expect(users[0].uid).toBe('user-1');
      expect(users[1].uid).toBe('user-2');
    });
  });

  describe('clearUserCache', () => {
    it('should clear the cache', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'user-1',
        data: () => ({
          email: 'test@example.com',
          displayName: 'Test',
          photoURL: null,
        }),
      });

      // Populate cache
      await getUserProfile('user-1');
      mockGetDoc.mockClear();

      // Clear cache
      clearUserCache();

      // Should fetch again
      await getUserProfile('user-1');

      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });
  });
});
