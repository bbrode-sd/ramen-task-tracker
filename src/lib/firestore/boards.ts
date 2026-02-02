/**
 * Board operations including CRUD, subscriptions, and member management
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Board, BoardMember, SubBoardTemplate } from '@/types';
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
 * If user doesn't exist yet, creates a pending invitation and optionally sends an email
 */
export const addBoardMember = async (
  boardId: string,
  email: string,
  inviter?: { uid: string; displayName: string | null; email: string | null }
): Promise<{ 
  success: boolean; 
  error?: string; 
  member?: BoardMember;
  pendingInvitation?: boolean;
  invitationId?: string;
}> => {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Get the board first (needed for both paths)
  let board;
  try {
    board = await getBoard(boardId);
  } catch (error) {
    console.error('Error getting board:', error);
    return { success: false, error: 'Failed to access board. Please try again.' };
  }
  
  if (!board) {
    return { success: false, error: 'Board not found.' };
  }
  
  // Find user by email
  let user;
  try {
    user = await getUserByEmail(normalizedEmail);
  } catch (error) {
    console.error('Error looking up user by email:', error);
    return { success: false, error: 'Failed to look up user. Please try again.' };
  }
  
  // If user doesn't exist, create a pending invitation
  if (!user) {
    if (!inviter) {
      return { success: false, error: 'Inviter information required for pending invitations.' };
    }
    
    try {
      // Import the invitation function dynamically to avoid circular dependencies
      const { createPendingInvitation } = await import('./invitations');
      
      const invitationId = await createPendingInvitation(
        normalizedEmail,
        boardId,
        board.name,
        inviter.uid,
        inviter.displayName || inviter.email || 'A Tomobodo user',
        inviter.email || ''
      );
      
      // Send invitation email via API
      try {
        const response = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            boardId,
            boardName: board.name,
            inviterName: inviter.displayName || inviter.email || 'A Tomobodo user',
            inviterEmail: inviter.email || '',
          }),
        });
        
        if (!response.ok) {
          console.warn('Failed to send invitation email, but invitation was created');
        }
      } catch (emailError) {
        console.warn('Failed to send invitation email:', emailError);
        // Don't fail the whole operation if email fails
      }
      
      return {
        success: true,
        pendingInvitation: true,
        invitationId,
      };
    } catch (error) {
      console.error('Error creating pending invitation:', error);
      return { success: false, error: 'Failed to create invitation. Please try again.' };
    }
  }
  
  // Check if already a member
  if (board.memberIds.includes(user.uid)) {
    return { success: false, error: 'User is already a member of this board.' };
  }
  
  // Add user to memberIds (only board owner can do this)
  try {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, {
      memberIds: [...board.memberIds, user.uid],
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating board members:', error);
    // Check if it's a permissions error (likely means user is not the owner)
    if (error instanceof Error && error.message.includes('permission')) {
      return { success: false, error: 'Only the board owner can add members.' };
    }
    return { success: false, error: 'Failed to add member. Please try again.' };
  }
  
  // Propagate member addition to all sub-boards and template boards
  await propagateMemberAddition(boardId, user.uid);
  
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
  
  // Propagate member removal to all sub-boards and template boards
  await propagateMemberRemoval(boardId, userId);
  
  return { success: true };
};

/**
 * Get all child boards (sub-boards and template boards) for a parent board
 * This is used to propagate member changes
 */
const getChildBoards = async (parentBoardId: string): Promise<Board[]> => {
  const childBoards: Board[] = [];
  
  // Get sub-boards (boards with parentBoardId)
  const subBoardsQuery = query(
    collection(db, 'boards'),
    where('parentBoardId', '==', parentBoardId),
    where('isArchived', '==', false)
  );
  const subBoardsSnapshot = await getDocs(subBoardsQuery);
  subBoardsSnapshot.docs.forEach((doc) => {
    childBoards.push({ id: doc.id, ...doc.data() } as Board);
  });
  
  // Get template boards (boards with templateForBoardId)
  const templateBoardsQuery = query(
    collection(db, 'boards'),
    where('templateForBoardId', '==', parentBoardId),
    where('isArchived', '==', false)
  );
  const templateBoardsSnapshot = await getDocs(templateBoardsQuery);
  templateBoardsSnapshot.docs.forEach((doc) => {
    childBoards.push({ id: doc.id, ...doc.data() } as Board);
  });
  
  return childBoards;
};

/**
 * Propagate a member addition to all sub-boards and template boards (recursively)
 * This ensures that when a member is added to a parent board,
 * they also gain access to all existing sub-boards, templates, and nested sub-boards
 */
