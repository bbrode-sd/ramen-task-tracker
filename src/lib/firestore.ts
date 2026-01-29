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
  Timestamp,
  writeBatch,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Board, Column, Card, Comment, Attachment, UserProfile, BoardMember, Checklist, ChecklistItem, Activity, ActivityType, CardTemplate, BoardTemplate, CardCover } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// User cache for avoiding repeated fetches
const userCache = new Map<string, UserProfile>();
const pendingUserFetches = new Map<string, Promise<UserProfile | null>>();

// Get user profile by ID with caching
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

// Get multiple user profiles by IDs with caching
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

// Clear user cache (useful for testing or when user data might have changed)
export const clearUserCache = () => {
  userCache.clear();
};

// Get board members with their profile info
export const getBoardMembers = async (boardId: string): Promise<BoardMember[]> => {
  const boardRef = doc(db, 'boards', boardId);
  const boardDoc = await getDoc(boardRef);
  
  if (!boardDoc.exists()) {
    return [];
  }
  
  const board = { id: boardDoc.id, ...boardDoc.data() } as Board;
  const memberIds = board.memberIds || [];
  
  const usersMap = await getUserProfiles(memberIds);
  return memberIds
    .map((uid) => {
      const profile = usersMap.get(uid);
      if (!profile) return null;
      return {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        isOwner: uid === board.ownerId,
      } as BoardMember;
    })
    .filter((m): m is BoardMember => m !== null);
};

// Board operations
export const createBoard = async (name: string, userId: string): Promise<string> => {
  const boardRef = await addDoc(collection(db, 'boards'), {
    name,
    ownerId: userId,
    memberIds: [userId],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
  });
  return boardRef.id;
};

