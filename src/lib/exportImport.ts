import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Board, Column, Card, Comment, Checklist, Attachment } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============ Export Types ============

export interface ExportedBoard {
  version: string;
  exportedAt: string;
  board: {
    name: string;
    background?: {
      type: 'gradient' | 'color' | 'image';
      value: string;
    };
  };
  columns: ExportedColumn[];
  cards: ExportedCard[];
  comments: ExportedComment[];
}

export interface ExportedColumn {
  id: string;
  name: string;
  order: number;
}

export interface ExportedCard {
  id: string;
  columnId: string;
  titleEn: string;
  titleJa: string;
  descriptionEn: string;
  descriptionJa: string;
  order: number;
  labels: string[];
  dueDate?: string | null;
  checklists?: Checklist[];
  attachments?: Attachment[];
  createdAt: string;
}

export interface ExportedComment {
  cardId: string;
  content: string;
  contentEn: string;
  contentJa: string;
  createdByName: string;
  createdAt: string;
}

// ============ Trello Import Types ============

export interface TrelloBoard {
  name: string;
  lists?: TrelloList[];
  cards?: TrelloCard[];
}

export interface TrelloList {
  id: string;
  name: string;
  pos: number;
  closed?: boolean;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  pos: number;
  due?: string | null;
  labels?: TrelloLabel[];
  checklists?: TrelloChecklist[];
  closed?: boolean;
}

export interface TrelloLabel {
  name: string;
  color?: string;
}

export interface TrelloChecklist {
  name: string;
  checkItems?: TrelloCheckItem[];
}

export interface TrelloCheckItem {
  name: string;
  state: 'complete' | 'incomplete';
  pos: number;
}

// ============ Validation Types ============

export interface ValidationResult {
  isValid: boolean;
  format: 'tomobodo' | 'trello' | 'unknown';
  errors: string[];
  warnings: string[];
  preview?: ImportPreview;
}

export interface ImportPreview {
  boardName: string;
  columnCount: number;
  cardCount: number;
  commentCount: number;
}

// ============ Export Functions ============

export async function exportBoardToJSON(boardId: string): Promise<ExportedBoard> {
  // Get board
  const boardDoc = await getDoc(doc(db, 'boards', boardId));
  if (!boardDoc.exists()) {
    throw new Error('Board not found');
  }
  const board = { id: boardDoc.id, ...boardDoc.data() } as Board;

  // Get columns
  const columnsQuery = query(
    collection(db, 'boards', boardId, 'columns'),
    orderBy('order', 'asc')
  );
  const columnsSnapshot = await getDocs(columnsQuery);
  const columns = columnsSnapshot.docs
    .filter((doc) => !doc.data().isArchived)
    .map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      order: doc.data().order,
    }));

  // Get cards
  const cardsQuery = query(
    collection(db, 'boards', boardId, 'cards'),
    orderBy('order', 'asc')
  );
  const cardsSnapshot = await getDocs(cardsQuery);
  const cards: ExportedCard[] = cardsSnapshot.docs
    .filter((doc) => !doc.data().isArchived)
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        columnId: data.columnId,
        titleEn: data.titleEn || '',
        titleJa: data.titleJa || '',
        descriptionEn: data.descriptionEn || '',
        descriptionJa: data.descriptionJa || '',
        order: data.order,
        labels: data.labels || [],
        dueDate: data.dueDate?.toDate?.()?.toISOString() || null,
        checklists: data.checklists || [],
        attachments: data.attachments?.map((att: Attachment) => ({
          ...att,
          createdAt: att.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        })) || [],
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

  // Get comments for all cards
  const comments: ExportedComment[] = [];
  for (const card of cards) {
    const commentsQuery = query(
      collection(db, 'boards', boardId, 'cards', card.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    commentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      comments.push({
        cardId: card.id,
        content: data.content || '',
        contentEn: data.contentEn || data.content || '',
        contentJa: data.contentJa || data.content || '',
        createdByName: data.createdByName || 'Unknown',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      });
    });
  }

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    board: {
      name: board.name,
      background: board.background,
    },
    columns,
    cards,
    comments,
  };
}

