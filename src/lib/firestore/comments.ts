/**
 * Comment operations for cards
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Comment, Attachment } from '@/types';

/**
 * Add a comment to a card
 */
export const addComment = async (
  boardId: string,
  cardId: string,
  content: string,
  userId: string,
  userName: string,
  userPhoto: string | null,
  attachments: Attachment[] = [],
  contentEn?: string,
  contentJa?: string,
  detectedLanguage?: 'en' | 'ja'
): Promise<string> => {
  const commentRef = await addDoc(
    collection(db, 'boards', boardId, 'cards', cardId, 'comments'),
    {
      cardId,
      content,
      contentEn: contentEn || content,
      contentJa: contentJa || content,
      detectedLanguage: detectedLanguage || 'en',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      createdByName: userName,
      createdByPhoto: userPhoto,
      attachments,
    }
  );
  
  // Update the card's comment count
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  await updateDoc(cardRef, {
    commentCount: increment(1),
  });
  
  return commentRef.id;
};

/**
 * Update comment content
 */
export const updateComment = async (
  boardId: string,
  cardId: string,
  commentId: string,
  content: string
) => {
  const commentRef = doc(db, 'boards', boardId, 'cards', cardId, 'comments', commentId);
  await updateDoc(commentRef, {
    content,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Update comment translation (for manual edits)
 */
export const updateCommentTranslation = async (
  boardId: string,
  cardId: string,
  commentId: string,
  language: 'en' | 'ja',
  translatedContent: string,
  translatorUid: string,
  translatorDisplayName: string
) => {
  const commentRef = doc(db, 'boards', boardId, 'cards', cardId, 'comments', commentId);
  
  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  if (language === 'en') {
    updateData.contentEn = translatedContent;
    updateData.translatorEn = {
      uid: translatorUid,
      displayName: translatorDisplayName,
    };
  } else {
    updateData.contentJa = translatedContent;
    updateData.translatorJa = {
      uid: translatorUid,
      displayName: translatorDisplayName,
    };
  }
  
  await updateDoc(commentRef, updateData);
};

/**
 * Delete a comment
 */
export const deleteComment = async (
  boardId: string,
  cardId: string,
  commentId: string
) => {
  const commentRef = doc(db, 'boards', boardId, 'cards', cardId, 'comments', commentId);
  await deleteDoc(commentRef);
  
  // Update the card's comment count
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  await updateDoc(cardRef, {
    commentCount: increment(-1),
  });
};

/**
 * Subscribe to comments for a card (real-time updates)
 */
export const subscribeToComments = (
  boardId: string,
  cardId: string,
  callback: (comments: Comment[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'cards', cardId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const comments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      callback(comments);
    },
    (error) => {
      console.error('Error subscribing to comments:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};