export const updateBoard = async (boardId: string, updates: Partial<Board>) => {
  const boardRef = doc(db, 'boards', boardId);
  await updateDoc(boardRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const subscribeToBoards = (
  userId: string,
  callback: (boards: Board[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'boards'),
    where('memberIds', 'array-contains', userId),
    where('isArchived', '==', false)
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const boards = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Board[];
      callback(boards);
    },
    (error) => {
      console.error('Error subscribing to boards:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

// Column operations
export const createColumn = async (
  boardId: string,
  name: string,
  order: number
): Promise<string> => {
  const columnRef = await addDoc(collection(db, 'boards', boardId, 'columns'), {
    boardId,
    name,
    order,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
  });
  return columnRef.id;
};

export const updateColumn = async (
  boardId: string,
  columnId: string,
  updates: Partial<Column>
) => {
  const columnRef = doc(db, 'boards', boardId, 'columns', columnId);
  await updateDoc(columnRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const archiveColumn = async (boardId: string, columnId: string) => {
  await updateColumn(boardId, columnId, { isArchived: true });
};

export const restoreColumn = async (boardId: string, columnId: string) => {
  await updateColumn(boardId, columnId, { isArchived: false });
};

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

export const restoreCards = async (boardId: string, cardIds: string[]) => {
  const batch = writeBatch(db);
  
  cardIds.forEach((cardId) => {
    const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
    batch.update(cardRef, { isArchived: false, updatedAt: Timestamp.now() });
  });
  
  await batch.commit();
};

export const subscribeToColumns = (
  boardId: string,
  callback: (columns: Column[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'columns'),
    where('isArchived', '==', false),
    orderBy('order', 'asc')
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const columns = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Column[];
      callback(columns);
    },
    (error) => {
      console.error('Error subscribing to columns:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

// Card operations
export const createCard = async (
  boardId: string,
  columnId: string,
  titleEn: string,
  titleJa: string,
  userId: string,
  order: number
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
  });
  return cardRef.id;
};

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

export const archiveCard = async (boardId: string, cardId: string) => {
  await updateCard(boardId, cardId, { isArchived: true });
};

export const restoreCard = async (boardId: string, cardId: string) => {
  await updateCard(boardId, cardId, { isArchived: false });
};

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

// Performance optimization: Subscribe to cards with optional pagination
// For boards with many cards, limit initial load and paginate
export const subscribeToCards = (
  boardId: string,
  callback: (cards: Card[]) => void,
  options?: {
    limit?: number; // Limit initial cards per query (default: no limit)
    columnId?: string; // Filter by specific column
    onError?: (error: Error) => void; // Error callback
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

// Paginated cards subscription for large boards
// Returns cards in batches with a "load more" capability
export const subscribeToCardsPaginated = (
  boardId: string,
  columnId: string,
  callback: (cards: Card[], hasMore: boolean) => void,
  initialLimit: number = 50
) => {
  const q = query(
    collection(db, 'boards', boardId, 'cards'),
    where('isArchived', '==', false),
    where('columnId', '==', columnId),
    orderBy('order', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const allCards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Card[];
    
    // Return limited cards with hasMore flag
    const limitedCards = allCards.slice(0, initialLimit);
    const hasMore = allCards.length > initialLimit;
    
    callback(limitedCards, hasMore);
  });
};

// Load more cards for a column (for pagination)
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

export const getCard = async (boardId: string, cardId: string): Promise<Card | null> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  if (cardDoc.exists()) {
    return { id: cardDoc.id, ...cardDoc.data() } as Card;
  }
  return null;
};

// Attachment operations
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

// Cover image operations
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

// Checklist operations
export const addChecklist = async (
  boardId: string,
  cardId: string,
  title: string
): Promise<string> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  const checklistId = uuidv4();
  const newChecklist: Checklist = {
    id: checklistId,
    title,
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

export const updateChecklist = async (
  boardId: string,
  cardId: string,
  checklistId: string,
  updates: Partial<Pick<Checklist, 'title'>>
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentChecklists: Checklist[] = cardDoc.data().checklists || [];
    const updatedChecklists = currentChecklists.map((checklist) =>
      checklist.id === checklistId ? { ...checklist, ...updates } : checklist
    );
    
    await updateDoc(cardRef, {
      checklists: updatedChecklists,
      updatedAt: Timestamp.now(),
    });
  }
};

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

export const addChecklistItem = async (
  boardId: string,
  cardId: string,
  checklistId: string,
  text: string
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
          text,
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

export const updateChecklistItem = async (
  boardId: string,
  cardId: string,
  checklistId: string,
  itemId: string,
  updates: Partial<Pick<ChecklistItem, 'text' | 'isCompleted'>>
): Promise<void> => {
  const cardRef = doc(db, 'boards', boardId, 'cards', cardId);
  const cardDoc = await getDoc(cardRef);
  
  if (cardDoc.exists()) {
    const currentChecklists: Checklist[] = cardDoc.data().checklists || [];
    const updatedChecklists = currentChecklists.map((checklist) => {
      if (checklist.id === checklistId) {
        const updatedItems = checklist.items.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item
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

// Comment operations
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
  return commentRef.id;
};

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

export const deleteComment = async (
  boardId: string,
  cardId: string,
  commentId: string
) => {
  const commentRef = doc(db, 'boards', boardId, 'cards', cardId, 'comments', commentId);
  await deleteDoc(commentRef);
};

export const subscribeToComments = (
  boardId: string,
  cardId: string,
  callback: (comments: Comment[]) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'cards', cardId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Comment[];
    callback(comments);
  });
};

// Reorder columns
export const reorderColumns = async (
  boardId: string,
  columnUpdates: { id: string; order: number }[]
) => {
  const batch = writeBatch(db);
  
  columnUpdates.forEach(({ id, order }) => {
    const columnRef = doc(db, 'boards', boardId, 'columns', id);
    batch.update(columnRef, { order, updatedAt: Timestamp.now() });
  });
  
  await batch.commit();
};

// User profile operations
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
    const { setDoc } = await import('firebase/firestore');
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

// Board member operations
export const getBoard = async (boardId: string): Promise<Board | null> => {
  const boardRef = doc(db, 'boards', boardId);
  const boardDoc = await getDoc(boardRef);
  
  if (boardDoc.exists()) {
    return { id: boardDoc.id, ...boardDoc.data() } as Board;
  }
  return null;
};

export const addBoardMember = async (
  boardId: string,
  email: string
): Promise<{ success: boolean; error?: string; member?: BoardMember }> => {
  // Find user by email
  const user = await getUserByEmail(email.toLowerCase());
  
  if (!user) {
    return { success: false, error: 'User not found. They need to sign in first.' };
  }
  
  // Get the board
  const board = await getBoard(boardId);
  if (!board) {
    return { success: false, error: 'Board not found.' };
  }
  
  // Check if already a member
  if (board.memberIds.includes(user.uid)) {
    return { success: false, error: 'User is already a member of this board.' };
  }
  
  // Add user to memberIds
  const boardRef = doc(db, 'boards', boardId);
  await updateDoc(boardRef, {
    memberIds: [...board.memberIds, user.uid],
    updatedAt: Timestamp.now(),
  });
  
  return {
    success: true,
    member: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      isOwner: false,
    },
  };
};

export const removeBoardMember = async (
  boardId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  const board = await getBoard(boardId);
  if (!board) {
    return { success: false, error: 'Board not found.' };
  }
  
  // Can't remove the owner
  if (board.ownerId === userId) {
    return { success: false, error: 'Cannot remove the board owner.' };
  }
  
  // Remove user from memberIds
  const boardRef = doc(db, 'boards', boardId);
  await updateDoc(boardRef, {
    memberIds: board.memberIds.filter((id) => id !== userId),
    updatedAt: Timestamp.now(),
  });
  
  return { success: true };
};

export const subscribeToBoardMembers = (
  boardId: string,
  callback: (members: BoardMember[]) => void
) => {
  const boardRef = doc(db, 'boards', boardId);
  
  return onSnapshot(boardRef, async (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const board = { id: snapshot.id, ...snapshot.data() } as Board;
    const memberIds = board.memberIds || [];
    const usersMap = await getUserProfiles(memberIds);
    
    const members = memberIds
      .map((uid) => {
        const profile = usersMap.get(uid);
        if (!profile) return null;
        return {
          uid: profile.uid,
          email: profile.email,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          isOwner: uid === board.ownerId,
        } as BoardMember;
      })
      .filter((m): m is BoardMember => m !== null);
    
    // Sort so owner is first
    members.sort((a, b) => (b.isOwner ? 1 : 0) - (a.isOwner ? 1 : 0));
    
    callback(members);
  });
};

// Archive operations - subscribe to archived items
export const subscribeToArchivedCards = (
  boardId: string,
  callback: (cards: Card[]) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'cards'),
    where('isArchived', '==', true),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const cards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Card[];
    callback(cards);
  });
};

export const subscribeToArchivedColumns = (
  boardId: string,
  callback: (columns: Column[]) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'columns'),
    where('isArchived', '==', true),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const columns = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Column[];
    callback(columns);
  });
};

// Permanent delete operations
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

export const permanentlyDeleteColumn = async (
  boardId: string,
  columnId: string
): Promise<void> => {
  // Find all cards in this column (including archived ones)
  const cardsQuery = query(
    collection(db, 'boards', boardId, 'cards'),
    where('columnId', '==', columnId)
  );
  const cardsSnapshot = await getDocs(cardsQuery);
  
  // Delete all cards and their comments
  for (const cardDoc of cardsSnapshot.docs) {
    await permanentlyDeleteCard(boardId, cardDoc.id);
  }
  
  // Delete the column
  const columnRef = doc(db, 'boards', boardId, 'columns', columnId);
  await deleteDoc(columnRef);
};

// ============ Card Template Operations ============

export const createCardTemplate = async (
  template: Omit<CardTemplate, 'id' | 'createdAt'>
): Promise<string> => {
  const templateRef = await addDoc(collection(db, 'cardTemplates'), {
    ...template,
    createdAt: Timestamp.now(),
  });
  return templateRef.id;
};

export const getCardTemplates = async (userId: string): Promise<CardTemplate[]> => {
  const q = query(
    collection(db, 'cardTemplates'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CardTemplate[];
};

export const deleteCardTemplate = async (templateId: string): Promise<void> => {
  const templateRef = doc(db, 'cardTemplates', templateId);
  await deleteDoc(templateRef);
};

export const getCardTemplate = async (templateId: string): Promise<CardTemplate | null> => {
  const templateRef = doc(db, 'cardTemplates', templateId);
  const templateDoc = await getDoc(templateRef);
  
  if (templateDoc.exists()) {
    return { id: templateDoc.id, ...templateDoc.data() } as CardTemplate;
  }
  return null;
};

export const createCardFromTemplate = async (
  boardId: string,
  columnId: string,
  templateId: string,
  userId: string,
  order: number
): Promise<string> => {
  const template = await getCardTemplate(templateId);
  if (!template) {
    throw new Error('Template not found');
  }
  
  const cardRef = await addDoc(collection(db, 'boards', boardId, 'cards'), {
    boardId,
    columnId,
    titleEn: template.titleEn,
    titleJa: template.titleJa || '',
    descriptionEn: template.descriptionEn || '',
    descriptionJa: template.descriptionJa || '',
    order,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: userId,
    isArchived: false,
    attachments: [],
    labels: template.labels || [],
    checklists: template.checklists || [],
  });
  
  return cardRef.id;
};

// ============ Board Template Operations ============

// Built-in board templates
export const BUILT_IN_BOARD_TEMPLATES: Omit<BoardTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'Sprint Board',
    description: 'Agile sprint workflow with backlog, progress tracking, and review stages',
    columns: [
      { name: 'Backlog', order: 0 },
      { name: 'To Do', order: 1 },
      { name: 'In Progress', order: 2 },
      { name: 'Review', order: 3 },
      { name: 'Done', order: 4 },
    ],
    isBuiltIn: true,
  },
  {
    name: 'Simple Kanban',
    description: 'Basic three-column workflow for straightforward task management',
    columns: [
      { name: 'To Do', order: 0 },
      { name: 'Doing', order: 1 },
      { name: 'Done', order: 2 },
    ],
    isBuiltIn: true,
  },
  {
    name: 'Bug Tracker',
    description: 'Track bugs from report through verification with dedicated stages',
    columns: [
      { name: 'Reported', order: 0 },
      { name: 'Triaged', order: 1 },
      { name: 'In Progress', order: 2 },
      { name: 'Fixed', order: 3 },
      { name: 'Verified', order: 4 },
    ],
    isBuiltIn: true,
  },
];

export const createBoardTemplate = async (
  template: Omit<BoardTemplate, 'id' | 'createdAt' | 'isBuiltIn'>
): Promise<string> => {
  const templateRef = await addDoc(collection(db, 'boardTemplates'), {
    ...template,
    isBuiltIn: false,
    createdAt: Timestamp.now(),
  });
  return templateRef.id;
};

export const getBoardTemplates = async (userId: string): Promise<BoardTemplate[]> => {
  // Get user's custom templates
  const q = query(
    collection(db, 'boardTemplates'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const userTemplates = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as BoardTemplate[];
  
  // Add built-in templates with generated IDs
  const builtInTemplates: BoardTemplate[] = BUILT_IN_BOARD_TEMPLATES.map((t, index) => ({
    ...t,
    id: `built-in-${index}`,
    createdAt: Timestamp.now(),
  }));
  
  return [...builtInTemplates, ...userTemplates];
};

export const deleteBoardTemplate = async (templateId: string): Promise<void> => {
  if (templateId.startsWith('built-in-')) {
    throw new Error('Cannot delete built-in templates');
  }
  const templateRef = doc(db, 'boardTemplates', templateId);
  await deleteDoc(templateRef);
};

export const createBoardFromTemplate = async (
  templateId: string,
  boardName: string,
  userId: string
): Promise<string> => {
  let columns: { name: string; order: number }[];
  
  // Check if it's a built-in template
  if (templateId.startsWith('built-in-')) {
    const index = parseInt(templateId.replace('built-in-', ''), 10);
    const builtInTemplate = BUILT_IN_BOARD_TEMPLATES[index];
    if (!builtInTemplate) {
      throw new Error('Built-in template not found');
    }
    columns = builtInTemplate.columns;
  } else {
    // Fetch user template
    const templateRef = doc(db, 'boardTemplates', templateId);
    const templateDoc = await getDoc(templateRef);
    
    if (!templateDoc.exists()) {
      throw new Error('Template not found');
    }
    
    const template = templateDoc.data() as BoardTemplate;
    columns = template.columns;
  }
  
  // Create the board
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: boardName,
    ownerId: userId,
    memberIds: [userId],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
  });
  
  // Create the columns
  const batch = writeBatch(db);
  columns.forEach((col) => {
    const columnRef = doc(collection(db, 'boards', boardRef.id, 'columns'));
    batch.set(columnRef, {
      boardId: boardRef.id,
      name: col.name,
      order: col.order,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isArchived: false,
    });
  });
  
  await batch.commit();
  
  return boardRef.id;
};

// Activity logging operations
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
      cardId: activity.cardId || null,
      cardTitle: activity.cardTitle || null,
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

export const subscribeToCardActivities = (
  boardId: string,
  cardId: string,
  callback: (activities: Activity[]) => void,
  limitCount: number = 50
) => {
  const q = query(
    collection(db, 'boards', boardId, 'activities'),
    where('cardId', '==', cardId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs
      .slice(0, limitCount)
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Activity[];
    callback(activities);
  });
};

export const subscribeToBoardActivities = (
  boardId: string,
  callback: (activities: Activity[]) => void,
  limitCount: number = 100
) => {
  const q = query(
    collection(db, 'boards', boardId, 'activities'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs
      .slice(0, limitCount)
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Activity[];
    callback(activities);
  });
};
