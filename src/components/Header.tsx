'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useFilterOptional } from '@/contexts/FilterContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import { SyncIndicator } from './SyncIndicator';
import Image from 'next/image';
import { BoardMember, Card, SortBy, SortOrder } from '@/types';
import { subscribeToBoardMembers, subscribeToArchivedCards, subscribeToArchivedColumns, subscribeToCards } from '@/lib/firestore';
// Avatar is used inline for member display, keep static import
import { Avatar } from './ShareBoardModal';
import { Tip, ShortcutHint } from './Tooltip';
import { BoardBackground } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';

// Lazy load all modal components for better initial load performance
// These are only rendered when user opens them, reducing initial bundle size

const ArchivedItemsDrawer = dynamic(() => import('./ArchivedItemsDrawer').then(mod => ({ default: mod.ArchivedItemsDrawer })), {
  ssr: false,
  loading: () => null,
});

const ExportImportModal = dynamic(() => import('./ExportImportModal').then(mod => ({ default: mod.ExportImportModal })), {
  ssr: false,
  loading: () => null,
});

// ShareBoardModal - loaded when user clicks share button
const ShareBoardModal = dynamic(() => import('./ShareBoardModal').then(mod => ({ default: mod.ShareBoardModal })), {
  ssr: false,
  loading: () => null,
});

// BackgroundPicker - loaded when user opens background menu
const BackgroundPicker = dynamic(() => import('./BackgroundPicker').then(mod => ({ default: mod.BackgroundPicker })), {
  ssr: false,
  loading: () => null,
});

// TranslationSettingsModal - loaded when user opens translation settings
const TranslationSettingsModal = dynamic(() => import('./TranslationSettingsModal').then(mod => ({ default: mod.TranslationSettingsModal })), {
  ssr: false,
  loading: () => null,
});

// BatchTranslationModal - loaded when user opens batch translation
const BatchTranslationModal = dynamic(() => import('./BatchTranslationModal').then(mod => ({ default: mod.BatchTranslationModal })), {
  ssr: false,
  loading: () => null,
});

// LanguageSettingsModal - loaded when user opens language settings
const LanguageSettingsModal = dynamic(() => import('./LanguageSettingsModal').then(mod => ({ default: mod.LanguageSettingsModal })), {
  ssr: false,
  loading: () => null,
});

interface DueDateStats {
  overdue: number;
  today: number;
  tomorrow: number;
  thisWeek: number;
}

interface HeaderProps {
  boardName?: string;
  onBoardNameChange?: (name: string) => void;
  boardId?: string;
  availableLabels?: string[];
  totalCards?: number;
  matchingCards?: number;
  onActivityClick?: () => void;
  currentBackground?: BoardBackground;
  onBackgroundChange?: (background: BoardBackground) => void;
  dueDateStats?: DueDateStats;
}