const propagateMemberAddition = async (parentBoardId: string, userId: string): Promise<void> => {
  try {
    const childBoards = await getChildBoards(parentBoardId);
    
    for (const childBoard of childBoards) {
      // Skip if user is already a member
      if (childBoard.memberIds.includes(userId)) {
        continue;
      }
      
      const boardRef = doc(db, 'boards', childBoard.id);
      await updateDoc(boardRef, {
        memberIds: [...childBoard.memberIds, userId],
        updatedAt: Timestamp.now(),
      });
      
      // Recursively propagate to nested sub-boards
      await propagateMemberAddition(childBoard.id, userId);
    }
  } catch (error) {
    // Log but don't fail the parent operation
    console.error('Error propagating member addition to child boards:', error);
  }
};

/**
 * Propagate a member removal to all sub-boards and template boards (recursively)
 * This ensures that when a member is removed from a parent board,
 * they also lose access to all existing sub-boards, templates, and nested sub-boards
 */
const propagateMemberRemoval = async (parentBoardId: string, userId: string): Promise<void> => {
  try {
    const childBoards = await getChildBoards(parentBoardId);
    
    for (const childBoard of childBoards) {
      // Skip if user is not a member
      if (!childBoard.memberIds.includes(userId)) {
        continue;
      }
      
      // Don't remove the owner of the sub-board
      if (childBoard.ownerId === userId) {
        continue;
      }
      
      const boardRef = doc(db, 'boards', childBoard.id);
      await updateDoc(boardRef, {
        memberIds: childBoard.memberIds.filter((id) => id !== userId),
        updatedAt: Timestamp.now(),
      });
      
      // Recursively propagate to nested sub-boards
      await propagateMemberRemoval(childBoard.id, userId);
    }
  } catch (error) {
    // Log but don't fail the parent operation
    console.error('Error propagating member removal to child boards:', error);
  }
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

// ============================================================================
// SUB-BOARDS
// ============================================================================

/**
 * Create a sub-board for a card
 * The sub-board is linked to the parent card and parent board
 */
export const createSubBoard = async (
  parentCardId: string,
  parentBoardId: string,
  name: string,
  userId: string,
  approvalColumnName: string = 'Approved'
): Promise<string> => {
  // Get the parent board to inherit memberIds
  const parentBoard = await getBoard(parentBoardId);
  if (!parentBoard) {
    throw new Error('Parent board not found');
  }

  // Verify current user is in memberIds (required by security rules)
  if (!parentBoard.memberIds.includes(userId)) {
    throw new Error('User is not a member of the parent board');
  }

  // Truncate name to 200 characters (security rule limit for board names)
  const truncatedName = name.length > 200 ? name.substring(0, 197) + '...' : name;

  const boardRef = await addDoc(collection(db, 'boards'), {
    name: truncatedName,
    ownerId: userId,
    memberIds: parentBoard.memberIds, // Inherit members from parent board
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
    parentCardId,
    parentBoardId,
    approvalColumnName,
  });

  // Update the parent card with the subBoardId
  const cardRef = doc(db, 'boards', parentBoardId, 'cards', parentCardId);
  await updateDoc(cardRef, {
    subBoardId: boardRef.id,
    subBoardApprovedCount: 0,
    subBoardTotalCount: 0,
    updatedAt: Timestamp.now(),
  });

  return boardRef.id;
};

/**
 * Create a sub-board from a template
 * Creates the board, columns, and pre-populated cards
 */
export const createSubBoardFromTemplate = async (
  parentCardId: string,
  parentBoardId: string,
  template: SubBoardTemplate,
  userId: string
): Promise<string> => {
  // Get the parent board to inherit memberIds
  const parentBoard = await getBoard(parentBoardId);
  if (!parentBoard) {
    throw new Error('Parent board not found');
  }

  // Verify current user is in memberIds (required by security rules)
  if (!parentBoard.memberIds.includes(userId)) {
    throw new Error('User is not a member of the parent board');
  }

  // Truncate template name to 200 characters (security rule limit for board names)
  const truncatedName = template.name.length > 200 
    ? template.name.substring(0, 197) + '...' 
    : template.name;

  // Create the sub-board
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: truncatedName,
    ownerId: userId,
    memberIds: parentBoard.memberIds,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
    parentCardId,
    parentBoardId,
    approvalColumnName: template.approvalColumnName || 'Approved',
  });

  const subBoardId = boardRef.id;

  // Create columns and cards sequentially to avoid race conditions with security rules
  // The security rules use get() to check board membership, which requires the board to be fully propagated
  const columnIdMap: Map<number, string> = new Map();

  // Create columns one by one
  for (const col of template.columns) {
    const columnRef = await addDoc(collection(db, 'boards', subBoardId, 'columns'), {
      boardId: subBoardId,
      name: col.nameEn, // Use English name as the primary column name
      nameJa: col.nameJa,
      nameOriginalLanguage: 'en',
      order: col.order,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isArchived: false,
    });
    columnIdMap.set(col.order, columnRef.id);
  }

  // Create cards for each column
  for (const col of template.columns) {
    const columnId = columnIdMap.get(col.order);
    if (columnId && col.cards) {
      for (const card of col.cards) {
        await addDoc(collection(db, 'boards', subBoardId, 'cards'), {
          boardId: subBoardId,
          columnId,
          titleEn: card.titleEn,
          titleJa: card.titleJa,
          descriptionEn: '',
          descriptionJa: '',
          order: card.order,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: userId,
          isArchived: false,
          attachments: [],
          labels: [],
        });
      }
    }
  }

  // Update the parent card with the subBoardId and initial counts
  // Count the pre-created cards from template
  const initialTotalCount = template.columns.reduce(
    (count, col) => count + (col.cards?.length || 0),
    0
  );
  const cardRef = doc(db, 'boards', parentBoardId, 'cards', parentCardId);
  await updateDoc(cardRef, {
    subBoardId,
    subBoardApprovedCount: 0,
    subBoardTotalCount: initialTotalCount,
    updatedAt: Timestamp.now(),
  });

  return subBoardId;
};

