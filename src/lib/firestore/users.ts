/**
 * User profile operations with caching
 */
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '@/types';

// User cache for avoiding repeated fetches
const userCache = new Map<string, UserProfile>();
const pendingUserFetches = new Map<string, Promise<UserProfile | null>>();

/**
 * Get user profile by ID with caching
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  // Check cache first
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  // Check if there's already a pending fetch for this user
  if (pendingUserFetches.has(userId)) {
    return pendingUserFetches.get(userId)!;
  }

  // Create new fetch promise
  const fetchPromise = (async () => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
        userCache.set(userId, userData);
        return userData;
      }
      return null;
    } finally {
      pendingUserFetches.delete(userId);
    }
  })();

  pendingUserFetches.set(userId, fetchPromise);
  return fetchPromise;
};

/**
 * Get multiple user profiles by IDs with caching
 */
export const getUserProfiles = async (userIds: string[]): Promise<Map<string, UserProfile>> => {
  const result = new Map<string, UserProfile>();
  const uncachedIds: string[] = [];

  // Check cache first
  for (const userId of userIds) {
    if (userCache.has(userId)) {
      result.set(userId, userCache.get(userId)!);
    } else {
      uncachedIds.push(userId);
    }
  }

  // Fetch uncached users
  if (uncachedIds.length > 0) {
    await Promise.all(
      uncachedIds.map(async (userId) => {
        const user = await getUserProfile(userId);
        if (user) {
          result.set(userId, user);
        }
      })
    );
  }

  return result;
};

/**
 * Clear user cache (useful for testing or when user data might have changed)
 */
export const clearUserCache = () => {
  userCache.clear();
};

/**
 * Save or update user profile in Firestore
 */
export const saveUserProfile = async (user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<void> => {
  if (!user.email) return; // Can't save without email for lookup
  
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    // Update existing user
    await updateDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      updatedAt: Timestamp.now(),
    });
  } else {
    // Create new user
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
};

/**
 * Get user by email address
 */
export const getUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const usersQuery = query(
    collection(db, 'users'),
    where('email', '==', email.toLowerCase())
  );
  
  const snapshot = await getDocs(usersQuery);
  if (snapshot.empty) return null;
  
  const userData = snapshot.docs[0].data();
  return {
    uid: userData.uid,
    email: userData.email,
    displayName: userData.displayName,
    photoURL: userData.photoURL,
    createdAt: userData.createdAt,
    updatedAt: userData.updatedAt,
  } as UserProfile;
};

/**
 * Get multiple users by their IDs (batched for Firestore limits)
 */
export const getUsersByIds = async (userIds: string[]): Promise<UserProfile[]> => {
  if (userIds.length === 0) return [];
  
  const users: UserProfile[] = [];
  
  // Firestore 'in' queries are limited to 30 items, so we batch them
  const batchSize = 30;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const usersQuery = query(
      collection(db, 'users'),
      where('uid', 'in', batch)
    );
    
    const snapshot = await getDocs(usersQuery);
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as UserProfile);
    });
  }
  
  return users;
};
