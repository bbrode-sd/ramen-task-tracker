/**
 * Notification tracking operations for card activity badges
 * 
 * Tracks when users last viewed cards to show notification badges
 * for new activity on cards they're assigned to.
 */
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Card view timestamps per card ID
 */
export interface CardViewsData {
  cardViews: Record<string, Timestamp>;
}

/**
 * Mark a card as viewed by updating the lastViewedAt timestamp
 */
export const markCardAsViewed = async (
  userId: string,
  cardId: string
): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  // Only update if user document exists (to avoid triggering create rules)
  if (!userDoc.exists()) {
    console.warn('[Notifications] User document does not exist, skipping markCardAsViewed');
    return;
  }
  
  const currentViews = userDoc.data()?.cardViews || {};
  const newTimestamp = Timestamp.now();
  
  console.log('[Notifications] Marking card as viewed:', { cardId, userId, timestamp: newTimestamp.toMillis() });
  
  await setDoc(
    userRef,
    {
      cardViews: {
        ...currentViews,
        [cardId]: newTimestamp,
      },
    },
    { merge: true }
  );
  
  console.log('[Notifications] Card marked as viewed successfully');
};

/**
 * Subscribe to a user's card view timestamps
 */
export const subscribeToCardViews = (
  userId: string,
  callback: (cardViews: Record<string, Timestamp>) => void,
  onError?: (error: Error) => void
) => {
  const userRef = doc(db, 'users', userId);
  
  return onSnapshot(
    userRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback(data?.cardViews || {});
      } else {
        callback({});
      }
    },
    (error) => {
      console.error('Error subscribing to card views:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

/**
 * Activity types that should trigger notification badges
 * Excludes: card_moved (as per requirements), card_created, card_archived, card_watched, card_unwatched
 */
export const BADGE_TRIGGERING_ACTIVITY_TYPES = new Set([
  'comment_added',
  'assignee_added',
  'checklist_completed',
  'due_date_set',
  'attachment_added',
  'card_updated',
  'checklist_item_assigned',
  'checklist_item_due_date_set',
]);

/**
 * Check if an activity type should trigger a notification badge
 */
export const shouldTriggerBadge = (activityType: string): boolean => {
  return BADGE_TRIGGERING_ACTIVITY_TYPES.has(activityType);
};
