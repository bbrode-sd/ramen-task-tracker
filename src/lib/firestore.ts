/**
 * Firestore operations - backwards compatibility re-export
 * 
 * This file re-exports from the modular structure at '@/lib/firestore/'.
 * For new code, prefer importing from specific modules:
 * - '@/lib/firestore/users'
 * - '@/lib/firestore/boards'
 * - '@/lib/firestore/columns'
 * - '@/lib/firestore/cards'
 * - '@/lib/firestore/comments'
 * - '@/lib/firestore/activities'
 * - '@/lib/firestore/templates'
 * 
 * Or use the barrel export: '@/lib/firestore'
 */

export * from './firestore/index';
