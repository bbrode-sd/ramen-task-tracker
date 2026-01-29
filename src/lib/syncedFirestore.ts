'use client';

import { useCallback } from 'react';
import { useSync } from '@/contexts/SyncContext';
import { useToast } from '@/contexts/ToastContext';
import * as firestore from './firestore';
import { Board, Column, Card, Attachment } from '@/types';

// Hook that provides synced versions of firestore operations
export function useSyncedFirestore() {
  const { startSync, endSync, setRetryHandler } = useSync();
  const { showToast } = useToast();

  // Generic wrapper for any async operation
  const withSync = useCallback(
    async <T>(
      operation: () => Promise<T>,
      errorMessage: string = 'Operation failed'
    ): Promise<T> => {
      startSync();
      try {
        const result = await operation();
        endSync(true);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        endSync(false, err);
        
        // Set up retry handler for the failed operation
        setRetryHandler(async () => {
          await withSync(operation, errorMessage);
        });
        
        showToast('error', errorMessage, {
          duration: 8000,
        });
        
        throw error;
      }
    },
    [startSync, endSync, setRetryHandler, showToast]
  );

  // Board operations
  const createBoard = useCallback(
    (name: string, userId: string) =>
      withSync(
        () => firestore.createBoard(name, userId),
        'Failed to create board'
      ),
    [withSync]
  );

  const updateBoard = useCallback(
    (boardId: string, updates: Partial<Board>) =>
      withSync(
        () => firestore.updateBoard(boardId, updates),
        'Failed to update board'
      ),
    [withSync]
  );

  // Column operations
  const createColumn = useCallback(
    (boardId: string, name: string, order: number) =>
      withSync(
        () => firestore.createColumn(boardId, name, order),
        'Failed to create column'
      ),
    [withSync]
  );

  const updateColumn = useCallback(
    (boardId: string, columnId: string, updates: Partial<Column>) =>
      withSync(
        () => firestore.updateColumn(boardId, columnId, updates),
        'Failed to update column'
      ),
    [withSync]
  );

  const archiveColumn = useCallback(
    (boardId: string, columnId: string) =>
      withSync(
        () => firestore.archiveColumn(boardId, columnId),
        'Failed to archive column'
      ),
    [withSync]
  );

  const restoreColumn = useCallback(
    (boardId: string, columnId: string) =>
      withSync(
        () => firestore.restoreColumn(boardId, columnId),
        'Failed to restore column'
      ),
    [withSync]
  );

  const archiveAllCardsInColumn = useCallback(
    (boardId: string, columnId: string) =>
      withSync(
        () => firestore.archiveAllCardsInColumn(boardId, columnId),
        'Failed to archive cards'
      ),
    [withSync]
  );

  const restoreCards = useCallback(
    (boardId: string, cardIds: string[]) =>
      withSync(
        () => firestore.restoreCards(boardId, cardIds),
        'Failed to restore cards'
      ),
    [withSync]
  );

  const reorderColumns = useCallback(
    (boardId: string, columnUpdates: { id: string; order: number }[]) =>
      withSync(
        () => firestore.reorderColumns(boardId, columnUpdates),
        'Failed to reorder columns'
      ),
    [withSync]
  );

  // Card operations
  const createCard = useCallback(
    (
      boardId: string,
      columnId: string,
      titleEn: string,
      titleJa: string,
      userId: string,
      order: number
    ) =>
      withSync(
        () => firestore.createCard(boardId, columnId, titleEn, titleJa, userId, order),
        'Failed to create card'
      ),
    [withSync]
  );

  const updateCard = useCallback(
    (boardId: string, cardId: string, updates: Partial<Card>) =>
      withSync(
        () => firestore.updateCard(boardId, cardId, updates),
        'Failed to update card'
      ),
    [withSync]
  );

  const archiveCard = useCallback(
    (boardId: string, cardId: string) =>
      withSync(
        () => firestore.archiveCard(boardId, cardId),
        'Failed to archive card'
      ),
    [withSync]
  );

  const restoreCard = useCallback(
    (boardId: string, cardId: string) =>
      withSync(
        () => firestore.restoreCard(boardId, cardId),
        'Failed to restore card'
      ),
    [withSync]
  );

  const moveCard = useCallback(
    (boardId: string, cardId: string, newColumnId: string, newOrder: number) =>
      withSync(
        () => firestore.moveCard(boardId, cardId, newColumnId, newOrder),
        'Failed to move card'
      ),
    [withSync]
  );

  const reorderCards = useCallback(
    (boardId: string, cardUpdates: { id: string; order: number; columnId?: string }[]) =>
      withSync(
        () => firestore.reorderCards(boardId, cardUpdates),
        'Failed to reorder cards'
      ),
    [withSync]
  );

  // Attachment operations
  const addAttachment = useCallback(
    (boardId: string, cardId: string, attachment: Omit<Attachment, 'id' | 'createdAt'>) =>
      withSync(
        () => firestore.addAttachment(boardId, cardId, attachment),
        'Failed to add attachment'
      ),
    [withSync]
  );

  const removeAttachment = useCallback(
    (boardId: string, cardId: string, attachmentId: string) =>
      withSync(
        () => firestore.removeAttachment(boardId, cardId, attachmentId),
        'Failed to remove attachment'
      ),
    [withSync]
  );

  // Comment operations
  const addComment = useCallback(
    (
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
    ) =>
      withSync(
        () =>
          firestore.addComment(
            boardId,
            cardId,
            content,
            userId,
            userName,
            userPhoto,
            attachments,
            contentEn,
            contentJa,
            detectedLanguage
          ),
        'Failed to add comment'
      ),
    [withSync]
  );

  const updateComment = useCallback(
    (boardId: string, cardId: string, commentId: string, content: string) =>
      withSync(
        () => firestore.updateComment(boardId, cardId, commentId, content),
        'Failed to update comment'
      ),
    [withSync]
  );

  const deleteComment = useCallback(
    (boardId: string, cardId: string, commentId: string) =>
      withSync(
        () => firestore.deleteComment(boardId, cardId, commentId),
        'Failed to delete comment'
      ),
    [withSync]
  );

  return {
    // Board operations
    createBoard,
    updateBoard,
    // Column operations
    createColumn,
    updateColumn,
    archiveColumn,
    restoreColumn,
    archiveAllCardsInColumn,
    restoreCards,
    reorderColumns,
    // Card operations
    createCard,
    updateCard,
    archiveCard,
    restoreCard,
    moveCard,
    reorderCards,
    // Attachment operations
    addAttachment,
    removeAttachment,
    // Comment operations
    addComment,
    updateComment,
    deleteComment,
    // Generic wrapper for custom operations
    withSync,
    // Re-export subscription functions (these don't need sync tracking)
    subscribeToBoards: firestore.subscribeToBoards,
    subscribeToColumns: firestore.subscribeToColumns,
    subscribeToCards: firestore.subscribeToCards,
    subscribeToComments: firestore.subscribeToComments,
    getCard: firestore.getCard,
  };
}
