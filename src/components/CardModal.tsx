'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { Card, Comment, Attachment, BoardMember, Checklist, ChecklistItem, Activity, CardCover, CardPriority } from '@/types';
import {
  getCard,
  updateCard,
  archiveCard,
  restoreCard,
  subscribeToComments,
  addComment,
  deleteComment,
  updateCommentTranslation,
  addAttachment,
  removeAttachment,
  getBoardMembers,
  getUserProfiles,
  addChecklist,
  updateChecklist,
  deleteChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  createCardTemplate,
  logActivity,
  subscribeToCardActivities,
  updateCardCover,
  removeCardCover,
} from '@/lib/firestore';
import { useToast } from '@/contexts/ToastContext';
import { uploadFile, uploadFromPaste, getFileType } from '@/lib/storage';
import { Timestamp } from 'firebase/firestore';
import { CommentsEmptyState } from './EmptyState';

// Translation indicator component
function TranslationIndicator({ 
  isTranslating, 
  hasError, 
  onRetry, 
  language 
}: { 
  isTranslating: boolean; 
  hasError?: string | null; 
  onRetry?: () => void;
  language: 'en' | 'ja';
}) {
  if (isTranslating) {
    return (
      <span className="animate-pulse text-xs text-slate-400 flex items-center gap-1">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {language === 'ja' ? '翻訳中...' : 'Translating...'}
      </span>
    );
  }
  
  if (hasError) {
    return (
      <span className="text-xs text-red-500 flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="hidden sm:inline">{language === 'ja' ? '翻訳失敗' : 'Translation failed'}</span>
        {onRetry && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            className="text-red-600 hover:text-red-700 underline ml-1"
          >
            {language === 'ja' ? '再試行' : 'Retry'}
          </button>
        )}
      </span>
    );
  }
  
  return null;
}

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

