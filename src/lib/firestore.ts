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
import { Board, Column, Card, Comment, Attachment } from '@/types';
import { v4 as uuidv4 } from 'uuid';

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
  callback: (boards: Board[]) => void
) => {
  const q = query(
    collection(db, 'boards'),
    where('memberIds', 'array-contains', userId),
    where('isArchived', '==', false)
  );
  
  return onSnapshot(q, (snapshot) => {
    const boards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Board[];
    callback(boards);
  });
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

export const archiveAllCardsInColumn = async (boardId: string, columnId: string) => {
  const cardsQuery = query(
    collection(db, 'boards', boardId, 'cards'),
    where('columnId', '==', columnId),
    where('isArchived', '==', false)
  );
  
  const snapshot = await getDocs(cardsQuery);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach((cardDoc) => {
    batch.update(cardDoc.ref, { isArchived: true, updatedAt: Timestamp.now() });
  });
  
  await batch.commit();
};

export const subscribeToColumns = (
  boardId: string,
  callback: (columns: Column[]) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'columns'),
    where('isArchived', '==', false),
    orderBy('order', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const columns = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Column[];
    callback(columns);
  });
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

export const subscribeToCards = (
  boardId: string,
  callback: (cards: Card[]) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'cards'),
    where('isArchived', '==', false),
    orderBy('order', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const cards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Card[];
    callback(cards);
  });
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
    
    await updateDoc(cardRef, {
      attachments: updatedAttachments,
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
  attachments: Attachment[] = []
): Promise<string> => {
  const commentRef = await addDoc(
    collection(db, 'boards', boardId, 'cards', cardId, 'comments'),
    {
      cardId,
      content,
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
