'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { saveUserProfile } from '@/lib/firestore';
import { User } from '@/types';

// Mock user for testing when NEXT_PUBLIC_SKIP_AUTH is enabled
const MOCK_TEST_USER: User = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if auth should be skipped for testing
  const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

  useEffect(() => {
    // If skip auth is enabled, immediately set mock user
    if (skipAuth) {
      setUser(MOCK_TEST_USER);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(userData);
        
        // Save/update user profile in Firestore for member lookup
        try {
          await saveUserProfile(userData);
        } catch (error) {
          console.error('Error saving user profile:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [skipAuth]);

  const signInWithGoogle = async () => {
    // In skip auth mode, user is already logged in
    if (skipAuth) {
      console.log('[Skip Auth] Already logged in as test user');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    // In skip auth mode, don't actually sign out
    if (skipAuth) {
      console.log('[Skip Auth] Sign out disabled in test mode');
      return;
    }
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
