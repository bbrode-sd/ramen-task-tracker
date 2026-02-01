'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useFilterOptional } from '@/contexts/FilterContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import { SyncIndicator } from './SyncIndicator';
import Image from 'next/image';
import { BoardMember, Card } from '@/types';
import { subscribeToBoardMembers, subscribeToArchivedCards, subscribeToArchivedColumns, subscribeToCards } from '@/lib/firestore';
// Avatar is used inline for member display, keep static import
import { Avatar } from './ShareBoardModal';
import { MemberProfilePopover } from './MemberProfilePopover';
import { Tip } from './Tooltip';
import { BoardBackground } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { FilterPanel } from './FilterPanel';

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

// LanguageSettingsModal - loaded when user opens language settings
const LanguageSettingsModal = dynamic(() => import('./LanguageSettingsModal').then(mod => ({ default: mod.LanguageSettingsModal })), {
  ssr: false,
  loading: () => null,
});

// SubBoardTemplateModal - loaded when user opens sub-board templates
const SubBoardTemplateModal = dynamic(() => import('./SubBoardTemplateModal').then(mod => ({ default: mod.SubBoardTemplateModal })), {
  ssr: false,
  loading: () => null,
});

interface DueDateStats {
  overdue: number;
  today: number;
  tomorrow: number;
  thisWeek: number;
}

