/**
 * Card operations including CRUD, attachments, checklists, and covers
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Card, Attachment, Checklist, ChecklistItem, CardCover } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// CARD CRUD
// ============================================================================

/**
 * Create a new card
 */
export const createCard = async (
  boardId: string,
  columnId: string,
  titleEn: string,
  titleJa: string,
  userId: string,
  order: number,
  options?: {
    titleDetectedLanguage?: 'en' | 'ja';
  }
): Promise<string> => {
  const cardRef = await addDoc(collection(db, 'boards', boardId, 'cards'), {
    boardId,
    columnId,
    titleEn,
    titleJa,
    descriptionEn: '',
    descriptionJa: '',
    order,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: userId,
    isArchived: false,
    attachments: [],
    labels: [],
    ...(options?.titleDetectedLanguage && { titleDetectedLanguage: options.titleDetectedLanguage }),
  });
  return cardRef.id;
};

/**
 * Update card properties
 */
export const updateCard = async (
  boardId: string,
  cardId: string,
  updates: Partial<Card>
) => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  await updateDoc(cardRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Get a single card by ID
 */
export const getCard = async (boardId: string, cardId: string): Promise<Card | null> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  if (cardDoc.exists()) {
    return { id: cardDoc.id, ...cardDoc.data() } as Card;
  }
  return null;
};

/**
 * Archive a card (soft delete)
 */
export const archiveCard = async (boardId: string, cardId: string) => {
  await updateCard(boardId, cardId, { isArchived: true });
};

/**
 * Restore an archived card
 */
export const restoreCard = async (boardId: string, cardId: string) => {
  await updateCard(boardId, cardId, { isArchived: false });
};

/**
 * Move a card to a different column
 */
export const moveCard = async (
  boardId: string,
  cardId: string,
  newColumnId: string,
  newOrder: number
) => {
  await updateCard(boardId, cardId, {
    columnId: newColumnId,
    order: newOrder,
  });
};

/**
 * Reorder multiple cards at once (batch update)
 */
export const reorderCards = async (
  boardId: string,
  cardUpdates: { id: string; order: number; columnId?: string }[]
) => {
  const batch = writeBatch(db);
  
  cardUpdates.forEach(({ id, order, columnId }) => {
    const cardRef = doc(db, 'boards', boardId, 'cards', id);
    const updateData: Record<string, unknown> = { order, updatedAt: Timestamp.now() };
    if (columnId) {
      updateData.columnId = columnId;
    }
    batch.update(cardRef, updateData);
  });
  
  await batch.commit();
};

/**
 * Archive all cards in a column
 */
export const archiveAllCardsInColumn = async (boardId: string, columnId: string): Promise<string[]> => {
  const cardsQuery = query(
    collection(db, 'boards', boardId, 'cards'),
    where('columnId', '==', columnId),
    where('isArchived', '==', false)
  );
  
  const snapshot = await getDocs(cardsQuery);
  const batch = writeBatch(db);
  const archivedCardIds: string[] = [];
  
  snapshot.docs.forEach((cardDoc) => {
    batch.update(cardDoc.ref, { isArchived: true, updatedAt: Timestamp.now() });
    archivedCardIds.push(cardDoc.id);
  });
  
  await batch.commit();
  return archivedCardIds;
};

/**
 * Restore multiple cards at once
 */
export const restoreCards = async (boardId: string, cardIds: string[]) => {
  const batch = writeBatch(db);
  
  cardIds.forEach((cardId) => {
    const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
    batch.update(cardRef, { isArchived: false, updatedAt: Timestamp.now() });
  });
  
  await batch.commit();
};

// ============================================================================
// CARD SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to cards in a board (real-time updates)
 */