export async function exportBoardToCSV(boardId: string): Promise<string> {
  // Get board data
  const exportData = await exportBoardToJSON(boardId);

  // Create column name mapping
  const columnMap = new Map(exportData.columns.map((col) => [col.id, col.name]));

  // CSV header
  const headers = [
    'Column',
    'Title (EN)',
    'Title (JA)',
    'Description (EN)',
    'Description (JA)',
    'Labels',
    'Due Date',
    'Checklists',
    'Created At',
  ];

  // Helper to escape CSV fields
  const escapeCSV = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  // Create rows
  const rows = exportData.cards.map((card) => {
    const checklistSummary = card.checklists
      ?.map((cl) => `${cl.title} (${cl.items.filter((i) => i.isCompleted).length}/${cl.items.length})`)
      .join('; ') || '';

    return [
      escapeCSV(columnMap.get(card.columnId) || ''),
      escapeCSV(card.titleEn),
      escapeCSV(card.titleJa),
      escapeCSV(card.descriptionEn),
      escapeCSV(card.descriptionJa),
      escapeCSV(card.labels.join(', ')),
      escapeCSV(card.dueDate ? new Date(card.dueDate).toLocaleDateString() : ''),
      escapeCSV(checklistSummary),
      escapeCSV(new Date(card.createdAt).toLocaleDateString()),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============ Validation Functions ============

export function validateImportData(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      format: 'unknown',
      errors: ['Invalid data format - expected JSON object'],
      warnings: [],
    };
  }

  const obj = data as Record<string, unknown>;

  // Check for Tomobodo format
  if ('version' in obj && 'board' in obj && 'columns' in obj && 'cards' in obj) {
    return validateTomobodoFormat(obj);
  }

  // Check for Trello format
  if ('name' in obj && ('lists' in obj || 'cards' in obj)) {
    return validateTrelloFormat(obj);
  }

  return {
    isValid: false,
    format: 'unknown',
    errors: ['Unrecognized file format. Please use a Tomobodo export or Trello JSON export.'],
    warnings: [],
  };
}

function validateTomobodoFormat(data: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!data.board || typeof data.board !== 'object') {
    errors.push('Missing or invalid "board" field');
  }

  const board = data.board as Record<string, unknown>;
  if (!board?.name || typeof board.name !== 'string') {
    errors.push('Board must have a name');
  }

  if (!Array.isArray(data.columns)) {
    errors.push('Missing or invalid "columns" field');
  }

  if (!Array.isArray(data.cards)) {
    errors.push('Missing or invalid "cards" field');
  }

  const columns = (data.columns as ExportedColumn[]) || [];
  const cards = (data.cards as ExportedCard[]) || [];
  const comments = (data.comments as ExportedComment[]) || [];

  // Validate column structure
  columns.forEach((col, index) => {
    if (!col.name || typeof col.name !== 'string') {
      errors.push(`Column at index ${index} is missing a name`);
    }
  });

  // Validate card structure
  cards.forEach((card, index) => {
    if (!card.titleEn && !card.titleJa) {
      warnings.push(`Card at index ${index} has no title`);
    }
    if (!columns.some((col) => col.id === card.columnId)) {
      warnings.push(`Card "${card.titleEn || card.titleJa}" references unknown column`);
    }
  });

  const isValid = errors.length === 0;

  return {
    isValid,
    format: 'tomobodo',
    errors,
    warnings,
    preview: isValid
      ? {
          boardName: (board?.name as string) || 'Untitled Board',
          columnCount: columns.length,
          cardCount: cards.length,
          commentCount: comments.length,
        }
      : undefined,
  };
}

function validateTrelloFormat(data: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = data.name as string;
  if (!name || typeof name !== 'string') {
    errors.push('Trello board must have a name');
  }

  const lists = (data.lists as TrelloList[]) || [];
  const cards = (data.cards as TrelloCard[]) || [];

  // Filter out closed lists and cards
  const openLists = lists.filter((list) => !list.closed);
  const openCards = cards.filter((card) => !card.closed);

  if (openLists.length === 0) {
    warnings.push('No open lists found in Trello export');
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    format: 'trello',
    errors,
    warnings,
    preview: isValid
      ? {
          boardName: name || 'Untitled Board',
          columnCount: openLists.length,
          cardCount: openCards.length,
          commentCount: 0, // Trello exports don't typically include comments
        }
      : undefined,
  };
}

// ============ Import Functions ============

export async function importBoardFromJSON(
  data: ExportedBoard | TrelloBoard,
  userId: string,
  format: 'tomobodo' | 'trello',
  onProgress?: (progress: number, message: string) => void
): Promise<string> {
  if (format === 'trello') {
    return importFromTrello(data as TrelloBoard, userId, onProgress);
  }
  return importFromTomobodo(data as ExportedBoard, userId, onProgress);
}

async function importFromTomobodo(
  data: ExportedBoard,
  userId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<string> {
  onProgress?.(0, 'Creating board...');

  // Create board
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: data.board.name,
    ownerId: userId,
    memberIds: [userId],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
    background: data.board.background,
  });

  const boardId = boardRef.id;
  const columnIdMap = new Map<string, string>();
  const cardIdMap = new Map<string, string>();

  onProgress?.(10, 'Creating columns...');

  // Create columns
  const batch1 = writeBatch(db);
  for (const column of data.columns) {
    const newColumnRef = doc(collection(db, 'boards', boardId, 'columns'));
    columnIdMap.set(column.id, newColumnRef.id);
    batch1.set(newColumnRef, {
      boardId,
      name: column.name,
      order: column.order,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isArchived: false,
    });
  }
  await batch1.commit();

  onProgress?.(30, 'Creating cards...');

  // Create cards in batches (Firestore limits batch writes to 500)
  const BATCH_SIZE = 400;
  for (let i = 0; i < data.cards.length; i += BATCH_SIZE) {
    const cardBatch = writeBatch(db);
    const cardsChunk = data.cards.slice(i, i + BATCH_SIZE);

    for (const card of cardsChunk) {
      const newColumnId = columnIdMap.get(card.columnId);
      if (!newColumnId) continue;

      const newCardRef = doc(collection(db, 'boards', boardId, 'cards'));
      cardIdMap.set(card.id, newCardRef.id);

      // Convert checklist dates if needed
      const checklists = card.checklists?.map((cl) => ({
        id: uuidv4(),
        title: cl.title,
        items: cl.items.map((item) => ({
          id: uuidv4(),
          text: item.text,
          isCompleted: item.isCompleted,
          order: item.order,
        })),
      }));

      cardBatch.set(newCardRef, {
        boardId,
        columnId: newColumnId,
        titleEn: card.titleEn,
        titleJa: card.titleJa,
        descriptionEn: card.descriptionEn,
        descriptionJa: card.descriptionJa,
        order: card.order,
        labels: card.labels,
        dueDate: card.dueDate ? Timestamp.fromDate(new Date(card.dueDate)) : null,
        checklists: checklists || [],
        attachments: [], // Skip attachments as URLs won't be valid
        createdAt: card.createdAt ? Timestamp.fromDate(new Date(card.createdAt)) : Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userId,
        isArchived: false,
      });
    }

    await cardBatch.commit();
    const progress = 30 + Math.floor(((i + cardsChunk.length) / data.cards.length) * 40);
    onProgress?.(progress, `Created ${Math.min(i + cardsChunk.length, data.cards.length)} of ${data.cards.length} cards...`);
  }

  onProgress?.(70, 'Creating comments...');

  // Create comments
  if (data.comments && data.comments.length > 0) {
    for (let i = 0; i < data.comments.length; i += BATCH_SIZE) {
      const commentBatch = writeBatch(db);
      const commentsChunk = data.comments.slice(i, i + BATCH_SIZE);

      for (const comment of commentsChunk) {
        const newCardId = cardIdMap.get(comment.cardId);
        if (!newCardId) continue;

        const newCommentRef = doc(collection(db, 'boards', boardId, 'cards', newCardId, 'comments'));
        commentBatch.set(newCommentRef, {
          cardId: newCardId,
          content: comment.content,
          contentEn: comment.contentEn,
          contentJa: comment.contentJa,
          detectedLanguage: 'en',
          createdAt: comment.createdAt ? Timestamp.fromDate(new Date(comment.createdAt)) : Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: userId,
          createdByName: comment.createdByName || 'Imported',
          createdByPhoto: null,
          attachments: [],
        });
      }

      await commentBatch.commit();
      const progress = 70 + Math.floor(((i + commentsChunk.length) / data.comments.length) * 25);
      onProgress?.(progress, `Created ${Math.min(i + commentsChunk.length, data.comments.length)} of ${data.comments.length} comments...`);
    }
  }

  onProgress?.(100, 'Import complete!');
  return boardId;
}

