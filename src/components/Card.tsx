'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { Draggable, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { Card as CardType } from '@/types';
import { useFilter } from '@/contexts/FilterContext';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip } from './Tooltip';
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
    <div className={`relative group ${className}`}>
      {user.photoURL ? (
        <Image
          src={user.photoURL}
          alt={user.displayName || 'User'}
          width={24}
          height={24}
          className="w-6 h-6 rounded-full object-cover ring-2 ring-[var(--surface)]"
          loading="lazy"
        />
      ) : (
        <div 
          className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(user.uid)} flex items-center justify-center ring-2 ring-[var(--surface)]`}
        >
          <span className="font-medium text-white text-[10px]">{getInitials(user.displayName)}</span>
        </div>
      )}
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
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

// Priority badge component with colored indicator
const PriorityBadge = memo(function PriorityBadge({ 
  priority 
}: { 
  priority: 'low' | 'medium' | 'high' | 'urgent' | null | undefined;
}) {
  if (!priority) return null;
  
  const priorityConfig = {
    low: {
      bg: 'bg-[var(--surface-hover)]',
      text: 'text-[var(--text-secondary)]',
      border: 'border-[var(--border)]',
      dot: 'bg-slate-400 dark:bg-slate-500',
      label: 'Low',
    },
    medium: {
      bg: 'bg-[var(--warning-bg)]',
      text: 'text-[var(--warning)]',
      border: 'border-[var(--warning)]/30',
      dot: 'bg-[var(--warning)]',
      label: 'Medium',
    },
    high: {
      bg: 'bg-orange-50 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-800/50',
      dot: 'bg-orange-500',
      label: 'High',
    },
    urgent: {
      bg: 'bg-[var(--error-bg)]',
      text: 'text-[var(--error)]',
      border: 'border-[var(--error)]/30',
      dot: 'bg-[var(--error)] animate-pulse',
      label: 'Urgent',
    },
  };
  
  const config = priorityConfig[priority];
  
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
      title={`Priority: ${config.label}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} aria-hidden="true" />
      <span>{config.label}</span>
    </div>
  );
});

// Translation status indicator for cards - shows when one language is missing
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
      <div 
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--info-bg)] text-[var(--info)] border border-[var(--info)]/30"
        title="Translation in progress"
      >
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning)]/30"
      title={`${missingLang === 'EN' ? 'English' : 'Japanese'} translation missing`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
      <span>{missingLang === 'EN' ? 'JP only' : 'EN only'}</span>
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

// Due date badge component with enhanced styling
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
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/30"
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
        <span aria-hidden="true" className="line-through opacity-75">{formattedDate}</span>
      </div>
    );
  }
  
  // Render the appropriate icon
  const renderIcon = () => {
    switch (config.icon) {
      case 'alert':
        return (
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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'clock':
        return (
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'calendar':
      default:
        return (
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        );
    }
  };
  
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
      title={`${config.label}: ${formattedDate}`}
      aria-label={`${config.label}: ${formattedDate}`}
    >
      {renderIcon()}
      <span aria-hidden="true">{formattedDate}</span>
    </div>
  );
});