export const subscribeToCards = (
  boardId: string,
  callback: (cards: Card[]) => void,
  options?: {
    limit?: number;
    columnId?: string;
    onError?: (error: Error) => void;
  }
) => {
  let q = query(
    collection(db, 'boards', boardId, 'cards'),
    where('isArchived', '==', false),
    orderBy('order', 'asc')
  );
  
  // Add column filter if specified
  if (options?.columnId) {
    q = query(
      collection(db, 'boards', boardId, 'cards'),
      where('isArchived', '==', false),
      where('columnId', '==', options.columnId),
      orderBy('order', 'asc')
    );
  }
  
  return onSnapshot(
    q,
    (snapshot) => {
      const cards = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Card[];
      callback(cards);
    },
    (error) => {
      console.error('Error subscribing to cards:', error);
      if (options?.onError) {
        options.onError(error);
      }
    }
  );
};

/**
 * Subscribe to cards with pagination support
 */
export const subscribeToCardsPaginated = (
  boardId: string,
  columnId: string,
  callback: (cards: Card[], hasMore: boolean) => void,
  initialLimit: number = 50,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'cards'),
    where('isArchived', '==', false),
    where('columnId', '==', columnId),
    orderBy('order', 'asc')
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const allCards = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Card[];
      
      const limitedCards = allCards.slice(0, initialLimit);
      const hasMore = allCards.length > initialLimit;
      
      callback(limitedCards, hasMore);
    },
    (error) => {
      console.error('Error subscribing to paginated cards:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

/**
 * Load more cards for pagination
 */
export const loadMoreCards = async (
  boardId: string,
  columnId: string,
  offset: number,
  limit: number = 50
): Promise<Card[]> => {
  const q = query(
    collection(db, 'boards', boardId, 'cards'),
    where('isArchived', '==', false),
    where('columnId', '==', columnId),
    orderBy('order', 'asc')
  );
  
  const snapshot = await getDocs(q);
  const allCards = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Card[];
  
  return allCards.slice(offset, offset + limit);
};

/**
 * Subscribe to archived cards
 */
export const subscribeToArchivedCards = (
  boardId: string,
  callback: (cards: Card[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'cards'),
    where('isArchived', '==', true),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const cards = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Card[];
      callback(cards);
    },
    (error) => {
      console.error('Error subscribing to archived cards:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

// ============================================================================
// ATTACHMENTS
// ============================================================================

/**
 * Add an attachment to a card
 */
export const addAttachment = async (
  boardId: string,
  cardId: string,
  attachment: Omit<Attachment, 'id' | 'createdAt'>
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentAttachments = cardDoc.data().attachments || [];
    const newAttachment: Attachment = {
      ...attachment,
      id: uuidv4(),
      createdAt: Timestamp.now(),
    };
    
    await updateDoc(cardRef, {
      attachments: [...currentAttachments, newAttachment],
      updatedAt: Timestamp.now(),
    });
  }
};

/**
 * Remove an attachment from a card
 */
export const removeAttachment = async (
  boardId: string,
  cardId: string,
  attachmentId: string
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentAttachments = cardDoc.data().attachments || [];
    const updatedAttachments = currentAttachments.filter(
      (a: Attachment) => a.id !== attachmentId
    );
    
    // Also remove cover if it references this attachment
    const currentCover = cardDoc.data().coverImage;
    const shouldRemoveCover = currentCover?.attachmentId === attachmentId;
    
    await updateDoc(cardRef, {
      attachments: updatedAttachments,
      ...(shouldRemoveCover && { coverImage: null }),
      updatedAt: Timestamp.now(),
    });
  }
};

// ============================================================================
// COVER IMAGE
// ============================================================================

/**
 * Update card cover image
 */
export const updateCardCover = async (
  boardId: string,
  cardId: string,
  cover: CardCover
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  await updateDoc(cardRef, {
    coverImage: cover,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Remove card cover image
 */
export const removeCardCover = async (
  boardId: string,
  cardId: string
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  await updateDoc(cardRef, {
    coverImage: null,
    updatedAt: Timestamp.now(),
  });
};

// ============================================================================
// CHECKLISTS
// ============================================================================

/**
 * Add a checklist to a card
 * @param titleEn - English title (required)
 * @param titleJa - Japanese title (optional, can be auto-translated later)
 * @param titleOriginalLanguage - Which language was originally typed
 */
export const addChecklist = async (
  boardId: string,
  cardId: string,
  titleEn: string,
  titleJa?: string,
  titleOriginalLanguage: 'en' | 'ja' = 'en'
): Promise<string> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  const checklistId = uuidv4();
  const newChecklist: Checklist = {
    id: checklistId,
    title: titleEn, // Keep for backwards compatibility
    titleEn,
    titleJa: titleJa || '',
    titleOriginalLanguage,
    items: [],
  };
  
  if (cardDoc.exists()) {
    const currentChecklists = cardDoc.data().checklists || [];
    await updateDoc(cardRef, {
      checklists: [...currentChecklists, newChecklist],
      updatedAt: Timestamp.now(),
    });
  }
  
  return checklistId;
};

/**
 * Update checklist properties
 */
export const updateChecklist = async (
  boardId: string,
  cardId: string,
  checklistId: string,
  updates: Partial<Pick<Checklist, 'title' | 'titleEn' | 'titleJa' | 'titleOriginalLanguage'>>
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentChecklists: Checklist[] = cardDoc.data().checklists || [];
    const updatedChecklists = currentChecklists.map((checklist) => {
      if (checklist.id === checklistId) {
        const merged = { ...checklist, ...updates };
        // Keep 'title' field in sync with titleEn for backwards compatibility
        if (updates.titleEn !== undefined) {
          merged.title = updates.titleEn;
        }
        return merged;
      }
      return checklist;
    });
    
    await updateDoc(cardRef, {
      checklists: updatedChecklists,
      updatedAt: Timestamp.now(),
    });
  }
};

/**
 * Delete a checklist from a card
 */
export const deleteChecklist = async (
  boardId: string,
  cardId: string,
  checklistId: string
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentChecklists: Checklist[] = cardDoc.data().checklists || [];
    const updatedChecklists = currentChecklists.filter(
      (checklist) => checklist.id !== checklistId
    );
    
    await updateDoc(cardRef, {
      checklists: updatedChecklists,
      updatedAt: Timestamp.now(),
    });
  }
};

/**
 * Add an item to a checklist
 * @param textEn - English text (required)
 * @param textJa - Japanese text (optional, can be auto-translated later)
 * @param textOriginalLanguage - Which language was originally typed
 */
export const addChecklistItem = async (
  boardId: string,
  cardId: string,
  checklistId: string,
  textEn: string,
  textJa?: string,
  textOriginalLanguage: 'en' | 'ja' = 'en'
): Promise<string> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  const itemId = uuidv4();
  
  if (cardDoc.exists()) {
    const currentChecklists: Checklist[] = cardDoc.data().checklists || [];
    const updatedChecklists = currentChecklists.map((checklist) => {
      if (checklist.id === checklistId) {
        const maxOrder = checklist.items.length > 0
          ? Math.max(...checklist.items.map((item) => item.order))
          : -1;
        const newItem: ChecklistItem = {
          id: itemId,
          text: textEn, // Keep for backwards compatibility
          textEn,
          textJa: textJa || '',
          textOriginalLanguage,
          isCompleted: false,
          order: maxOrder + 1,
        };
        return { ...checklist, items: [...checklist.items, newItem] };
      }
      return checklist;
    });
    
    await updateDoc(cardRef, {
      checklists: updatedChecklists,
      updatedAt: Timestamp.now(),
    });
  }
  
  return itemId;
};

/**
 * Update a checklist item
 */
export const updateChecklistItem = async (
  boardId: string,
  cardId: string,
  checklistId: string,
  itemId: string,
  updates: Partial<Pick<ChecklistItem, 'text' | 'textEn' | 'textJa' | 'textOriginalLanguage' | 'isCompleted' | 'assigneeId' | 'dueDate'>>
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentChecklists: Checklist[] = cardDoc.data().checklists || [];
    const updatedChecklists = currentChecklists.map((checklist) => {
      if (checklist.id === checklistId) {
        const updatedItems = checklist.items.map((item) => {
          if (item.id === itemId) {
            const merged = { ...item, ...updates };
            // Keep 'text' field in sync with textEn for backwards compatibility
            if (updates.textEn !== undefined) {
              merged.text = updates.textEn;
            }
            return merged;
          }
          return item;
        }
        );
        return { ...checklist, items: updatedItems };
      }
      return checklist;
    });
    
    await updateDoc(cardRef, {
      checklists: updatedChecklists,
      updatedAt: Timestamp.now(),
    });
  }
};

/**
 * Delete a checklist item
 */
export const deleteChecklistItem = async (
  boardId: string,
  cardId: string,
  checklistId: string,
  itemId: string
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentChecklists: Checklist[] = cardDoc.data().checklists || [];
    const updatedChecklists = currentChecklists.map((checklist) => {
      if (checklist.id === checklistId) {
        const updatedItems = checklist.items.filter((item) => item.id !== itemId);
        return { ...checklist, items: updatedItems };
      }
      return checklist;
    });
    
    await updateDoc(cardRef, {
      checklists: updatedChecklists,
      updatedAt: Timestamp.now(),
    });
  }
};

