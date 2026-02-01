/**
 * Card and board template operations
 */
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CardTemplate, BoardTemplate, SubBoardTemplate } from '@/types';

// ============================================================================
// CARD TEMPLATES
// ============================================================================

/**
 * Create a card template
 */
export const createCardTemplate = async (
  template: Omit<CardTemplate, 'id' | 'createdAt'>
): Promise<string> => {
  const templateRef = await addDoc(collection(db, 'cardTemplates'), {
    ...template,
    createdAt: Timestamp.now(),
  });
  return templateRef.id;
};

/**
 * Get all card templates for a user
 */
export const getCardTemplates = async (userId: string): Promise<CardTemplate[]> => {
  const q = query(
    collection(db, 'cardTemplates'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CardTemplate[];
};

/**
 * Get a single card template by ID
 */
export const getCardTemplate = async (templateId: string): Promise<CardTemplate | null> => {
  const templateRef = doc(db, 'cardTemplates', templateId);
  const templateDoc = await getDoc(templateRef);
  
  if (templateDoc.exists()) {
    return { id: templateDoc.id, ...templateDoc.data() } as CardTemplate;
  }
  return null;
};

/**
 * Delete a card template
 */
export const deleteCardTemplate = async (templateId: string): Promise<void> => {
  const templateRef = doc(db, 'cardTemplates', templateId);
  await deleteDoc(templateRef);
};

/**
 * Create a card from a template
 */
export const createCardFromTemplate = async (
  boardId: string,
  columnId: string,
  templateId: string,
  userId: string,
  order: number
): Promise<string> => {
  const template = await getCardTemplate(templateId);
  if (!template) {
    throw new Error('Template not found');
  }
  
  const cardRef = await addDoc(collection(db, 'boards', boardId, 'cards'), {
    boardId,
    columnId,
    titleEn: template.titleEn,
    titleJa: template.titleJa || '',
    titleDetectedLanguage: 'en', // Templates are created with English titles as original
    descriptionEn: template.descriptionEn || '',
    descriptionJa: template.descriptionJa || '',
    order,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: userId,
    isArchived: false,
    attachments: [],
    labels: template.labels || [],
    checklists: template.checklists || [],
  });
  
  return cardRef.id;
};

// ============================================================================
// BOARD TEMPLATES
// ============================================================================

/**
 * Built-in board templates
 */
export const BUILT_IN_BOARD_TEMPLATES: Omit<BoardTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'Sprint Board',
    description: 'Agile sprint workflow with backlog, progress tracking, and review stages',
    columns: [
      { name: 'Backlog', order: 0 },
      { name: 'To Do', order: 1 },
      { name: 'In Progress', order: 2 },
      { name: 'Review', order: 3 },
      { name: 'Done', order: 4 },
    ],
    isBuiltIn: true,
  },
  {
    name: 'Simple Kanban',
    description: 'Basic three-column workflow for straightforward task management',
    columns: [
      { name: 'To Do', order: 0 },
      { name: 'Doing', order: 1 },
      { name: 'Done', order: 2 },
    ],
    isBuiltIn: true,
  },
  {
    name: 'Bug Tracker',
    description: 'Track bugs from report through verification with dedicated stages',
    columns: [
      { name: 'Reported', order: 0 },
      { name: 'Triaged', order: 1 },
      { name: 'In Progress', order: 2 },
      { name: 'Fixed', order: 3 },
      { name: 'Verified', order: 4 },
    ],
    isBuiltIn: true,
  },
];

/**
 * Create a custom board template
 */
export const createBoardTemplate = async (
  template: Omit<BoardTemplate, 'id' | 'createdAt' | 'isBuiltIn'>
): Promise<string> => {
  const templateRef = await addDoc(collection(db, 'boardTemplates'), {
    ...template,
    isBuiltIn: false,
    createdAt: Timestamp.now(),
  });
  return templateRef.id;
};

/**
 * Get all board templates (built-in + user's custom)
 */
