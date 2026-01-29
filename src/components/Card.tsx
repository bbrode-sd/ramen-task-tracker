'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { Draggable, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { Card as CardType } from '@/types';
import { useFilter } from '@/contexts/FilterContext';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import Image from 'next/image';
import { Timestamp } from 'firebase/firestore';
import { getUserProfiles } from '@/lib/firestore';


// Helper to generate consistent color from user ID
function getAvatarColor(userId: string): string {
  const colors = [
    'from-orange-400 to-red-500',
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
          className="w-6 h-6 rounded-full object-cover ring-2 ring-white"
          loading="lazy"
        />
      ) : (
        <div 
          className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(user.uid)} flex items-center justify-center ring-2 ring-white`}
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
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200"
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
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200"
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

// Helper function to get due date status
function getDueDateStatus(dueDate: Timestamp): 'overdue' | 'soon' | 'future' {
  const date = dueDate.toDate();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffMs = dueDateOnly.getTime() - today.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffMs < 0) {
    return 'overdue';
  }
  if (diffHours <= 24) {
    return 'soon';
  }
  return 'future';
}

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
  'data-onboarding': dataOnboarding 
}: CardProps) {
  const { searchQuery } = useFilter();
  const { setHoveredCardId } = useKeyboardShortcuts();
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
  const getDragStyle = (snapshot: DraggableStateSnapshot, draggableStyle: React.CSSProperties | undefined) => {
    if (!snapshot.isDragging) {
      return {
        ...draggableStyle,
        transition: snapshot.isDropAnimating 
          ? 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)' 
          : draggableStyle?.transition,
      };
    }

    return {
      ...draggableStyle,
      transform: draggableStyle?.transform,
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
          className={`relative bg-white rounded-xl mb-2.5 cursor-pointer border group drag-handle
            ${snapshot.isDragging 
              ? 'card-dragging drag-shadow z-50' 
              : 'shadow-sm hover:shadow-md transition-all duration-200 hover:border-slate-200'
            }
            ${snapshot.isDropAnimating ? 'animate-drop' : ''}
            ${isDimmed ? 'opacity-40 scale-[0.98] border-slate-100' : ''} 
            ${isFocused && !snapshot.isDragging ? 'ring-2 ring-orange-500 border-orange-300 shadow-md' : 'border-slate-100'}
            ${isSelected && !snapshot.isDragging ? 'ring-2 ring-orange-500 bg-orange-50/50' : ''}
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
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-md z-10">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {/* Cover image/color if exists */}
          {coverData && (
            coverData.type === 'image' ? (
              <div className="relative h-[120px] rounded-t-xl overflow-hidden transition-all duration-300">
                <Image
                  src={coverData.url}
                  alt="Card cover"
                  fill
                  loading="lazy"
                  sizes="300px"
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
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
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border border-orange-200/50"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Bilingual Title */}
            <div className="space-y-2">
              {/* English */}
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded mt-0.5 border border-blue-100">
                  EN
                </span>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">
                    {card.titleEn ? <HighlightedText text={card.titleEn} searchQuery={searchQuery} /> : '—'}
                  </p>
              </div>
              
              {/* Japanese */}
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-5 text-[10px] font-bold text-red-600 bg-red-50 rounded mt-0.5 border border-red-100">
                  JP
                </span>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {card.titleJa ? (
                    <HighlightedText text={card.titleJa} searchQuery={searchQuery} />
                  ) : (
                    <span className="text-slate-300 italic flex items-center gap-1">
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
            {(card.descriptionEn || card.descriptionJa || hasAttachments || card.dueDate || hasAssignees || (hasChecklists && checklistStats.total > 0)) && (
              <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-slate-100">
                {/* Due date badge */}
                {card.dueDate && (() => {
                  const status = getDueDateStatus(card.dueDate);
                  const formattedDate = formatDueDate(card.dueDate);
                  
                  const statusStyles = {
                    overdue: 'bg-red-100 text-red-700 border-red-200',
                    soon: 'bg-orange-100 text-orange-700 border-orange-200',
                    future: 'bg-slate-100 text-slate-600 border-slate-200',
                  };
                  
                  const statusLabels = {
                    overdue: 'Overdue',
                    soon: 'Due soon',
                    future: 'Due',
                  };
                  
                  return (
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${statusStyles[status]}`}
                      title={`Due: ${formattedDate}`}
                      aria-label={`${statusLabels[status]}: ${formattedDate}`}
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
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span aria-hidden="true">{formattedDate}</span>
                    </div>
                  );
                })()}

                {/* Translation status badge */}
                <TranslationStatusBadge
                  hasEn={!!card.titleEn && !!card.descriptionEn}
                  hasJa={!!card.titleJa}
                  isTranslating={!card.titleJa && !!card.titleEn}
                />

                {/* Description indicator */}
                {(card.descriptionEn || card.descriptionJa) && (
                  <div className="flex items-center gap-1.5 text-slate-400" title="Has description">
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
                )}

                {/* Attachments indicator */}
                {hasAttachments && (
                  <div className="flex items-center gap-1.5 text-slate-400" title="Has attachments">
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
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                    title={`Checklist: ${checklistStats.completed}/${checklistStats.total} completed`}
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${
                        checklistStats.completed === checklistStats.total ? 'text-green-600' : 'text-slate-500'
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

                {/* Spacer to push assignees to the right */}
                <div className="flex-1" />

                {/* Assignees */}
                {hasAssignees && (
                  <div className="flex items-center -space-x-1.5">
                    {assignees.slice(0, maxVisibleAssignees).map((assignee) => (
                      <MiniAvatar key={assignee.uid} user={assignee} />
                    ))}
                    {extraAssignees > 0 && (
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-white">
                        <span className="text-[10px] font-medium text-slate-600">+{extraAssignees}</span>
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

// Export memoized Card component - only re-renders when props change
// React DevTools Profiler: This component should highlight less frequently after memoization
export const Card = memo(CardComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance
  // Only re-render if these specific props change
  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.card.titleEn === nextProps.card.titleEn &&
    prevProps.card.titleJa === nextProps.card.titleJa &&
    prevProps.card.columnId === nextProps.card.columnId &&
    prevProps.card.order === nextProps.card.order &&
    JSON.stringify(prevProps.card.coverImage) === JSON.stringify(nextProps.card.coverImage) &&
    prevProps.card.dueDate === nextProps.card.dueDate &&
    prevProps.index === nextProps.index &&
    prevProps.isDimmed === nextProps.isDimmed &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.selectedCount === nextProps.selectedCount &&
    JSON.stringify(prevProps.card.labels) === JSON.stringify(nextProps.card.labels) &&
    JSON.stringify(prevProps.card.checklists) === JSON.stringify(nextProps.card.checklists) &&
    JSON.stringify(prevProps.card.attachments) === JSON.stringify(nextProps.card.attachments) &&
    JSON.stringify(prevProps.card.assigneeIds) === JSON.stringify(nextProps.card.assigneeIds)
  );
});
