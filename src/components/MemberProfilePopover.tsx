'use client';

import { useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { BoardMember } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';

interface MemberProfilePopoverProps {
  member: BoardMember;
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  onViewActivity?: (memberId: string) => void;
  isCurrentUser?: boolean;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

function calculatePosition(anchorEl: HTMLElement | null) {
  if (!anchorEl) return null;
  
  const rect = anchorEl.getBoundingClientRect();
  const popoverWidth = 320;
  const popoverHeight = 280;
  
  // Position below the anchor, centered
  let left = rect.left + rect.width / 2 - popoverWidth / 2;
  let top = rect.bottom + 8;
  
  // Ensure it doesn't go off the right edge
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }
  
  // Ensure it doesn't go off the left edge
  if (left < 16) {
    left = 16;
  }
  
  // If it would go below the viewport, position above
  if (top + popoverHeight > window.innerHeight - 16) {
    top = rect.top - popoverHeight - 8;
  }
  
  return { top, left };
}

export function MemberProfilePopover({
  member,
  isOpen,
  onClose,
  anchorEl,
  onViewActivity,
  isCurrentUser = false,
}: MemberProfilePopoverProps) {
  const { t } = useLocale();
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // Calculate position immediately from anchor element
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const position = useMemo(() => calculatePosition(anchorEl), [anchorEl, isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && 
          anchorEl && !anchorEl.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      // Use setTimeout to avoid immediate close from the same click
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, anchorEl]);

  // Don't render until we have a valid position
  if (!isOpen || !position) return null;

  return (
    <div className="fixed inset-0 z-[60]" style={{ pointerEvents: 'none' }}>
      <div
        ref={popoverRef}
        className="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ 
          top: position.top, 
          left: position.left, 
          width: 320,
          pointerEvents: 'auto',
        }}
      >
        {/* Header with gradient background */}
        <div className="relative h-24 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Avatar - overlapping the header */}
        <div className="relative px-6 -mt-12">
          {member.photoURL ? (
            <Image
              src={member.photoURL}
              alt={member.displayName || member.email}
              width={80}
              height={80}
              className="w-20 h-20 rounded-full ring-4 ring-white dark:ring-gray-800 object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full ring-4 ring-white dark:ring-gray-800 bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-2xl font-bold">
              {getInitials(member.displayName, member.email)}
            </div>
          )}
        </div>

        {/* Member info */}
        <div className="px-6 pt-3 pb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {member.displayName || member.email.split('@')[0]}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {member.email}
          </p>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 dark:border-gray-700">
          {isCurrentUser && (
            <button
              onClick={() => {
                // TODO: Implement edit profile
                onClose();
              }}
              className="w-full px-6 py-3.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <span>{t('member.editProfile')}</span>
            </button>
          )}
          {onViewActivity && (
            <button
              onClick={() => {
                onViewActivity(member.uid);
                onClose();
              }}
              className="w-full px-6 py-3.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <span>{t('member.viewActivity')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
