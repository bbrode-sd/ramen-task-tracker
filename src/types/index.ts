import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// User profile stored in Firestore for member lookup
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Board member with profile info for display
export interface BoardMember {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  isOwner: boolean;
}

export interface BoardBackground {
  type: 'gradient' | 'color' | 'image';
  value: string;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isArchived: boolean;
  background?: BoardBackground;
  // Sub-board support
  parentCardId?: string;      // If set, this is a sub-board linked to a parent card
  parentBoardId?: string;     // Reference to the parent board (for queries)
  approvalColumnName?: string; // Column name to track for "approved" count (default: "Approved")
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  nameJa?: string;
  nameOriginalLanguage?: 'en' | 'ja'; // Which language was originally typed (undefined = 'en' for backwards compatibility)
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isArchived: boolean;
}

export interface CardCover {
  attachmentId?: string;
  color?: string;
}

export type CardPriority = 'low' | 'medium' | 'high' | 'urgent' | null;

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  titleEn: string;
  titleJa: string;
  titleDetectedLanguage?: 'en' | 'ja'; // Which language was originally typed for title
  titleTranslatorEn?: TranslatorInfo; // Who manually edited the EN title (undefined = auto-translated)
  titleTranslatorJa?: TranslatorInfo; // Who manually edited the JA title (undefined = auto-translated)
  descriptionEn: string;
  descriptionJa: string;
  descriptionDetectedLanguage?: 'en' | 'ja'; // Which language was originally typed for description
  descriptionTranslatorEn?: TranslatorInfo; // Who manually edited the EN description (undefined = auto-translated)
  descriptionTranslatorJa?: TranslatorInfo; // Who manually edited the JA description (undefined = auto-translated)
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  isArchived: boolean;
  attachments: Attachment[];
  labels: string[];
  dueDate?: Timestamp | null;
  assigneeIds?: string[];
  checklists?: Checklist[];
  coverImage?: CardCover;
  priority?: CardPriority;
  watcherIds?: string[];
  commentCount?: number;
  // Sub-board support
  subBoardId?: string;              // ID of linked sub-board
  subBoardApprovedCount?: number;   // Cached count of cards in approval column
}

export interface Attachment {
  id: string;
  type: 'image' | 'link' | 'file';
  url: string;
  name: string;
  thumbnailUrl?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface ChecklistItem {
  id: string;
  text: string; // Keep for backwards compatibility - will be migrated to textEn
  textEn?: string;
  textJa?: string;
  textOriginalLanguage?: 'en' | 'ja'; // Which language was originally typed (undefined = 'en' for backwards compatibility)
  isCompleted: boolean;
  order: number;
  assigneeId?: string;  // User ID of assigned member
  dueDate?: Timestamp | null;  // Due date for this item
}

export interface Checklist {
  id: string;
  title: string; // Keep for backwards compatibility - will be migrated to titleEn
  titleEn?: string;
  titleJa?: string;
  titleOriginalLanguage?: 'en' | 'ja'; // Which language was originally typed (undefined = 'en' for backwards compatibility)
  items: ChecklistItem[];
}

export interface TranslatorInfo {
  uid: string;
  displayName: string;
}

export interface Comment {
  id: string;
  cardId: string;
  content: string; // Original content (kept for backwards compatibility)
  contentEn: string; // English version
  contentJa: string; // Japanese version
  detectedLanguage: 'en' | 'ja'; // Which language was originally typed
  translatorEn?: TranslatorInfo; // Who manually edited the EN translation (undefined = auto-translated)
  translatorJa?: TranslatorInfo; // Who manually edited the JA translation (undefined = auto-translated)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName: string;
  createdByPhoto: string | null;
  attachments: Attachment[];
}

// For drag and drop
export interface DragResult {
  draggableId: string;
  type: string;
  source: {
    droppableId: string;
    index: number;
  };
  destination: {
    droppableId: string;
    index: number;
  } | null;
}

// Templates
export interface CardTemplate {
  id: string;
  name: string;
  titleEn: string;
  titleJa?: string;
  descriptionEn?: string;
  descriptionJa?: string;
  labels: string[];
  checklists?: Checklist[];
  createdBy: string;
  createdAt: Timestamp;
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  columns: { name: string; order: number }[];
  isBuiltIn: boolean;
  createdBy?: string;
  createdAt: Timestamp;
}

// Sub-board template with pre-created cards
export interface SubBoardTemplateColumn {
  name: string;
  order: number;
  cards?: { title: string; order: number }[];
}

export interface SubBoardTemplate {
  id: string;
  name: string;
  description?: string;
  columns: SubBoardTemplateColumn[];
  approvalColumnName?: string; // Which column to track for "approved" count
  createdBy?: string;
  createdAt: Timestamp;
}

// Activity types for activity logging
export type ActivityType = 
  | 'card_created' 
  | 'card_moved' 
  | 'card_updated' 
  | 'card_archived' 
  | 'comment_added' 
  | 'checklist_completed' 
  | 'assignee_added' 
  | 'due_date_set'
  | 'attachment_added'
  | 'card_watched'
  | 'card_unwatched'
  | 'checklist_item_assigned'
  | 'checklist_item_due_date_set';

export interface Activity {
  id: string;
  boardId: string;
  cardId?: string;
  cardTitle?: string; // For display purposes when showing board-level activities
  type: ActivityType;
  userId: string;
  userName: string;
  userPhoto?: string;
  metadata: Record<string, unknown>; // e.g., { from: 'To Do', to: 'Done' }
  createdAt: Timestamp;
}
