/**
 * Migration script to sync memberIds from parent boards to all sub-boards and template boards.
 * 
 * This fixes the issue where members added to a board after sub-boards were created
 * don't have access to those sub-boards.
 * 
 * Usage:
 *   1. Download a service account key from Firebase Console:
 *      Project Settings > Service Accounts > Generate New Private Key
 *   2. Save it as `service-account-key.json` in the project root (it's gitignored)
 *   3. Run: npx tsx scripts/migrate-subboard-members.ts
 * 
 * The script will:
 *   - Find all parent boards (boards without parentBoardId)
 *   - For each parent board, find all sub-boards and template boards
 *   - Update sub-boards to have the same memberIds as their parent
 *   - Recursively handle nested sub-boards
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load service account key
const serviceAccountPath = join(process.cwd(), 'service-account-key.json');
let serviceAccount: ServiceAccount;

try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  console.error('❌ Could not load service-account-key.json');
  console.error('');
  console.error('Please download a service account key from Firebase Console:');
  console.error('  1. Go to Project Settings > Service Accounts');
  console.error('  2. Click "Generate New Private Key"');
  console.error('  3. Save the file as "service-account-key.json" in the project root');
  process.exit(1);
}

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

interface Board {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  parentBoardId?: string;
  parentCardId?: string;
  templateForBoardId?: string;
  isTemplate?: boolean;
  isArchived?: boolean;
}

/**
 * Get all child boards (sub-boards and template boards) for a parent board
 */
async function getChildBoards(parentBoardId: string): Promise<Board[]> {
  const childBoards: Board[] = [];

  // Get sub-boards
  const subBoardsSnapshot = await db
    .collection('boards')
    .where('parentBoardId', '==', parentBoardId)
    .where('isArchived', '==', false)
    .get();

  subBoardsSnapshot.docs.forEach((doc) => {
    childBoards.push({ id: doc.id, ...doc.data() } as Board);
  });

  // Get template boards
  const templateBoardsSnapshot = await db
    .collection('boards')
    .where('templateForBoardId', '==', parentBoardId)
    .where('isArchived', '==', false)
    .get();

  templateBoardsSnapshot.docs.forEach((doc) => {
    childBoards.push({ id: doc.id, ...doc.data() } as Board);
  });

  return childBoards;
}

/**
 * Recursively sync memberIds from parent to all child boards
 */
async function syncMembersToChildBoards(
  parentBoard: Board,
  stats: { updated: number; skipped: number; errors: number }
): Promise<void> {
  const childBoards = await getChildBoards(parentBoard.id);

  for (const childBoard of childBoards) {
    // Calculate the new memberIds - union of parent's members
    // We merge rather than replace to preserve any direct members
    const newMemberIds = [...new Set([...parentBoard.memberIds])];
    
    // Check if update is needed
    const currentMemberSet = new Set(childBoard.memberIds);
    const newMemberSet = new Set(newMemberIds);
    const needsUpdate = 
      newMemberIds.some(id => !currentMemberSet.has(id)) ||
      childBoard.memberIds.some(id => !newMemberSet.has(id));

    if (!needsUpdate) {
      console.log(`  ⏭️  Skipping "${childBoard.name}" - already in sync`);
      stats.skipped++;
    } else {
      try {
        await db.collection('boards').doc(childBoard.id).update({
          memberIds: newMemberIds,
          updatedAt: Timestamp.now(),
        });
        
        const addedCount = newMemberIds.filter(id => !currentMemberSet.has(id)).length;
        console.log(`  ✅ Updated "${childBoard.name}" - added ${addedCount} member(s)`);
        stats.updated++;
      } catch (error) {
        console.error(`  ❌ Failed to update "${childBoard.name}":`, error);
        stats.errors++;
      }
    }

    // Recursively sync to nested sub-boards
    // Pass the parent's memberIds down (not the child's, to ensure consistency)
    await syncMembersToChildBoards(
      { ...childBoard, memberIds: newMemberIds },
      stats
    );
  }
}

async function runMigration() {
  console.log('🚀 Starting sub-board member sync migration...');
  console.log('');

  // Get all parent boards (boards without parentBoardId and not templates)
  const parentBoardsSnapshot = await db
    .collection('boards')
    .where('isArchived', '==', false)
    .get();

  const parentBoards = parentBoardsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as Board))
    .filter((board) => !board.parentBoardId && !board.isTemplate);

  console.log(`📋 Found ${parentBoards.length} parent board(s)`);
  console.log('');

  const stats = { updated: 0, skipped: 0, errors: 0 };

  for (const parentBoard of parentBoards) {
    console.log(`📁 Processing "${parentBoard.name}" (${parentBoard.memberIds.length} members)`);
    await syncMembersToChildBoards(parentBoard, stats);
  }

  console.log('');
  console.log('✨ Migration complete!');
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Errors:  ${stats.errors}`);
}

runMigration().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
