'use client';

import Image from 'next/image';
import { getAvatarColor, getInitials } from './utils';

interface UserAvatarProps {
  user: { uid: string; displayName: string | null; photoURL: string | null };
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onRemove?: () => void;
}

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

const SIZE_PIXELS = {
  sm: 24,
  md: 32,
  lg: 40,
};

/**
 * Avatar component with photo or initials fallback
 */
export function UserAvatar({ 
  user, 
  size = 'md',
  showTooltip = true,
  onRemove,
}: UserAvatarProps) {
  return (
    <div className="relative group">
      {user.photoURL ? (
        <Image
          src={user.photoURL}
          alt={user.displayName || 'User'}
          width={SIZE_PIXELS[size]}
          height={SIZE_PIXELS[size]}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover ring-2 ring-white`}
        />
      ) : (
        <div 
          className={`${SIZE_CLASSES[size]} rounded-full bg-gradient-to-br ${getAvatarColor(user.uid)} flex items-center justify-center ring-2 ring-white`}
        >
          <span className="font-medium text-white">{getInitials(user.displayName)}</span>
        </div>
      )}
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
          {user.displayName || 'Unknown User'}
        </div>
      )}
      
      {/* Remove button */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
