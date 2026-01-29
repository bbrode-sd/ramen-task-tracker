'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInAnonymously,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { saveUserProfile } from '@/lib/firestore';
import { User } from '@/types';

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
  const anonymousSignInAttempted = useRef(false);

  // Check if auth should be skipped for testing
  const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // In skip auth mode, ensure we're using anonymous auth (not a stale session)
        if (skipAuth && !firebaseUser.isAnonymous && !anonymousSignInAttempted.current) {
          // Sign out the old user and sign in anonymously
          console.log('[Skip Auth] Found non-anonymous user, signing out to use anonymous auth...');
          anonymousSignInAttempted.current = true;
          try {
            await firebaseSignOut(auth);
            await signInAnonymously(auth);
            // onAuthStateChanged will fire again with the anonymous user
            return;
          } catch (error) {
            console.error('[Skip Auth] Error switching to anonymous auth:', error);
          }
        }
        
        // User is signed in (could be anonymous or Google)
        const userData: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || (skipAuth ? 'test@example.com' : null),
          displayName: firebaseUser.displayName || (skipAuth ? 'Test User' : null),
          photoURL: firebaseUser.photoURL,
        };
        setUser(userData);
        
        // Save/update user profile in Firestore for member lookup
        // Only save if we have an email (skip for pure anonymous without email)
        if (userData.email) {
          try {
            await saveUserProfile(userData);
          } catch (error) {
            console.error('Error saving user profile:', error);
          }
        }
        setLoading(false);
      } else {
        // No user signed in
        if (skipAuth && !anonymousSignInAttempted.current) {
          // In skip auth mode, sign in anonymously to get a real Firebase auth session
          anonymousSignInAttempted.current = true;
          console.log('[Skip Auth] Signing in anonymously for test mode...');
          try {
            await signInAnonymously(auth);
            // onAuthStateChanged will fire again with the anonymous user
          } catch (error) {
            console.error('[Skip Auth] Anonymous sign-in failed:', error);
            setUser(null);
            setLoading(false);
          }
        } else {
          setUser(null);
          setLoading(false);
        }
      }
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
