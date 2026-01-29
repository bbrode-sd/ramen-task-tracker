import { vi } from 'vitest';

// Mock Firebase Auth
export const mockAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn((callback) => {
    callback(null);
    return vi.fn(); // unsubscribe function
  }),
  signInWithPopup: vi.fn(),
  signInAnonymously: vi.fn(),
  signOut: vi.fn(),
};

// Mock Firebase Firestore
export const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  })),
  serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
};

// Mock Firebase Storage
export const mockStorage = {
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
};

// Mock the firebase module
vi.mock('@/lib/firebase', () => ({
  auth: mockAuth,
  db: mockFirestore,
  storage: mockStorage,
}));

// Helper to reset all mocks
export function resetFirebaseMocks() {
  vi.clearAllMocks();
}

// Helper to mock authenticated user
export function mockAuthenticatedUser(user = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
}) {
  mockAuth.currentUser = user as unknown as typeof mockAuth.currentUser;
  mockAuth.onAuthStateChanged.mockImplementation((callback) => {
    callback(user);
    return vi.fn();
  });
  return user;
}

// Helper to mock Firestore document
export function mockFirestoreDoc(data: Record<string, unknown> | null, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
    id: data?.id || 'mock-doc-id',
  };
}

// Helper to mock Firestore query result
export function mockFirestoreQuery(docs: Array<Record<string, unknown>>) {
  return {
    docs: docs.map((data) => mockFirestoreDoc(data)),
    empty: docs.length === 0,
    size: docs.length,
  };
}
