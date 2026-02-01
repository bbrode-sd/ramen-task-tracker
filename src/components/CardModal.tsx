'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { Card, Comment, BoardMember, Checklist, ChecklistItem, Activity, CardPriority, Column, Board } from '@/types';
import {
  getCard,
  updateCard,
  archiveCard,
  restoreCard,
  subscribeToComments,
  addComment,
  deleteComment,
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
  toggleCardWatch,
  subscribeToColumns,
  subscribeToCards,
  moveCard,
  subscribeToSubBoard,
  createSubBoard,
  cloneTemplateBoardAsSubBoard,
  getTemplateBoardsForBoard,
} from '@/lib/firestore';
import { useToast } from '@/contexts/ToastContext';
import { useLocale } from '@/contexts/LocaleContext';
import { uploadFile, uploadFromPaste, getFileType } from '@/lib/storage';
import { Timestamp } from 'firebase/firestore';
import { CommentsEmptyState } from './EmptyState';

// Import extracted sub-components
import { TranslationIndicator } from './CardModal/TranslationIndicator';
import { UserAvatar } from './CardModal/UserAvatar';
import { AttachmentItem } from './CardModal/AttachmentItem';
import { SubBoardTemplateModal } from './SubBoardTemplateModal';
import { CommentItem } from './CardModal/CommentItem';
import { ActivityItem } from './CardModal/ActivityItem';
import { COVER_COLORS, getAvatarColor, getInitials } from './CardModal/utils';
import { KanbanBoard } from './KanbanBoard';

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
  const { locale, t } = useLocale();
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
  
  // Temp editing values (for cancel functionality)
  const [editTitleEn, setEditTitleEn] = useState('');
  const [editTitleJa, setEditTitleJa] = useState('');
  const [editDescriptionEn, setEditDescriptionEn] = useState('');
  const [editDescriptionJa, setEditDescriptionJa] = useState('');

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
  const [uploadNotice, setUploadNotice] = useState<{
    status: 'uploading' | 'success' | 'error';
    message: string;
  } | null>(null);
  const uploadNoticeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Drag and drop file upload
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);
  
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
  const [editingChecklistField, setEditingChecklistField] = useState<'en' | 'ja' | null>(null);
  const [editingChecklistTitleEn, setEditingChecklistTitleEn] = useState('');
  const [editingChecklistTitleJa, setEditingChecklistTitleJa] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemField, setEditingItemField] = useState<'en' | 'ja' | null>(null);
  const [editingItemTextEn, setEditingItemTextEn] = useState('');
  const [editingItemTextJa, setEditingItemTextJa] = useState('');
  // Checklist item assignee and due date pickers
  const [activeItemAssigneePickerId, setActiveItemAssigneePickerId] = useState<string | null>(null);
  const [activeItemDueDatePickerId, setActiveItemDueDatePickerId] = useState<string | null>(null);

  // Template state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Activity log
  const [activities, setActivities] = useState<Activity[]>([]);

  // Cover image
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  // Watchers
  const [isWatching, setIsWatching] = useState(false);
  const [watchers, setWatchers] = useState<BoardMember[]>([]);
  const [isTogglingWatch, setIsTogglingWatch] = useState(false);

  // Column/list selection
  const [columns, setColumns] = useState<Column[]>([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [isMovingCard, setIsMovingCard] = useState(false);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  // Sub-board state
  const [subBoard, setSubBoard] = useState<Board | null>(null);
  const [showSubBoardTemplates, setShowSubBoardTemplates] = useState(false);
  const [templateBoards, setTemplateBoards] = useState<Board[]>([]);
  const [isCreatingSubBoard, setIsCreatingSubBoard] = useState(false);
  const [showSubBoardTemplateManager, setShowSubBoardTemplateManager] = useState(false);

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

  // Subscribe to columns for the list selector
  useEffect(() => {
    const unsubscribe = subscribeToColumns(
      boardId,
      setColumns,
      (error) => {
        console.error('Error subscribing to columns:', error);
      }
    );
    return () => unsubscribe();
  }, [boardId]);

  // Subscribe to all cards to determine order when moving
  useEffect(() => {
    const unsubscribe = subscribeToCards(
      boardId,
      setAllCards,
      {
        onError: (error) => {
          console.error('Error subscribing to cards:', error);
        }
      }
    );
    return () => unsubscribe();
  }, [boardId]);

  // Close column dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setShowColumnDropdown(false);
      }
    };
    if (showColumnDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnDropdown]);

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

  // Subscribe to sub-board (if card has one)
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToSubBoard(
      cardId,
      user.uid,
      setSubBoard,
      (error) => {
        console.error('Error subscribing to sub-board:', error);
      }
    );
    return () => unsubscribe();
  }, [cardId, user]);

  // Fetch template boards when template picker is shown
  useEffect(() => {
    if (showSubBoardTemplates && boardId && user) {
      const fetchTemplates = async () => {
        const templates = await getTemplateBoardsForBoard(boardId, user.uid);
        setTemplateBoards(templates);
      };
      fetchTemplates();
    }
  }, [showSubBoardTemplates, boardId, user]);

  // Fetch board members
  useEffect(() => {
    const fetchMembers = async () => {
      const members = await getBoardMembers(boardId);
      setBoardMembers(members);
    };
    fetchMembers();
  }, [boardId]);

  useEffect(() => {
    return () => {
      if (uploadNoticeTimeoutRef.current) {
        clearTimeout(uploadNoticeTimeoutRef.current);
      }
    };
  }, []);

  const showUploadNotice = useCallback(
    (status: 'uploading' | 'success' | 'error', message: string, autoHideMs = 2500) => {
      if (uploadNoticeTimeoutRef.current) {
        clearTimeout(uploadNoticeTimeoutRef.current);
      }

      setUploadNotice({ status, message });

      if (status !== 'uploading') {
        uploadNoticeTimeoutRef.current = setTimeout(() => {
          setUploadNotice(null);
        }, autoHideMs);
      }
    },
    []
  );

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

  // Load watchers and check if current user is watching
  useEffect(() => {
    const loadWatchers = async () => {
      if (!card?.watcherIds?.length) {
        setWatchers([]);
        setIsWatching(false);
        return;
      }
      
      // Check if current user is watching
      setIsWatching(user ? card.watcherIds.includes(user.uid) : false);
      
      // First try to get from board members
      const watcherList = card.watcherIds
        .map(id => boardMembers.find(m => m.uid === id))
        .filter((m): m is BoardMember => m !== undefined);
      
      // If some watchers aren't in board members (edge case), fetch them
      if (watcherList.length < card.watcherIds.length) {
        const missingIds = card.watcherIds.filter(
          id => !boardMembers.some(m => m.uid === id)
        );
        if (missingIds.length > 0) {
          const profiles = await getUserProfiles(missingIds);
          profiles.forEach((profile) => {
            watcherList.push({
              uid: profile.uid,
              email: profile.email,
              displayName: profile.displayName,
              photoURL: profile.photoURL,
              isOwner: false,
            });
          });
        }
      }
      
      setWatchers(watcherList);
    };
    loadWatchers();
  }, [card?.watcherIds, boardMembers, user]);

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
    
    // Determine if this is the first title or an edit of the original
    const isFirstTitle = !card?.titleDetectedLanguage && !lastSavedTitleEn && !lastSavedTitleJa;
    const isEditingOriginal = card?.titleDetectedLanguage === 'en';
    const isEditingTranslation = card?.titleDetectedLanguage === 'ja';
    
    if (isFirstTitle) {
      // First time entering a title - mark EN as original
      await updateCard(boardId, cardId, { 
        titleEn: value,
        titleDetectedLanguage: 'en',
      });
      // Update local card state
      if (card) {
        setCard({ ...card, titleDetectedLanguage: 'en', titleTranslatorEn: undefined, titleTranslatorJa: undefined });
      }
    } else if (isEditingOriginal) {
      // Editing the original EN - just update the text
      await updateCard(boardId, cardId, { titleEn: value });
    } else if (isEditingTranslation && user) {
      // Editing the translated EN - mark as manually translated
      const translatorInfo = { uid: user.uid, displayName: user.displayName || 'Unknown' };
      await updateCard(boardId, cardId, { 
        titleEn: value,
        titleTranslatorEn: translatorInfo,
      });
      if (card) {
        setCard({ ...card, titleTranslatorEn: translatorInfo });
      }
    } else {
      await updateCard(boardId, cardId, { titleEn: value });
    }

    // Auto-translate to Japanese with debouncing (only if editing original or first entry)
    if (value.trim() && (isFirstTitle || isEditingOriginal)) {
      debouncedTranslate(value, 'ja', fieldKeys.titleJa, async (result) => {
        if (!result.error) {
          setTitleJa(result.translation);
          setLastSavedTitleJa(result.translation);
          // Auto-translated, so no translator info needed
          await updateCard(boardId, cardId, { titleJa: result.translation });
          if (card) {
            setCard(c => c ? { ...c, titleTranslatorJa: undefined } : c);
          }
        }
      });
    }
  };

  const handleTitleJaChange = async (value: string) => {
    // Only process if value actually changed
    if (value === lastSavedTitleJa) return;
    
    setTitleJa(value);
    setLastSavedTitleJa(value);
    
    // Determine if this is the first title or an edit of the original
    const isFirstTitle = !card?.titleDetectedLanguage && !lastSavedTitleEn && !lastSavedTitleJa;
    const isEditingOriginal = card?.titleDetectedLanguage === 'ja';
    const isEditingTranslation = card?.titleDetectedLanguage === 'en';
    
    if (isFirstTitle) {
      // First time entering a title - mark JA as original
      await updateCard(boardId, cardId, { 
        titleJa: value,
        titleDetectedLanguage: 'ja',
      });
      // Update local card state
      if (card) {
        setCard({ ...card, titleDetectedLanguage: 'ja', titleTranslatorEn: undefined, titleTranslatorJa: undefined });
      }
    } else if (isEditingOriginal) {
      // Editing the original JA - just update the text
      await updateCard(boardId, cardId, { titleJa: value });
    } else if (isEditingTranslation && user) {
      // Editing the translated JA - mark as manually translated
      const translatorInfo = { uid: user.uid, displayName: user.displayName || 'Unknown' };
      await updateCard(boardId, cardId, { 
        titleJa: value,
        titleTranslatorJa: translatorInfo,
      });
      if (card) {
        setCard({ ...card, titleTranslatorJa: translatorInfo });
      }
    } else {
      await updateCard(boardId, cardId, { titleJa: value });
    }

    // Auto-translate to English with debouncing (only if editing original or first entry)
    if (value.trim() && (isFirstTitle || isEditingOriginal)) {
      debouncedTranslate(value, 'en', fieldKeys.titleEn, async (result) => {
        if (!result.error) {
          setTitleEn(result.translation);
          setLastSavedTitleEn(result.translation);
          // Auto-translated, so no translator info needed
          await updateCard(boardId, cardId, { titleEn: result.translation });
          if (card) {
            setCard(c => c ? { ...c, titleTranslatorEn: undefined } : c);
          }
        }
      });
    }
  };

  const handleDescriptionEnChange = async (value: string) => {
    // Only process if value actually changed
    if (value === lastSavedDescriptionEn) return;
    
    setDescriptionEn(value);
    setLastSavedDescriptionEn(value);
    
    // Determine if this is the first description or an edit of the original
    const isFirstDescription = !card?.descriptionDetectedLanguage && !lastSavedDescriptionEn && !lastSavedDescriptionJa;
    const isEditingOriginal = card?.descriptionDetectedLanguage === 'en';
    const isEditingTranslation = card?.descriptionDetectedLanguage === 'ja';
    
    if (isFirstDescription) {
      // First time entering a description - mark EN as original
      await updateCard(boardId, cardId, { 
        descriptionEn: value,
        descriptionDetectedLanguage: 'en',
      });
      // Update local card state
      if (card) {
        setCard({ ...card, descriptionDetectedLanguage: 'en', descriptionTranslatorEn: undefined, descriptionTranslatorJa: undefined });
      }
    } else if (isEditingOriginal) {
      // Editing the original EN - just update the text
      await updateCard(boardId, cardId, { descriptionEn: value });
    } else if (isEditingTranslation && user) {
      // Editing the translated EN - mark as manually translated
      const translatorInfo = { uid: user.uid, displayName: user.displayName || 'Unknown' };
      await updateCard(boardId, cardId, { 
        descriptionEn: value,
        descriptionTranslatorEn: translatorInfo,
      });
      if (card) {
        setCard({ ...card, descriptionTranslatorEn: translatorInfo });
      }
    } else {
      await updateCard(boardId, cardId, { descriptionEn: value });
    }

    if (value.trim() && (isFirstDescription || isEditingOriginal)) {
      debouncedTranslate(value, 'ja', fieldKeys.descriptionJa, async (result) => {
        if (!result.error) {
          setDescriptionJa(result.translation);
          setLastSavedDescriptionJa(result.translation);
          // Auto-translated, so no translator info needed
          await updateCard(boardId, cardId, { descriptionJa: result.translation });
          if (card) {
            setCard(c => c ? { ...c, descriptionTranslatorJa: undefined } : c);
          }
        }
      });
    }
  };

  const handleDescriptionJaChange = async (value: string) => {
    // Only process if value actually changed
    if (value === lastSavedDescriptionJa) return;
    
    setDescriptionJa(value);
    setLastSavedDescriptionJa(value);
    
    // Determine if this is the first description or an edit of the original
    const isFirstDescription = !card?.descriptionDetectedLanguage && !lastSavedDescriptionEn && !lastSavedDescriptionJa;
    const isEditingOriginal = card?.descriptionDetectedLanguage === 'ja';
    const isEditingTranslation = card?.descriptionDetectedLanguage === 'en';
    
    if (isFirstDescription) {
      // First time entering a description - mark JA as original
      await updateCard(boardId, cardId, { 
        descriptionJa: value,
        descriptionDetectedLanguage: 'ja',
      });
      if (card) {
        setCard({ ...card, descriptionDetectedLanguage: 'ja', descriptionTranslatorEn: undefined, descriptionTranslatorJa: undefined });
      }
    } else if (isEditingOriginal) {
      // Editing the original JA - just update the text
      await updateCard(boardId, cardId, { descriptionJa: value });
    } else if (isEditingTranslation && user) {
      // Editing the translated JA - mark as manually translated
      const translatorInfo = { uid: user.uid, displayName: user.displayName || 'Unknown' };
      await updateCard(boardId, cardId, { 
        descriptionJa: value,
        descriptionTranslatorJa: translatorInfo,
      });
      if (card) {
        setCard({ ...card, descriptionTranslatorJa: translatorInfo });
      }
    } else {
      await updateCard(boardId, cardId, { descriptionJa: value });
    }

    if (value.trim() && (isFirstDescription || isEditingOriginal)) {
      debouncedTranslate(value, 'en', fieldKeys.descriptionEn, async (result) => {
        if (!result.error) {
          setDescriptionEn(result.translation);
          setLastSavedDescriptionEn(result.translation);
          // Auto-translated, so no translator info needed
          await updateCard(boardId, cardId, { descriptionEn: result.translation });
          if (card) {
            setCard(c => c ? { ...c, descriptionTranslatorEn: undefined } : c);
          }
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

  // Helper to get the description translation status label
  const getDescriptionTranslationLabel = useCallback((lang: 'en' | 'ja') => {
    if (!card?.descriptionDetectedLanguage) {
      // No description yet or legacy data without tracking
      return null;
    }
    
    const isOriginal = lang === card.descriptionDetectedLanguage;
    if (isOriginal) {
      return t('cardModal.comment.original');
    }
    
    // Check if there's a manual translator
    const translator = lang === 'en' ? card.descriptionTranslatorEn : card.descriptionTranslatorJa;
    if (translator) {
      return t('cardModal.comment.translatedBy', { name: translator.displayName });
    }
    
    return t('cardModal.comment.autoTranslated');
  }, [card?.descriptionDetectedLanguage, card?.descriptionTranslatorEn, card?.descriptionTranslatorJa, t]);

  // Helper to get the title translation status label
  const getTitleTranslationLabel = useCallback((lang: 'en' | 'ja') => {
    if (!card?.titleDetectedLanguage) {
      // No title tracking yet or legacy data without tracking
      return null;
    }
    
    const isOriginal = lang === card.titleDetectedLanguage;
    if (isOriginal) {
      return t('cardModal.comment.original');
    }
    
    // Check if there's a manual translator
    const translator = lang === 'en' ? card.titleTranslatorEn : card.titleTranslatorJa;
    if (translator) {
      return t('cardModal.comment.translatedBy', { name: translator.displayName });
    }
    
    return t('cardModal.comment.autoTranslated');
  }, [card?.titleDetectedLanguage, card?.titleTranslatorEn, card?.titleTranslatorJa, t]);

  // Edit mode handlers for explicit save/cancel workflow
  const startEditingTitleEn = useCallback(() => {
    setEditTitleEn(titleEn);
    setEditingField('titleEn');
  }, [titleEn]);

  const startEditingTitleJa = useCallback(() => {
    setEditTitleJa(titleJa);
    setEditingField('titleJa');
  }, [titleJa]);

  const startEditingDescriptionEn = useCallback(() => {
    setEditDescriptionEn(descriptionEn);
    setEditingField('descriptionEn');
  }, [descriptionEn]);

  const startEditingDescriptionJa = useCallback(() => {
    setEditDescriptionJa(descriptionJa);
    setEditingField('descriptionJa');
  }, [descriptionJa]);

  const cancelEditing = useCallback(() => {
    setEditingField(null);
    setEditTitleEn('');
    setEditTitleJa('');
    setEditDescriptionEn('');
    setEditDescriptionJa('');
  }, []);

  const saveTitleEn = useCallback(async () => {
    if (editTitleEn !== titleEn) {
      await handleTitleEnChange(editTitleEn);
    }
    setEditingField(null);
  }, [editTitleEn, titleEn, handleTitleEnChange]);

  const saveTitleJa = useCallback(async () => {
    if (editTitleJa !== titleJa) {
      await handleTitleJaChange(editTitleJa);
    }
    setEditingField(null);
  }, [editTitleJa, titleJa, handleTitleJaChange]);

  const saveDescriptionEn = useCallback(async () => {
    if (editDescriptionEn !== descriptionEn) {
      await handleDescriptionEnChange(editDescriptionEn);
    }
    setEditingField(null);
  }, [editDescriptionEn, descriptionEn, handleDescriptionEnChange]);

  const saveDescriptionJa = useCallback(async () => {
    if (editDescriptionJa !== descriptionJa) {
      await handleDescriptionJaChange(editDescriptionJa);
    }
    setEditingField(null);
  }, [editDescriptionJa, descriptionJa, handleDescriptionJaChange]);

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
    const title = newChecklistTitle.trim();
    if (!title) return;
    
    // Generate a temporary key for translation tracking
    const tempChecklistKey = `new-checklist-${Date.now()}`;
    
    // Detect language and translate
    const detectionResult = await translateWithAutoDetect(title, tempChecklistKey);
    const detectedLang = detectionResult.detectedLanguage || 'en';
    
    const titleEn = detectedLang === 'en' ? title : (detectionResult.translation || '');
    const titleJa = detectedLang === 'ja' ? title : (detectionResult.translation || '');
    
    const checklistId = await addChecklist(boardId, cardId, titleEn, titleJa, detectedLang);
    const newChecklist: Checklist = { 
      id: checklistId, 
      title: titleEn, 
      titleEn, 
      titleJa, 
      titleOriginalLanguage: detectedLang,
      items: [] 
    };
    setChecklists([...checklists, newChecklist]);
    setNewChecklistTitle('');
    setShowChecklistInput(false);
  };

  const handleUpdateChecklistTitleEn = async (checklistId: string) => {
    const value = editingChecklistTitleEn.trim();
    if (!value) {
      setEditingChecklistId(null);
      setEditingChecklistField(null);
      return;
    }
    
    const checklist = checklists.find(cl => cl.id === checklistId);
    const isOriginal = !checklist?.titleOriginalLanguage || checklist.titleOriginalLanguage === 'en';
    
    // Update local state immediately
    setChecklists(checklists.map(cl => 
      cl.id === checklistId ? { ...cl, titleEn: value, title: value } : cl
    ));
    setEditingChecklistId(null);
    setEditingChecklistField(null);
    
    if (isOriginal) {
      // English is the original - update and translate to Japanese
      await updateChecklist(boardId, cardId, checklistId, { 
        titleEn: value, 
        titleOriginalLanguage: 'en' 
      });
      
      const checklistTitleJaKey = `checklist-${checklistId}-title-ja`;
      debouncedTranslate(value, 'ja', checklistTitleJaKey, async (result) => {
        if (!result.error) {
          await updateChecklist(boardId, cardId, checklistId, { titleJa: result.translation });
          setChecklists(prev => prev.map(cl =>
            cl.id === checklistId ? { ...cl, titleJa: result.translation } : cl
          ));
        }
      });
    } else {
      // English is the translation - just save without translating back
      await updateChecklist(boardId, cardId, checklistId, { titleEn: value });
    }
  };

  const handleUpdateChecklistTitleJa = async (checklistId: string) => {
    const value = editingChecklistTitleJa.trim();
    if (!value) {
      setEditingChecklistId(null);
      setEditingChecklistField(null);
      return;
    }
    
    const checklist = checklists.find(cl => cl.id === checklistId);
    const isOriginal = checklist?.titleOriginalLanguage === 'ja';
    
    // Update local state immediately
    setChecklists(checklists.map(cl => 
      cl.id === checklistId ? { ...cl, titleJa: value } : cl
    ));
    setEditingChecklistId(null);
    setEditingChecklistField(null);
    
    if (isOriginal) {
      // Japanese is the original - update and translate to English
      await updateChecklist(boardId, cardId, checklistId, { titleJa: value });
      
      const checklistTitleEnKey = `checklist-${checklistId}-title-en`;
      debouncedTranslate(value, 'en', checklistTitleEnKey, async (result) => {
        if (!result.error) {
          await updateChecklist(boardId, cardId, checklistId, { titleEn: result.translation });
          setChecklists(prev => prev.map(cl =>
            cl.id === checklistId ? { ...cl, titleEn: result.translation, title: result.translation } : cl
          ));
        }
      });
    } else {
      // Japanese is the translation - just save without translating back
      await updateChecklist(boardId, cardId, checklistId, { titleJa: value });
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    await deleteChecklist(boardId, cardId, checklistId);
    setChecklists(checklists.filter(cl => cl.id !== checklistId));
  };

  const handleAddChecklistItem = async (checklistId: string) => {
    const text = newItemTexts[checklistId]?.trim();
    if (!text) return;
    
    // Clear input immediately for better UX
    setNewItemTexts({ ...newItemTexts, [checklistId]: '' });
    
    // Generate a temporary key for translation tracking
    const tempItemKey = `new-item-${Date.now()}`;
    
    // Detect language and translate
    const detectionResult = await translateWithAutoDetect(text, tempItemKey);
    const detectedLang = detectionResult.detectedLanguage || 'en';
    
    const textEn = detectedLang === 'en' ? text : (detectionResult.translation || '');
    const textJa = detectedLang === 'ja' ? text : (detectionResult.translation || '');
    
    const itemId = await addChecklistItem(boardId, cardId, checklistId, textEn, textJa, detectedLang);
    const newItem: ChecklistItem = {
      id: itemId,
      text: textEn,
      textEn,
      textJa,
      textOriginalLanguage: detectedLang,
      isCompleted: false,
      order: checklists.find(cl => cl.id === checklistId)?.items.length || 0,
    };
    setChecklists(checklists.map(cl => 
      cl.id === checklistId ? { ...cl, items: [...cl.items, newItem] } : cl
    ));
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

  const handleUpdateChecklistItemTextEn = async (checklistId: string, itemId: string) => {
    const value = editingItemTextEn.trim();
    if (!value) {
      setEditingItemId(null);
      setEditingItemField(null);
      return;
    }
    
    const checklist = checklists.find(cl => cl.id === checklistId);
    const item = checklist?.items.find(i => i.id === itemId);
    const isOriginal = !item?.textOriginalLanguage || item.textOriginalLanguage === 'en';
    
    // Update local state immediately
    setChecklists(checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.map(i => 
            i.id === itemId ? { ...i, textEn: value, text: value } : i
          ),
        };
      }
      return cl;
    }));
    setEditingItemId(null);
    setEditingItemField(null);
    
    if (isOriginal) {
      // English is the original - update and translate to Japanese
      await updateChecklistItem(boardId, cardId, checklistId, itemId, { 
        textEn: value, 
        textOriginalLanguage: 'en' 
      });
      
      const itemTextJaKey = `item-${itemId}-text-ja`;
      debouncedTranslate(value, 'ja', itemTextJaKey, async (result) => {
        if (!result.error) {
          await updateChecklistItem(boardId, cardId, checklistId, itemId, { textJa: result.translation });
          setChecklists(prev => prev.map(cl => {
            if (cl.id === checklistId) {
              return {
                ...cl,
                items: cl.items.map(i =>
                  i.id === itemId ? { ...i, textJa: result.translation } : i
                ),
              };
            }
            return cl;
          }));
        }
      });
    } else {
      // English is the translation - just save without translating back
      await updateChecklistItem(boardId, cardId, checklistId, itemId, { textEn: value });
    }
  };

  const handleUpdateChecklistItemTextJa = async (checklistId: string, itemId: string) => {
    const value = editingItemTextJa.trim();
    if (!value) {
      setEditingItemId(null);
      setEditingItemField(null);
      return;
    }
    
    const checklist = checklists.find(cl => cl.id === checklistId);
    const item = checklist?.items.find(i => i.id === itemId);
    const isOriginal = item?.textOriginalLanguage === 'ja';
    
    // Update local state immediately
    setChecklists(checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.map(i => 
            i.id === itemId ? { ...i, textJa: value } : i
          ),
        };
      }
      return cl;
    }));
    setEditingItemId(null);
    setEditingItemField(null);
    
    if (isOriginal) {
      // Japanese is the original - update and translate to English
      await updateChecklistItem(boardId, cardId, checklistId, itemId, { textJa: value });
      
      const itemTextEnKey = `item-${itemId}-text-en`;
      debouncedTranslate(value, 'en', itemTextEnKey, async (result) => {
        if (!result.error) {
          await updateChecklistItem(boardId, cardId, checklistId, itemId, { textEn: result.translation });
          setChecklists(prev => prev.map(cl => {
            if (cl.id === checklistId) {
              return {
                ...cl,
                items: cl.items.map(i =>
                  i.id === itemId ? { ...i, textEn: result.translation, text: result.translation } : i
                ),
              };
            }
            return cl;
          }));
        }
      });
    } else {
      // Japanese is the translation - just save without translating back
      await updateChecklistItem(boardId, cardId, checklistId, itemId, { textJa: value });
    }
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

  // Checklist item assignee handler
  const handleChecklistItemAssignee = async (checklistId: string, itemId: string, assigneeId: string | undefined) => {
    await updateChecklistItem(boardId, cardId, checklistId, itemId, { assigneeId });
    setChecklists(checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.map(item => 
            item.id === itemId ? { ...item, assigneeId } : item
          ),
        };
      }
      return cl;
    }));
    setActiveItemAssigneePickerId(null);
    
    // Log activity if assigning (not unassigning)
    if (assigneeId && user) {
      const assignee = boardMembers.find(m => m.uid === assigneeId);
      await logActivity(boardId, {
        cardId,
        cardTitle: card?.titleEn || '',
        type: 'checklist_item_assigned',
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL,
        metadata: { 
          assigneeId, 
          assigneeName: assignee?.displayName || assignee?.email || 'Unknown',
          checklistId,
          itemId,
        },
      });
    }
  };

  // Checklist item due date handler
  const handleChecklistItemDueDate = async (checklistId: string, itemId: string, dueDate: Timestamp | null) => {
    await updateChecklistItem(boardId, cardId, checklistId, itemId, { dueDate });
    setChecklists(checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.map(item => 
            item.id === itemId ? { ...item, dueDate } : item
          ),
        };
      }
      return cl;
    }));
    setActiveItemDueDatePickerId(null);
  };

  // Helper to get due date status for checklist items
  const getChecklistItemDueDateStatus = (dueDate: Timestamp | null | undefined): { 
    label: string; 
    className: string;
    isOverdue: boolean;
    isDueToday: boolean;
    isDueTomorrow: boolean;
  } => {
    if (!dueDate) {
      return { label: '', className: '', isOverdue: false, isDueToday: false, isDueTomorrow: false };
    }
    
    const dueDateObj = dueDate.toDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateDay = new Date(dueDateObj);
    dueDateDay.setHours(0, 0, 0, 0);
    
    const diffMs = dueDateDay.getTime() - today.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return {
        label: format(dueDateObj, 'MMM d'),
        className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
        isOverdue: true,
        isDueToday: false,
        isDueTomorrow: false,
      };
    } else if (diffDays === 0) {
      return {
        label: t('cardModal.sidebar.today'),
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
        isOverdue: false,
        isDueToday: true,
        isDueTomorrow: false,
      };
    } else if (diffDays === 1) {
      return {
        label: t('cardModal.sidebar.tomorrow'),
        className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
        isOverdue: false,
        isDueToday: false,
        isDueTomorrow: true,
      };
    } else {
      return {
        label: format(dueDateObj, 'MMM d'),
        className: 'bg-slate-100 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300',
        isOverdue: false,
        isDueToday: false,
        isDueTomorrow: false,
      };
    }
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

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || !user) return;

    setIsUploading(true);
    const fileCount = files.length;
    showUploadNotice(
      'uploading',
      fileCount === 1 ? t('cardModal.upload.uploadingOne') : t('cardModal.upload.uploadingMany', { count: fileCount })
    );
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
      showUploadNotice(
        'success',
        fileCount === 1 ? t('cardModal.upload.addedOne') : t('cardModal.upload.addedMany', { count: fileCount })
      );
    } catch (error) {
      console.error('Upload error:', error);
      showUploadNotice('error', t('cardModal.upload.failed'));
    } finally {
      setIsUploading(false);
    }
  }, [user, card, boardId, cardId, t, showUploadNotice]);

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!user) return;

    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        setIsUploading(true);
        showUploadNotice('uploading', t('cardModal.upload.uploadingImage'));

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
              showUploadNotice('success', t('cardModal.upload.imageAdded'));
            } catch (error) {
              console.error('Paste upload error:', error);
              showUploadNotice('error', t('cardModal.upload.imageFailed'));
            } finally {
              setIsUploading(false);
            }
          };
          reader.onerror = () => {
            console.error('Paste upload error: failed to read image data');
            showUploadNotice('error', t('cardModal.upload.imageFailed'));
            setIsUploading(false);
          };
          reader.readAsDataURL(blob);
        } else {
          showUploadNotice('error', t('cardModal.upload.imageFailed'));
          setIsUploading(false);
        }
        break;
      }
    }
  };

  // Drag and drop file upload handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    
    // Check if the drag contains files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    
    // Only hide the drop zone when we've left all nested elements
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Set dropEffect to indicate this is a valid drop target
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset drag state
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    
    // Get the dropped files
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFileUpload(files);
    }
  }, [handleFileUpload]);

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

  // Move card to a different column
  const handleMoveToColumn = async (targetColumnId: string) => {
    if (!card || card.columnId === targetColumnId) {
      setShowColumnDropdown(false);
      return;
    }

    setIsMovingCard(true);
    try {
      // Get max order in the target column to place card at the bottom
      const cardsInTargetColumn = allCards.filter(c => c.columnId === targetColumnId && !c.isArchived);
      const maxOrder = cardsInTargetColumn.length > 0 
        ? Math.max(...cardsInTargetColumn.map(c => c.order)) + 1 
        : 0;

      // Get column names for activity log
      const fromColumn = columns.find(col => col.id === card.columnId);
      const toColumn = columns.find(col => col.id === targetColumnId);

      await moveCard(boardId, cardId, targetColumnId, maxOrder);

      // Log activity
      if (user) {
        await logActivity(boardId, {
          cardId,
          cardTitle: card.titleEn || card.titleJa || '',
          type: 'card_moved',
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          userPhoto: user.photoURL,
          metadata: {
            from: fromColumn?.name || 'Unknown',
            to: toColumn?.name || 'Unknown',
          },
        });
      }

      // Refresh card data
      const updatedCard = await getCard(boardId, cardId);
      if (updatedCard) setCard(updatedCard);

      showToast('success', t('cardModal.movedTo', { list: toColumn?.name || 'list' }));
    } catch (error) {
      console.error('Failed to move card:', error);
      showToast('error', t('cardModal.toast.failedToMove'));
    } finally {
      setIsMovingCard(false);
      setShowColumnDropdown(false);
    }
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
      showToast('success', t('cardModal.toast.cardArchived'), {
        undoAction: async () => {
          await restoreCard(boardId, cardId);
        },
      });
    } catch (error) {
      console.error('Failed to archive card:', error);
      showToast('error', t('cardModal.toast.failedToArchive'));
    }
  };

  const handleToggleWatch = async () => {
    if (!user) return;
    
    setIsTogglingWatch(true);
    try {
      const nowWatching = await toggleCardWatch(boardId, cardId, user.uid);
      setIsWatching(nowWatching);
      
      // Log activity
      await logActivity(boardId, {
        cardId,
        cardTitle: card?.titleEn || '',
        type: nowWatching ? 'card_watched' : 'card_unwatched',
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL,
      });
      
      // Refresh card to get updated watchers
      const updatedCard = await getCard(boardId, cardId);
      if (updatedCard) setCard(updatedCard);
      
      showToast('success', nowWatching ? t('cardModal.toast.nowWatching') : t('cardModal.toast.stoppedWatching'));
    } catch (error) {
      console.error('Failed to toggle watch:', error);
      showToast('error', t('cardModal.toast.failedToWatch'));
    } finally {
      setIsTogglingWatch(false);
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
      showToast('success', t('cardModal.toast.templateSaved'));
      setShowSaveTemplateModal(false);
      setTemplateName('');
    } catch (error) {
      console.error('Failed to save template:', error);
      showToast('error', t('cardModal.toast.templateFailed'));
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Sub-board handlers
  const handleCreateSubBoard = async () => {
    if (!user || !card) return;
    
    setIsCreatingSubBoard(true);
    try {
      await createSubBoard(cardId, boardId, `${card.titleEn} Sub-Board`, user.uid);
      showToast('success', t('cardModal.toast.subBoardCreated'));
      setShowSubBoardTemplates(false);
    } catch (error) {
      console.error('Failed to create sub-board:', error);
      showToast('error', t('cardModal.toast.subBoardFailed'));
    } finally {
      setIsCreatingSubBoard(false);
    }
  };

  const handleCreateSubBoardFromTemplate = async (templateBoard: Board) => {
    if (!user || !card) return;
    
    setIsCreatingSubBoard(true);
    try {
      await cloneTemplateBoardAsSubBoard(templateBoard.id, cardId, boardId, user.uid);
      showToast('success', t('cardModal.toast.subBoardCreated'));
      setShowSubBoardTemplates(false);
    } catch (error) {
      console.error('Failed to create sub-board from template:', error);
      showToast('error', t('cardModal.toast.subBoardFailed'));
    } finally {
      setIsCreatingSubBoard(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="relative">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-white/30 border-t-white"></div>
          <span className="absolute inset-0 flex items-center justify-center">
            <Image src="/logo-white.png" alt="Loading" width={28} height={28} className="opacity-50" />
          </span>
        </div>
      </div>
    );
  }

  if (!card) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md backdrop-saturate-150 flex items-start justify-center z-50 overflow-y-auto py-0 sm:py-6 md:py-10 px-0 sm:px-4"
      onClick={onClose}
      role="presentation"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
        className="relative bg-white dark:bg-slate-950/95 rounded-none sm:rounded-2xl shadow-2xl dark:shadow-[0_40px_120px_-60px_rgba(0,0,0,0.85)] w-full min-h-screen sm:min-h-0 sm:max-w-[1230px] sm:my-0 animate-in fade-in sm:zoom-in-95 duration-200 border border-slate-200/70 dark:border-slate-800/80 ring-1 ring-black/5 dark:ring-white/5"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and drop file overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[var(--primary)]/10 backdrop-blur-sm rounded-none sm:rounded-2xl border-2 border-dashed border-[var(--primary)] pointer-events-none">
            <div className="flex flex-col items-center gap-3 p-6 bg-white/90 dark:bg-slate-900/90 rounded-xl shadow-lg">
              <div className="w-16 h-16 rounded-full bg-[var(--primary-light)] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--primary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {t('cardModal.dropToUpload')}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('cardModal.dropToUploadHint')}
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Header with Editable Bilingual Titles */}
        <header className="px-4 sm:px-5 py-3 border-b border-slate-200/70 dark:border-slate-800/70 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 rounded-none sm:rounded-t-2xl shadow-sm dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-500/20 dark:to-emerald-500/5 dark:ring-1 dark:ring-emerald-400/20 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <svg
                  className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-300"
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
              <h2 id="card-modal-title" className="sr-only">
                {titleEn || titleJa || t('card.untitled')}
              </h2>
              
              {/* Column/List Selector */}
              <div className="relative" ref={columnDropdownRef}>
                <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{t('cardModal.inList')}</span>
                <button
                  onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                  disabled={isMovingCard}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-md transition-colors disabled:opacity-50"
                  aria-label={t('cardModal.changeList')}
                  aria-expanded={showColumnDropdown}
                  aria-haspopup="listbox"
                >
                  {isMovingCard ? (
                    <span className="animate-pulse">{t('common.loading')}</span>
                  ) : (
                    <>
                      {columns.find(col => col.id === card?.columnId)?.name || 'Unknown'}
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
                
                {showColumnDropdown && (
                  <div 
                    className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50"
                    role="listbox"
                    aria-label={t('cardModal.selectList')}
                  >
                    {columns.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => handleMoveToColumn(col.id)}
                        disabled={col.id === card?.columnId}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          col.id === card?.columnId
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-default'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                        role="option"
                        aria-selected={col.id === card?.columnId}
                      >
                        <span className="flex items-center gap-2">
                          {col.id === card?.columnId && (
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span className={col.id === card?.columnId ? '' : 'ml-6'}>{col.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-lg transition-all group touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center flex-shrink-0"
              aria-label="Close card details dialog"
            >
              <svg
                className="w-5 h-5 text-slate-400 dark:text-slate-300 group-hover:text-slate-600 dark:group-hover:text-white transition-colors"
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
          </div>
          
          {/* Bilingual Title Display/Edit - Equal Billing */}
          <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <legend className="sr-only">Card Title in English and Japanese</legend>
            {/* English Title */}
            <div className="space-y-1">
              {editingField === 'titleEn' ? (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-start shrink-0">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full" aria-hidden="true">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80 dark:bg-blue-300/80" />
                        EN
                      </span>
                      {getTitleTranslationLabel('en') && (
                        <span className={`text-[10px] font-medium whitespace-nowrap ${card?.titleDetectedLanguage === 'en' ? 'text-blue-500 dark:text-blue-300' : 'text-slate-400 dark:text-slate-400'}`}>
                          {getTitleTranslationLabel('en')}
                        </span>
                      )}
                    </div>
                    <input
                      id="card-title-en"
                      type="text"
                      value={editTitleEn}
                      onChange={(e) => setEditTitleEn(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveTitleEn();
                        } else if (e.key === 'Escape') {
                          cancelEditing();
                        }
                      }}
                      autoFocus
                      aria-describedby={translationState.errors[fieldKeys.titleEn] ? 'title-en-error' : undefined}
                      aria-invalid={!!translationState.errors[fieldKeys.titleEn]}
                      className={`flex-1 px-2.5 py-2 text-xl font-semibold border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white dark:bg-slate-900/70 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                        translationState.errors[fieldKeys.titleEn]
                          ? 'border-red-300 dark:border-red-600 focus:ring-red-500/20 focus:border-red-400'
                          : 'border-slate-200 dark:border-slate-700/80 focus:ring-blue-500/20 focus:border-blue-400'
                      }`}
                      placeholder={t('cardModal.enterTitleEn')}
                    />
                    <TranslationIndicator
                      isTranslating={translationState.isTranslating[fieldKeys.titleEn] || false}
                      hasError={translationState.errors[fieldKeys.titleEn]}
                      onRetry={handleRetryTitleEn}
                      language="en"
                    />
                  </div>
                  <div className="flex gap-2 ml-10">
                    <button
                      onClick={saveTitleEn}
                      className="px-2.5 py-1 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-2.5 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="group flex items-start gap-2 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-lg transition-colors"
                  onClick={startEditingTitleEn}
                >
                  <div className="flex flex-col items-start shrink-0">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full" aria-hidden="true">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80 dark:bg-blue-300/80" />
                      EN
                    </span>
                    {getTitleTranslationLabel('en') && (
                      <span className={`text-[10px] font-medium whitespace-nowrap ${card?.titleDetectedLanguage === 'en' ? 'text-blue-500 dark:text-blue-300' : 'text-slate-400 dark:text-slate-400'}`}>
                        {getTitleTranslationLabel('en')}
                      </span>
                    )}
                  </div>
                  <p className={`flex-1 px-2 py-1.5 text-xl font-semibold rounded-lg border border-transparent ${
                    titleEn ? 'text-gray-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 italic'
                  }`}>
                    {titleEn || t('cardModal.noTitle')}
                  </p>
                  <TranslationIndicator
                    isTranslating={translationState.isTranslating[fieldKeys.titleEn] || false}
                    hasError={translationState.errors[fieldKeys.titleEn]}
                    onRetry={handleRetryTitleEn}
                    language="en"
                  />
                </div>
              )}
              {translationState.errors[fieldKeys.titleEn] && (
                <span id="title-en-error" className="sr-only">Translation error: {translationState.errors[fieldKeys.titleEn]}</span>
              )}
            </div>

            {/* Japanese Title */}
            <div className="space-y-1">
              {editingField === 'titleJa' ? (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-start shrink-0">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full" aria-hidden="true">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 dark:bg-red-300/80" />
                        JP
                      </span>
                      {getTitleTranslationLabel('ja') && (
                        <span className={`text-[10px] font-medium whitespace-nowrap ${card?.titleDetectedLanguage === 'ja' ? 'text-red-500 dark:text-red-300' : 'text-slate-400 dark:text-slate-400'}`}>
                          {getTitleTranslationLabel('ja')}
                        </span>
                      )}
                    </div>
                    <input
                      id="card-title-ja"
                      type="text"
                      value={editTitleJa}
                      onChange={(e) => setEditTitleJa(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveTitleJa();
                        } else if (e.key === 'Escape') {
                          cancelEditing();
                        }
                      }}
                      autoFocus
                      aria-describedby={translationState.errors[fieldKeys.titleJa] ? 'title-ja-error' : undefined}
                      aria-invalid={!!translationState.errors[fieldKeys.titleJa]}
                      className={`flex-1 px-2.5 py-2 text-xl font-semibold border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white dark:bg-slate-900/70 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                        translationState.errors[fieldKeys.titleJa]
                          ? 'border-red-300 dark:border-red-600 focus:ring-red-500/20 focus:border-red-400'
                          : 'border-slate-200 dark:border-slate-700/80 focus:ring-red-500/20 focus:border-red-400'
                      }`}
                      placeholder={t('cardModal.enterTitleJa')}
                    />
                    <TranslationIndicator
                      isTranslating={translationState.isTranslating[fieldKeys.titleJa] || false}
                      hasError={translationState.errors[fieldKeys.titleJa]}
                      onRetry={handleRetryTitleJa}
                      language="ja"
                    />
                  </div>
                  <div className="flex gap-2 ml-10">
                    <button
                      onClick={saveTitleJa}
                      className="px-2.5 py-1 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-2.5 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="group flex items-start gap-2 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-lg transition-colors"
                  onClick={startEditingTitleJa}
                >
                  <div className="flex flex-col items-start shrink-0">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full" aria-hidden="true">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 dark:bg-red-300/80" />
                      JP
                    </span>
                    {getTitleTranslationLabel('ja') && (
                      <span className={`text-[10px] font-medium whitespace-nowrap ${card?.titleDetectedLanguage === 'ja' ? 'text-red-500 dark:text-red-300' : 'text-slate-400 dark:text-slate-400'}`}>
                        {getTitleTranslationLabel('ja')}
                      </span>
                    )}
                  </div>
                  <p className={`flex-1 px-2 py-1.5 text-xl font-semibold rounded-lg border border-transparent ${
                    titleJa ? 'text-gray-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 italic'
                  }`}>
                    {titleJa || t('cardModal.noTitle')}
                  </p>
                  <TranslationIndicator
                    isTranslating={translationState.isTranslating[fieldKeys.titleJa] || false}
                    hasError={translationState.errors[fieldKeys.titleJa]}
                    onRetry={handleRetryTitleJa}
                    language="ja"
                  />
                </div>
              )}
              {translationState.errors[fieldKeys.titleJa] && (
                <span id="title-ja-error" className="sr-only">Translation error: {translationState.errors[fieldKeys.titleJa]}</span>
              )}
            </div>
          </fieldset>
        </header>

        {/* Cover preview */}
        {coverPreview && (
          <div className="relative group/cover">
            {coverPreview.type === 'image' ? (
              <div className="relative h-32 sm:h-40 w-full overflow-hidden bg-black">
                <Image
                  src={coverPreview.url}
                  alt={t('cardModal.accessibility.cardCover')}
                  fill
                  className="object-contain"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
              </div>
            ) : (
              <div 
                className="h-20 sm:h-24 w-full transition-colors duration-300"
                style={{ backgroundColor: coverPreview.color }}
              />
            )}
            {/* Quick remove cover button - only shows on hover */}
            <button
              onClick={handleRemoveCover}
              className="absolute top-2 right-2 px-2.5 py-1.5 bg-white/90 hover:bg-red-500 hover:text-white rounded-lg shadow-sm transition-all border border-slate-200 hover:border-red-500 text-slate-500 dark:bg-slate-900/80 dark:border-slate-700/70 dark:text-slate-300 dark:hover:bg-red-500/90 dark:hover:border-red-500 opacity-0 group-hover/cover:opacity-100 flex items-center gap-1.5 text-xs font-medium"
              title={t('cardModal.accessibility.removeCoverTitle')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('cardModal.sidebar.removeCover')}
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 p-4 sm:p-5 md:p-6 space-y-5 sm:space-y-6">
            {/* Bilingual Description Section */}
            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <legend className="sr-only">Card Description in English and Japanese</legend>
              {/* English Description */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <div className="flex flex-col items-start shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full" aria-hidden="true">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80 dark:bg-blue-300/80" />
                      EN
                    </span>
                    {getDescriptionTranslationLabel('en') && (
                      <span className={`text-[10px] font-medium whitespace-nowrap ${card?.descriptionDetectedLanguage === 'en' ? 'text-blue-500 dark:text-blue-300' : 'text-slate-400 dark:text-slate-400'}`}>
                        {getDescriptionTranslationLabel('en')}
                      </span>
                    )}
                  </div>
                  {t('cardModal.descriptionEn')}
                  <TranslationIndicator
                    isTranslating={translationState.isTranslating[fieldKeys.descriptionEn] || false}
                    hasError={translationState.errors[fieldKeys.descriptionEn]}
                    onRetry={handleRetryDescriptionEn}
                    language="en"
                  />
                </div>
                {editingField === 'descriptionEn' ? (
                  <div className="space-y-2">
                    <textarea
                      id="card-description-en"
                      value={editDescriptionEn}
                      onChange={(e) => setEditDescriptionEn(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          cancelEditing();
                        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          saveDescriptionEn();
                        }
                      }}
                      autoFocus
                      aria-describedby={translationState.errors[fieldKeys.descriptionEn] ? 'desc-en-error' : undefined}
                      aria-invalid={!!translationState.errors[fieldKeys.descriptionEn]}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 min-h-[130px] resize-y transition-all bg-white dark:bg-slate-900/70 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                        translationState.errors[fieldKeys.descriptionEn]
                          ? 'border-red-300 dark:border-red-600 focus:ring-red-500/20 focus:border-red-400'
                          : 'border-slate-200 dark:border-slate-700/80 focus:ring-blue-500/20 focus:border-blue-400'
                      }`}
                      placeholder={t('cardModal.enterDescriptionEn')}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveDescriptionEn}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    <div 
                      className={`min-h-[40px] py-1 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-lg transition-colors ${
                        descriptionEn ? 'text-gray-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 italic'
                      }`}
                      onClick={startEditingDescriptionEn}
                    >
                      <p className="whitespace-pre-wrap">{descriptionEn || t('cardModal.noDescription')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Japanese Description */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <div className="flex flex-col items-start shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full" aria-hidden="true">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 dark:bg-red-300/80" />
                      JP
                    </span>
                    {getDescriptionTranslationLabel('ja') && (
                      <span className={`text-[10px] font-medium whitespace-nowrap ${card?.descriptionDetectedLanguage === 'ja' ? 'text-red-500 dark:text-red-300' : 'text-slate-400 dark:text-slate-400'}`}>
                        {getDescriptionTranslationLabel('ja')}
                      </span>
                    )}
                  </div>
                  {t('cardModal.descriptionJa')}
                  <TranslationIndicator
                    isTranslating={translationState.isTranslating[fieldKeys.descriptionJa] || false}
                    hasError={translationState.errors[fieldKeys.descriptionJa]}
                    onRetry={handleRetryDescriptionJa}
                    language="ja"
                  />
                </div>
                {editingField === 'descriptionJa' ? (
                  <div className="space-y-2">
                    <textarea
                      id="card-description-ja"
                      value={editDescriptionJa}
                      onChange={(e) => setEditDescriptionJa(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          cancelEditing();
                        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          saveDescriptionJa();
                        }
                      }}
                      autoFocus
                      aria-describedby={translationState.errors[fieldKeys.descriptionJa] ? 'desc-ja-error' : undefined}
                      aria-invalid={!!translationState.errors[fieldKeys.descriptionJa]}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 min-h-[130px] resize-y transition-all bg-white dark:bg-slate-900/70 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
                        translationState.errors[fieldKeys.descriptionJa]
                          ? 'border-red-300 dark:border-red-600 focus:ring-red-500/20 focus:border-red-400'
                          : 'border-slate-200 dark:border-slate-700/80 focus:ring-red-500/20 focus:border-red-400'
                      }`}
                      placeholder={t('cardModal.enterDescriptionJa')}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveDescriptionJa}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    <div 
                      className={`min-h-[40px] py-1 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-lg transition-colors ${
                        descriptionJa ? 'text-gray-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 italic'
                      }`}
                      onClick={startEditingDescriptionJa}
                    >
                      <p className="whitespace-pre-wrap">{descriptionJa || t('cardModal.noDescription')}</p>
                    </div>
                  </div>
                )}
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
                    <div key={checklist.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      {/* Checklist header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-2.5 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            {/* English title */}
                            <div className="flex items-center gap-1.5">
                              <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-4 text-[8px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded border border-sky-200/60 dark:border-sky-700/50">
                                EN
                              </span>
                              {editingChecklistId === checklist.id && editingChecklistField === 'en' ? (
                                <input
                                  type="text"
                                  value={editingChecklistTitleEn}
                                  onChange={(e) => setEditingChecklistTitleEn(e.target.value)}
                                  onBlur={() => handleUpdateChecklistTitleEn(checklist.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateChecklistTitleEn(checklist.id);
                                    if (e.key === 'Escape') {
                                      setEditingChecklistId(null);
                                      setEditingChecklistField(null);
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 text-sm font-semibold text-slate-800 dark:text-white border-2 border-sky-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 bg-white dark:bg-slate-900/70"
                                  autoFocus
                                  placeholder="Checklist name (English)"
                                />
                              ) : (
                                <div 
                                  onClick={() => {
                                    setEditingChecklistId(checklist.id);
                                    setEditingChecklistField('en');
                                    setEditingChecklistTitleEn(checklist.titleEn || checklist.title || '');
                                  }}
                                  className="flex-1 flex items-center gap-1.5 cursor-pointer group"
                                >
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                    {checklist.titleEn || checklist.title || '—'}
                                  </span>
                                  <TranslationIndicator
                                    isTranslating={translationState.isTranslating[`checklist-${checklist.id}-title-en`] || false}
                                    hasError={translationState.errors[`checklist-${checklist.id}-title-en`]}
                                    onRetry={async () => {
                                      const jaTitle = checklist.titleJa;
                                      if (jaTitle) {
                                        clearError(`checklist-${checklist.id}-title-en`);
                                        const result = await retryTranslation(jaTitle, 'en', `checklist-${checklist.id}-title-en`);
                                        if (!result.error) {
                                          await updateChecklist(boardId, cardId, checklist.id, { titleEn: result.translation });
                                          setChecklists(prev => prev.map(cl =>
                                            cl.id === checklist.id ? { ...cl, titleEn: result.translation, title: result.translation } : cl
                                          ));
                                        }
                                      }
                                    }}
                                    language="en"
                                  />
                                  <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            
                            {/* Japanese title */}
                            <div className="flex items-center gap-1.5">
                              <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-4 text-[8px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 rounded border border-rose-200/60 dark:border-rose-700/50">
                                JP
                              </span>
                              {editingChecklistId === checklist.id && editingChecklistField === 'ja' ? (
                                <input
                                  type="text"
                                  value={editingChecklistTitleJa}
                                  onChange={(e) => setEditingChecklistTitleJa(e.target.value)}
                                  onBlur={() => handleUpdateChecklistTitleJa(checklist.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateChecklistTitleJa(checklist.id);
                                    if (e.key === 'Escape') {
                                      setEditingChecklistId(null);
                                      setEditingChecklistField(null);
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 text-xs text-slate-800 dark:text-white border-2 border-rose-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/30 bg-white dark:bg-slate-900/70"
                                  autoFocus
                                  placeholder="チェックリスト名（日本語）"
                                />
                              ) : (
                                <div 
                                  onClick={() => {
                                    setEditingChecklistId(checklist.id);
                                    setEditingChecklistField('ja');
                                    setEditingChecklistTitleJa(checklist.titleJa || '');
                                  }}
                                  className="flex-1 flex items-center gap-1.5 cursor-pointer group"
                                >
                                  {translationState.isTranslating[`checklist-${checklist.id}-title-ja`] && !checklist.titleJa ? (
                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic flex items-center gap-1">
                                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      翻訳中...
                                    </span>
                                  ) : (
                                    <>
                                      <span className="text-xs text-slate-600 dark:text-slate-300 truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                        {checklist.titleJa || '—'}
                                      </span>
                                      <TranslationIndicator
                                        isTranslating={translationState.isTranslating[`checklist-${checklist.id}-title-ja`] || false}
                                        hasError={translationState.errors[`checklist-${checklist.id}-title-ja`]}
                                        onRetry={async () => {
                                          const enTitle = checklist.titleEn || checklist.title;
                                          if (enTitle) {
                                            clearError(`checklist-${checklist.id}-title-ja`);
                                            const result = await retryTranslation(enTitle, 'ja', `checklist-${checklist.id}-title-ja`);
                                            if (!result.error) {
                                              await updateChecklist(boardId, cardId, checklist.id, { titleJa: result.translation });
                                              setChecklists(prev => prev.map(cl =>
                                                cl.id === checklist.id ? { ...cl, titleJa: result.translation } : cl
                                              ));
                                            }
                                          }
                                        }}
                                        language="ja"
                                      />
                                      <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteChecklist(checklist.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('cardModal.checklistItem.deleteChecklist')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Progress bar */}
                      {totalCount > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                            <span>{progress}%</span>
                            <span>{completedCount}/{totalCount}</span>
                          </div>
                          <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
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
                        {checklist.items.sort((a, b) => a.order - b.order).map((item) => {
                          const itemAssignee = item.assigneeId ? boardMembers.find(m => m.uid === item.assigneeId) : null;
                          const dueDateStatus = getChecklistItemDueDateStatus(item.dueDate);
                          const isCurrentUserAssigned = item.assigneeId === user?.uid;
                          
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg group transition-colors relative ${
                                item.isCompleted 
                                  ? 'bg-green-50/50 dark:bg-green-900/20' 
                                  : isCurrentUserAssigned 
                                    ? 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                    : 'hover:bg-white dark:hover:bg-slate-700'
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
                              
                              {/* Item text - bilingual */}
                              <div className="flex-1 min-w-0 space-y-0.5">
                                {/* English text */}
                                <div className="flex items-center gap-1">
                                  <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-3 text-[7px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded border border-sky-200/60 dark:border-sky-700/50">
                                    EN
                                  </span>
                                  {editingItemId === item.id && editingItemField === 'en' ? (
                                    <input
                                      type="text"
                                      value={editingItemTextEn}
                                      onChange={(e) => setEditingItemTextEn(e.target.value)}
                                      onBlur={() => handleUpdateChecklistItemTextEn(checklist.id, item.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateChecklistItemTextEn(checklist.id, item.id);
                                        if (e.key === 'Escape') {
                                          setEditingItemId(null);
                                          setEditingItemField(null);
                                        }
                                      }}
                                      className="flex-1 px-2 py-0.5 text-sm border-2 border-sky-400 rounded focus:outline-none focus:ring-2 focus:ring-sky-500/30 bg-white dark:bg-slate-900/70 text-slate-900 dark:text-white"
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                      <span
                                        onClick={() => {
                                          setEditingItemId(item.id);
                                          setEditingItemField('en');
                                          setEditingItemTextEn(item.textEn || item.text || '');
                                        }}
                                        className={`text-sm cursor-pointer transition-all truncate ${
                                          item.isCompleted
                                            ? 'text-slate-400 dark:text-slate-500 line-through'
                                            : 'text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400'
                                        }`}
                                      >
                                        {item.textEn || item.text || '—'}
                                      </span>
                                      <TranslationIndicator
                                        isTranslating={translationState.isTranslating[`item-${item.id}-text-en`] || false}
                                        hasError={translationState.errors[`item-${item.id}-text-en`]}
                                        onRetry={async () => {
                                          const jaText = item.textJa;
                                          if (jaText) {
                                            clearError(`item-${item.id}-text-en`);
                                            const result = await retryTranslation(jaText, 'en', `item-${item.id}-text-en`);
                                            if (!result.error) {
                                              await updateChecklistItem(boardId, cardId, checklist.id, item.id, { textEn: result.translation });
                                              setChecklists(prev => prev.map(cl => {
                                                if (cl.id === checklist.id) {
                                                  return {
                                                    ...cl,
                                                    items: cl.items.map(i =>
                                                      i.id === item.id ? { ...i, textEn: result.translation, text: result.translation } : i
                                                    ),
                                                  };
                                                }
                                                return cl;
                                              }));
                                            }
                                          }
                                        }}
                                        language="en"
                                      />
                                      {/* Due date badge - only show on EN row */}
                                      {item.dueDate && dueDateStatus.label && (
                                        <span 
                                          className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-medium rounded flex-shrink-0 ${
                                            item.isCompleted ? 'opacity-50 line-through' : ''
                                          } ${dueDateStatus.className}`}
                                        >
                                          <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          {dueDateStatus.label}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Japanese text */}
                                <div className="flex items-center gap-1">
                                  <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-3 text-[7px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 rounded border border-rose-200/60 dark:border-rose-700/50">
                                    JP
                                  </span>
                                  {editingItemId === item.id && editingItemField === 'ja' ? (
                                    <input
                                      type="text"
                                      value={editingItemTextJa}
                                      onChange={(e) => setEditingItemTextJa(e.target.value)}
                                      onBlur={() => handleUpdateChecklistItemTextJa(checklist.id, item.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateChecklistItemTextJa(checklist.id, item.id);
                                        if (e.key === 'Escape') {
                                          setEditingItemId(null);
                                          setEditingItemField(null);
                                        }
                                      }}
                                      className="flex-1 px-2 py-0.5 text-xs border-2 border-rose-400 rounded focus:outline-none focus:ring-2 focus:ring-rose-500/30 bg-white dark:bg-slate-900/70 text-slate-900 dark:text-white"
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                      {translationState.isTranslating[`item-${item.id}-text-ja`] && !item.textJa ? (
                                        <span className="text-[11px] text-slate-400 dark:text-slate-500 italic flex items-center gap-1">
                                          <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          翻訳中...
                                        </span>
                                      ) : (
                                        <>
                                          <span
                                            onClick={() => {
                                              setEditingItemId(item.id);
                                              setEditingItemField('ja');
                                              setEditingItemTextJa(item.textJa || '');
                                            }}
                                            className={`text-[11px] cursor-pointer transition-all truncate ${
                                              item.isCompleted
                                                ? 'text-slate-400 dark:text-slate-500 line-through'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                                            }`}
                                          >
                                            {item.textJa || '—'}
                                          </span>
                                          <TranslationIndicator
                                            isTranslating={translationState.isTranslating[`item-${item.id}-text-ja`] || false}
                                            hasError={translationState.errors[`item-${item.id}-text-ja`]}
                                            onRetry={async () => {
                                              const enText = item.textEn || item.text;
                                              if (enText) {
                                                clearError(`item-${item.id}-text-ja`);
                                                const result = await retryTranslation(enText, 'ja', `item-${item.id}-text-ja`);
                                                if (!result.error) {
                                                  await updateChecklistItem(boardId, cardId, checklist.id, item.id, { textJa: result.translation });
                                                  setChecklists(prev => prev.map(cl => {
                                                    if (cl.id === checklist.id) {
                                                      return {
                                                        ...cl,
                                                        items: cl.items.map(i =>
                                                          i.id === item.id ? { ...i, textJa: result.translation } : i
                                                        ),
                                                      };
                                                    }
                                                    return cl;
                                                  }));
                                                }
                                              }
                                            }}
                                            language="ja"
                                          />
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Action buttons container */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Assignee picker button/avatar */}
                                <div className="relative">
                                  {itemAssignee ? (
                                    <button
                                      onClick={() => setActiveItemAssigneePickerId(
                                        activeItemAssigneePickerId === item.id ? null : item.id
                                      )}
                                      className="w-6 h-6 rounded-full overflow-hidden border-2 border-white dark:border-slate-600 shadow-sm hover:ring-2 hover:ring-blue-400 transition-all"
                                      title={itemAssignee.displayName || itemAssignee.email}
                                    >
                                      {itemAssignee.photoURL ? (
                                        <Image
                                          src={itemAssignee.photoURL}
                                          alt={itemAssignee.displayName || 'Assignee'}
                                          width={24}
                                          height={24}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div 
                                          className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-white"
                                          style={{ backgroundColor: getAvatarColor(itemAssignee.displayName || itemAssignee.email) }}
                                        >
                                          {getInitials(itemAssignee.displayName || itemAssignee.email)}
                                        </div>
                                      )}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setActiveItemAssigneePickerId(
                                        activeItemAssigneePickerId === item.id ? null : item.id
                                      )}
                                      className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                      title={t('cardModal.checklistItem.assignMember')}
                                    >
                                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </button>
                                  )}
                                  
                                  {/* Assignee dropdown */}
                                  {activeItemAssigneePickerId === item.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900/80 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700/70 z-20 py-1 max-h-48 overflow-y-auto">
                                      {item.assigneeId && (
                                        <button
                                          onClick={() => handleChecklistItemAssignee(checklist.id, item.id, undefined)}
                                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                          {t('cardModal.checklistItem.unassign')}
                                        </button>
                                      )}
                                      {boardMembers.map((member) => (
                                        <button
                                          key={member.uid}
                                          onClick={() => handleChecklistItemAssignee(checklist.id, item.id, member.uid)}
                                          className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-2 ${
                                            item.assigneeId === member.uid ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                          }`}
                                        >
                                          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                                            {member.photoURL ? (
                                              <Image
                                                src={member.photoURL}
                                                alt={member.displayName || 'Member'}
                                                width={20}
                                                height={20}
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <div 
                                                className="w-full h-full flex items-center justify-center text-[8px] font-semibold text-white"
                                                style={{ backgroundColor: getAvatarColor(member.displayName || member.email) }}
                                              >
                                                {getInitials(member.displayName || member.email)}
                                              </div>
                                            )}
                                          </div>
                                          <span className="truncate text-slate-700 dark:text-slate-200">
                                            {member.displayName || member.email}
                                          </span>
                                          {item.assigneeId === member.uid && (
                                            <svg className="w-4 h-4 ml-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Due date picker button */}
                                <div className="relative">
                                  {item.dueDate ? (
                                    <button
                                      onClick={() => setActiveItemDueDatePickerId(
                                        activeItemDueDatePickerId === item.id ? null : item.id
                                      )}
                                      className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                                        dueDateStatus.isOverdue 
                                          ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                                          : dueDateStatus.isDueToday
                                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
                                      } hover:ring-2 hover:ring-emerald-400`}
                                      title={`Due: ${dueDateStatus.label}`}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setActiveItemDueDatePickerId(
                                        activeItemDueDatePickerId === item.id ? null : item.id
                                      )}
                                      className="w-6 h-6 rounded border border-dashed border-slate-300 dark:border-slate-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                                      title={t('cardModal.checklistItem.setDueDate')}
                                    >
                                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  )}
                                  
                                  {/* Due date picker dropdown */}
                                  {activeItemDueDatePickerId === item.id && (
                                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-900/80 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700/70 z-20 p-3">
                                      <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('cardModal.sidebar.dueDate')}</label>
                                        <input
                                          type="date"
                                          value={item.dueDate ? format(item.dueDate.toDate(), 'yyyy-MM-dd') : ''}
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              const date = new Date(e.target.value + 'T00:00:00');
                                              handleChecklistItemDueDate(checklist.id, item.id, Timestamp.fromDate(date));
                                            }
                                          }}
                                          className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200"
                                        />
                                        
                                        {/* Quick date options */}
                                        <div className="flex flex-wrap gap-1 pt-1">
                                          {[
                                            { label: t('cardModal.sidebar.today'), days: 0 },
                                            { label: t('cardModal.sidebar.tomorrow'), days: 1 },
                                            { label: t('cardModal.sidebar.nextWeek'), days: 7 },
                                          ].map((opt) => {
                                            const targetDate = new Date();
                                            targetDate.setDate(targetDate.getDate() + opt.days);
                                            return (
                                              <button
                                                key={opt.label}
                                                onClick={() => handleChecklistItemDueDate(checklist.id, item.id, Timestamp.fromDate(targetDate))}
                                                className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors"
                                              >
                                                {opt.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                        
                                        {item.dueDate && (
                                          <button
                                            onClick={() => handleChecklistItemDueDate(checklist.id, item.id, null)}
                                            className="w-full mt-2 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center justify-center gap-1"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            {t('cardModal.checklistItem.removeDueDate')}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Delete button */}
                                <button
                                  onClick={() => handleDeleteChecklistItem(checklist.id, item.id)}
                                  className="p-1 text-slate-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-all"
                                  title={t('cardModal.checklistItem.deleteItem')}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
                            placeholder={t('cardModal.checklistItem.addItemPlaceholder')}
                            className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/70 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white dark:bg-slate-900/70 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                          />
                          <button
                            onClick={() => handleAddChecklistItem(checklist.id)}
                            disabled={!newItemTexts[checklist.id]?.trim()}
                            className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-200 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            {t('cardModal.checklistItem.add')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-Board Section */}
            {subBoard && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 dark:ring-1 dark:ring-purple-700/50 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-purple-500"
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
                  </div>
                  {t('cardModal.subBoard.title')}
                  {typeof card.subBoardApprovedCount === 'number' && card.subBoardApprovedCount > 0 && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                      {card.subBoardApprovedCount} {t('cardModal.sidebar.approved')}
                    </span>
                  )}
                </h4>
                
                {/* Sub-board preview - links to full board */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/70">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{subBoard.name}</span>
                    <a
                      href={`/boards/${subBoard.id}`}
                      className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {t('cardModal.subBoard.openFull')}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                  {/* Embedded KanbanBoard component */}
                  <KanbanBoard
                    boardId={subBoard.id}
                    embedded={true}
                    maxHeight="320px"
                  />
                </div>
              </div>
            )}

            {/* Attachments */}
            {card.attachments && card.attachments.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 dark:ring-1 dark:ring-slate-700/70 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-slate-500 dark:text-slate-300"
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
                  {t('cardModal.attachments')}
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 dark:ring-1 dark:ring-slate-700/70 px-2 py-0.5 rounded-full">
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
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 dark:ring-1 dark:ring-slate-700/70 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-slate-500 dark:text-slate-300"
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
                {t('cardModal.activity.title')}
                {(comments.length + activities.filter(a => a.type !== 'comment_added').length) > 0 && (
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 dark:ring-1 dark:ring-slate-700/70 px-2 py-0.5 rounded-full">
                    {comments.length + activities.filter(a => a.type !== 'comment_added').length}
                  </span>
                )}
              </h4>

              {/* Add comment */}
              <div className="flex justify-center">
                <div className="w-full md:w-1/2 flex gap-3">
                  {user?.photoURL && (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-slate-100 dark:ring-slate-800/80 object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={t('cardModal.comment.placeholder')}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 min-h-[90px] resize-y transition-all bg-white dark:bg-slate-900/70 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleAddComment();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t('cardModal.comment.submitHint')}</span>
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || isAddingComment}
                        className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-sm active:scale-[0.98]"
                      >
                        {isAddingComment ? t('cardModal.comment.posting') : t('cardModal.comment.postComment')}
                      </button>
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
          <div className="lg:w-56 p-4 sm:p-5 bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950/80 sm:rounded-br-2xl space-y-4 border-t lg:border-t-0 lg:border-l border-slate-200/70 dark:border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t('cardModal.sidebar.addToCard')}
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
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600/80 rounded-xl text-sm text-left flex items-center gap-3 transition-all disabled:opacity-50 group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 flex items-center justify-center transition-colors">
                <svg
                  className="w-4 h-4 text-slate-400 dark:text-slate-300 group-hover:text-emerald-500 transition-colors"
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
              <span className="text-slate-600 dark:text-slate-200 font-medium">{isUploading ? t('cardModal.sidebar.uploading') : t('cardModal.sidebar.attachment')}</span>
            </button>

            {/* Add link */}
            {showLinkInput ? (
              <div className="space-y-2.5 p-3 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={t('cardModal.sidebar.linkUrlPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-white dark:bg-slate-600 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  autoFocus
                />
                <input
                  type="text"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder={t('cardModal.sidebar.linkNamePlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-white dark:bg-slate-600 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddLink}
                    disabled={!linkUrl.trim()}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowLinkInput(false);
                      setLinkUrl('');
                      setLinkName('');
                    }}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLinkInput(true)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600/80 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 flex items-center justify-center transition-colors">
                  <svg
                    className="w-4 h-4 text-slate-400 dark:text-slate-300 group-hover:text-blue-500 transition-colors"
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
                <span className="text-slate-600 dark:text-slate-200 font-medium">{t('cardModal.sidebar.link')}</span>
              </button>
            )}

            {/* Add checklist */}
            {showChecklistInput ? (
              <div className="space-y-2.5 p-3 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <input
                  type="text"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  placeholder={t('cardModal.sidebar.checklistTitlePlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white dark:bg-slate-600 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowChecklistInput(true)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600/80 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 group-hover:bg-green-100 dark:group-hover:bg-green-900/40 flex items-center justify-center transition-colors">
                  <svg
                    className="w-4 h-4 text-slate-400 dark:text-slate-300 group-hover:text-green-500 transition-colors"
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
                <span className="text-slate-600 dark:text-slate-200 font-medium">{t('cardModal.sidebar.checklist')}</span>
              </button>
            )}

            {/* Sub-Board */}
            {card.subBoardId ? (
              <a
                href={`/boards/${card.subBoardId}`}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600/80 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <span className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-purple-500"
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
                </span>
                <span className="text-purple-600 dark:text-purple-400 font-medium flex items-center gap-2">
                  {t('cardModal.sidebar.viewSubBoard')}
                  {typeof card.subBoardApprovedCount === 'number' && card.subBoardApprovedCount > 0 && (
                    <span className="bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-xs px-1.5 py-0.5 rounded-full">
                      {card.subBoardApprovedCount} {t('cardModal.sidebar.approved')}
                    </span>
                  )}
                </span>
              </a>
            ) : showSubBoardTemplates ? (
              <div className="space-y-2.5 p-3 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('cardModal.sidebar.selectTemplate')}</span>
                  <button
                    onClick={() => setShowSubBoardTemplates(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {/* Blank sub-board option */}
                <button
                  onClick={handleCreateSubBoard}
                  disabled={isCreatingSubBoard}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg text-sm text-left flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-600/50 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-slate-600 dark:text-slate-300">{t('cardModal.sidebar.blankSubBoard')}</span>
                </button>
                {/* Template options */}
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {templateBoards.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleCreateSubBoardFromTemplate(template)}
                      disabled={isCreatingSubBoard}
                      className="w-full px-3 py-2 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg text-sm text-left transition-colors border border-purple-200 dark:border-purple-700/50 disabled:opacity-50"
                    >
                      <div className="font-medium text-purple-600 dark:text-purple-400">{template.name}</div>
                    </button>
                  ))}
                </div>
                {/* Manage Templates link */}
                <button
                  onClick={() => setShowSubBoardTemplateManager(true)}
                  className="w-full px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg flex items-center justify-center gap-1.5 transition-colors mt-2 border-t border-slate-100 dark:border-slate-700/50 pt-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t('cardModal.sidebar.manageTemplates')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSubBoardTemplates(true)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600/80 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 flex items-center justify-center transition-colors">
                  <svg
                    className="w-4 h-4 text-slate-400 dark:text-slate-300 group-hover:text-purple-500 transition-colors"
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
                </span>
                <span className="text-slate-600 dark:text-slate-200 font-medium">{t('cardModal.sidebar.subBoard')}</span>
              </button>
            )}

            {/* Cover */}
            {showCoverPicker ? (
              <div className="space-y-3 p-3 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('cardModal.sidebar.cover')}</span>
                  <button
                    onClick={() => setShowCoverPicker(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Image attachments */}
                {imageAttachments.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('cardModal.sidebar.images')}</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {imageAttachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          onClick={() => handleSetImageCover(attachment.id)}
                          className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${
                            card?.coverImage?.attachmentId === attachment.id
                              ? 'border-emerald-500 ring-2 ring-emerald-200'
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
                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
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
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('cardModal.sidebar.colors')}</span>
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
                    className="w-full px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                  >
                    {t('cardModal.sidebar.removeCover')}
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowCoverPicker(true)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600/80 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 flex items-center justify-center transition-colors">
                  <svg
                    className="w-4 h-4 text-slate-400 dark:text-slate-300 group-hover:text-amber-500 transition-colors"
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
                <span className="text-slate-600 dark:text-slate-200 font-medium">{t('cardModal.sidebar.cover')}</span>
              </button>
            )}

            {/* Assignees */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                {t('cardModal.sidebar.assignees')}
              </label>
              
              {/* Current assignees */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {assignees.length === 0 ? (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">{t('cardModal.sidebar.noAssignees')}</span>
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
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600/80 rounded-xl text-sm text-left flex items-center gap-2 transition-all group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                  <svg
                    className="w-4 h-4 text-slate-400 dark:text-slate-300 group-hover:text-emerald-500 transition-colors"
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
                  <span className="text-slate-600 dark:text-slate-200 font-medium">{t('cardModal.sidebar.addAssignee')}</span>
                </button>
                
                {showAssigneeDropdown && (
                  <div 
                    role="listbox"
                    aria-label="Available team members"
                    className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/70 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto"
                  >
                    {boardMembers.filter(m => !card?.assigneeIds?.includes(m.uid)).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500 text-center">
                        {t('cardModal.sidebar.allMembersAssigned')}
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
                            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-left"
                          >
                            <UserAvatar user={member} size="sm" showTooltip={false} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                {member.displayName || member.email}
                              </p>
                              {member.displayName && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{member.email}</p>
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
              <label htmlFor="card-due-date" className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                {t('cardModal.sidebar.dueDate')}
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
                    bg: 'bg-red-100 dark:bg-red-900/30',
                    text: 'text-red-700 dark:text-red-400',
                    border: 'border-red-200 dark:border-red-800/50',
                    icon: 'alert',
                    label: Math.abs(diffDays) === 1 ? t('cardModal.sidebar.overdueBy', { count: Math.abs(diffDays) }) : t('cardModal.sidebar.overdueByPlural', { count: Math.abs(diffDays) }),
                    pulse: true,
                  };
                } else if (diffDays === 0) {
                  statusConfig = {
                    bg: 'bg-red-50 dark:bg-red-900/20',
                    text: 'text-red-600 dark:text-red-400',
                    border: 'border-red-200 dark:border-red-800/50',
                    icon: 'clock',
                    label: t('cardModal.sidebar.dueToday'),
                  };
                } else if (diffDays === 1) {
                  statusConfig = {
                    bg: 'bg-orange-100 dark:bg-orange-900/30',
                    text: 'text-orange-700 dark:text-orange-400',
                    border: 'border-orange-200 dark:border-orange-800/50',
                    icon: 'clock',
                    label: t('cardModal.sidebar.dueTomorrow'),
                  };
                } else if (diffDays <= 7) {
                  statusConfig = {
                    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
                    text: 'text-yellow-700 dark:text-yellow-400',
                    border: 'border-yellow-200 dark:border-yellow-800/50',
                    icon: 'calendar',
                    label: t('cardModal.sidebar.dueInDays', { count: diffDays }),
                  };
                } else {
                  statusConfig = {
                    bg: 'bg-slate-100 dark:bg-slate-800/50',
                    text: 'text-slate-600 dark:text-slate-400',
                    border: 'border-slate-200 dark:border-slate-700/50',
                    icon: 'calendar',
                    label: t('cardModal.sidebar.dueInDays', { count: diffDays }),
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
                  { label: t('cardModal.sidebar.today'), days: 0 },
                  { label: t('cardModal.sidebar.tomorrow'), days: 1 },
                  { label: t('cardModal.sidebar.nextWeek'), days: 7 },
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
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
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
                  className="w-full px-3 py-3 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/70 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                />
                <span id="due-date-help" className="sr-only">Select a due date for this card</span>
              </div>
              
              {dueDate && (
                <button
                  onClick={handleClearDueDate}
                  aria-label="Clear due date"
                  className="w-full px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-slate-200 dark:border-slate-600 hover:border-red-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('cardModal.sidebar.clearDueDate')}
                </button>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                {t('cardModal.sidebar.priority')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: null, labelKey: 'cardModal.sidebar.priorityNone', color: 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/50' },
                  { value: 'low', labelKey: 'cardModal.sidebar.priorityLow', color: 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/50', dot: 'bg-slate-400' },
                  { value: 'medium', labelKey: 'cardModal.sidebar.priorityMedium', color: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50 hover:bg-yellow-100 dark:hover:bg-yellow-800/40', dot: 'bg-yellow-500' },
                  { value: 'high', labelKey: 'cardModal.sidebar.priorityHigh', color: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 hover:bg-orange-100 dark:hover:bg-orange-800/40', dot: 'bg-orange-500' },
                  { value: 'urgent', labelKey: 'cardModal.sidebar.priorityUrgent', color: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-800/40', dot: 'bg-red-500' },
                ] as { value: CardPriority; labelKey: string; color: string; dot?: string }[]).map((option) => (
                  <button
                    key={option.value ?? 'none'}
                    onClick={() => handlePriorityChange(option.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                      priority === option.value
                        ? `ring-2 ring-emerald-500 ${option.color}`
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
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-700" />

            <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t('cardModal.sidebar.actions')}
            </h4>

            {/* Watch/Subscribe button */}
            <button
              onClick={handleToggleWatch}
              disabled={isTogglingWatch}
              title={isWatching ? t('cardModal.toast.stoppedWatching') : t('cardModal.sidebar.watch')}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm ${
                isWatching
                  ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/30'
                  : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-700/70 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:border-cyan-200 dark:hover:border-cyan-800'
              } disabled:opacity-50`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isWatching
                  ? 'bg-cyan-100 dark:bg-cyan-900/40'
                  : 'bg-slate-100 dark:bg-slate-600 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40'
              }`}>
                <svg
                  className={`w-4 h-4 transition-colors ${
                    isWatching
                      ? 'text-cyan-600 dark:text-cyan-400'
                      : 'text-slate-400 dark:text-slate-300 group-hover:text-cyan-500'
                  }`}
                  fill={isWatching ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
              </span>
              <span className={`font-medium transition-colors ${
                isWatching
                  ? 'text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-600 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400'
              }`}>
                {isTogglingWatch ? t('cardModal.sidebar.updating') : isWatching ? t('cardModal.sidebar.watching') : t('cardModal.sidebar.watch')}
              </span>
              {isWatching && (
                <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Watchers display */}
            {watchers.length > 0 && (
              <div className="space-y-2 p-3 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {t('cardModal.sidebar.watchersCount', { count: watchers.length })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {watchers.slice(0, 5).map((watcher) => (
                    <UserAvatar
                      key={watcher.uid}
                      user={watcher}
                      size="sm"
                      showTooltip={true}
                    />
                  ))}
                  {watchers.length > 5 && (
                    <div 
                      className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center"
                      title={`+${watchers.length - 5} more watchers`}
                    >
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">+{watchers.length - 5}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSaveTemplateModal(true)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/70 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-slate-200 dark:border-slate-700/70 hover:border-purple-200 dark:hover:border-purple-800 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 flex items-center justify-center transition-colors">
                <svg
                  className="w-4 h-4 text-slate-400 dark:text-slate-300 group-hover:text-purple-500 transition-colors"
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
              <span className="text-slate-600 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 font-medium transition-colors">{t('cardModal.sidebar.saveAsTemplate')}</span>
            </button>

            <button
              onClick={handleArchive}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/70 hover:bg-red-50 dark:hover:bg-red-900/20 border border-slate-200 dark:border-slate-700/70 hover:border-red-200 dark:hover:border-red-800 rounded-xl text-sm text-left flex items-center gap-3 transition-all group shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-600 group-hover:bg-red-100 dark:group-hover:bg-red-900/40 flex items-center justify-center transition-colors">
                <svg
                  className="w-4 h-4 text-slate-400 dark:text-slate-300 group-hover:text-red-500 transition-colors"
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
              <span className="text-slate-600 dark:text-slate-200 group-hover:text-red-600 dark:group-hover:text-red-400 font-medium transition-colors">{t('cardModal.sidebar.archive')}</span>
            </button>
          </div>
        </div>
      </div>

      {uploadNotice && (
        <div className="fixed bottom-4 left-4 z-[70] pointer-events-none">
          <div
            className={`w-72 max-w-[calc(100vw-2rem)] rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl ${
              uploadNotice.status === 'uploading'
                ? 'bg-blue-500/10 border-blue-500/20'
                : uploadNotice.status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  uploadNotice.status === 'uploading'
                    ? 'bg-blue-500 text-white'
                    : uploadNotice.status === 'success'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-red-500 text-white'
                }`}
              >
                {uploadNotice.status === 'uploading' ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                ) : uploadNotice.status === 'success' ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    uploadNotice.status === 'uploading'
                      ? 'text-blue-700'
                      : uploadNotice.status === 'success'
                        ? 'text-emerald-700'
                        : 'text-red-700'
                  }`}
                >
                  {uploadNotice.message}
                </p>
                {uploadNotice.status === 'uploading' && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/5">
                    <div className="h-full w-2/3 animate-pulse bg-blue-500" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showSaveTemplateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowSaveTemplateModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-800/20 flex items-center justify-center">
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
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{t('cardModal.template.title')}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('cardModal.template.subtitle')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('cardModal.template.nameLabel')}
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={t('cardModal.template.namePlaceholder')}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 bg-white dark:bg-slate-900/70 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
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

              <div className="bg-slate-50 dark:bg-slate-900/70 rounded-xl p-4 space-y-2 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('cardModal.template.willInclude')}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-600 rounded-lg text-xs text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('cardModal.template.titlesDescriptions')}
                  </span>
                  {card?.labels && card.labels.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs text-slate-600 border border-slate-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {card.labels.length > 1 ? t('cardModal.template.labelCountPlural', { count: card.labels.length }) : t('cardModal.template.labelCount', { count: card.labels.length })}
                    </span>
                  )}
                  {card?.checklists && card.checklists.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs text-slate-600 border border-slate-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      {card.checklists.length > 1 ? t('cardModal.template.checklistCountPlural', { count: card.checklists.length }) : t('cardModal.template.checklistCount', { count: card.checklists.length })}
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
                  {isSavingTemplate ? t('cardModal.template.savingTemplate') : t('cardModal.template.saveTemplate')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Board Template Manager Modal */}
      <SubBoardTemplateModal
        isOpen={showSubBoardTemplateManager}
        onClose={() => {
          setShowSubBoardTemplateManager(false);
          // Refresh templates after closing the manager
          if (boardId && user) {
            getTemplateBoardsForBoard(boardId, user.uid).then(setTemplateBoards);
          }
        }}
        boardId={boardId}
      />
    </div>
  );
}
