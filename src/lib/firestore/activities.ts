/**
 * Activity logging operations for audit trails
 */
import {
  collection,
  doc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Activity, ActivityType } from '@/types';

/**
 * Log an activity event
 */
export const logActivity = async (
  boardId: string,
  activity: {
    cardId?: string;
    cardTitle?: string;
    type: ActivityType;
    userId: string;
    userName: string;
    userPhoto?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<string> => {
  const activityRef = await addDoc(
    collection(db, 'boards', boardId, 'activities'),
    {
      boardId,
      cardId: activity.cardId ?? null,
      cardTitle: activity.cardTitle ?? null,
      type: activity.type,
      userId: activity.userId,
      userName: activity.userName,
      userPhoto: activity.userPhoto || null,
      metadata: activity.metadata || {},
      createdAt: Timestamp.now(),
    }
  );
  return activityRef.id;
};

/**
 * Subscribe to activities for a specific card
 */
export const subscribeToCardActivities = (
  boardId: string,
  cardId: string,
  callback: (activities: Activity[]) => void,
  limitCount: number = 50,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'activities'),
    where('cardId', '==', cardId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const activities = snapshot.docs
        .slice(0, limitCount)
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Activity[];
      callback(activities);
    },
    (error) => {
      console.error('Error subscribing to card activities:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

/**
 * Subscribe to all activities for a board
 */
export const subscribeToBoardActivities = (
  boardId: string,
  callback: (activities: Activity[]) => void,
  limitCount: number = 100,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'activities'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const activities = snapshot.docs
        .slice(0, limitCount)
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Activity[];
      callback(activities);
    },
    (error) => {
      console.error('Error subscribing to board activities:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};
