import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isArchived: boolean;
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

export interface Comment {
  id: string;
  cardId: string;
  content: string; // Original content (kept for backwards compatibility)
  contentEn: string; // English version
  contentJa: string; // Japanese version
  detectedLanguage: 'en' | 'ja'; // Which language was originally typed
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
