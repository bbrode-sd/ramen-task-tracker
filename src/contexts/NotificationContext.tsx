'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
  subscribeToCardViews,
  subscribeToBoardActivities,
  subscribeToCards,
  markCardAsViewed as markCardAsViewedFirestore,
  shouldTriggerBadge,
} from '@/lib/firestore';
import { Card, Activity } from '@/types';

interface NotificationContextType {
  /** Set of card IDs that have unread activity for the current user */
  unreadCardIds: Set<string>;
  /** Check if a specific card has unread activity */
  hasUnreadActivity: (cardId: string) => boolean;
  /** Mark a card as viewed (clears the badge) */
  markCardAsViewed: (cardId: string) => Promise<void>;
  /** Set the current board ID to track notifications for */
  setBoardId: (boardId: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [cardViews, setCardViews] = useState<Record<string, Timestamp>>({});
  
  // Track if subscriptions are active to ignore errors after unsubscribe (sign-out race condition)
  const cardViewsSubscribedRef = useRef(false);
  
  // Subscribe to cards for the current board
  useEffect(() => {
    if (!boardId) {
      setCards([]);
      return;
    }
    
    const unsubscribe = subscribeToCards(
      boardId,
      setCards,
      {
        onError: (error) => {
          console.error('Error subscribing to cards for notifications:', error);
        },
      }
    );
    
    return () => unsubscribe();
  }, [boardId]);
  
  // Subscribe to activities for the current board
  useEffect(() => {
    if (!boardId) {
      setActivities([]);
      return;
    }
    
    const unsubscribe = subscribeToBoardActivities(
      boardId,
      setActivities,
      500, // Get more activities to ensure we catch all recent ones
      (error) => {
        console.error('Error subscribing to activities for notifications:', error);
      }
    );
    
    return () => unsubscribe();
  }, [boardId]);
  
  // Subscribe to user's card view timestamps
  useEffect(() => {
    if (!user) {
      setCardViews({});
      return;
    }
    
    cardViewsSubscribedRef.current = true;
    
    const unsubscribe = subscribeToCardViews(
      user.uid,
      (views) => {
        // Ignore callbacks if we've already unsubscribed (user signed out)
        if (!cardViewsSubscribedRef.current) return;
        console.log('[Notifications] Card views updated:', Object.keys(views).length, 'cards');
        setCardViews(views);
      },
      (error) => {
        // Ignore permission errors after unsubscribe (happens during sign-out race condition)
        if (!cardViewsSubscribedRef.current) return;
        console.error('Error subscribing to card views:', error);
      }
    );
    
    return () => {
      cardViewsSubscribedRef.current = false;
      unsubscribe();
    };
  }, [user?.uid]);
  
  // Calculate which cards have unread activity
  const unreadCardIds = useMemo(() => {
    if (!user) return new Set<string>();
    
    const unread = new Set<string>();
    
    // Get cards where the current user is an assignee
    const assignedCards = cards.filter(
      card => card.assigneeIds?.includes(user.uid) && !card.isArchived
    );
    
    for (const card of assignedCards) {
      const lastViewed = cardViews[card.id];
      
      // Get activities for this card that:
      // 1. Are newer than last viewed (or never viewed)
      // 2. Should trigger a badge
      // 3. Were NOT created by the current user (don't notify for your own actions)
      const hasUnread = activities.some(activity => {
        // Activity must be for this card
        if (activity.cardId !== card.id) return false;
        
        // Activity must be a badge-triggering type
        if (!shouldTriggerBadge(activity.type)) return false;
        
        // Don't notify user of their own actions
        if (activity.userId === user.uid) return false;
        
        // Check if activity is newer than last viewed
        if (!lastViewed) return true; // Never viewed = all activities are unread
        
        return activity.createdAt.toMillis() > lastViewed.toMillis();
      });
      
      if (hasUnread) {
        unread.add(card.id);
      }
    }
    
    // Also check for assignee_added activities where the current user was assigned
    // This covers the case where user was just assigned (even if not yet in their assigned cards list)
    for (const activity of activities) {
      if (activity.type !== 'assignee_added') continue;
      if (!activity.cardId) continue;
      
      // Check if this activity is about assigning the current user
      const assigneeId = activity.metadata?.assigneeId as string | undefined;
      if (assigneeId !== user.uid) continue;
      
      // Don't notify if user assigned themselves
      if (activity.userId === user.uid) continue;
      
      // Check if newer than last viewed
      const lastViewed = cardViews[activity.cardId];
      if (lastViewed && activity.createdAt.toMillis() <= lastViewed.toMillis()) continue;
      
      unread.add(activity.cardId);
    }
    
    return unread;
  }, [user, cards, activities, cardViews]);
  
  const hasUnreadActivity = useCallback(
    (cardId: string) => unreadCardIds.has(cardId),
    [unreadCardIds]
  );
  
  const markCardAsViewed = useCallback(
    async (cardId: string) => {
      if (!user) {
        console.warn('markCardAsViewed called without user');
        return;
      }
      try {
        await markCardAsViewedFirestore(user.uid, cardId);
      } catch (error) {
        console.error('Error marking card as viewed:', error);
      }
    },
    [user]
  );
  
  const value = useMemo(
    () => ({
      unreadCardIds,
      hasUnreadActivity,
      markCardAsViewed,
      setBoardId,
    }),
    [unreadCardIds, hasUnreadActivity, markCardAsViewed]
  );
  
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
