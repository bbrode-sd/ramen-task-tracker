/**
 * Zod schemas for runtime validation
 * 
 * These schemas validate data coming from Firestore to catch
 * data inconsistencies early and provide better error messages.
 */

import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// CUSTOM ZOD TYPES
// ============================================================================

/**
 * Firestore Timestamp validator
 */
const firestoreTimestamp = z.custom<Timestamp>(
  (val) => val instanceof Timestamp,
  { message: 'Expected Firestore Timestamp' }
);

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UserSchema = z.object({
  uid: z.string(),
  email: z.string().email().nullable(),
  displayName: z.string().max(100).nullable(),
  photoURL: z.string().url().nullable(),
});

export const UserProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().max(100).nullable(),
  photoURL: z.string().url().nullable(),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
});

export const BoardMemberSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().max(100).nullable(),
  photoURL: z.string().url().nullable(),
  isOwner: z.boolean(),
});

// ============================================================================
// BOARD SCHEMAS
// ============================================================================

export const BoardBackgroundSchema = z.object({
  type: z.enum(['gradient', 'color', 'image']),
  value: z.string(),
});

export const BoardSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  ownerId: z.string(),
  memberIds: z.array(z.string()),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  isArchived: z.boolean(),
  background: BoardBackgroundSchema.optional(),
  // Sub-board support
  parentCardId: z.string().optional(),
  parentBoardId: z.string().optional(),
  approvalColumnName: z.string().max(200).optional(),
});

// ============================================================================
// COLUMN SCHEMAS
// ============================================================================

export const ColumnSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  name: z.string().min(1).max(200),
  order: z.number().int().min(0),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  isArchived: z.boolean(),
});

// ============================================================================
// CARD SCHEMAS
// ============================================================================

export const AttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'link', 'file']),
  url: z.string().url(),
  name: z.string().max(500),
  thumbnailUrl: z.string().url().optional(),
  createdAt: firestoreTimestamp,
  createdBy: z.string(),
});

export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string().max(500),
  isCompleted: z.boolean(),
  order: z.number().int().min(0),
});

export const ChecklistSchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  items: z.array(ChecklistItemSchema),
});

export const CardCoverSchema = z.object({
  attachmentId: z.string().optional(),
  color: z.string().optional(),
});

export const CardPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']).nullable();

export const CardSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  columnId: z.string(),
  titleEn: z.string().max(500),
  titleJa: z.string().max(500),
  descriptionEn: z.string().max(10000),
  descriptionJa: z.string().max(10000),
  order: z.number().int().min(0),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  createdBy: z.string(),
  isArchived: z.boolean(),
  attachments: z.array(AttachmentSchema),
  labels: z.array(z.string()),
  dueDate: firestoreTimestamp.optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  checklists: z.array(ChecklistSchema).optional(),
  coverImage: CardCoverSchema.optional(),
  priority: CardPrioritySchema.optional(),
  // Sub-board support
  subBoardId: z.string().optional(),
  subBoardApprovedCount: z.number().int().min(0).optional(),
});

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

export const TranslatorInfoSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
});

export const CommentSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  content: z.string().max(5000),
  contentEn: z.string().max(5000),
  contentJa: z.string().max(5000),
  detectedLanguage: z.enum(['en', 'ja']),
  translatorEn: TranslatorInfoSchema.optional(),
  translatorJa: TranslatorInfoSchema.optional(),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  createdBy: z.string(),
  createdByName: z.string().max(100),
  createdByPhoto: z.string().url().nullable(),
  attachments: z.array(AttachmentSchema),
});

// ============================================================================
// ACTIVITY SCHEMAS
// ============================================================================

export const ActivityTypeSchema = z.enum([
  'card_created',
  'card_moved',
  'card_updated',
  'card_archived',
  'comment_added',
  'checklist_completed',
  'assignee_added',
  'due_date_set',
  'attachment_added',
]);

export const ActivitySchema = z.object({
  id: z.string(),
  boardId: z.string(),
  cardId: z.string().optional(),
  cardTitle: z.string().max(500).optional(),
  type: ActivityTypeSchema,
  userId: z.string(),
  userName: z.string().max(100),
  userPhoto: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: firestoreTimestamp,
});

// ============================================================================
// TEMPLATE SCHEMAS
// ============================================================================

export const CardTemplateSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  titleEn: z.string().max(500),
  titleJa: z.string().max(500).optional(),
  descriptionEn: z.string().max(10000).optional(),
  descriptionJa: z.string().max(10000).optional(),
  labels: z.array(z.string()),
  checklists: z.array(ChecklistSchema).optional(),
  createdBy: z.string(),
  createdAt: firestoreTimestamp,
});

export const BoardTemplateColumnSchema = z.object({
  name: z.string().max(200),
  order: z.number().int().min(0),
});

export const BoardTemplateSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  description: z.string().max(1000),
  columns: z.array(BoardTemplateColumnSchema).min(1).max(20),
  isBuiltIn: z.boolean(),
  createdBy: z.string().optional(),
  createdAt: firestoreTimestamp,
});

// Sub-board template schemas
export const SubBoardTemplateCardSchema = z.object({
  title: z.string().max(500),
  order: z.number().int().min(0),
});

export const SubBoardTemplateColumnSchema = z.object({
  name: z.string().max(200),
  order: z.number().int().min(0),
  cards: z.array(SubBoardTemplateCardSchema).optional(),
});

export const SubBoardTemplateSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  description: z.string().max(1000).optional(),
  columns: z.array(SubBoardTemplateColumnSchema).min(1).max(20),
  approvalColumnName: z.string().max(200).optional(),
  createdBy: z.string().optional(),
  createdAt: firestoreTimestamp,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safe parse that logs validation errors in development
 */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown, context?: string): T | null {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Schema Validation${context ? `:${context}` : ''}] Validation failed:`, result.error.issues);
    }
    return null;
  }
  
  return result.data;
}

/**
 * Parse with fallback for partial data (useful for Firestore docs that might be missing fields)
 */
export function parseWithDefaults<T extends object>(
  schema: z.ZodType<T>, 
  data: unknown, 
  defaults: Partial<T>
): T | null {
  // Ensure data is an object before spreading
  const dataObj = typeof data === 'object' && data !== null ? data : {};
  const merged = { ...defaults, ...dataObj } as unknown;
  return safeParse(schema, merged);
}

// ============================================================================
// TYPE EXPORTS (inferred from schemas)
// ============================================================================

export type ValidatedUser = z.infer<typeof UserSchema>;
export type ValidatedUserProfile = z.infer<typeof UserProfileSchema>;
export type ValidatedBoard = z.infer<typeof BoardSchema>;
export type ValidatedColumn = z.infer<typeof ColumnSchema>;
export type ValidatedCard = z.infer<typeof CardSchema>;
export type ValidatedComment = z.infer<typeof CommentSchema>;
export type ValidatedActivity = z.infer<typeof ActivitySchema>;
export type ValidatedSubBoardTemplate = z.infer<typeof SubBoardTemplateSchema>;
