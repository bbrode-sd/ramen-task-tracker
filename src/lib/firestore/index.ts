/**
 * Firestore operations - modular re-exports
 * 
 * This file provides backwards-compatible exports from the modular structure.
 * Import from '@/lib/firestore' or individual modules like '@/lib/firestore/cards'.
 */

// User operations
export {
  getUserProfile,
  getUserProfiles,
  clearUserCache,
  saveUserProfile,
  getUserByEmail,
  getUsersByIds,
} from './users';

// Board operations
export {
  createBoard,
  updateBoard,
  getBoard,
  subscribeToBoards,
  getBoardMembers,
  addBoardMember,
  removeBoardMember,
  subscribeToBoardMembers,
  // Sub-board operations
  createSubBoard,
  createSubBoardFromTemplate,
  getSubBoardForCard,
  subscribeToSubBoard,
  subscribeToBoardsExcludingSubBoards,
  removeSubBoard,
  // Template board operations (templates are real boards)
  getTemplateBoardsForBoard,
  createTemplateBoard,
  cloneTemplateBoardAsSubBoard,
  deleteTemplateBoard,
} from './boards';

// Column operations
export {
  createColumn,
  updateColumn,
  archiveColumn,
  restoreColumn,
  reorderColumns,
  subscribeToColumns,
  subscribeToArchivedColumns,
  permanentlyDeleteColumn,
} from './columns';

// Card operations
export {
  createCard,
  updateCard,
  getCard,
  archiveCard,
  restoreCard,
  moveCard,
  reorderCards,
  archiveAllCardsInColumn,
  restoreCards,
  subscribeToCards,
  subscribeToCardsPaginated,
  loadMoreCards,
  subscribeToArchivedCards,
  addAttachment,
  removeAttachment,
  updateCardCover,
  removeCardCover,
  addChecklist,
  updateChecklist,
  deleteChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  permanentlyDeleteCard,
  toggleCardWatch,
  addCardWatcher,
  removeCardWatcher,
  // Sub-board support
  updateSubBoardApprovedCount,
  calculateSubBoardApprovedCount,
  recalculateAndUpdateApprovedCount,
} from './cards';

// Comment operations
export {
  addComment,
  updateComment,
  updateCommentTranslation,
  deleteComment,
  subscribeToComments,
} from './comments';

// Activity operations
export {
  logActivity,
  subscribeToCardActivities,
  subscribeToBoardActivities,
} from './activities';

// Template operations
export {
  createCardTemplate,
  getCardTemplates,
  getCardTemplate,
  deleteCardTemplate,
  createCardFromTemplate,
  BUILT_IN_BOARD_TEMPLATES,
  createBoardTemplate,
  getBoardTemplates,
  deleteBoardTemplate,
  createBoardFromTemplate,
  // Sub-board template operations
  createSubBoardTemplate,
  getSubBoardTemplates,
  getSubBoardTemplate,
  deleteSubBoardTemplate,
  updateSubBoardTemplate,
} from './templates';
