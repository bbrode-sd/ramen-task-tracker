import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if we should use emulators
export const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

// Initialize Firebase app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Get service instances
const authInstance = getAuth(app);

// Initialize Firestore with persistent cache for offline support (multi-tab)
// Skip persistence when using emulators or skip auth mode
const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
const shouldUsePersistence = typeof window !== 'undefined' && !useEmulators && !skipAuth;

let dbInstance;
try {
  if (shouldUsePersistence && getApps().length === 1) {
    // Only initialize with persistence on first load (not HMR)
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } else {
    dbInstance = getFirestore(app);
  }
} catch {
  // Firestore already initialized (HMR), just get the existing instance
  dbInstance = getFirestore(app);
}

const storageInstance = getStorage(app);

// Connect to emulators BEFORE exporting instances
// This must happen before any Firestore operations
if (typeof window !== 'undefined' && useEmulators) {
  // Check if already connected by looking at internal state
  const firestoreSettings = (dbInstance as unknown as { _settings?: { host?: string } })._settings;
  const isAlreadyConnected = firestoreSettings?.host?.includes('127.0.0.1');
  
  if (!isAlreadyConnected) {
    console.log('[Firebase] Connecting to local emulators...');
    try {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(dbInstance, '127.0.0.1', 8181);
      connectStorageEmulator(storageInstance, '127.0.0.1', 9199);
      console.log('[Firebase] Connected to emulators successfully');
    } catch (error) {
      // Already connected (can happen during HMR) - this is fine
      console.log('[Firebase] Emulators already connected or error:', error);
    }
  } else {
    console.log('[Firebase] Already connected to emulators');
  }
}

// Export instances
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;
export const googleProvider = new GoogleAuthProvider();

// Track persistence status - now handled at initialization time via persistentLocalCache
const persistenceEnabled = shouldUsePersistence;
const persistenceError: Error | null = null;

/**
 * Enable Firestore offline persistence with multi-tab support.
 * This allows the app to work offline and sync when back online.
 * 
 * NOTE: As of Firebase v10+, persistence is now configured at initialization time
 * using persistentLocalCache with persistentMultipleTabManager. This function
 * is kept for backwards compatibility and simply returns the current status.
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

  // Persistence is now configured at Firestore initialization time
  // This function just returns the current status
  if (persistenceEnabled) {
    console.log('[Offline] Firestore offline persistence enabled (multi-tab)');
    return { success: true };
  }

  // When using emulators or skip auth mode, we didn't enable persistence
  if (useEmulators || skipAuth) {
    console.log('[Offline] Skipping persistence - using emulators or skip auth mode');
    return { success: true };
  }

  return { success: true };
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