/**
 * Reorder checklist items
 */
export const reorderChecklistItems = async (
  boardId: string,
  cardId: string,
  checklistId: string,
  itemUpdates: { id: string; order: number }[]
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentChecklists: Checklist[] = cardDoc.data().checklists || [];
    const updatedChecklists = currentChecklists.map((checklist) => {
      if (checklist.id === checklistId) {
        const updatedItems = checklist.items.map((item) => {
          const update = itemUpdates.find((u) => u.id === item.id);
          return update ? { ...item, order: update.order } : item;
        });
        // Sort items by order
        updatedItems.sort((a, b) => a.order - b.order);
        return { ...checklist, items: updatedItems };
      }
      return checklist;
    });
    
    await updateDoc(cardRef, {
      checklists: updatedChecklists,
      updatedAt: Timestamp.now(),
    });
  }
};

// ============================================================================
// WATCH/SUBSCRIBE
// ============================================================================

/**
 * Toggle watch status for a user on a card
 * Returns true if now watching, false if unwatched
 */
export const toggleCardWatch = async (
  boardId: string,
  cardId: string,
  userId: string
): Promise<boolean> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentWatchers: string[] = cardDoc.data().watcherIds || [];
    const isWatching = currentWatchers.includes(userId);
    
    let updatedWatchers: string[];
    if (isWatching) {
      // Remove user from watchers
      updatedWatchers = currentWatchers.filter(id => id !== userId);
    } else {
      // Add user to watchers
      updatedWatchers = [...currentWatchers, userId];
    }
    
    await updateDoc(cardRef, {
      watcherIds: updatedWatchers,
      updatedAt: Timestamp.now(),
    });
    
    return !isWatching; // Return new watch status
  }
  
  return false;
};

