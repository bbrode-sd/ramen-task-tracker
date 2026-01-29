import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Connect to emulators in development/test mode
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
let emulatorsConnected = false;

if (typeof window !== 'undefined' && useEmulators && !emulatorsConnected) {
  emulatorsConnected = true;
  console.log('[Firebase] Connecting to local emulators...');
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8181);
  connectStorageEmulator(storage, 'localhost', 9199);
}

// Track persistence status
let persistenceEnabled = false;
let persistenceError: Error | null = null;

/**
 * Enable Firestore offline persistence with multi-tab support.
 * This allows the app to work offline and sync when back online.
 * Call this once after Firebase is initialized.
 * 
 * Test scenarios for offline support:
 * 1. Create card while offline - should save locally, sync when online
 * 2. Edit card while offline - should update locally, sync when online
 * 3. Come back online - verify all pending changes sync automatically
 * 4. Multiple tabs with offline changes - all tabs should sync correctly
 */
export async function enableOfflinePersistence(): Promise<{ success: boolean; error?: Error }> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return { success: false };
  }

  // Already attempted
  if (persistenceEnabled) {
    return { success: true };
  }

  if (persistenceError) {
    return { success: false, error: persistenceError };
  }

  try {
    // Enable multi-tab persistence for better multi-window experience
    await enableMultiTabIndexedDbPersistence(db);
    persistenceEnabled = true;
    console.log('[Offline] Firestore offline persistence enabled (multi-tab)');
    return { success: true };
  } catch (error) {
    persistenceError = error as Error;
    const err = error as { code?: string };
    
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      // This is expected in multi-tab scenarios, the other tabs will still work
      console.warn('[Offline] Persistence failed: Multiple tabs open. Only one tab can enable persistence at a time.');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required for persistence
      console.warn('[Offline] Persistence not available: Browser does not support IndexedDB.');
    } else {
      console.error('[Offline] Error enabling persistence:', error);
    }
    
    return { success: false, error: persistenceError };
  }
}

/**
 * Check if offline persistence is currently enabled
 */
export function isPersistenceEnabled(): boolean {
  return persistenceEnabled;
}

/**
 * Get any persistence error that occurred
 */
export function getPersistenceError(): Error | null {
  return persistenceError;
}

export default app;