interface ParentCardInfo {
  id: string;
  titleEn: string;
  titleJa: string;
  boardId: string;
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
  parentCard?: ParentCardInfo | null;
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
  parentCard,
}: HeaderProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t, locale } = useLocale();
  // Use optional filter hook - returns null when not in a FilterProvider (e.g., on home page)
  const filterContext = useFilterOptional();
  const hasActiveFilters = filterContext?.hasActiveFilters ?? false;
  const clearFilters = filterContext?.clearFilters ?? (() => {});
  const { searchInputRef: keyboardSearchInputRef, expandSearchCallback } = useKeyboardShortcuts();
  
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQueryLocal] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showArchivedDrawer, setShowArchivedDrawer] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showExportImportModal, setShowExportImportModal] = useState(false);
  const [showTranslationSettings, setShowTranslationSettings] = useState(false);
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [showSubBoardTemplates, setShowSubBoardTemplates] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [selectedMember, setSelectedMember] = useState<BoardMember | null>(null);
  const [memberAnchorEl, setMemberAnchorEl] = useState<HTMLElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const boardNameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<Card[]>([]);

  // Get active filter count
  const activeFilterCount = filterContext?.activeFilterCount ?? 0;

  // Search cards for dropdown (not filtering)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return cards.filter(card => {
      const searchableText = [
        card.titleEn || '',
        card.titleJa || '',
        card.descriptionEn || '',
        card.descriptionJa || '',
      ].join(' ').toLowerCase();
      return searchableText.includes(query);
    }).slice(0, 10); // Limit to 10 results
  }, [cards, searchQuery]);

  // Register the expand search callback
  useEffect(() => {
    expandSearchCallback.current = () => {
      setIsSearchExpanded(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    };
    return () => {
      expandSearchCallback.current = null;
    };
  }, [expandSearchCallback]);

  // Connect keyboard shortcut ref to search input
  useEffect(() => {
    if (searchInputRef.current) {
      (keyboardSearchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = searchInputRef.current;
    }
  }, [keyboardSearchInputRef, isSearchExpanded]);

  // Focus search input when expanded
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
        if (!searchQuery) {
          setIsSearchExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

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

  const cycleTheme = useCallback(() => {
    const themeOrder = ['light', 'dark', 'system'] as const;
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  }, [setTheme, theme]);

  const themeLabel = theme === 'system'
    ? t('header.theme.system')
    : theme === 'light'
      ? t('header.theme.light')
      : t('header.theme.dark');

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
              href={parentCard ? `/boards/${parentCard.boardId}?card=${parentCard.id}` : "/"}
              className="p-2.5 sm:p-2 -ml-1 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={parentCard ? t('header.backToCard') : t('header.backToBoards')}
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
            <div className="min-w-0">
              {/* Parent card name (for sub-boards) */}
              {parentCard && (
                <Link
                  href={`/boards/${parentCard.boardId}?card=${parentCard.id}`}
                  className="block text-xs text-white/70 hover:text-white/90 truncate max-w-[140px] sm:max-w-[200px] md:max-w-[300px] transition-colors"
                  title={`${parentCard.titleEn}${parentCard.titleJa && parentCard.titleJa !== parentCard.titleEn ? ` / ${parentCard.titleJa}` : ''}`}
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="truncate">
                      {locale === 'ja' && parentCard.titleJa ? parentCard.titleJa : parentCard.titleEn}
                      {parentCard.titleEn && parentCard.titleJa && parentCard.titleEn !== parentCard.titleJa && (
                        <span className="text-white/50 ml-1">
                          ({locale === 'ja' ? parentCard.titleEn : parentCard.titleJa})
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              )}
              {/* Board name */}
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
                    className={`text-base sm:text-lg md:text-xl font-bold text-white tracking-tight truncate px-2 sm:px-3 py-1.5 -mx-2 rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-colors max-w-[140px] sm:max-w-[200px] md:max-w-none ${parentCard ? '-my-0.5' : '-my-1.5'}`}
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
                {/* Quick Actions */}
                <div className="p-2">
                  {/* Search Button */}
                  <button
                    onClick={() => { setIsSearchExpanded(true); setShowMobileMenu(false); }}
                    aria-label={t('common.search')}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-lg min-h-[48px]"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {t('common.search')}
                  </button>
                  {/* Filter Button */}
                  <button
                    onClick={() => { setShowFilterPanel(true); setShowMobileMenu(false); }}
                    aria-label={t('header.filter')}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-lg min-h-[48px]"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {t('header.filter')}
                    {activeFilterCount > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center px-1.5 text-xs font-bold bg-emerald-100 text-emerald-600 rounded-full">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
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
                  <button
                    onClick={() => { setShowSubBoardTemplates(true); setShowMobileMenu(false); }}
                    aria-label={t('header.subBoardTemplates')}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors rounded-lg min-h-[48px]"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    {t('header.subBoardTemplates')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search, Filter and Actions - Desktop only, hidden on mobile */}
        {showSearchAndFilters && (
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-center">
            {/* Search Bar with Dropdown */}
            <div 
              ref={searchContainerRef}
              className={`relative flex items-center transition-all duration-300 ease-out ${
                isSearchExpanded ? 'flex-1 min-w-[160px] max-w-xs' : ''
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
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQueryLocal(e.target.value);
                      setShowSearchResults(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowSearchResults(searchQuery.length > 0)}
                    placeholder={t('header.searchCards')}
                    className="w-full pl-9 pr-8 py-2 bg-white/20 hover:bg-white/25 focus:bg-white/30 border border-white/20 focus:border-white/40 rounded-xl text-white placeholder:text-white/50 text-sm focus:outline-none transition-all backdrop-blur-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQueryLocal('');
                        setShowSearchResults(false);
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  {/* Search Results Dropdown */}
                  {showSearchResults && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                      {searchResults.length > 0 ? (
                        <div className="py-1 max-h-80 overflow-y-auto">
                          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Cards
                            </span>
                          </div>
                          {searchResults.map((card) => (
                            <button
                              key={card.id}
                              onClick={() => {
                                router.push(`/boards/${boardId}?card=${card.id}`);
                                setShowSearchResults(false);
                                setSearchQueryLocal('');
                              }}
                              className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-start gap-3"
                            >
                              <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {card.titleEn || card.titleJa || t('card.untitled')}
                                </div>
                                {card.titleJa && card.titleEn && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {card.titleJa}
                                  </div>
                                )}
                                {card.isArchived && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    • Archived
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                          {/* Advanced search link */}
                          <button
                            onClick={() => {
                              setShowFilterPanel(true);
                              setShowSearchResults(false);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 border-t border-gray-100 dark:border-gray-700"
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              Advanced search
                            </span>
                          </button>
                        </div>
                      ) : searchQuery.length > 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No cards found for "{searchQuery}"
                          </p>
                          <button
                            onClick={() => {
                              setShowFilterPanel(true);
                              setShowSearchResults(false);
                            }}
                            className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Try advanced search
                          </button>
                        </div>
                      ) : null}
                    </div>
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
                    onClick={() => setIsSearchExpanded(true)}
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

            {/* Filter Button */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex-shrink-0 ${
                hasActiveFilters 
                  ? 'bg-white text-emerald-600' 
                  : 'text-white/80 hover:text-white bg-white/20 hover:bg-white/30 border border-white/20'
              }`}
              aria-label={t('header.filter')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="hidden sm:inline">{t('header.filter')}</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Active Filters Indicator & Clear Button */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-shrink-0" role="status" aria-live="polite">
                <span className="text-white/80 text-sm hidden sm:inline whitespace-nowrap" aria-label={`Showing ${matchingCards} of ${totalCards} cards`}>
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
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
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
                <div
                  className="flex items-center flex-shrink-0 -space-x-2"
                  role="group"
                  aria-label={`${members.length} board member${members.length !== 1 ? 's' : ''}`}
                >
                  {members.slice(0, 4).map((member, index) => (
                    <button
                      key={member.uid}
                      onClick={(e) => {
                        setSelectedMember(member);
                        setMemberAnchorEl(e.currentTarget);
                      }}
                      className="relative flex-shrink-0 hover:z-20 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white/60 rounded-full"
                      style={{ zIndex: 10 - index }}
                      aria-label={`View ${member.displayName || member.email}'s profile`}
                    >
                      <Avatar
                        photoURL={member.photoURL}
                        displayName={member.displayName}
                        email={member.email}
                        size="sm"
                      />
                    </button>
                  ))}
                  {members.length > 4 && (
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="relative w-8 h-8 rounded-full bg-white/30 ring-2 ring-white flex items-center justify-center text-white text-xs font-semibold backdrop-blur-sm hover:bg-white/40 transition-colors"
                      style={{ zIndex: 6 }}
                      aria-label={`View all ${members.length} members`}
                    >
                      +{members.length - 4}
                    </button>
                  )}
                </div>
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
                  className="relative flex items-center justify-center w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all duration-200 border border-white/20"
                  aria-label={t('header.moreOptions')}
                  aria-expanded={showMoreMenu}
                  aria-haspopup="menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
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

                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" role="separator" />

                    {/* Sub-Board Templates */}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowSubBoardTemplates(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                      {t('header.subBoardTemplates')}
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
                          <span>{t('header.keyboardShortcuts')}</span>
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

                      <button
                        role="menuitem"
                        onClick={() => {
                          setShowLanguageSettings(true);
                          setShowAccountMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        <span>Language / 言語</span>
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

      {/* Member Profile Popover */}
      {selectedMember && (
        <MemberProfilePopover
          member={selectedMember}
          isOpen={!!selectedMember}
          onClose={() => {
            setSelectedMember(null);
            setMemberAnchorEl(null);
          }}
          anchorEl={memberAnchorEl}
          onViewActivity={onActivityClick ? (memberId) => {
            // TODO: Filter activity by member
            onActivityClick();
          } : undefined}
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

      {/* Language Settings Modal */}
      <LanguageSettingsModal
        isOpen={showLanguageSettings}
        onClose={() => setShowLanguageSettings(false)}
      />

      {/* Sub-Board Templates Modal */}
      <SubBoardTemplateModal
        isOpen={showSubBoardTemplates}
        onClose={() => setShowSubBoardTemplates(false)}
        boardId={boardId}
      />

      {/* Filter Panel */}
      {boardId && (
        <FilterPanel
          isOpen={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          availableLabels={availableLabels}
          cards={cards}
          members={members}
          onCardClick={(cardId) => {
            // Navigate to card
            window.location.href = `/boards/${boardId}?card=${cardId}`;
          }}
        />
      )}
    </header>
  );
}