// Avatar component with photo or initials fallback
function UserAvatar({ 
  user, 
  size = 'md',
  showTooltip = true,
  onRemove,
}: { 
  user: { uid: string; displayName: string | null; photoURL: string | null };
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onRemove?: () => void;
}) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div className="relative group">
      {user.photoURL ? (
        <Image
          src={user.photoURL}
          alt={user.displayName || 'User'}
          width={size === 'lg' ? 40 : size === 'md' ? 32 : 24}
          height={size === 'lg' ? 40 : size === 'md' ? 32 : 24}
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white`}
        />
      ) : (
        <div 
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${getAvatarColor(user.uid)} flex items-center justify-center ring-2 ring-white`}
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

interface CardModalProps {
  boardId: string;
  cardId: string;
  onClose: () => void;
}

/**
 * CardModal Component - Accessible modal for viewing/editing card details
 * 
 * Accessibility Testing Points:
 * - VoiceOver/NVDA: Verify modal is announced as "dialog"
 * - Focus should be trapped within modal when open
 * - Escape key should close modal
 * - Focus should return to trigger element on close
 */
export function CardModal({ boardId, cardId, onClose }: CardModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { 
    debouncedTranslate, 
    translateWithAutoDetect, 
    translationState, 
    cancelTranslation,
    clearError,
    retryTranslation,
    settings: translationSettings,
  } = useTranslation();
  const [card, setCard] = useState<Card | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [titleEn, setTitleEn] = useState('');
  const [titleJa, setTitleJa] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionJa, setDescriptionJa] = useState('');

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Translation field keys for the context
  const fieldKeys = {
    titleEn: `card-${cardId}-titleEn`,
    titleJa: `card-${cardId}-titleJa`,
    descriptionEn: `card-${cardId}-descriptionEn`,
    descriptionJa: `card-${cardId}-descriptionJa`,
  };

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Accessibility: Modal focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Link input
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  // Due date
  const [dueDate, setDueDate] = useState<string>('');

  // Priority
  const [priority, setPriority] = useState<CardPriority>(null);

  // Assignees
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [assignees, setAssignees] = useState<BoardMember[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  // Checklists
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [showChecklistInput, setShowChecklistInput] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistTitle, setEditingChecklistTitle] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');

  // Template state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Activity log
  const [activities, setActivities] = useState<Activity[]>([]);

  // Cover image
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  // Track last saved values to avoid re-translating unchanged content
  const [lastSavedTitleEn, setLastSavedTitleEn] = useState('');
  const [lastSavedTitleJa, setLastSavedTitleJa] = useState('');
  const [lastSavedDescriptionEn, setLastSavedDescriptionEn] = useState('');
  const [lastSavedDescriptionJa, setLastSavedDescriptionJa] = useState('');

  // Fetch card data
  useEffect(() => {
    const fetchCard = async () => {
      const cardData = await getCard(boardId, cardId);
      if (cardData) {
        setCard(cardData);
        setTitleEn(cardData.titleEn);
        setTitleJa(cardData.titleJa);
        setDescriptionEn(cardData.descriptionEn);
        setDescriptionJa(cardData.descriptionJa);
        // Initialize last saved values
        setLastSavedTitleEn(cardData.titleEn);
        setLastSavedTitleJa(cardData.titleJa);
        setLastSavedDescriptionEn(cardData.descriptionEn);
        setLastSavedDescriptionJa(cardData.descriptionJa);
        // Initialize due date
        if (cardData.dueDate) {
          const date = cardData.dueDate.toDate();
          setDueDate(date.toISOString().split('T')[0]);
        }
        // Initialize priority
        setPriority(cardData.priority ?? null);
        // Initialize checklists
        setChecklists(cardData.checklists || []);
      }
      setLoading(false);
    };
    fetchCard();
  }, [boardId, cardId]);

  // Subscribe to comments
  useEffect(() => {
    const unsubscribe = subscribeToComments(
      boardId,
      cardId,
      setComments,
      (error) => {
        console.error('Error subscribing to comments:', error);
      }
    );
    return () => unsubscribe();
  }, [boardId, cardId]);

  // Subscribe to activities
  useEffect(() => {
    const unsubscribe = subscribeToCardActivities(
      boardId,
      cardId,
      setActivities,
      50, // limitCount
      (error) => {
        console.error('Error subscribing to card activities:', error);
      }
    );
    return () => unsubscribe();
  }, [boardId, cardId]);

  // Fetch board members
  useEffect(() => {
    const fetchMembers = async () => {
      const members = await getBoardMembers(boardId);
      setBoardMembers(members);
    };
    fetchMembers();
  }, [boardId]);

  // Load assignees when card or board members change
  useEffect(() => {
    const loadAssignees = async () => {
      if (!card?.assigneeIds?.length || boardMembers.length === 0) {
        setAssignees([]);
        return;
      }
      
      // First try to get from board members
      const assigneeList = card.assigneeIds
        .map(id => boardMembers.find(m => m.uid === id))
        .filter((m): m is BoardMember => m !== undefined);
      
      // If some assignees aren't in board members (edge case), fetch them
      if (assigneeList.length < card.assigneeIds.length) {
        const missingIds = card.assigneeIds.filter(
          id => !boardMembers.some(m => m.uid === id)
        );
        if (missingIds.length > 0) {
          const profiles = await getUserProfiles(missingIds);
          profiles.forEach((profile) => {
            assigneeList.push({
              uid: profile.uid,
              email: profile.email,
              displayName: profile.displayName,
              photoURL: profile.photoURL,
              isOwner: false,
            });
          });
        }
      }
      
      setAssignees(assigneeList);
    };
    loadAssignees();
  }, [card?.assigneeIds, boardMembers]);

  // Accessibility: Store the previously focused element and focus the modal
  useEffect(() => {
    // Store the element that triggered the modal
    previousActiveElement.current = document.activeElement as HTMLElement;
    
    // Focus the close button when modal opens (first focusable element)
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);
    
    // Return focus to trigger element when modal closes
    return () => {
      previousActiveElement.current?.focus();
    };
  }, []);

  // Accessibility: Focus trap - keep focus within modal
  useEffect(() => {
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;
      
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };
    
    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingField) {
          setEditingField(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editingField, onClose]);

  // Cancel translations when unmounting
  useEffect(() => {
    return () => {
      cancelTranslation(fieldKeys.titleEn);
      cancelTranslation(fieldKeys.titleJa);
      cancelTranslation(fieldKeys.descriptionEn);
      cancelTranslation(fieldKeys.descriptionJa);
    };
  }, [cancelTranslation, fieldKeys.titleEn, fieldKeys.titleJa, fieldKeys.descriptionEn, fieldKeys.descriptionJa]);

  const handleTitleEnChange = async (value: string) => {
    // Only process if value actually changed
    if (value === lastSavedTitleEn) return;
    
    setTitleEn(value);
    setLastSavedTitleEn(value);
    await updateCard(boardId, cardId, { titleEn: value });

    // Auto-translate to Japanese with debouncing
    if (value.trim()) {
      debouncedTranslate(value, 'ja', fieldKeys.titleJa, async (result) => {
        if (!result.error) {
          setTitleJa(result.translation);
          setLastSavedTitleJa(result.translation);
          await updateCard(boardId, cardId, { titleJa: result.translation });
        }
      });
    }
  };

  const handleTitleJaChange = async (value: string) => {
    // Only process if value actually changed
    if (value === lastSavedTitleJa) return;
    
    setTitleJa(value);
    setLastSavedTitleJa(value);
    await updateCard(boardId, cardId, { titleJa: value });

    // Auto-translate to English with debouncing
    if (value.trim()) {
      debouncedTranslate(value, 'en', fieldKeys.titleEn, async (result) => {
        if (!result.error) {
          setTitleEn(result.translation);
          setLastSavedTitleEn(result.translation);
          await updateCard(boardId, cardId, { titleEn: result.translation });
        }
      });
    }
  };

  const handleDescriptionEnChange = async (value: string) => {
    // Only process if value actually changed
    if (value === lastSavedDescriptionEn) return;
    
    setDescriptionEn(value);
    setLastSavedDescriptionEn(value);
    await updateCard(boardId, cardId, { descriptionEn: value });

    if (value.trim()) {
      debouncedTranslate(value, 'ja', fieldKeys.descriptionJa, async (result) => {
        if (!result.error) {
          setDescriptionJa(result.translation);
          setLastSavedDescriptionJa(result.translation);
          await updateCard(boardId, cardId, { descriptionJa: result.translation });
        }
      });
    }
  };

  const handleDescriptionJaChange = async (value: string) => {
    // Only process if value actually changed
    if (value === lastSavedDescriptionJa) return;
    
    setDescriptionJa(value);
    setLastSavedDescriptionJa(value);
    await updateCard(boardId, cardId, { descriptionJa: value });

    if (value.trim()) {
      debouncedTranslate(value, 'en', fieldKeys.descriptionEn, async (result) => {
        if (!result.error) {
          setDescriptionEn(result.translation);
          setLastSavedDescriptionEn(result.translation);
          await updateCard(boardId, cardId, { descriptionEn: result.translation });
        }
      });
    }
  };

  // Retry handlers for failed translations
  const handleRetryTitleJa = useCallback(async () => {
    clearError(fieldKeys.titleJa);
    const result = await retryTranslation(titleEn, 'ja', fieldKeys.titleJa);
    if (!result.error) {
      setTitleJa(result.translation);
      setLastSavedTitleJa(result.translation);
      await updateCard(boardId, cardId, { titleJa: result.translation });
    }
  }, [titleEn, fieldKeys.titleJa, clearError, retryTranslation, boardId, cardId]);

  const handleRetryTitleEn = useCallback(async () => {
    clearError(fieldKeys.titleEn);
    const result = await retryTranslation(titleJa, 'en', fieldKeys.titleEn);
    if (!result.error) {
      setTitleEn(result.translation);
      setLastSavedTitleEn(result.translation);
      await updateCard(boardId, cardId, { titleEn: result.translation });
    }
  }, [titleJa, fieldKeys.titleEn, clearError, retryTranslation, boardId, cardId]);

  const handleRetryDescriptionJa = useCallback(async () => {
    clearError(fieldKeys.descriptionJa);
    const result = await retryTranslation(descriptionEn, 'ja', fieldKeys.descriptionJa);
    if (!result.error) {
      setDescriptionJa(result.translation);
      setLastSavedDescriptionJa(result.translation);
      await updateCard(boardId, cardId, { descriptionJa: result.translation });
    }
  }, [descriptionEn, fieldKeys.descriptionJa, clearError, retryTranslation, boardId, cardId]);

  const handleRetryDescriptionEn = useCallback(async () => {
    clearError(fieldKeys.descriptionEn);
    const result = await retryTranslation(descriptionJa, 'en', fieldKeys.descriptionEn);
    if (!result.error) {
      setDescriptionEn(result.translation);
      setLastSavedDescriptionEn(result.translation);
      await updateCard(boardId, cardId, { descriptionEn: result.translation });
    }
  }, [descriptionJa, fieldKeys.descriptionEn, clearError, retryTranslation, boardId, cardId]);

  const handleDueDateChange = async (value: string) => {
    setDueDate(value);
    if (value) {
      const date = new Date(value + 'T00:00:00');
      await updateCard(boardId, cardId, { dueDate: Timestamp.fromDate(date) });
      
      // Log activity
      if (user) {
        await logActivity(boardId, {
          cardId,
          cardTitle: card?.titleEn || '',
          type: 'due_date_set',
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          userPhoto: user.photoURL,
          metadata: { dueDate: value },
        });
      }
    } else {
      await updateCard(boardId, cardId, { dueDate: null });
    }
    // Refresh card data
    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
  };

  const handleClearDueDate = async () => {
    setDueDate('');
    await updateCard(boardId, cardId, { dueDate: null });
    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
  };

  const handlePriorityChange = async (newPriority: CardPriority) => {
    setPriority(newPriority);
    await updateCard(boardId, cardId, { priority: newPriority });
    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
  };

  const handleAddAssignee = async (member: BoardMember) => {
    if (!card) return;
    const currentAssignees = card.assigneeIds || [];
    if (currentAssignees.includes(member.uid)) return;
    
    const newAssignees = [...currentAssignees, member.uid];
    await updateCard(boardId, cardId, { assigneeIds: newAssignees });
    setCard({ ...card, assigneeIds: newAssignees });
    setShowAssigneeDropdown(false);
    
    // Log activity
    if (user) {
      await logActivity(boardId, {
        cardId,
        cardTitle: card.titleEn,
        type: 'assignee_added',
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL,
        metadata: { 
          assigneeName: member.displayName || member.email,
          assigneeId: member.uid 
        },
      });
    }
  };

  const handleRemoveAssignee = async (userId: string) => {
    if (!card) return;
    const currentAssignees = card.assigneeIds || [];
    const newAssignees = currentAssignees.filter(id => id !== userId);
    await updateCard(boardId, cardId, { assigneeIds: newAssignees });
    setCard({ ...card, assigneeIds: newAssignees });
  };

  // Checklist handlers
  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    const checklistId = await addChecklist(boardId, cardId, newChecklistTitle.trim());
    setChecklists([...checklists, { id: checklistId, title: newChecklistTitle.trim(), items: [] }]);
    setNewChecklistTitle('');
    setShowChecklistInput(false);
  };

  const handleUpdateChecklistTitle = async (checklistId: string) => {
    if (!editingChecklistTitle.trim()) return;
    await updateChecklist(boardId, cardId, checklistId, { title: editingChecklistTitle.trim() });
    setChecklists(checklists.map(cl => 
      cl.id === checklistId ? { ...cl, title: editingChecklistTitle.trim() } : cl
    ));
    setEditingChecklistId(null);
    setEditingChecklistTitle('');
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    await deleteChecklist(boardId, cardId, checklistId);
    setChecklists(checklists.filter(cl => cl.id !== checklistId));
  };

  const handleAddChecklistItem = async (checklistId: string) => {
    const text = newItemTexts[checklistId]?.trim();
    if (!text) return;
    const itemId = await addChecklistItem(boardId, cardId, checklistId, text);
    const newItem: ChecklistItem = {
      id: itemId,
      text,
      isCompleted: false,
      order: checklists.find(cl => cl.id === checklistId)?.items.length || 0,
    };
    setChecklists(checklists.map(cl => 
      cl.id === checklistId ? { ...cl, items: [...cl.items, newItem] } : cl
    ));
    setNewItemTexts({ ...newItemTexts, [checklistId]: '' });
  };

  const handleToggleChecklistItem = async (checklistId: string, itemId: string, isCompleted: boolean) => {
    await updateChecklistItem(boardId, cardId, checklistId, itemId, { isCompleted: !isCompleted });
    setChecklists(checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.map(item => 
            item.id === itemId ? { ...item, isCompleted: !isCompleted } : item
          ),
        };
      }
      return cl;
    }));
  };

  const handleUpdateChecklistItemText = async (checklistId: string, itemId: string) => {
    if (!editingItemText.trim()) return;
    await updateChecklistItem(boardId, cardId, checklistId, itemId, { text: editingItemText.trim() });
    setChecklists(checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.map(item => 
            item.id === itemId ? { ...item, text: editingItemText.trim() } : item
          ),
        };
      }
      return cl;
    }));
    setEditingItemId(null);
    setEditingItemText('');
  };

  const handleDeleteChecklistItem = async (checklistId: string, itemId: string) => {
    await deleteChecklistItem(boardId, cardId, checklistId, itemId);
    setChecklists(checklists.map(cl => {
      if (cl.id === checklistId) {
        return { ...cl, items: cl.items.filter(item => item.id !== itemId) };
      }
      return cl;
    }));
  };

  // Cover colors (matching board background colors)
  const coverColors = [
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

  // Get image attachments for cover selection
  const imageAttachments = card?.attachments?.filter(a => a.type === 'image') || [];

  // Get current cover data for preview
  const getCoverPreview = () => {
    if (!card?.coverImage) return null;
    
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
  };

  const coverPreview = getCoverPreview();

  const handleSetImageCover = async (attachmentId: string) => {
    await updateCardCover(boardId, cardId, { attachmentId });
    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
    setShowCoverPicker(false);
  };

  const handleSetColorCover = async (color: string) => {
    await updateCardCover(boardId, cardId, { color });
    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
    setShowCoverPicker(false);
  };

  const handleRemoveCover = async () => {
    await removeCardCover(boardId, cardId);
    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
    setShowCoverPicker(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;

    setIsAddingComment(true);
    
    // Detect language and translate using context
    const { detectedLanguage, original, translation } = await translateWithAutoDetect(
      newComment.trim(), 
      `comment-${cardId}-new`
    );
    
    // Set English and Japanese content based on detected language
    const contentEn = detectedLanguage === 'en' ? original : translation;
    const contentJa = detectedLanguage === 'ja' ? original : translation;
    
    await addComment(
      boardId,
      cardId,
      newComment.trim(),
      user.uid,
      user.displayName || 'Anonymous',
      user.photoURL,
      [],
      contentEn,
      contentJa,
      detectedLanguage
    );
    
    // Log activity
    await logActivity(boardId, {
      cardId,
      cardTitle: card?.titleEn || '',
      type: 'comment_added',
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      userPhoto: user.photoURL,
    });
    
    setNewComment('');
    setIsAddingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(boardId, cardId, commentId);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user) return;

    setIsUploading(true);
    try {
      // Check if card currently has no cover and no image attachments
      const hasNoCover = !card?.coverImage;
      const hasNoImageAttachments = !card?.attachments?.some(a => a.type === 'image');
      let firstImageAttachmentId: string | null = null;

      for (const file of Array.from(files)) {
        const result = await uploadFile(file, boardId, user.uid);
        const fileType = getFileType(file);
        await addAttachment(boardId, cardId, {
          type: fileType,
          url: result.url,
          name: result.name,
          createdBy: user.uid,
        });
        
        // Log activity for file upload
        await logActivity(boardId, {
          cardId,
          cardTitle: card?.titleEn || '',
          type: 'attachment_added',
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          userPhoto: user.photoURL,
          metadata: { attachmentName: result.name, attachmentType: fileType },
        });
        
        // Track the first image attachment for auto-cover
        if (fileType === 'image' && !firstImageAttachmentId) {
          // Fetch the updated card to get the attachment ID
          const tempCard = await getCard(boardId, cardId);
          const newAttachment = tempCard?.attachments?.find(a => a.url === result.url);
          if (newAttachment) {
            firstImageAttachmentId = newAttachment.id;
          }
        }
      }
      
      // Auto-set cover if this is the first image attachment
      if (hasNoCover && hasNoImageAttachments && firstImageAttachmentId) {
        await updateCardCover(boardId, cardId, { attachmentId: firstImageAttachmentId });
      }
      
      // Refresh card
      const updatedCard = await getCard(boardId, cardId);
      if (updatedCard) setCard(updatedCard);
    } catch (error) {
      console.error('Upload error:', error);
    }
    setIsUploading(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!user) return;

    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        setIsUploading(true);

        // Check if card currently has no cover and no image attachments
        const hasNoCover = !card?.coverImage;
        const hasNoImageAttachments = !card?.attachments?.some(a => a.type === 'image');

        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            try {
              const result = await uploadFromPaste(dataUrl, boardId, user.uid);
              await addAttachment(boardId, cardId, {
                type: 'image',
                url: result.url,
                name: result.name,
                createdBy: user.uid,
              });
              
              // Log activity for image paste
              await logActivity(boardId, {
                cardId,
                cardTitle: card?.titleEn || '',
                type: 'attachment_added',
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                userPhoto: user.photoURL,
                metadata: { attachmentName: result.name, attachmentType: 'image' },
              });
              
              // Auto-set cover if this is the first image
              if (hasNoCover && hasNoImageAttachments) {
                const tempCard = await getCard(boardId, cardId);
                const newAttachment = tempCard?.attachments?.find(a => a.url === result.url);
                if (newAttachment) {
                  await updateCardCover(boardId, cardId, { attachmentId: newAttachment.id });
                }
              }
              
              const updatedCard = await getCard(boardId, cardId);
              if (updatedCard) setCard(updatedCard);
            } catch (error) {
              console.error('Paste upload error:', error);
            }
            setIsUploading(false);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim() || !user) return;

    await addAttachment(boardId, cardId, {
      type: 'link',
      url: linkUrl.trim(),
      name: linkName.trim() || linkUrl.trim(),
      createdBy: user.uid,
    });

    setLinkUrl('');
    setLinkName('');
    setShowLinkInput(false);

    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    await removeAttachment(boardId, cardId, attachmentId);
    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
  };

  const handleArchive = async () => {
    try {
      await archiveCard(boardId, cardId);
      
      // Log activity
      if (user) {
        await logActivity(boardId, {
          cardId,
          cardTitle: card?.titleEn || '',
          type: 'card_archived',
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          userPhoto: user.photoURL,
        });
      }
      
      onClose();
      showToast('success', 'Card archived', {
        undoAction: async () => {
          await restoreCard(boardId, cardId);
        },
      });
    } catch (error) {
      console.error('Failed to archive card:', error);
      showToast('error', 'Failed to archive card');
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || !user || !card) return;
    
    setIsSavingTemplate(true);
    try {
      await createCardTemplate({
        name: templateName.trim(),
        titleEn: card.titleEn,
        titleJa: card.titleJa,
        descriptionEn: card.descriptionEn,
        descriptionJa: card.descriptionJa,
        labels: card.labels || [],
        checklists: card.checklists || [],
        createdBy: user.uid,
      });
      showToast('success', 'Card saved as template');
      setShowSaveTemplateModal(false);
      setTemplateName('');
    } catch (error) {
      console.error('Failed to save template:', error);
      showToast('error', 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="relative">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-white/30 border-t-white"></div>
          <span className="absolute inset-0 flex items-center justify-center text-2xl">🍜</span>
        </div>
      </div>
    );
  }

  if (!card) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-0 sm:py-6 md:py-10 px-0 sm:px-4"
      onClick={onClose}
      role="presentation"
    >
      {/* 
        Accessibility: Modal dialog with proper ARIA attributes
        - role="dialog": Identifies this as a dialog
        - aria-modal="true": Indicates content behind is inert
        - aria-labelledby: Points to the modal title
        - Test with VoiceOver: Should announce "Card Details, dialog"
      */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        aria-describedby="card-modal-description"
        className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full min-h-screen sm:min-h-0 sm:max-w-[1230px] sm:my-0 animate-in fade-in sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white rounded-none sm:rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="card-modal-title" className="text-base sm:text-lg font-semibold text-slate-800 truncate">Card Details</h2>
              <p id="card-modal-description" className="text-xs text-slate-400 hidden sm:block">Edit titles, descriptions, and more</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2.5 sm:p-2 hover:bg-slate-100 rounded-xl transition-colors group touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
            aria-label="Close card details dialog"
          >
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* Cover preview */}
        {coverPreview && (
          <div className="relative">
            {coverPreview.type === 'image' ? (
              <div className="relative h-32 sm:h-40 w-full overflow-hidden">
                <Image
                  src={coverPreview.url}
                  alt="Card cover"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
              </div>
            ) : (
              <div 
                className="h-20 sm:h-24 w-full transition-colors duration-300"
                style={{ backgroundColor: coverPreview.color }}
              />
            )}
            {/* Quick remove cover button */}
            <button
              onClick={handleRemoveCover}
              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-500 hover:text-white rounded-lg shadow-sm transition-all border border-slate-200 hover:border-red-500 text-slate-500"
              title="Remove cover"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 p-4 sm:p-5 md:p-6 space-y-5 sm:space-y-6">
            {/* Bilingual Title Section */}
            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <legend className="sr-only">Card Title in English and Japanese</legend>
              {/* English Title */}
              <div className="space-y-2.5">
                <label htmlFor="card-title-en" className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center justify-center w-8 h-6 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-md border border-blue-100" aria-hidden="true">EN</span>
                  Title (English)
                  <TranslationIndicator
                    isTranslating={translationState.isTranslating[fieldKeys.titleEn] || false}
                    hasError={translationState.errors[fieldKeys.titleEn]}
                    onRetry={handleRetryTitleEn}
                    language="en"
                  />
                </label>
                <input
                  id="card-title-en"
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  onBlur={() => handleTitleEnChange(titleEn)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleEnChange(titleEn);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  aria-describedby={translationState.errors[fieldKeys.titleEn] ? 'title-en-error' : undefined}
                  aria-invalid={!!translationState.errors[fieldKeys.titleEn]}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all text-slate-800 placeholder:text-slate-500 ${
                    translationState.errors[fieldKeys.titleEn]
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
                      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'
                  }`}
                  placeholder="Enter title in English..."
                />
                {translationState.errors[fieldKeys.titleEn] && (
                  <span id="title-en-error" className="sr-only">Translation error: {translationState.errors[fieldKeys.titleEn]}</span>
                )}
              </div>

              {/* Japanese Title */}
              <div className="space-y-2.5">
                <label htmlFor="card-title-ja" className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center justify-center w-8 h-6 text-[10px] font-bold text-red-600 bg-red-50 rounded-md border border-red-100" aria-hidden="true">JP</span>
                  Title (日本語)
                  <TranslationIndicator
                    isTranslating={translationState.isTranslating[fieldKeys.titleJa] || false}
                    hasError={translationState.errors[fieldKeys.titleJa]}
                    onRetry={handleRetryTitleJa}
                    language="ja"
                  />
                </label>
                <input
                  id="card-title-ja"
                  type="text"
                  value={titleJa}
                  onChange={(e) => setTitleJa(e.target.value)}
                  onBlur={() => handleTitleJaChange(titleJa)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleJaChange(titleJa);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  aria-describedby={translationState.errors[fieldKeys.titleJa] ? 'title-ja-error' : undefined}
                  aria-invalid={!!translationState.errors[fieldKeys.titleJa]}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all text-slate-800 placeholder:text-slate-500 ${
                    translationState.errors[fieldKeys.titleJa]
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
                      : 'border-slate-200 focus:ring-red-500/20 focus:border-red-400'
                  }`}
                  placeholder="日本語でタイトルを入力..."
                />
                {translationState.errors[fieldKeys.titleJa] && (
                  <span id="title-ja-error" className="sr-only">Translation error: {translationState.errors[fieldKeys.titleJa]}</span>
                )}
              </div>
            </fieldset>

            {/* Bilingual Description Section */}
            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <legend className="sr-only">Card Description in English and Japanese</legend>
              {/* English Description */}
              <div className="space-y-2.5">
                <label htmlFor="card-description-en" className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center justify-center w-8 h-6 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-md border border-blue-100" aria-hidden="true">EN</span>
                  Description (English)
                  <TranslationIndicator
                    isTranslating={translationState.isTranslating[fieldKeys.descriptionEn] || false}
                    hasError={translationState.errors[fieldKeys.descriptionEn]}
                    onRetry={handleRetryDescriptionEn}
                    language="en"
                  />
                </label>
                <textarea
                  id="card-description-en"
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  onBlur={() => handleDescriptionEnChange(descriptionEn)}
                  aria-describedby={translationState.errors[fieldKeys.descriptionEn] ? 'desc-en-error' : undefined}
                  aria-invalid={!!translationState.errors[fieldKeys.descriptionEn]}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 min-h-[130px] resize-y transition-all text-slate-800 placeholder:text-slate-500 ${
                    translationState.errors[fieldKeys.descriptionEn]
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
                      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'
                  }`}
                  placeholder="Add a description in English..."
                />
              </div>

              {/* Japanese Description */}
              <div className="space-y-2.5">
                <label htmlFor="card-description-ja" className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center justify-center w-8 h-6 text-[10px] font-bold text-red-600 bg-red-50 rounded-md border border-red-100" aria-hidden="true">JP</span>
                  Description (日本語)
                  <TranslationIndicator
                    isTranslating={translationState.isTranslating[fieldKeys.descriptionJa] || false}
                    hasError={translationState.errors[fieldKeys.descriptionJa]}
                    onRetry={handleRetryDescriptionJa}
                    language="ja"
                  />
                </label>
                <textarea
                  id="card-description-ja"
                  value={descriptionJa}
                  onChange={(e) => setDescriptionJa(e.target.value)}
                  onBlur={() => handleDescriptionJaChange(descriptionJa)}
                  aria-describedby={translationState.errors[fieldKeys.descriptionJa] ? 'desc-ja-error' : undefined}
                  aria-invalid={!!translationState.errors[fieldKeys.descriptionJa]}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 min-h-[130px] resize-y transition-all text-slate-800 placeholder:text-slate-500 ${
                    translationState.errors[fieldKeys.descriptionJa]
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
                      : 'border-slate-200 focus:ring-red-500/20 focus:border-red-400'
                  }`}
                  placeholder="日本語で説明を追加..."
                />
              </div>
            </fieldset>

            {/* Checklists */}
            {checklists.length > 0 && (
              <div className="space-y-4">
                {checklists.map((checklist) => {
                  const completedCount = checklist.items.filter(item => item.isCompleted).length;
                  const totalCount = checklist.items.length;
                  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                  
                  return (
                    <div key={checklist.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                      {/* Checklist header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </div>
                          {editingChecklistId === checklist.id ? (
                            <input
                              type="text"
                              value={editingChecklistTitle}
                              onChange={(e) => setEditingChecklistTitle(e.target.value)}
                              onBlur={() => handleUpdateChecklistTitle(checklist.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateChecklistTitle(checklist.id);
                                if (e.key === 'Escape') {
                                  setEditingChecklistId(null);
                                  setEditingChecklistTitle('');
                                }
                              }}
                              className="flex-1 px-3 py-1.5 text-sm font-semibold text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                              autoFocus
                            />
                          ) : (
                            <h4
                              onClick={() => {
                                setEditingChecklistId(checklist.id);
                                setEditingChecklistTitle(checklist.title);
                              }}
                              className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-green-600 transition-colors"
                            >
                              {checklist.title}
                            </h4>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteChecklist(checklist.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete checklist"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Progress bar */}
                      {totalCount > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                            <span>{progress}%</span>
                            <span>{completedCount}/{totalCount}</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                progress === 100 ? 'bg-green-500' : 'bg-green-400'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Checklist items */}
                      <div className="space-y-1.5">
                        {checklist.items.sort((a, b) => a.order - b.order).map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-start gap-2.5 p-2 rounded-lg group transition-colors ${
                              item.isCompleted ? 'bg-green-50/50' : 'hover:bg-white'
                            }`}
                          >
                            <button
                              onClick={() => handleToggleChecklistItem(checklist.id, item.id, item.isCompleted)}
                              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                item.isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-slate-300 hover:border-green-400'
                              }`}
                            >
                              {item.isCompleted && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            
                            {editingItemId === item.id ? (
                              <input
                                type="text"
                                value={editingItemText}
                                onChange={(e) => setEditingItemText(e.target.value)}
                                onBlur={() => handleUpdateChecklistItemText(checklist.id, item.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateChecklistItemText(checklist.id, item.id);
                                  if (e.key === 'Escape') {
                                    setEditingItemId(null);
                                    setEditingItemText('');
                                  }
                                }}
                                className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingItemText(item.text);
                                }}
                                className={`flex-1 text-sm cursor-pointer transition-all ${
                                  item.isCompleted
                                    ? 'text-slate-400 line-through'
                                    : 'text-slate-700 hover:text-slate-900'
                                }`}
                              >
                                {item.text}
                              </span>
                            )}
                            
                            <button
                              onClick={() => handleDeleteChecklistItem(checklist.id, item.id)}
                              className="p-1 text-slate-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      {/* Add item input */}
                      <div className="mt-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newItemTexts[checklist.id] || ''}
                            onChange={(e) => setNewItemTexts({ ...newItemTexts, [checklist.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddChecklistItem(checklist.id);
                            }}
                            placeholder="Add an item..."
                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white placeholder:text-slate-400"
                          />
                          <button
                            onClick={() => handleAddChecklistItem(checklist.id)}
                            disabled={!newItemTexts[checklist.id]?.trim()}
                            className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Attachments */}
            {card.attachments && card.attachments.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-slate-500"
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
                  </div>
                  Attachments
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {card.attachments.length}
                  </span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {card.attachments.map((attachment) => (
                    <AttachmentItem
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => handleRemoveAttachment(attachment.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Unified Activity Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                Activity
                {(comments.length + activities.filter(a => a.type !== 'comment_added').length) > 0 && (
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {comments.length + activities.filter(a => a.type !== 'comment_added').length}
                  </span>
                )}
              </h4>

              {/* Add comment */}
              <div className="flex gap-3">
                {user?.photoURL && (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-slate-100 object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  {/* Use same grid as comments, with content centered in middle */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 justify-items-center">
                    <div className="w-full md:col-span-2 md:w-1/2">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 min-h-[90px] resize-y transition-all text-slate-800 placeholder:text-slate-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            handleAddComment();
                          }
                        }}
                      />
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-slate-500">Press ⌘+Enter to submit</span>
                        <button
                          onClick={handleAddComment}
                          disabled={!newComment.trim() || isAddingComment}
                          className="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-sm active:scale-[0.98]"
                        >
                          {isAddingComment ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unified timeline of comments and activities */}
              <div className="space-y-4 pt-2">
                {comments.length === 0 && activities.filter(a => a.type !== 'comment_added').length === 0 ? (
                  <CommentsEmptyState />
                ) : (
                  // Combine comments and activities (excluding 'comment_added' since we show the actual comment)
                  [...comments.map(c => ({ type: 'comment' as const, data: c, timestamp: c.createdAt.toMillis() })),
                   ...activities.filter(a => a.type !== 'comment_added').map(a => ({ type: 'activity' as const, data: a, timestamp: a.createdAt.toMillis() }))]
                    .sort((a, b) => b.timestamp - a.timestamp) // Sort newest first
                    .map((item) => 
                      item.type === 'comment' ? (
                        <CommentItem
                          key={`comment-${item.data.id}`}
                          comment={item.data}
                          currentUserId={user?.uid}
                          currentUserName={user?.displayName || 'Anonymous'}
                          boardId={boardId}
                          cardId={cardId}
                          onDelete={() => handleDeleteComment(item.data.id)}
                        />
                      ) : (
                        <ActivityItem key={`activity-${item.data.id}`} activity={item.data} />
                      )
                    )
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-56 p-4 sm:p-5 bg-gradient-to-b from-slate-50 to-slate-100/50 sm:rounded-br-2xl space-y-4 border-t lg:border-t-0 lg:border-l border-slate-100">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Add to card
            </h4>

            {/* Upload file */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              aria-label="Upload file attachment"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-label={isUploading ? 'Uploading file...' : 'Add file attachment'}
              className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-sm text-left flex items-center gap-3 transition-all disabled:opacity-50 group shadow-sm"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors"
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
              </span>
              <span className="text-slate-600 font-medium">{isUploading ? 'Uploading...' : 'Attachment'}</span>
            </button>

            {/* Add link */}
            {showLinkInput ? (
              <div className="space-y-2.5 p-3 bg-white rounded-xl border border-slate-200">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste link URL..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-slate-800 placeholder:text-slate-500"
                  autoFocus
                />
                <input
                  type="text"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Link name (optional)"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-slate-800 placeholder:text-slate-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddLink}
                    disabled={!linkUrl.trim()}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowLinkInput(false);
                      setLinkUrl('');
                      setLinkName('');
                    }}
                    className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLinkInput(true)}
                className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <svg
                    className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </span>
                <span className="text-slate-600 font-medium">Link</span>
              </button>
            )}

            {/* Add checklist */}
            {showChecklistInput ? (
              <div className="space-y-2.5 p-3 bg-white rounded-xl border border-slate-200">
                <input
                  type="text"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  placeholder="Checklist title..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 text-slate-800 placeholder:text-slate-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddChecklist();
                    if (e.key === 'Escape') {
                      setShowChecklistInput(false);
                      setNewChecklistTitle('');
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddChecklist}
                    disabled={!newChecklistTitle.trim()}
                    className="flex-1 px-3 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 transition-all"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowChecklistInput(false);
                      setNewChecklistTitle('');
                    }}
                    className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowChecklistInput(true)}
                className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-green-100 flex items-center justify-center transition-colors">
                  <svg
                    className="w-4 h-4 text-slate-400 group-hover:text-green-500 transition-colors"
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
                </span>
                <span className="text-slate-600 font-medium">Checklist</span>
              </button>
            )}

            {/* Cover */}
            {showCoverPicker ? (
              <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cover</span>
                  <button
                    onClick={() => setShowCoverPicker(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Image attachments */}
                {imageAttachments.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-slate-500">Images</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {imageAttachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          onClick={() => handleSetImageCover(attachment.id)}
                          className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${
                            card?.coverImage?.attachmentId === attachment.id
                              ? 'border-orange-500 ring-2 ring-orange-200'
                              : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          <Image
                            src={attachment.url}
                            alt={attachment.name}
                            fill
                            className="object-cover"
                          />
                          {card?.coverImage?.attachmentId === attachment.id && (
                            <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Color palette */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-slate-500">Colors</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {coverColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleSetColorCover(color)}
                        className={`h-8 rounded-lg transition-all ${
                          card?.coverImage?.color === color
                            ? 'ring-2 ring-offset-1 ring-slate-400 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {card?.coverImage?.color === color && (
                          <svg className="w-4 h-4 text-white mx-auto drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Remove cover button */}
                {card?.coverImage && (
                  <button
                    onClick={handleRemoveCover}
                    className="w-full px-3 py-2 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                  >
                    Remove cover
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowCoverPicker(true)}
                className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                  <svg
                    className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </span>
                <span className="text-slate-600 font-medium">Cover</span>
              </button>
            )}

            {/* Assignees */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                  />
                </svg>
                Assignees
              </label>
              
              {/* Current assignees */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {assignees.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No assignees</span>
                ) : (
                  assignees.map((assignee) => (
                    <UserAvatar
                      key={assignee.uid}
                      user={assignee}
                      size="md"
                      onRemove={() => handleRemoveAssignee(assignee.uid)}
                    />
                  ))
                )}
              </div>
              
              {/* Add assignee dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  aria-expanded={showAssigneeDropdown}
                  aria-haspopup="listbox"
                  aria-label="Add assignee to card"
                  className="w-full px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-sm text-left flex items-center gap-2 transition-all group shadow-sm"
                >
                  <svg
                    className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span className="text-slate-600 font-medium">Add assignee</span>
                </button>
                
                {showAssigneeDropdown && (
                  <div 
                    role="listbox"
                    aria-label="Available team members"
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto"
                  >
                    {boardMembers.filter(m => !card?.assigneeIds?.includes(m.uid)).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400 text-center">
                        All members assigned
                      </div>
                    ) : (
                      boardMembers
                        .filter(m => !card?.assigneeIds?.includes(m.uid))
                        .map((member) => (
                          <button
                            key={member.uid}
                            role="option"
                            aria-selected={false}
                            onClick={() => handleAddAssignee(member)}
                            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 transition-colors text-left"
                          >
                            <UserAvatar user={member} size="sm" showTooltip={false} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {member.displayName || member.email}
                              </p>
                              {member.displayName && (
                                <p className="text-xs text-slate-400 truncate">{member.email}</p>
                              )}
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Due Date - Enhanced */}
            <div className="space-y-3">
              <label htmlFor="card-due-date" className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <svg
                  className="w-4 h-4"
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
                Due Date
              </label>
              
              {/* Due Date Status Banner */}
              {dueDate && (() => {
                const dueDateObj = new Date(dueDate + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffMs = dueDateObj.getTime() - today.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                
                let statusConfig: { bg: string; text: string; border: string; icon: string; label: string; pulse?: boolean };
                
                if (diffDays < 0) {
                  statusConfig = {
                    bg: 'bg-red-100',
                    text: 'text-red-700',
                    border: 'border-red-200',
                    icon: 'alert',
                    label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`,
                    pulse: true,
                  };
                } else if (diffDays === 0) {
                  statusConfig = {
                    bg: 'bg-red-50',
                    text: 'text-red-600',
                    border: 'border-red-200',
                    icon: 'clock',
                    label: 'Due today',
                  };
                } else if (diffDays === 1) {
                  statusConfig = {
                    bg: 'bg-orange-100',
                    text: 'text-orange-700',
                    border: 'border-orange-200',
                    icon: 'clock',
                    label: 'Due tomorrow',
                  };
                } else if (diffDays <= 7) {
                  statusConfig = {
                    bg: 'bg-yellow-100',
                    text: 'text-yellow-700',
                    border: 'border-yellow-200',
                    icon: 'calendar',
                    label: `Due in ${diffDays} days`,
                  };
                } else {
                  statusConfig = {
                    bg: 'bg-slate-100',
                    text: 'text-slate-600',
                    border: 'border-slate-200',
                    icon: 'calendar',
                    label: `Due in ${diffDays} days`,
                  };
                }
                
                return (
                  <div className={`flex items-center gap-2 p-3 rounded-xl border ${statusConfig.bg} ${statusConfig.border}`}>
                    {statusConfig.icon === 'alert' ? (
                      <svg className={`w-5 h-5 ${statusConfig.text} ${statusConfig.pulse ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : statusConfig.icon === 'clock' ? (
                      <svg className={`w-5 h-5 ${statusConfig.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className={`w-5 h-5 ${statusConfig.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    <span className={`text-sm font-medium ${statusConfig.text}`}>{statusConfig.label}</span>
                  </div>
                );
              })()}
              
              {/* Quick date buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: 'Next Week', days: 7 },
                ].map((option) => {
                  const targetDate = new Date();
                  targetDate.setDate(targetDate.getDate() + option.days);
                  const targetValue = targetDate.toISOString().split('T')[0];
                  const isSelected = dueDate === targetValue;
                  
                  return (
                    <button
                      key={option.label}
                      onClick={() => handleDueDateChange(targetValue)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              
              {/* Date picker input */}
              <div className="relative">
                <input
                  id="card-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  aria-describedby="due-date-help"
                  className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all shadow-sm"
                />
                <span id="due-date-help" className="sr-only">Select a due date for this card</span>
              </div>
              
              {dueDate && (
                <button
                  onClick={handleClearDueDate}
                  aria-label="Clear due date"
                  className="w-full px-3 py-2.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear due date
                </button>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                  />
                </svg>
                Priority
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: null, label: 'None', color: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' },
                  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200', dot: 'bg-slate-400' },
                  { value: 'medium', label: 'Medium', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100', dot: 'bg-yellow-500' },
                  { value: 'high', label: 'High', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100', dot: 'bg-orange-500' },
                  { value: 'urgent', label: 'Urgent', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100', dot: 'bg-red-500' },
                ] as { value: CardPriority; label: string; color: string; dot?: string }[]).map((option) => (
                  <button
                    key={option.value ?? 'none'}
                    onClick={() => handlePriorityChange(option.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                      priority === option.value
                        ? `ring-2 ring-orange-500 ${option.color}`
                        : option.color
                    }`}
                    aria-pressed={priority === option.value}
                  >
                    {option.dot && (
                      <span 
                        className={`w-2 h-2 rounded-full ${option.dot} ${option.value === 'urgent' && priority === 'urgent' ? 'animate-pulse' : ''}`} 
                        aria-hidden="true" 
                      />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-200" />

            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Actions
            </h4>

            <button
              onClick={() => setShowSaveTemplateModal(true)}
              className="w-full px-4 py-2.5 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-200 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                  />
                </svg>
              </span>
              <span className="text-slate-600 group-hover:text-purple-600 font-medium transition-colors">Save as Template</span>
            </button>

            <button
              onClick={handleArchive}
              className="w-full px-4 py-2.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
              </span>
              <span className="text-slate-600 group-hover:text-red-600 font-medium transition-colors">Archive</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save as Template Modal */}
      {showSaveTemplateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowSaveTemplateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Save as Template</h3>
                <p className="text-xs text-slate-400">Create a reusable card template</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Bug Report, Feature Request..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 text-slate-800 placeholder:text-slate-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && templateName.trim()) {
                      handleSaveAsTemplate();
                    }
                    if (e.key === 'Escape') {
                      setShowSaveTemplateModal(false);
                      setTemplateName('');
                    }
                  }}
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Will include:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs text-slate-600 border border-slate-200">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Titles & Descriptions
                  </span>
                  {card?.labels && card.labels.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs text-slate-600 border border-slate-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {card.labels.length} Label{card.labels.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {card?.checklists && card.checklists.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs text-slate-600 border border-slate-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      {card.checklists.length} Checklist{card.checklists.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowSaveTemplateModal(false);
                    setTemplateName('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsTemplate}
                  disabled={!templateName.trim() || isSavingTemplate}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {isSavingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Attachment Item Component
function AttachmentItem({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const isImage = attachment.type === 'image';
  const isLink = attachment.type === 'link';

  return (
    <div className="relative group bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:border-slate-300 transition-colors">
      {isImage ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="relative h-28">
            <Image
              src={attachment.url}
              alt={attachment.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
          <p className="px-3 py-2 text-xs text-slate-600 truncate font-medium">{attachment.name}</p>
        </a>
      ) : isLink ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3.5 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-600 truncate">
                {attachment.name}
              </p>
              <p className="text-xs text-slate-400 truncate">{attachment.url}</p>
            </div>
          </div>
        </a>
      ) : (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3.5 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-700 truncate font-medium">{attachment.name}</p>
          </div>
        </a>
      )}

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-500 hover:text-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-slate-200 hover:border-red-500"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

// Comment Item Component
function CommentItem({
  comment,
  currentUserId,
  currentUserName,
  boardId,
  cardId,
  onDelete,
}: {
  comment: Comment;
  currentUserId?: string;
  currentUserName: string;
  boardId: string;
  cardId: string;
  onDelete: () => void;
}) {
  const isOwner = currentUserId === comment.createdBy;
  
  // Editing state
  const [editingLang, setEditingLang] = useState<'en' | 'ja' | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Get content for both languages, falling back to original content for old comments
  const englishContent = comment.contentEn || comment.content;
  const japaneseContent = comment.contentJa || comment.content;
  const detectedLang = comment.detectedLanguage || 'en';
  
  // Helper to get the translation status label
  const getTranslationLabel = (lang: 'en' | 'ja') => {
    const isOriginal = lang === detectedLang;
    if (isOriginal) {
      return lang === 'en' ? 'Original' : 'オリジナル';
    }
    
    // Check if there's a manual translator
    const translator = lang === 'en' ? comment.translatorEn : comment.translatorJa;
    if (translator) {
      return `Translated by ${translator.displayName}`;
    }
    
    return 'Auto-Translated';
  };
  
  const handleStartEdit = (lang: 'en' | 'ja') => {
    setEditingLang(lang);
    setEditingContent(lang === 'en' ? englishContent : japaneseContent);
  };
  
  const handleCancelEdit = () => {
    setEditingLang(null);
    setEditingContent('');
  };
  
  const handleConfirmEdit = async () => {
    if (!editingLang || !currentUserId || !editingContent.trim()) return;
    
    setIsSaving(true);
    try {
      await updateCommentTranslation(
        boardId,
        cardId,
        comment.id,
        editingLang,
        editingContent.trim(),
        currentUserId,
        currentUserName
      );
      setEditingLang(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to update translation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex gap-3 group">
      {comment.createdByPhoto ? (
        <Image
          src={comment.createdByPhoto}
          alt={comment.createdByName}
          width={36}
          height={36}
          className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-slate-100 object-cover"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-sm font-medium text-white">
            {comment.createdByName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-slate-800">
            {comment.createdByName}
          </span>
          <span className="text-xs text-slate-400">
            {comment.createdAt instanceof Timestamp
              ? format(comment.createdAt.toDate(), 'MMM d, yyyy h:mm a')
              : ''}
          </span>
          {isOwner && (
            <button
              onClick={onDelete}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            >
              Delete
            </button>
          )}
        </div>
        
        {/* Bilingual comment display - side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* English version */}
          <div className={`bg-slate-50 border rounded-xl px-4 py-3 ${detectedLang === 'en' ? 'border-blue-200' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[9px] font-bold text-blue-600 bg-blue-50 rounded border border-blue-100">EN</span>
              <span className={`text-[10px] font-medium ${detectedLang === 'en' ? 'text-blue-500' : 'text-slate-400'}`}>
                {getTranslationLabel('en')}
              </span>
              {/* Edit button for translated content (not original) */}
              {detectedLang !== 'en' && editingLang !== 'en' && currentUserId && (
                <button
                  onClick={() => handleStartEdit('en')}
                  className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit translation"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
            {editingLang === 'en' ? (
              <div className="space-y-2">
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmEdit}
                    disabled={isSaving || !editingContent.trim()}
                    className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{englishContent}</p>
            )}
          </div>
          
          {/* Japanese version */}
          <div className={`bg-slate-50 border rounded-xl px-4 py-3 ${detectedLang === 'ja' ? 'border-red-200' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[9px] font-bold text-red-600 bg-red-50 rounded border border-red-100">JP</span>
              <span className={`text-[10px] font-medium ${detectedLang === 'ja' ? 'text-red-500' : 'text-slate-400'}`}>
                {getTranslationLabel('ja')}
              </span>
              {/* Edit button for translated content (not original) */}
              {detectedLang !== 'ja' && editingLang !== 'ja' && currentUserId && (
                <button
                  onClick={() => handleStartEdit('ja')}
                  className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit translation"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
            {editingLang === 'ja' ? (
              <div className="space-y-2">
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmEdit}
                    disabled={isSaving || !editingContent.trim()}
                    className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{japaneseContent}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Activity Item Component
function ActivityItem({ activity }: { activity: Activity }) {
  const getRelativeTime = (timestamp: Timestamp): string => {
    const now = new Date();
    const activityDate = timestamp.toDate();
    const diffMs = now.getTime() - activityDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return format(activityDate, 'MMM d, yyyy');
  };

  const getActivityDescription = (): string => {
    const metadata = activity.metadata as Record<string, string>;
    switch (activity.type) {
      case 'card_created':
        return `created this card in ${metadata?.columnName || 'the board'}`;
      case 'card_moved':
        return `moved this card from ${metadata?.from || '?'} to ${metadata?.to || '?'}`;
      case 'card_archived':
        return 'archived this card';
      case 'comment_added':
        return 'added a comment';
      case 'assignee_added':
        return `added ${metadata?.assigneeName || 'someone'} to this card`;
      case 'due_date_set':
        return `set the due date to ${metadata?.dueDate || 'a date'}`;
      case 'checklist_completed':
        return 'completed all checklist items';
      case 'card_updated':
        return 'updated this card';
      case 'attachment_added':
        return metadata?.attachmentType === 'image' 
          ? 'added an image' 
          : 'added an attachment';
      default:
        return 'made a change';
    }
  };

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {activity.userPhoto ? (
        <Image
          src={activity.userPhoto}
          alt={activity.userName}
          width={24}
          height={24}
          className="w-6 h-6 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div 
          className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(activity.userId)} flex items-center justify-center flex-shrink-0`}
        >
          <span className="text-[10px] font-medium text-white">
            {getInitials(activity.userName)}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-600 leading-relaxed">
          <span className="font-medium text-slate-700">{activity.userName}</span>{' '}
          {getActivityDescription()}
        </p>
        <span className="text-[10px] text-slate-400">
          {getRelativeTime(activity.createdAt)}
        </span>
      </div>
    </div>
  );
}