async function importFromTrello(
  data: TrelloBoard,
  userId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<string> {
  onProgress?.(0, 'Creating board from Trello export...');

  // Create board
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: data.name || 'Imported from Trello',
    ownerId: userId,
    memberIds: [userId],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
  });

  const boardId = boardRef.id;
  const listIdMap = new Map<string, string>();

  // Get open lists sorted by position
  const lists = (data.lists || [])
    .filter((list) => !list.closed)
    .sort((a, b) => a.pos - b.pos);

  // Get open cards sorted by position
  const cards = (data.cards || [])
    .filter((card) => !card.closed)
    .sort((a, b) => a.pos - b.pos);

  onProgress?.(10, 'Creating columns...');

  // Create columns from lists
  const batch1 = writeBatch(db);
  lists.forEach((list, index) => {
    const newColumnRef = doc(collection(db, 'boards', boardId, 'columns'));
    listIdMap.set(list.id, newColumnRef.id);
    batch1.set(newColumnRef, {
      boardId,
      name: list.name,
      order: index,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isArchived: false,
    });
  });
  await batch1.commit();

  onProgress?.(30, 'Creating cards...');

  // Create cards in batches
  const BATCH_SIZE = 400;
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const cardBatch = writeBatch(db);
    const cardsChunk = cards.slice(i, i + BATCH_SIZE);

    cardsChunk.forEach((card, index) => {
      const newColumnId = listIdMap.get(card.idList);
      if (!newColumnId) return;

      const newCardRef = doc(collection(db, 'boards', boardId, 'cards'));

      // Convert Trello checklists
      const checklists: Checklist[] = (card.checklists || []).map((cl) => ({
        id: uuidv4(),
        title: cl.name,
        items: (cl.checkItems || [])
          .sort((a, b) => a.pos - b.pos)
          .map((item, itemIndex) => ({
            id: uuidv4(),
            text: item.name,
            isCompleted: item.state === 'complete',
            order: itemIndex,
          })),
      }));

      // Extract labels
      const labels = (card.labels || [])
        .filter((label) => label.name)
        .map((label) => label.name);

      cardBatch.set(newCardRef, {
        boardId,
        columnId: newColumnId,
        titleEn: card.name,
        titleJa: '', // Trello doesn't have Japanese titles
        descriptionEn: card.desc || '',
        descriptionJa: '',
        order: i + index,
        labels,
        dueDate: card.due ? Timestamp.fromDate(new Date(card.due)) : null,
        checklists,
        attachments: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userId,
        isArchived: false,
      });
    });

    await cardBatch.commit();
    const progress = 30 + Math.floor(((i + cardsChunk.length) / cards.length) * 65);
    onProgress?.(progress, `Created ${Math.min(i + cardsChunk.length, cards.length)} of ${cards.length} cards...`);
  }

  onProgress?.(100, 'Import complete!');
  return boardId;
}

// ============ Helper Functions ============

export function parseImportFile(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON file');
  }
}

export function getExportFilename(boardName: string, format: 'json' | 'csv'): string {
  const sanitizedName = boardName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const date = new Date().toISOString().split('T')[0];
  return `${sanitizedName}-${date}.${format}`;
}
