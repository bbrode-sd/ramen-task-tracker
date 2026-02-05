'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { Draggable, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { Card as CardType, BoardTag } from '@/types';
import { getTagColorConfig, getLocalizedTagName } from './TagManagementModal';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { useFilter } from '@/contexts/FilterContext';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { Timestamp } from 'firebase/firestore';
import { getUserProfiles } from '@/lib/firestore';


// Helper to generate consistent color from user ID
function getAvatarColor(userId: string): string {
  const colors = [
    'from-emerald-400 to-teal-500',
    'from-blue-400 to-indigo-500',
    'from-green-400 to-emerald-500',
    'from-purple-400 to-violet-500',
    'from-pink-400 to-rose-500',
    'from-yellow-400 to-amber-500',
    'from-cyan-400 to-teal-500',
    'from-fuchsia-400 to-purple-500',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Helper to get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Mini avatar for card display - memoized to prevent unnecessary re-renders
const MiniAvatar = memo(function MiniAvatar({ 
  user,
  className = '',
}: { 
  user: { uid: string; displayName: string | null; photoURL: string | null };
  className?: string;
}) {
  return (
    <div className={`relative group/avatar ${className}`}>
      {user.photoURL ? (
        <Image
          src={user.photoURL}
          alt={user.displayName || 'User'}
          width={20}
          height={20}
          className="w-5 h-5 rounded-full object-cover ring-1 ring-[var(--surface)]"
          loading="lazy"
        />
      ) : (
        <div 
          className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(user.uid)} flex items-center justify-center ring-1 ring-[var(--surface)]`}
        >
          <span className="font-medium text-white text-[9px]">{getInitials(user.displayName)}</span>
        </div>
      )}
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {user.displayName || 'Unknown User'}
      </div>
    </div>
  );
});

// Helper function to highlight matching text - memoized for performance
const HighlightedText = memo(function HighlightedText({ text, searchQuery }: { text: string; searchQuery: string }) {
  if (!searchQuery.trim() || !text) {
    return <>{text}</>;
  }

  const query = searchQuery.toLowerCase().trim();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(query);

  if (index === -1) {
    return <>{text}</>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{match}</mark>
      {after}
    </>
  );
});

// Custom tag badge component for displaying board tags - Trello-style compact
const TagBadge = memo(function TagBadge({ 
  tag 
}: { 
  tag: BoardTag;
}) {
  const { locale } = useLocale();
  const colorConfig = getTagColorConfig(tag.color);
  const displayName = getLocalizedTagName(tag, locale);
  
  return (
    <div
      className={`h-2 w-10 rounded-sm ${colorConfig.dot}`}
      title={displayName}
      aria-label={displayName}
    />
  );
});

// Translation status indicator for cards - compact version
const TranslationStatusBadge = memo(function TranslationStatusBadge({ 
  hasEn, 
  hasJa, 
  isTranslating 
}: { 
  hasEn: boolean; 
  hasJa: boolean;
  isTranslating?: boolean;
}) {
  // If both languages are present, don't show anything
  if (hasEn && hasJa) return null;
  
  // If translating, show spinner
  if (isTranslating) {
    return (
      <div title="Translation in progress">
        <svg className="w-3.5 h-3.5 animate-spin text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }
  
  // Determine which language is missing
  const missingLang = !hasEn ? 'EN' : !hasJa ? 'JP' : null;
  if (!missingLang) return null;
  
  return (
    <div 
      className="text-[var(--warning)]"
      title={`${missingLang === 'EN' ? 'English' : 'Japanese'} translation missing`}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    </div>
  );
});

// Helper function to format due date
function formatDueDate(dueDate: Timestamp): string {
  const date = dueDate.toDate();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dueDateOnly.getTime() === today.getTime()) {
    return 'Today';
  }
  if (dueDateOnly.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// Due date status type with more granular levels
type DueDateStatus = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'future';

// Helper function to get due date status with more granular levels
function getDueDateStatus(dueDate: Timestamp): DueDateStatus {
  const date = dueDate.toDate();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffMs = dueDateOnly.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  if (diffMs < 0) {
    return 'overdue';
  }
  if (diffDays === 0) {
    return 'today';
  }
  if (diffDays === 1) {
    return 'tomorrow';
  }
  if (diffDays <= 7) {
    return 'thisWeek';
  }
  return 'future';
}

// Due date badge configuration
const dueDateConfig: Record<DueDateStatus, {
  bg: string;
  text: string;
  border: string;
  icon: 'clock' | 'calendar' | 'alert';
  label: string;
  pulse?: boolean;
}> = {
  overdue: {
    bg: 'bg-[var(--error-bg)]',
    text: 'text-[var(--error)]',
    border: 'border-[var(--error)]/30',
    icon: 'alert',
    label: 'Overdue',
    pulse: true,
  },
  today: {
    bg: 'bg-[var(--error-bg)]',
    text: 'text-[var(--error)]',
    border: 'border-[var(--error)]/30',
    icon: 'clock',
    label: 'Due today',
  },
  tomorrow: {
    bg: 'bg-orange-50 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800/50',
    icon: 'clock',
    label: 'Due tomorrow',
  },
  thisWeek: {
    bg: 'bg-[var(--warning-bg)]',
    text: 'text-[var(--warning)]',
    border: 'border-[var(--warning)]/30',
    icon: 'calendar',
    label: 'Due this week',
  },
  future: {
    bg: 'bg-[var(--surface-hover)]',
    text: 'text-[var(--text-secondary)]',
    border: 'border-[var(--border)]',
    icon: 'calendar',
    label: 'Due',
  },
};

// Due date badge component - compact Trello-style
const DueDateBadge = memo(function DueDateBadge({ 
  dueDate,
  isCompleted = false,
}: { 
  dueDate: Timestamp;
  isCompleted?: boolean;
}) {
  const status = getDueDateStatus(dueDate);
  const formattedDate = formatDueDate(dueDate);
  const config = dueDateConfig[status];
  
  // If completed, show a green completed style
  if (isCompleted) {
    return (
      <div
        className="flex items-center gap-1 text-[var(--success)]"
        title={`Completed - was due: ${formattedDate}`}
        aria-label={`Completed, was due: ${formattedDate}`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="text-[11px] line-through opacity-75">{formattedDate}</span>
      </div>
    );
  }
  
  // Render the clock icon for all states
  const renderIcon = () => (
    <svg
      className={`w-3.5 h-3.5 ${config.pulse ? 'animate-pulse' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
  
  return (
    <div
      className={`flex items-center gap-1 ${config.text}`}
      title={`${config.label}: ${formattedDate}`}
      aria-label={`${config.label}: ${formattedDate}`}
    >
      {renderIcon()}
      <span className="text-[11px]">{formattedDate}</span>
    </div>
  );
});

interface CardProps {
  card: CardType;
  index: number;
  boardId: string;
  boardTags?: BoardTag[];
  onClick: () => void;
  isDimmed?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  selectedCount?: number;
  onSelectToggle?: (cardId: string, shiftKey: boolean) => void;
  onArchive?: (cardId: string) => void;
  onDuplicate?: (cardId: string) => void;
  commentCount?: number;
  hasUnreadActivity?: boolean;
  'data-onboarding'?: string;
  isClone?: boolean;
  cloneProvided?: DraggableProvided;
  cloneSnapshot?: DraggableStateSnapshot;
}

/**
 * Card Component - Accessible draggable card
 * 
 * Accessibility Testing Points:
 * - VoiceOver/NVDA: Card should announce title and drag instructions
 * - Space/Enter should open card details
 * - Drag operation should be announced to screen readers
 */

interface AssigneeData {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

function CardComponent({ 
  card, 
  index, 
  boardTags = [],
  onClick, 
  isDimmed = false, 
  isFocused = false, 
  isSelected = false,
  selectedCount = 0,
  onSelectToggle,
  onArchive,
  onDuplicate,
  commentCount = 0,
  hasUnreadActivity = false,
  'data-onboarding': dataOnboarding,
  isClone = false,
  cloneProvided,
  cloneSnapshot,
}: CardProps) {
  const { searchQuery } = useFilter();
  const { setHoveredCardId } = useKeyboardShortcuts();
  const { user } = useAuth();
  const { settings: translationSettings } = useTranslation();
  const userTextDisplayMode = translationSettings.userTextDisplayMode;
  
  // Check if current user is watching this card
  const isWatching = useMemo(() => {
    return user && card.watcherIds ? card.watcherIds.includes(user.uid) : false;
  }, [user, card.watcherIds]);
  const hasAttachments = card.attachments && card.attachments.length > 0;
  const [showLongPressIndicator, setShowLongPressIndicator] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLElement>(null);

  // Handle hover tracking for keyboard shortcuts
  const handleMouseEnter = useCallback(() => {
    setHoveredCardId(card.id);
  }, [card.id, setHoveredCardId]);

  const handleMouseLeave = useCallback(() => {
    setHoveredCardId(null);
  }, [setHoveredCardId]);

  // Touch event handlers for long-press feedback
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowLongPressIndicator(true);
    }, 100);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setShowLongPressIndicator(false);
  };

  // Handle click with shift key for multi-select
  const handleClick = (e: React.MouseEvent) => {
    if (onSelectToggle && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onSelectToggle(card.id, true);
    } else {
      onClick();
    }
  };

  // Get drag styles based on snapshot
  // Let the library handle all transform/transition during drag/drop
  // IMPORTANT: Do NOT add scale() or rotate() transforms here - they conflict with
  // the library's cursor-based positioning and cause the card to appear offset.
  // Visual effects (elevation, glow) are handled via the card-dragging CSS class.
  const getDragStyle = (snapshot: DraggableStateSnapshot, draggableStyle: React.CSSProperties | undefined) => {
    // During drop animation, don't interfere with the library's animation
    if (snapshot.isDropAnimating) {
      return {
        ...draggableStyle,
        // Force the drop animation to complete quickly
        transitionDuration: '0.001s',
      };
    }
    
    if (!snapshot.isDragging) {
      return draggableStyle;
    }

    // When dragging, only disable transitions - let the library control all transforms
    return {
      ...draggableStyle,
      transition: 'none',
    };
  };
  
  // Memoize cover image computation to prevent recalculation on every render
  const coverData = useMemo(() => {
    if (!card.coverImage) return null;
    
    if (card.coverImage.color) {
      return { type: 'color' as const, color: card.coverImage.color };
    }
    
    if (card.coverImage.attachmentId) {
      const attachment = card.attachments?.find(a => a.id === card.coverImage?.attachmentId);
      if (attachment && attachment.type === 'image') {
        return { type: 'image' as const, url: attachment.url };
      }
    }
    
    return null;
  }, [card.coverImage, card.attachments]);
  
  // Memoize checklist progress computation
  const { hasChecklists, checklistStats } = useMemo(() => {
    const hasChecklists = card.checklists && card.checklists.length > 0;
    const stats = hasChecklists
      ? card.checklists!.reduce(
          (acc, checklist) => {
            const completed = checklist.items.filter(item => item.isCompleted).length;
            const total = checklist.items.length;
            return { completed: acc.completed + completed, total: acc.total + total };
          },
          { completed: 0, total: 0 }
        )
      : { completed: 0, total: 0 };
    return { hasChecklists, checklistStats: stats };
  }, [card.checklists]);
  
  // Compute resolved tags from card.tagIds and boardTags
  const resolvedTags = useMemo(() => {
    if (!card.tagIds?.length || !boardTags?.length) return [];
    return card.tagIds
      .map(tagId => boardTags.find(t => t.id === tagId))
      .filter((t): t is BoardTag => t !== undefined)
      .sort((a, b) => a.order - b.order);
  }, [card.tagIds, boardTags]);
  const hasTags = resolvedTags.length > 0;
  
  // Assignee state
  const [assignees, setAssignees] = useState<AssigneeData[]>([]);
  const hasAssignees = card.assigneeIds && card.assigneeIds.length > 0;
  const maxVisibleAssignees = 3;
  const extraAssignees = hasAssignees ? Math.max(0, card.assigneeIds!.length - maxVisibleAssignees) : 0;

  // Load assignees - use stringified key for stable dependency
  const assigneeIdsKey = useMemo(() => card.assigneeIds?.join(',') ?? '', [card.assigneeIds]);
  
  useEffect(() => {
    const loadAssignees = async () => {
      if (!card.assigneeIds?.length) {
        setAssignees([]);
        return;
      }
      
      const profiles = await getUserProfiles(card.assigneeIds);
      const assigneeList: AssigneeData[] = card.assigneeIds
        .map(id => {
          const profile = profiles.get(id);
          if (!profile) return null;
          return {
            uid: profile.uid,
            displayName: profile.displayName,
            photoURL: profile.photoURL,
          };
        })
        .filter((a): a is AssigneeData => a !== null);
      
      setAssignees(assigneeList);
    };
    loadAssignees();
  }, [assigneeIdsKey, card.assigneeIds]);

  // Generate accessible label for the card
  const cardLabel = `${card.titleEn || 'Untitled card'}${card.titleJa ? `, Japanese: ${card.titleJa}` : ''}`;
  const dragInstructions = 'Press space bar to lift. Use arrow keys to move. Press space bar to drop.';
  
  const renderCard = (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
    <article
      ref={(el) => {
        provided.innerRef(el);
        (cardRef as React.MutableRefObject<HTMLElement | null>).current = el;
      }}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-card-id={card.id}
      data-onboarding={dataOnboarding}
      tabIndex={isFocused ? 0 : -1}
      role="button"
      aria-label={cardLabel}
      aria-describedby={`card-drag-instructions-${card.id}`}
      aria-grabbed={snapshot.isDragging}
      aria-selected={isSelected}
      style={getDragStyle(snapshot, provided.draggableProps.style)}
      className={`relative bg-[var(--surface)] rounded-md mb-1.5 cursor-pointer border group drag-handle
        ${snapshot.isDragging 
          ? 'card-dragging drag-shadow z-50' 
          : 'shadow-sm hover:shadow-md transition-[box-shadow,border-color,opacity,ring] duration-150 hover:border-[var(--text-tertiary)]'
        }
        ${isDimmed ? 'opacity-40 scale-[0.98] border-[var(--border-subtle)]' : ''} 
        ${isFocused && !snapshot.isDragging ? 'ring-2 ring-[var(--primary)] border-[var(--primary)] shadow-md' : 'border-[var(--border)]'}
        ${isSelected && !snapshot.isDragging ? 'ring-2 ring-[var(--primary)] bg-[var(--primary-light)]' : ''}
      `}
    >
          {/* Screen reader drag instructions */}
          <span id={`card-drag-instructions-${card.id}`} className="sr-only">
            {dragInstructions}
          </span>
          {/* Long press indicator for touch devices */}
          {showLongPressIndicator && <div className="long-press-indicator" />}
          
          {/* Multi-select badge when dragging multiple */}
          {snapshot.isDragging && selectedCount > 1 && (
            <div className="multi-select-badge">
              {selectedCount}
            </div>
          )}
          
          {/* Notification badge for unread activity */}
          {hasUnreadActivity && !isSelected && !snapshot.isDragging && (
            <div 
              className="absolute top-1 right-1 w-3.5 h-3.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center shadow-sm ring-2 ring-[var(--surface)] z-10 animate-pulse"
              title="New activity on this card"
              aria-label="New activity"
            >
              <span className="sr-only">New activity</span>
            </div>
          )}
          
          
          {/* Cover image/color if exists */}
          {coverData && (
            coverData.type === 'image' ? (
              <div className="rounded-t-md overflow-hidden bg-black/50">
                <Image
                  src={coverData.url}
                  alt="Card cover"
                  width={300}
                  height={140}
                  loading="lazy"
                  sizes="260px"
                  style={{ width: '100%', height: 'auto' }}
                  className="max-h-[140px] object-contain"
                />
              </div>
            ) : (
              <div 
                className="h-8 rounded-t-md"
                style={{ backgroundColor: coverData.color }}
              />
            )
          )}

          <div className="px-2 py-1.5">
            {/* Tags - Trello-style colored bars */}
            {hasTags && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {resolvedTags.map(tag => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}

            {/* Labels (legacy) */}
            {card.labels && card.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {card.labels.map((label, i) => (
                  <span
                    key={i}
                    className="h-2 w-10 rounded-sm bg-[var(--primary)]"
                    title={label}
                  />
                ))}
              </div>
            )}

            {/* Title - compact, single or dual language */}
            <div className="space-y-0.5">
              {/* English */}
              {(userTextDisplayMode === 'both' || userTextDisplayMode === 'en') && (
                <div className="flex items-start gap-1.5">
                  {userTextDisplayMode === 'both' && (
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-4 text-[9px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded mt-0.5">
                      EN
                    </span>
                  )}
                  <p className="text-sm text-[var(--text-primary)] leading-snug">
                    {card.titleEn ? <HighlightedText text={card.titleEn} searchQuery={searchQuery} /> : '—'}
                  </p>
                </div>
              )}
              
              {/* Japanese */}
              {(userTextDisplayMode === 'both' || userTextDisplayMode === 'ja') && (
                <div className="flex items-start gap-1.5">
                  {userTextDisplayMode === 'both' && (
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-4 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 rounded mt-0.5">
                      JP
                    </span>
                  )}
                  <p className={`text-sm leading-snug ${userTextDisplayMode === 'both' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                    {card.titleJa ? (
                      <HighlightedText text={card.titleJa} searchQuery={searchQuery} />
                    ) : (
                      <span className="text-[var(--text-muted)] italic text-xs">翻訳中...</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Card metadata - Trello-style compact icons */}
            {(card.descriptionEn || card.descriptionJa || hasAttachments || card.dueDate || hasAssignees || (hasChecklists && checklistStats.total > 0) || card.subBoardId || commentCount > 0 || isWatching) && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[var(--text-tertiary)]">
                {/* Due date */}
                {card.dueDate && (
                  <DueDateBadge 
                    dueDate={card.dueDate} 
                    isCompleted={hasChecklists && checklistStats.total > 0 && checklistStats.completed === checklistStats.total}
                  />
                )}

                {/* Translation status */}
                <TranslationStatusBadge
                  hasEn={!!card.titleEn && (!card.descriptionJa || !!card.descriptionEn)}
                  hasJa={!!card.titleJa && (!card.descriptionEn || !!card.descriptionJa)}
                  isTranslating={!card.titleJa && !!card.titleEn}
                />

                {/* Watching indicator */}
                {isWatching && (
                  <span title="You are watching this card">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  </span>
                )}

                {/* Description indicator */}
                {(card.descriptionEn || card.descriptionJa) && (
                  <span title="Has description">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </span>
                )}

                {/* Comments */}
                {commentCount > 0 && (
                  <div className="flex items-center gap-0.5" title={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-[11px]">{commentCount}</span>
                  </div>
                )}

                {/* Attachments */}
                {hasAttachments && (
                  <div className="flex items-center gap-0.5" title={`${card.attachments.length} attachment${card.attachments.length !== 1 ? 's' : ''}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-[11px]">{card.attachments.length}</span>
                  </div>
                )}

                {/* Checklist progress */}
                {hasChecklists && checklistStats.total > 0 && (
                  <div 
                    className={`flex items-center gap-0.5 ${checklistStats.completed === checklistStats.total ? 'text-[var(--success)]' : ''}`}
                    title={`Checklist: ${checklistStats.completed}/${checklistStats.total} completed`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-[11px]">{checklistStats.completed}/{checklistStats.total}</span>
                  </div>
                )}

                {/* Sub-board */}
                {card.subBoardId && (
                  <div 
                    className={`flex items-center gap-0.5 ${
                      typeof card.subBoardTotalCount === 'number' && card.subBoardApprovedCount === card.subBoardTotalCount && card.subBoardTotalCount > 0
                        ? 'text-[var(--success)]'
                        : 'text-purple-500 dark:text-purple-400'
                    }`}
                    title={`Sub-board: ${card.subBoardApprovedCount ?? 0}${typeof card.subBoardTotalCount === 'number' ? `/${card.subBoardTotalCount}` : ''}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <span className="text-[11px]">{card.subBoardApprovedCount ?? 0}{typeof card.subBoardTotalCount === 'number' ? `/${card.subBoardTotalCount}` : ''}</span>
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Assignees */}
                {hasAssignees && (
                  <div className="flex items-center -space-x-1">
                    {assignees.slice(0, maxVisibleAssignees).map((assignee) => (
                      <MiniAvatar key={assignee.uid} user={assignee} />
                    ))}
                    {extraAssignees > 0 && (
                      <div className="w-5 h-5 rounded-full bg-[var(--surface-hover)] flex items-center justify-center ring-1 ring-[var(--surface)]">
                        <span className="text-[9px] font-medium text-[var(--text-secondary)]">+{extraAssignees}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
    </article>
  );

  if (isClone && cloneProvided && cloneSnapshot) {
    return renderCard(cloneProvided, cloneSnapshot);
  }

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => renderCard(provided, snapshot)}
    </Draggable>
  );
}

// Shallow array comparison - much faster than JSON.stringify
function shallowArrayEqual<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Shallow object comparison for coverImage
function coverImageEqual(a: CardType['coverImage'], b: CardType['coverImage']): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  return a.attachmentId === b.attachmentId && a.color === b.color;
}

function getCoverAttachmentSignature(card: CardType): string {
  if (!card.coverImage?.attachmentId || !card.attachments?.length) return '';
  const coverAttachment = card.attachments.find(
    attachment => attachment.id === card.coverImage?.attachmentId
  );
  if (!coverAttachment) return '';
  return `${coverAttachment.id}:${coverAttachment.url}:${coverAttachment.type}`;
}

// Compare checklists by their IDs and item completion status only
function checklistsEqual(a: CardType['checklists'], b: CardType['checklists']): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].items.length !== b[i].items.length) return false;
    // Only check completion status changed, not every property
    for (let j = 0; j < a[i].items.length; j++) {
      if (a[i].items[j].isCompleted !== b[i].items[j].isCompleted) return false;
    }
  }
  return true;
}

// Export memoized Card component - only re-renders when props change
// React DevTools Profiler: This component should highlight less frequently after memoization
export const Card = memo(CardComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance - avoid JSON.stringify
  // Only re-render if these specific props change
  const prevCoverAttachmentSignature = getCoverAttachmentSignature(prevProps.card);
  const nextCoverAttachmentSignature = getCoverAttachmentSignature(nextProps.card);

  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.card.titleEn === nextProps.card.titleEn &&
    prevProps.card.titleJa === nextProps.card.titleJa &&
    prevProps.card.columnId === nextProps.card.columnId &&
    prevProps.card.order === nextProps.card.order &&
    coverImageEqual(prevProps.card.coverImage, nextProps.card.coverImage) &&
    prevProps.card.dueDate === nextProps.card.dueDate &&
    prevProps.index === nextProps.index &&
    prevProps.isDimmed === nextProps.isDimmed &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.selectedCount === nextProps.selectedCount &&
    prevProps.commentCount === nextProps.commentCount &&
    prevProps.hasUnreadActivity === nextProps.hasUnreadActivity &&
    prevProps.onArchive === nextProps.onArchive &&
    prevProps.onDuplicate === nextProps.onDuplicate &&
    shallowArrayEqual(prevProps.card.labels, nextProps.card.labels) &&
    checklistsEqual(prevProps.card.checklists, nextProps.card.checklists) &&
    prevProps.card.attachments?.length === nextProps.card.attachments?.length &&
    prevCoverAttachmentSignature === nextCoverAttachmentSignature &&
    shallowArrayEqual(prevProps.card.assigneeIds, nextProps.card.assigneeIds) &&
    shallowArrayEqual(prevProps.card.watcherIds, nextProps.card.watcherIds) &&
    shallowArrayEqual(prevProps.card.tagIds, nextProps.card.tagIds) &&
    prevProps.boardTags === nextProps.boardTags &&
    prevProps.card.subBoardId === nextProps.card.subBoardId &&
    prevProps.card.subBoardApprovedCount === nextProps.card.subBoardApprovedCount &&
    prevProps.card.subBoardTotalCount === nextProps.card.subBoardTotalCount
  );
});