export function Header({ 
  boardName, 
  onBoardNameChange, 
  boardId, 
  availableLabels = [],
  totalCards = 0,
  matchingCards = 0,
  onActivityClick,
  currentBackground,
  onBackgroundChange,
  dueDateStats,
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useLocale();
  // Use optional filter hook - returns null when not in a FilterProvider (e.g., on home page)
  const filterContext = useFilterOptional();
  const searchQuery = filterContext?.searchQuery ?? '';
  const setSearchQuery = filterContext?.setSearchQuery ?? (() => {});
  const selectedLabels = filterContext?.selectedLabels ?? [];
  const toggleLabel = filterContext?.toggleLabel ?? (() => {});
  const selectedPriorities = filterContext?.selectedPriorities ?? [];
  const togglePriority = filterContext?.togglePriority ?? (() => {});
  const hasActiveFilters = filterContext?.hasActiveFilters ?? false;
  const clearFilters = filterContext?.clearFilters ?? (() => {});
  const sortBy = filterContext?.sortBy ?? 'priority';
  const sortOrder = filterContext?.sortOrder ?? 'desc';
  const setSortBy = filterContext?.setSortBy ?? (() => {});
  const setSortOrder = filterContext?.setSortOrder ?? (() => {});
  const { searchInputRef: keyboardSearchInputRef, expandSearchCallback } = useKeyboardShortcuts();
  
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showArchivedDrawer, setShowArchivedDrawer] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showExportImportModal, setShowExportImportModal] = useState(false);
  const [showTranslationSettings, setShowTranslationSettings] = useState(false);
  const [showBatchTranslation, setShowBatchTranslation] = useState(false);
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const boardNameInputRef = useRef<HTMLInputElement>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const localSearchInputRef = useRef<HTMLInputElement>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Priority options for filter
  const priorityOptions = [
    { value: 'urgent' as const, label: t('header.priorityUrgent'), color: 'bg-red-500' },
    { value: 'high' as const, label: t('header.priorityHigh'), color: 'bg-amber-500' },
    { value: 'medium' as const, label: t('header.priorityMedium'), color: 'bg-yellow-500' },
    { value: 'low' as const, label: t('header.priorityLow'), color: 'bg-blue-500' },
  ];

  // Connect the search input ref to the keyboard shortcuts context
  const searchInputRef = useCallback((element: HTMLInputElement | null) => {
    (localSearchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = element;
    (keyboardSearchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = element;
  }, [keyboardSearchInputRef]);

  // Register the expand search callback
  useEffect(() => {
    expandSearchCallback.current = () => {
      setIsSearchExpanded(true);
    };
    return () => {
      expandSearchCallback.current = null;
    };
  }, [expandSearchCallback]);

  // Subscribe to board members
  useEffect(() => {
    if (!boardId) {
      setMembers([]);
      return;
    }

    const unsubscribe = subscribeToBoardMembers(boardId, (fetchedMembers) => {
      setMembers(fetchedMembers);
    });

    return () => unsubscribe();
  }, [boardId]);

  // Subscribe to archived items count
  useEffect(() => {
    if (!boardId) {
      setArchivedCount(0);
      return;
    }

    let cardsCount = 0;
    let columnsCount = 0;

    const updateCount = () => {
      setArchivedCount(cardsCount + columnsCount);
    };

    const unsubCards = subscribeToArchivedCards(
      boardId,
      (cards) => {
        cardsCount = cards.length;
        updateCount();
      },
      (error) => {
        console.error('Error subscribing to archived cards:', error);
      }
    );

    const unsubColumns = subscribeToArchivedColumns(
      boardId,
      (columns) => {
        columnsCount = columns.length;
        updateCount();
      },
      (error) => {
        console.error('Error subscribing to archived columns:', error);
      }
    );

    return () => {
      unsubCards();
      unsubColumns();
    };
  }, [boardId]);

  // Subscribe to cards for batch translation
  useEffect(() => {
    if (!boardId) {
      setCards([]);
      return;
    }

    const unsubscribe = subscribeToCards(
      boardId,
      (fetchedCards) => {
        setCards(fetchedCards);
      },
      {
        onError: (error) => {
          console.error('Error subscribing to cards for batch translation:', error);
        },
      }
    );

    return () => unsubscribe();
  }, [boardId]);

  // Sync local state with context
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Debounced search
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 300);
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [localSearchQuery, setSearchQuery]);

  // Focus search input when expanded
  useEffect(() => {
    if (isSearchExpanded && localSearchInputRef.current) {
      localSearchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // Focus board name input when editing
  useEffect(() => {
    if (isEditingBoardName && boardNameInputRef.current) {
      boardNameInputRef.current.focus();
      boardNameInputRef.current.select();
    }
  }, [isEditingBoardName]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setShowPriorityDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchExpand = useCallback(() => {
    setIsSearchExpanded(true);
  }, []);

  // Expand search when / key is pressed (from keyboard shortcut context)
  useEffect(() => {
    const handleFocus = () => {
      if (localSearchInputRef.current === document.activeElement) {
        setIsSearchExpanded(true);
      }
    };
    localSearchInputRef.current?.addEventListener('focus', handleFocus);
    return () => {
      localSearchInputRef.current?.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleSearchBlur = useCallback(() => {
    if (!localSearchQuery) {
      setIsSearchExpanded(false);
    }
  }, [localSearchQuery]);

  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery('');
    setSearchQuery('');
    localSearchInputRef.current?.focus();
  }, [setSearchQuery]);

  const cycleTheme = useCallback(() => {
    const themeOrder = ['light', 'dark', 'system'] as const;
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  }, [setTheme, theme]);

  const themeLabel = theme === 'system'
    ? 'Theme: System (auto)'
    : theme === 'light'
      ? 'Theme: Light'
      : 'Theme: Dark';

  const themeIcon = theme === 'system' ? (
    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ) : resolvedTheme === 'dark' ? (
    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ) : (
    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );

  const openKeyboardShortcuts = useCallback(() => {
    const event = new KeyboardEvent('keydown', { key: '?' });
    document.dispatchEvent(event);
  }, []);

  const showSearchAndFilters = !!boardId;

  return (
    <header 
      className="relative z-50 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 dark:from-emerald-600 dark:via-teal-600 dark:to-blue-600 shadow-lg"
      role="banner"
    >
      {/* Refined pattern overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent_50%)]"></div>
      </div>
      
      <div className="relative px-3 sm:px-4 md:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0 min-w-0">
          {boardId && (
            <Link
              href="/"
              className="p-2.5 sm:p-2 -ml-1 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t('header.backToBoards')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <Image 
              src="/logo-white.png" 
              alt="Tomobodo" 
              width={28} 
              height={28} 
              className="flex-shrink-0"
            />
            {boardName ? (
              isEditingBoardName ? (
                <input
                  ref={boardNameInputRef}
                  type="text"
                  value={boardName}
                  onChange={(e) => onBoardNameChange?.(e.target.value)}
                  onBlur={() => setIsEditingBoardName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  className="text-base sm:text-lg md:text-xl font-bold text-white bg-white/20 border border-white/30 focus:bg-white/25 focus:border-white/50 focus:outline-none rounded-lg px-2 sm:px-3 py-1.5 min-w-0 w-full max-w-[140px] sm:max-w-[200px] md:max-w-none transition-all placeholder:text-white/50"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingBoardName(true)}
                  className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight truncate px-2 sm:px-3 py-1.5 -mx-2 -my-1.5 rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-colors max-w-[140px] sm:max-w-[200px] md:max-w-none"
                  aria-label="Edit board name"
                >
                  {boardName}
                </button>
              )
            ) : (
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight truncate">
                <span className="hidden sm:inline">Tomobodo</span>
                <span className="sm:hidden">Tomobodo</span>
              </h1>
            )}
          </div>
        </div>

        {/* Mobile Menu Button - only show on board pages */}
        {showSearchAndFilters && (
          <div className="lg:hidden flex items-center" ref={mobileMenuRef}>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={showMobileMenu ? t('common.close') : t('common.menu')}
              aria-expanded={showMobileMenu}
            >
              {showMobileMenu ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            
            {/* Mobile Dropdown Menu */}
            {showMobileMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 mx-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                {/* Search */}
                <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative" role="search">
                    <svg 
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="search"
                      value={localSearchQuery}
                      onChange={(e) => setLocalSearchQuery(e.target.value)}
                      placeholder={t('header.searchCards')}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                    />
                  </div>
                </div>
                
                {/* Labels Filter */}
                {availableLabels.length > 0 && (
                  <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('header.filterByLabel')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {availableLabels.map((label) => (
                        <button
                          key={label}
                          onClick={() => toggleLabel(label)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                            selectedLabels.includes(label) 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority Filter */}
                <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('header.filterByPriority')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {priorityOptions.map((priority) => (
                      <button
                        key={priority.value}
                        onClick={() => togglePriority(priority.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center gap-2 ${
                          selectedPriorities.includes(priority.value) 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${priority.color}`} aria-hidden="true" />
                        {priority.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="p-2">
                  {onActivityClick && (
                    <button
                      onClick={() => { onActivityClick(); setShowMobileMenu(false); }}
                      aria-label={t('header.activity')}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-lg min-h-[48px]"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('header.activity')}
                    </button>
                  )}
                  <button
                    onClick={() => { setShowShareModal(true); setShowMobileMenu(false); }}
                    aria-label={t('common.share')}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-lg min-h-[48px]"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    {t('common.share')}
                  </button>
                  <button
                    onClick={() => { setShowArchivedDrawer(true); setShowMobileMenu(false); }}
                    aria-label={t('common.archive')}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-lg min-h-[48px]"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    {t('common.archive')}
                    {archivedCount > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center px-1.5 text-xs font-bold bg-emerald-100 text-emerald-600 rounded-full">
                        {archivedCount > 99 ? '99+' : archivedCount}
                      </span>
                    )}
                  </button>
                  {onBackgroundChange && (
                    <button
                      onClick={() => { setShowBackgroundPicker(true); setShowMobileMenu(false); }}
                      aria-label={t('header.background')}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-lg min-h-[48px]"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      {t('header.background')}
                    </button>
                  )}
                  <button
                    onClick={() => { setShowExportImportModal(true); setShowMobileMenu(false); }}
                    aria-label={t('header.exportImport')}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-lg min-h-[48px]"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    {t('header.exportImport')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search and Filters - Desktop only, hidden on mobile */}
        {showSearchAndFilters && (
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-center max-w-xl">
            {/* Search Bar */}
            <div 
              className={`relative flex items-center transition-all duration-300 ease-out ${
                isSearchExpanded ? 'flex-1 max-w-sm' : ''
              }`}
            >
              {isSearchExpanded ? (
                <div className="relative flex-1" role="search">
                  <svg 
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <label htmlFor="card-search" className="sr-only">{t('header.searchCards')}</label>
                  <input
                    id="card-search"
                    ref={searchInputRef}
                    type="search"
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    onBlur={handleSearchBlur}
                    placeholder={t('header.searchCards')}
                    aria-describedby="search-results-count"
                    className="w-full pl-9 pr-8 py-2 bg-white/20 hover:bg-white/25 focus:bg-white/30 border border-white/20 focus:border-white/40 rounded-xl text-white placeholder:text-white/50 text-sm focus:outline-none transition-all backdrop-blur-sm"
                  />
                  <span id="search-results-count" className="sr-only">
                    {hasActiveFilters ? `${matchingCards} of ${totalCards} cards match your search` : `${totalCards} cards total`}
                  </span>
                  {localSearchQuery && (
                    <button
                      onClick={handleClearSearch}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <Tip
                  id="search-shortcut"
                  tip={t('header.searchShortcut')}
                  shortcut="/"
                  position="bottom"
                >
                  <button
                    onClick={handleSearchExpand}
                    className="flex items-center gap-2 px-3 py-2 text-white/80 hover:text-white bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-200 border border-white/20"
                    aria-label={t('header.searchCards')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 text-white rounded pointer-events-none">
                      /
                    </kbd>
                  </button>
                </Tip>
              )}
            </div>

            {/* Label Filter Dropdown */}
            {availableLabels.length > 0 && (
              <div className="relative" ref={labelDropdownRef}>
                <button
                  onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                  aria-expanded={showLabelDropdown}
                  aria-haspopup="listbox"
                  aria-label={`${t('header.labels')}${selectedLabels.length > 0 ? `, ${selectedLabels.length} selected` : ''}`}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedLabels.length > 0 
                      ? 'bg-white text-emerald-600' 
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="hidden sm:inline">{t('header.labels')}</span>
                  {selectedLabels.length > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full" aria-hidden="true">
                      {selectedLabels.length}
                    </span>
                  )}
                </button>

                {showLabelDropdown && (
                  <div 
                    role="listbox"
                    aria-label="Available labels"
                    aria-multiselectable="true"
                    className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide" id="label-filter-heading">{t('header.filterByLabel')}</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1" role="group" aria-labelledby="label-filter-heading">
                      {availableLabels.map((label) => (
                        <button
                          key={label}
                          role="option"
                          aria-selected={selectedLabels.includes(label)}
                          onClick={() => toggleLabel(label)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                        >
                          <span 
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedLabels.includes(label) 
                                ? 'bg-emerald-500 border-emerald-500' 
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                            aria-hidden="true"
                          >
                            {selectedLabels.includes(label) && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/50">
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Priority Filter Dropdown */}
            <div className="relative" ref={priorityDropdownRef}>
              <button
                onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                aria-expanded={showPriorityDropdown}
                aria-haspopup="listbox"
                aria-label={`${t('header.priority')}${selectedPriorities.length > 0 ? `, ${selectedPriorities.length} selected` : ''}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedPriorities.length > 0 
                    ? 'bg-white text-emerald-600' 
                    : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                </svg>
                <span className="hidden sm:inline">{t('header.priority')}</span>
                {selectedPriorities.length > 0 && (
                  <span className="flex items-center justify-center w-5 h-5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full" aria-hidden="true">
                    {selectedPriorities.length}
                  </span>
                )}
              </button>

              {showPriorityDropdown && (
                <div 
                  role="listbox"
                  aria-label="Available priorities"
                  aria-multiselectable="true"
                  className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide" id="priority-filter-heading">{t('header.filterByPriority')}</h4>
                  </div>
                  <div className="py-1" role="group" aria-labelledby="priority-filter-heading">
                    {priorityOptions.map((priority) => (
                      <button
                        key={priority.value}
                        role="option"
                        aria-selected={selectedPriorities.includes(priority.value)}
                        onClick={() => togglePriority(priority.value)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                      >
                        <span 
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedPriorities.includes(priority.value) 
                              ? 'bg-emerald-500 border-emerald-500' 
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                          aria-hidden="true"
                        >
                          {selectedPriorities.includes(priority.value) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                        <span className={`w-2.5 h-2.5 rounded-full ${priority.color}`} aria-hidden="true" />
                        <span>{priority.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                aria-expanded={showSortDropdown}
                aria-haspopup="listbox"
                aria-label="Sort cards"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-white/20 text-white hover:bg-white/30 border border-white/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span className="hidden sm:inline">{t('header.sort')}</span>
                {sortOrder === 'asc' ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {showSortDropdown && (
                <div 
                  role="listbox"
                  aria-label="Sort options"
                  className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('header.sortBy')}</h4>
                  </div>
                  <div className="py-1">
                    {([
                      { value: 'priority', label: t('header.sortPriority') },
                      { value: 'dueDate', label: t('header.sortDueDate') },
                      { value: 'created', label: t('header.sortCreated') },
                      { value: 'title', label: t('header.sortTitle') },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        role="option"
                        aria-selected={sortBy === option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                          sortBy === option.value 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' 
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span 
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                            sortBy === option.value 
                              ? 'bg-emerald-500 border-emerald-500' 
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                          aria-hidden="true"
                        >
                          {sortBy === option.value && (
                            <span className="w-1.5 h-1.5 bg-white rounded-full" />
                          )}
                        </span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 mt-1">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('header.sortOrder')}</h4>
                    <div className="flex gap-2" role="group" aria-label={t('header.sortOrder')}>
                      <button
                        onClick={() => setSortOrder('asc')}
                        aria-label={t('header.ascending')}
                        aria-pressed={sortOrder === 'asc'}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                          sortOrder === 'asc'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        {t('header.ascending')}
                      </button>
                      <button
                        onClick={() => setSortOrder('desc')}
                        aria-label={t('header.descending')}
                        aria-pressed={sortOrder === 'desc'}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                          sortOrder === 'desc'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {t('header.descending')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active Filters Indicator & Clear Button */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <span className="text-white/80 text-sm hidden sm:inline" aria-label={`Showing ${matchingCards} of ${totalCards} cards`}>
                  {matchingCards} of {totalCards}
                </span>
                <button
                  onClick={clearFilters}
                  aria-label={t('header.clearFilters')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-white/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="hidden sm:inline">{t('common.clear')}</span>
                </button>
              </div>
            )}

            {/* Due Date Stats, Member Avatars, Archive & Share Buttons */}
            <div className="flex items-center gap-2 ml-2">
              {/* Due Date Stats Indicator */}
              {dueDateStats && (dueDateStats.overdue > 0 || dueDateStats.today > 0 || dueDateStats.tomorrow > 0) && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-white/20">
                  {dueDateStats.overdue > 0 ? (
                    <>
                      <svg className="w-4 h-4 text-red-200 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="hidden sm:inline">{dueDateStats.overdue} overdue</span>
                      <span className="sm:hidden">{dueDateStats.overdue}</span>
                    </>
                  ) : dueDateStats.today > 0 ? (
                    <>
                      <svg className="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="hidden sm:inline">{dueDateStats.today} due today</span>
                      <span className="sm:hidden">{dueDateStats.today}</span>
                    </>
                  ) : dueDateStats.tomorrow > 0 ? (
                    <>
                      <svg className="w-4 h-4 text-yellow-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="hidden sm:inline">{dueDateStats.tomorrow} due tomorrow</span>
                      <span className="sm:hidden">{dueDateStats.tomorrow}</span>
                    </>
                  ) : null}
                </div>
              )}
              
              {/* Stacked Member Avatars */}
              {members.length > 0 && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center -space-x-2 hover:opacity-90 transition-opacity"
                  aria-label={`View ${members.length} board member${members.length !== 1 ? 's' : ''}`}
                  title={`${members.length} member${members.length !== 1 ? 's' : ''}`}
                >
                  {members.slice(0, 4).map((member, index) => (
                    <div
                      key={member.uid}
                      className="relative"
                      style={{ zIndex: 10 - index }}
                    >
                      <Avatar
                        photoURL={member.photoURL}
                        displayName={member.displayName}
                        email={member.email}
                        size="sm"
                      />
                    </div>
                  ))}
                  {members.length > 4 && (
                    <div
                      className="relative w-8 h-8 rounded-full bg-white/30 ring-2 ring-white flex items-center justify-center text-white text-xs font-semibold backdrop-blur-sm"
                      style={{ zIndex: 6 }}
                    >
                      +{members.length - 4}
                    </div>
                  )}
                </button>
              )}

              {/* Activity Button */}
              {onActivityClick && (
                <button
                  onClick={onActivityClick}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-white/20"
                  aria-label={t('header.viewActivity')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">{t('header.activity')}</span>
                </button>
              )}

              {/* Share Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-white/20"
                aria-label={t('header.shareBoard')}
                title={t('header.shareBoard')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">{t('common.share')}</span>
              </button>

              {/* More Menu */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="relative flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-white/20"
                  aria-label={t('header.moreOptions')}
                  aria-expanded={showMoreMenu}
                  aria-haspopup="menu"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                  <span className="hidden sm:inline">{t('common.more')}</span>
                </button>

                {showMoreMenu && (
                  <div 
                    role="menu"
                    className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50 overflow-hidden"
                  >
                    {/* Background */}
                    {onBackgroundChange && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          setShowBackgroundPicker(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        {t('header.background')}
                      </button>
                    )}

                    {/* Export/Import */}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowExportImportModal(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      {t('header.exportImport')}
                    </button>

                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" role="separator" />

                    {/* Translation Settings */}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowTranslationSettings(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                      {t('header.translationSettings')}
                    </button>

                    {/* Batch Translation */}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowBatchTranslation(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('header.batchTranslation')}
                    </button>

                    {/* Language Settings */}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowLanguageSettings(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Language / 言語
                    </button>

                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" role="separator" />

                    {/* Archive */}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowArchivedDrawer(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <span className="flex-1">{t('common.archive')}</span>
                      {archivedCount > 0 && (
                        <span className="min-w-[20px] h-5 flex items-center justify-center px-1.5 text-xs font-bold bg-emerald-100 text-emerald-600 rounded-full">
                          {archivedCount > 99 ? '99+' : archivedCount}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
          <SyncIndicator />
          {user && (
            <>
              <div className="relative" ref={accountMenuRef}>
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-white/20 hover:bg-white/25 rounded-xl backdrop-blur-sm border border-white/10 transition-colors"
                  aria-label={`Signed in as ${user.displayName || user.email || t('common.anonymous')}`}
                  aria-expanded={showAccountMenu}
                  aria-haspopup="menu"
                >
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt=""
                      width={28}
                      height={28}
                      className="rounded-full ring-2 ring-white/30"
                      aria-hidden="true"
                    />
                  ) : (
                    <div 
                      className="w-7 h-7 rounded-full ring-2 ring-white/30 bg-white/30 flex items-center justify-center text-white text-xs font-semibold"
                      aria-hidden="true"
                    >
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                  <span className="text-white text-sm font-medium max-w-[120px] sm:max-w-[150px] truncate">
                    {user.displayName || user.email || t('common.anonymous')}
                  </span>
                  <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showAccountMenu && (
                  <div
                    role="menu"
                    className="absolute top-full right-0 mt-2 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50 overflow-hidden"
                  >
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {user.displayName || user.email || t('common.anonymous')}
                      </div>
                    </div>

                    <div className="py-1">
                      <Tip
                        id="keyboard-shortcuts-menu"
                        tip="Press ? for keyboard shortcuts"
                        shortcut="?"
                        position="left"
                      >
                        <button
                          role="menuitem"
                          onClick={() => {
                            openKeyboardShortcuts();
                            setShowAccountMenu(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Keyboard shortcuts</span>
                          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">?</span>
                        </button>
                      </Tip>

                      <button
                        role="menuitem"
                        onClick={() => {
                          cycleTheme();
                          setShowAccountMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                        aria-label={themeLabel}
                        title={themeLabel}
                      >
                        {themeIcon}
                        <span>{themeLabel}</span>
                      </button>

                      <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" role="separator" />

                      <button
                        role="menuitem"
                        onClick={() => {
                          setShowAccountMenu(false);
                          signOut();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                        aria-label={t('common.signOut')}
                      >
                        <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                        </svg>
                        <span>{t('common.signOut')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Share Board Modal */}
      {boardId && (
        <ShareBoardModal
          boardId={boardId}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Archived Items Drawer */}
      {boardId && (
        <ArchivedItemsDrawer
          boardId={boardId}
          isOpen={showArchivedDrawer}
          onClose={() => setShowArchivedDrawer(false)}
        />
      )}

      {/* Background Picker */}
      {boardId && onBackgroundChange && (
        <BackgroundPicker
          isOpen={showBackgroundPicker}
          onClose={() => setShowBackgroundPicker(false)}
          currentBackground={currentBackground}
          onSelect={onBackgroundChange}
        />
      )}

      {/* Export/Import Modal */}
      {boardId && (
        <ExportImportModal
          boardId={boardId}
          boardName={boardName || 'Board'}
          isOpen={showExportImportModal}
          onClose={() => setShowExportImportModal(false)}
        />
      )}

      {/* Translation Settings Modal */}
      <TranslationSettingsModal
        isOpen={showTranslationSettings}
        onClose={() => setShowTranslationSettings(false)}
      />

      {/* Batch Translation Modal */}
      {boardId && (
        <BatchTranslationModal
          isOpen={showBatchTranslation}
          onClose={() => setShowBatchTranslation(false)}
          cards={cards}
          boardId={boardId}
        />
      )}

      {/* Language Settings Modal */}
      <LanguageSettingsModal
        isOpen={showLanguageSettings}
        onClose={() => setShowLanguageSettings(false)}
      />
    </header>
  );
}