/**
 * Add a user as a watcher to a card
 */
export const addCardWatcher = async (
  boardId: string,
  cardId: string,
  userId: string
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentWatchers: string[] = cardDoc.data().watcherIds || [];
    if (!currentWatchers.includes(userId)) {
      await updateDoc(cardRef, {
        watcherIds: [...currentWatchers, userId],
        updatedAt: Timestamp.now(),
      });
    }
  }
};

/**
 * Remove a user as a watcher from a card
 */
export const removeCardWatcher = async (
  boardId: string,
  cardId: string,
  userId: string
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentWatchers: string[] = cardDoc.data().watcherIds || [];
    if (currentWatchers.includes(userId)) {
      await updateDoc(cardRef, {
        watcherIds: currentWatchers.filter(id => id !== userId),
        updatedAt: Timestamp.now(),
      });
    }
  }
};

// ============================================================================
// PERMANENT DELETE
// ============================================================================

/**
 * Permanently delete a card and all its comments
 */
export const permanentlyDeleteCard = async (
  boardId: string,
  cardId: string
): Promise<void> => {
  // Delete all comments for the card first
  const commentsQuery = query(
    collection(db, 'boards', boardId, 'cards', cardId, 'comments')
  );
  const commentsSnapshot = await getDocs(commentsQuery);
  const batch = writeBatch(db);
  
  commentsSnapshot.docs.forEach((commentDoc) => {
    batch.delete(commentDoc.ref);
  });
  
  // Delete the card itself
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  batch.delete(cardRef);
  
  await batch.commit();
};
