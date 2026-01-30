/**
 * Shared utilities for CardModal components
 */

/**
 * Avatar gradient colors for users without profile photos
 */
const AVATAR_COLORS = [
  'from-orange-400 to-red-500',
  'from-blue-400 to-indigo-500',
  'from-green-400 to-emerald-500',
  'from-purple-400 to-violet-500',
  'from-pink-400 to-rose-500',
  'from-yellow-400 to-amber-500',
  'from-cyan-400 to-teal-500',
  'from-fuchsia-400 to-purple-500',
];

/**
 * Generate consistent gradient color from user ID
 */
export function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Get initials from a name (first and last initials, or first 2 chars)
 */
export function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Cover colors for card covers (matching board background colors)
 */
export const COVER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
  '#1e293b', // dark slate
];
