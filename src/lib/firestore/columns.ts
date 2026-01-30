/**
 * Column operations for Kanban boards
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
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Column } from '@/types';

/**
 * Create a new column in a board
 */
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

/**
 * Update column properties
 */
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

/**
 * Archive a column (soft delete)
 */
export const archiveColumn = async (boardId: string, columnId: string) => {
  await updateColumn(boardId, columnId, { isArchived: true });
};

/**
 * Restore an archived column
 */
export const restoreColumn = async (boardId: string, columnId: string) => {
  await updateColumn(boardId, columnId, { isArchived: false });
};

/**
 * Reorder multiple columns at once
 */
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

/**
 * Subscribe to columns in a board (real-time updates)
 */
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

/**
 * Subscribe to archived columns in a board
 */
export const subscribeToArchivedColumns = (
  boardId: string,
  callback: (columns: Column[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'boards', boardId, 'columns'),
    where('isArchived', '==', true),
    orderBy('updatedAt', 'desc')
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
      console.error('Error subscribing to archived columns:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

/**
 * Permanently delete a column and all its cards
 * Note: This also deletes all cards in the column
 */
export const permanentlyDeleteColumn = async (
  boardId: string,
  columnId: string
): Promise<void> => {
  // Import here to avoid circular dependency
  const { permanentlyDeleteCard } = await import('./cards');
  
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