interface CardProps {
  card: CardType;
  index: number;
  boardId: string;
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
  'data-onboarding': dataOnboarding 
}: CardProps) {
  const { searchQuery } = useFilter();
  const { setHoveredCardId } = useKeyboardShortcuts();
  const { user } = useAuth();
  
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
  
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
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
          className={`relative bg-[var(--surface)] rounded-xl mb-2.5 cursor-pointer border group drag-handle
            ${snapshot.isDragging 
              ? 'card-dragging drag-shadow z-50' 
              : 'shadow-sm hover:shadow-xl transition-[box-shadow,border-color,opacity,ring] duration-200 hover:ring-1 hover:ring-[var(--primary)] hover:border-[var(--primary)]'
            }
            ${'' /* removed animate-drop - was causing visual hangs */}
            ${isDimmed ? 'opacity-40 scale-[0.98] border-[var(--border-subtle)]' : ''} 
            ${isFocused && !snapshot.isDragging ? 'ring-2 ring-[var(--primary)] border-[var(--primary)] shadow-lg' : 'border-[var(--border)]'}
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
          
          {/* Selection checkmark */}
          {isSelected && !snapshot.isDragging && (
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md z-10">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          
          {/* Notification badge for unread activity */}
          {hasUnreadActivity && !isSelected && !snapshot.isDragging && (
            <div 
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center shadow-md z-10 animate-pulse"
              title="New activity on this card"
              aria-label="New activity"
            >
              <span className="sr-only">New activity</span>
            </div>
          )}
          
          
          {/* Cover image/color if exists */}
          {coverData && (
            coverData.type === 'image' ? (
              <div className="rounded-t-xl overflow-hidden transition-all duration-300 bg-black/50">
                <Image
                  src={coverData.url}
                  alt="Card cover"
                  width={400}
                  height={180}
                  loading="lazy"
                  sizes="300px"
                  className="w-full h-auto max-h-[180px] object-contain group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
            ) : (
              <div 
                className="h-10 rounded-t-xl transition-all duration-300"
                style={{ backgroundColor: coverData.color }}
              />
            )
          )}

          <div className="p-3.5">
            {/* Labels */}
            {card.labels && card.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {card.labels.map((label, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Bilingual Title */}
            <div className="space-y-2.5">
              {/* English */}
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-5 text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded-md mt-0.5 border border-sky-200/60 dark:border-sky-700/50">
                  EN
                </span>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                    {card.titleEn ? <HighlightedText text={card.titleEn} searchQuery={searchQuery} /> : '—'}
                  </p>
              </div>
              
              {/* Japanese */}
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 rounded-md mt-0.5 border border-rose-200/60 dark:border-rose-700/50">
                  JP
                </span>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {card.titleJa ? (
                    <HighlightedText text={card.titleJa} searchQuery={searchQuery} />
                  ) : (
                    <span className="text-[var(--text-muted)] italic flex items-center gap-1.5">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      翻訳中...
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Card metadata */}
            {(card.descriptionEn || card.descriptionJa || hasAttachments || card.dueDate || card.priority || hasAssignees || (hasChecklists && checklistStats.total > 0) || card.subBoardId) && (
              <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-700">
                {/* Priority badge */}
                <PriorityBadge priority={card.priority} />

                {/* Due date badge */}
                {card.dueDate && (
                  <DueDateBadge 
                    dueDate={card.dueDate} 
                    isCompleted={hasChecklists && checklistStats.total > 0 && checklistStats.completed === checklistStats.total}
                  />
                )}

                {/* Translation status badge */}
                <TranslationStatusBadge
                  hasEn={!!card.titleEn && (!card.descriptionJa || !!card.descriptionEn)}
                  hasJa={!!card.titleJa && (!card.descriptionEn || !!card.descriptionJa)}
                  isTranslating={!card.titleJa && !!card.titleEn}
                />

                {/* Watching indicator */}
                {isWatching && (
                  <div 
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-600 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800"
                    title="You are watching this card"
                  >
                    <svg className="w-3 h-3" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </div>
                )}

                {/* Description indicator */}
                {(card.descriptionEn || card.descriptionJa) && (
                  <Tooltip content="This card has a description." position="top">
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h7"
                        />
                      </svg>
                    </div>
                  </Tooltip>
                )}

                {/* Comments indicator */}
                {commentCount > 0 && (
                  <Tooltip content={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`} position="top">
                    <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span className="text-xs font-medium">{commentCount}</span>
                    </div>
                  </Tooltip>
                )}

                {/* Attachments indicator */}
                {hasAttachments && (
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500" title="Has attachments">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                    <span className="text-xs font-medium">{card.attachments.length}</span>
                  </div>
                )}

                {/* Checklist progress indicator */}
                {hasChecklists && checklistStats.total > 0 && (
                  <div 
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      checklistStats.completed === checklistStats.total
                        ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/30'
                        : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border)]'
                    }`}
                    title={`Checklist: ${checklistStats.completed}/${checklistStats.total} completed`}
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${
                        checklistStats.completed === checklistStats.total ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                    <span>{checklistStats.completed}/{checklistStats.total}</span>
                  </div>
                )}

                {/* Sub-board progress indicator */}
                {card.subBoardId && (
                  <Tooltip content={`Sub-board: ${card.subBoardApprovedCount ?? 0} approved${typeof card.subBoardTotalCount === 'number' ? ` of ${card.subBoardTotalCount} total` : ''}`} position="top">
                    <div 
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${
                        typeof card.subBoardTotalCount === 'number' && card.subBoardApprovedCount === card.subBoardTotalCount && card.subBoardTotalCount > 0
                          ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/30'
                          : 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-700/50'
                      }`}
                      title={`Sub-board: ${card.subBoardApprovedCount ?? 0}${typeof card.subBoardTotalCount === 'number' ? `/${card.subBoardTotalCount}` : ''}`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                        />
                      </svg>
                      <span>{card.subBoardApprovedCount ?? 0}{typeof card.subBoardTotalCount === 'number' ? `/${card.subBoardTotalCount}` : ''}</span>
                      {typeof card.subBoardTotalCount === 'number' && card.subBoardApprovedCount === card.subBoardTotalCount && card.subBoardTotalCount > 0 && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </div>
                  </Tooltip>
                )}

                {/* Spacer to push assignees to the right */}
                <div className="flex-1" />

                {/* Assignees */}
                {hasAssignees && (
                  <div className="flex items-center -space-x-1.5">
                    {assignees.slice(0, maxVisibleAssignees).map((assignee) => (
                      <MiniAvatar key={assignee.uid} user={assignee} />
                    ))}
                    {extraAssignees > 0 && (
                      <div className="w-6 h-6 rounded-full bg-[var(--surface-hover)] flex items-center justify-center ring-2 ring-[var(--surface)]">
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">+{extraAssignees}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </article>
      )}
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
    prevProps.card.priority === nextProps.card.priority &&
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
    prevProps.card.subBoardId === nextProps.card.subBoardId &&
    prevProps.card.subBoardApprovedCount === nextProps.card.subBoardApprovedCount &&
    prevProps.card.subBoardTotalCount === nextProps.card.subBoardTotalCount
  );
});