export const getBoardTemplates = async (userId: string): Promise<BoardTemplate[]> => {
  // Get user's custom templates
  const q = query(
    collection(db, 'boardTemplates'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const userTemplates = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as BoardTemplate[];
  
  // Add built-in templates with generated IDs
  const builtInTemplates: BoardTemplate[] = BUILT_IN_BOARD_TEMPLATES.map((t, index) => ({
    ...t,
    id: `built-in-${index}`,
    createdAt: Timestamp.now(),
  }));
  
  return [...builtInTemplates, ...userTemplates];
};

/**
 * Delete a custom board template
 */
export const deleteBoardTemplate = async (templateId: string): Promise<void> => {
  if (templateId.startsWith('built-in-')) {
    throw new Error('Cannot delete built-in templates');
  }
  const templateRef = doc(db, 'boardTemplates', templateId);
  await deleteDoc(templateRef);
};

/**
 * Create a board from a template
 */
export const createBoardFromTemplate = async (
  templateId: string,
  boardName: string,
  userId: string
): Promise<string> => {
  let columns: { name: string; order: number }[];
  
  // Check if it's a built-in template
  if (templateId.startsWith('built-in-')) {
    const index = parseInt(templateId.replace('built-in-', ''), 10);
    const builtInTemplate = BUILT_IN_BOARD_TEMPLATES[index];
    if (!builtInTemplate) {
      throw new Error('Built-in template not found');
    }
    columns = builtInTemplate.columns;
  } else {
    // Fetch user template
    const templateRef = doc(db, 'boardTemplates', templateId);
    const templateDoc = await getDoc(templateRef);
    
    if (!templateDoc.exists()) {
      throw new Error('Template not found');
    }
    
    const template = templateDoc.data() as BoardTemplate;
    columns = template.columns;
  }
  
  // Create the board
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: boardName,
    ownerId: userId,
    memberIds: [userId],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isArchived: false,
  });
  
  // Create the columns
  const batch = writeBatch(db);
  columns.forEach((col) => {
    const columnRef = doc(collection(db, 'boards', boardRef.id, 'columns'));
    batch.set(columnRef, {
      boardId: boardRef.id,
      name: col.name,
      order: col.order,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isArchived: false,
    });
  });
  
  await batch.commit();
  
  return boardRef.id;
};

// ============================================================================
// SUB-BOARD TEMPLATES
// ============================================================================

/**
 * Create a custom sub-board template
 */
export const createSubBoardTemplate = async (
  template: Omit<SubBoardTemplate, 'id' | 'createdAt'>
): Promise<string> => {
  const templateRef = await addDoc(collection(db, 'subBoardTemplates'), {
    ...template,
    createdAt: Timestamp.now(),
  });
  return templateRef.id;
};

/**
 * Get all sub-board templates for a user
 */
export const getSubBoardTemplates = async (userId: string): Promise<SubBoardTemplate[]> => {
  const q = query(
    collection(db, 'subBoardTemplates'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SubBoardTemplate[];
};

/**
 * Get a single sub-board template by ID
 */
export const getSubBoardTemplate = async (templateId: string): Promise<SubBoardTemplate | null> => {
  const templateRef = doc(db, 'subBoardTemplates', templateId);
  const templateDoc = await getDoc(templateRef);
  
  if (templateDoc.exists()) {
    return { id: templateDoc.id, ...templateDoc.data() } as SubBoardTemplate;
  }
  return null;
};

/**
 * Delete a sub-board template
 */
export const deleteSubBoardTemplate = async (templateId: string): Promise<void> => {
  const templateRef = doc(db, 'subBoardTemplates', templateId);
  await deleteDoc(templateRef);
};

/**
 * Update a sub-board template
 */
export const updateSubBoardTemplate = async (
  templateId: string,
  updates: Partial<Omit<SubBoardTemplate, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
  const templateRef = doc(db, 'subBoardTemplates', templateId);
  await updateDoc(templateRef, updates);
};