/**
 * Get the sub-board for a card (if one exists)
 * @param cardId - The parent card ID
 * @param userId - The current user's ID (required for security rules)
 */
export const getSubBoardForCard = async (cardId: string, userId: string): Promise<Board | null> => {
  // Query must include memberIds filter to satisfy security rules
  // Security rules require: currentUserId() in resource.data.memberIds
  const q = query(
    collection(db, 'boards'),
    where('parentCardId', '==', cardId),
    where('memberIds', 'array-contains', userId),
    where('isArchived', '==', false)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Board;
};

/**
 * Subscribe to a sub-board (real-time updates)
 * @param cardId - The parent card ID
 * @param userId - The current user's ID (required for security rules)
 * @param callback - Called with the sub-board or null
 * @param onError - Called on error
 */
export const subscribeToSubBoard = (
  cardId: string,
  userId: string,
  callback: (board: Board | null) => void,
  onError?: (error: Error) => void
) => {
  // Query must include memberIds filter to satisfy security rules
  // Security rules require: currentUserId() in resource.data.memberIds
  const q = query(
    collection(db, 'boards'),
    where('parentCardId', '==', cardId),
    where('memberIds', 'array-contains', userId),
    where('isArchived', '==', false)
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback(null);
        return;
      }
      const boardDoc = snapshot.docs[0];
      callback({ id: boardDoc.id, ...boardDoc.data() } as Board);
    },
    (error) => {
      console.error('Error subscribing to sub-board:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

/**
 * Subscribe to boards for a user, excluding sub-boards and templates
 */
export const subscribeToBoardsExcludingSubBoards = (
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
      const allBoards = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Board[];
      // Filter out sub-boards (boards with parentCardId) and templates
      const boards = allBoards.filter((board) => !board.parentCardId && !board.isTemplate);
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
// TEMPLATE BOARDS
// ============================================================================

/**
 * Get all template boards for a given board
 * Templates are real boards with isTemplate=true and templateForBoardId set
 */
export const getTemplateBoardsForBoard = async (
  boardId: string,
  userId: string
): Promise<Board[]> => {
  const q = query(
    collection(db, 'boards'),
    where('templateForBoardId', '==', boardId),
    where('isTemplate', '==', true),
    where('memberIds', 'array-contains', userId),
    where('isArchived', '==', false)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Board[];
};

/**
 * Create a new template board for a parent board
 */
export const createTemplateBoard = async (
  parentBoardId: string,
  name: string,
  userId: string
): Promise<string> => {
  // Get the parent board to inherit memberIds
  const parentBoard = await getBoard(parentBoardId);
  if (!parentBoard) {
    throw new Error('Parent board not found');
  }

  // Truncate name to 200 characters (security rule limit for board names)
  const truncatedName = name.length > 200 ? name.substring(0, 197) + '...' : name;

  const boardRef = await addDoc(collection(db, 'boards'), {
    name: truncatedName,
    ownerId: userId,
    memberIds: parentBoard.memberIds,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
    isTemplate: true,
    templateForBoardId: parentBoardId,
  });

  return boardRef.id;
};

/**
 * Clone a template board to create a sub-board
 * Copies all columns and cards from the template
 */
export const cloneTemplateBoardAsSubBoard = async (
  templateBoardId: string,
  parentCardId: string,
  parentBoardId: string,
  userId: string
): Promise<string> => {
  // Get the template board
  const templateBoard = await getBoard(templateBoardId);
  if (!templateBoard) {
    throw new Error('Template board not found');
  }

  // Get the parent board to inherit memberIds
  const parentBoard = await getBoard(parentBoardId);
  if (!parentBoard) {
    throw new Error('Parent board not found');
  }

  // Verify current user is in memberIds
  if (!parentBoard.memberIds.includes(userId)) {
    throw new Error('User is not a member of the parent board');
  }

  // Truncate name to 200 characters
  const truncatedName = templateBoard.name.length > 200 
    ? templateBoard.name.substring(0, 197) + '...' 
    : templateBoard.name;

  // Create the sub-board
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: truncatedName,
    ownerId: userId,
    memberIds: parentBoard.memberIds,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
    parentCardId,
    parentBoardId,
    approvalColumnName: templateBoard.approvalColumnName || 'Approved',
  });

  const subBoardId = boardRef.id;

  // Get template's columns
  const columnsSnapshot = await getDocs(
    query(
      collection(db, 'boards', templateBoardId, 'columns'),
      where('isArchived', '==', false)
    )
  );

  // Create a map of old column ID -> new column ID
  const columnIdMap = new Map<string, string>();

  // Clone columns one by one
  for (const colDoc of columnsSnapshot.docs) {
    const colData = colDoc.data();
    const newColRef = await addDoc(collection(db, 'boards', subBoardId, 'columns'), {
      boardId: subBoardId,
      name: colData.name,
      nameJa: colData.nameJa || '',
      nameOriginalLanguage: colData.nameOriginalLanguage || 'en',
      order: colData.order,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isArchived: false,
    });
    columnIdMap.set(colDoc.id, newColRef.id);
  }

  // Get template's cards
  const cardsSnapshot = await getDocs(
    query(
      collection(db, 'boards', templateBoardId, 'cards'),
      where('isArchived', '==', false)
    )
  );

  // Clone cards one by one
  for (const cardDoc of cardsSnapshot.docs) {
    const cardData = cardDoc.data();
    const newColumnId = columnIdMap.get(cardData.columnId);
    if (!newColumnId) continue; // Skip if column wasn't cloned

    await addDoc(collection(db, 'boards', subBoardId, 'cards'), {
      boardId: subBoardId,
      columnId: newColumnId,
      titleEn: cardData.titleEn || '',
      titleJa: cardData.titleJa || '',
      titleDetectedLanguage: cardData.titleDetectedLanguage || 'en',
      descriptionEn: cardData.descriptionEn || '',
      descriptionJa: cardData.descriptionJa || '',
      order: cardData.order,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      isArchived: false,
      attachments: [], // Don't copy attachments
      labels: cardData.labels || [],
      checklists: cardData.checklists || [],
    });
  }

  // Update the parent card with the subBoardId
  const cardRef = doc(db, 'boards', parentBoardId, 'cards', parentCardId);
  await updateDoc(cardRef, {
    subBoardId,
    subBoardApprovedCount: 0,
    subBoardTotalCount: cardsSnapshot.size,
    updatedAt: Timestamp.now(),
  });

  return subBoardId;
};

/**
 * Remove a sub-board from a card
 * This unlinks the sub-board from the parent card and archives the sub-board
 * @param parentBoardId - The parent board ID
 * @param parentCardId - The parent card ID
 * @param subBoardId - The sub-board ID to remove
 */
export const removeSubBoard = async (
  parentBoardId: string,
  parentCardId: string,
  subBoardId: string
): Promise<void> => {
  // Clear the subBoardId from the parent card
  const cardRef = doc(db, 'boards', parentBoardId, 'cards', parentCardId);
  await updateDoc(cardRef, {
    subBoardId: null,
    subBoardApprovedCount: null,
    subBoardTotalCount: null,
    updatedAt: Timestamp.now(),
  });

  // Archive the sub-board (don't delete it in case user wants to recover)
  // Note: We don't clear parentCardId because security rules prevent changing it after creation
  const subBoardRef = doc(db, 'boards', subBoardId);
  await updateDoc(subBoardRef, {
    isArchived: true,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Delete a template board
 */
export const deleteTemplateBoard = async (templateBoardId: string): Promise<void> => {
  // Get all columns and cards and delete them
  const columnsSnapshot = await getDocs(collection(db, 'boards', templateBoardId, 'columns'));
  for (const colDoc of columnsSnapshot.docs) {
    await deleteDoc(colDoc.ref);
  }

  const cardsSnapshot = await getDocs(collection(db, 'boards', templateBoardId, 'cards'));
  for (const cardDoc of cardsSnapshot.docs) {
    await deleteDoc(cardDoc.ref);
  }

  // Delete the board itself
  await deleteDoc(doc(db, 'boards', templateBoardId));
};
