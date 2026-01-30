/**
 * Board operations including CRUD, subscriptions, and member management
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Board, BoardMember } from '@/types';
import { getUserProfiles, getUserByEmail } from './users';

// ============================================================================
// BOARD CRUD
// ============================================================================

/**
 * Create a new board
 */
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

/**
 * Update board properties
 */
export const updateBoard = async (boardId: string, updates: Partial<Board>) => {
  const boardRef = doc(db, 'boards', boardId);
  await updateDoc(boardRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Get a single board by ID
 */
export const getBoard = async (boardId: string): Promise<Board | null> => {
  const boardRef = doc(db, 'boards', boardId);
  const boardDoc = await getDoc(boardRef);
  
  if (boardDoc.exists()) {
    return { id: boardDoc.id, ...boardDoc.data() } as Board;
  }
  return null;
};

/**
 * Subscribe to user's boards (real-time updates)
 */
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

// ============================================================================
// BOARD MEMBERS
// ============================================================================

/**
 * Get board members with their profile info
 */
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

/**
 * Add a member to the board by email
 */
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

/**
 * Remove a member from the board
 */
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

/**
 * Subscribe to board members (real-time updates)
 */
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
