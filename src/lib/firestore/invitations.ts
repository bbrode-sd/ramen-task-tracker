/**
 * Pending invitation operations for email-based board invitations
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { PendingInvitation } from '@/types';

// ============================================================================
// PENDING INVITATIONS
// ============================================================================

/**
 * Create a pending invitation for a user who hasn't signed up yet
 */
export const createPendingInvitation = async (
  email: string,
  boardId: string,
  boardName: string,
  invitedBy: string,
  invitedByName: string,
  invitedByEmail: string
): Promise<string> => {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if there's already a pending invitation for this email and board
  const existingQuery = query(
    collection(db, 'pendingInvitations'),
    where('email', '==', normalizedEmail),
    where('boardId', '==', boardId),
    where('status', '==', 'pending')
  );
  
  const existingSnapshot = await getDocs(existingQuery);
  if (!existingSnapshot.empty) {
    // Return existing invitation ID
    return existingSnapshot.docs[0].id;
  }
  
  const invitationRef = await addDoc(collection(db, 'pendingInvitations'), {
    email: normalizedEmail,
    boardId,
    boardName,
    invitedBy,
    invitedByName,
    invitedByEmail,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  return invitationRef.id;
};

/**
 * Get pending invitations for an email address
 */
export const getPendingInvitationsForEmail = async (
  email: string
): Promise<PendingInvitation[]> => {
  const normalizedEmail = email.toLowerCase().trim();
  
  const q = query(
    collection(db, 'pendingInvitations'),
    where('email', '==', normalizedEmail),
    where('status', '==', 'pending')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PendingInvitation[];
};

/**
 * Get pending invitations for a board
 */
export const getPendingInvitationsForBoard = async (
  boardId: string
): Promise<PendingInvitation[]> => {
  const q = query(
    collection(db, 'pendingInvitations'),
    where('boardId', '==', boardId),
    where('status', '==', 'pending')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PendingInvitation[];
};

/**
 * Subscribe to pending invitations for a board
 */
export const subscribeToPendingInvitations = (
  boardId: string,
  callback: (invitations: PendingInvitation[]) => void
) => {
  const q = query(
    collection(db, 'pendingInvitations'),
    where('boardId', '==', boardId),
    where('status', '==', 'pending')
  );
  
  return onSnapshot(q, (snapshot) => {
    const invitations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PendingInvitation[];
    callback(invitations);
  });
};

/**
 * Mark an invitation as accepted
 */
export const acceptPendingInvitation = async (invitationId: string): Promise<void> => {
  const invitationRef = doc(db, 'pendingInvitations', invitationId);
  await updateDoc(invitationRef, {
    status: 'accepted',
    acceptedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

/**
 * Cancel/delete a pending invitation
 */
export const cancelPendingInvitation = async (invitationId: string): Promise<void> => {
  const invitationRef = doc(db, 'pendingInvitations', invitationId);
  await deleteDoc(invitationRef);
};

/**
 * Process all pending invitations for a newly signed-up user
 * Adds them to all boards they were invited to and marks invitations as accepted
 */
export const processPendingInvitationsForUser = async (
  userId: string,
  email: string
): Promise<{ boardsAdded: string[]; count: number }> => {
  const invitations = await getPendingInvitationsForEmail(email);
  const boardsAdded: string[] = [];
  
  for (const invitation of invitations) {
    try {
      // Add user to the board's memberIds
      const boardRef = doc(db, 'boards', invitation.boardId);
      const { getDoc: getBoardDoc, updateDoc: updateBoardDoc } = await import('firebase/firestore');
      const boardSnapshot = await getBoardDoc(boardRef);
      
      if (boardSnapshot.exists()) {
        const boardData = boardSnapshot.data();
        const currentMemberIds = boardData.memberIds || [];
        
        // Only add if not already a member
        if (!currentMemberIds.includes(userId)) {
          await updateBoardDoc(boardRef, {
            memberIds: [...currentMemberIds, userId],
            updatedAt: Timestamp.now(),
          });
          boardsAdded.push(invitation.boardId);
        }
      }
      
      // Mark invitation as accepted
      await acceptPendingInvitation(invitation.id);
    } catch (error) {
      console.error(`Error processing invitation ${invitation.id}:`, error);
      // Continue with other invitations even if one fails
    }
  }
  
  return { boardsAdded, count: boardsAdded.length };
};
