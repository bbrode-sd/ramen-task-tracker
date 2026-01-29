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
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
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

export type SortBy = 'created' | 'dueDate' | 'priority' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  titleEn: string;
  titleJa: string;
  descriptionEn: string;
  descriptionJa: string;
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
  text: string;
  isCompleted: boolean;
  order: number;
}

export interface Checklist {
  id: string;
  title: string;
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
  | 'attachment_added';

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
