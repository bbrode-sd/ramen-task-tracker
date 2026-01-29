'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useFilter } from '@/contexts/FilterContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useKeyboardShortcuts } from '@/contexts/KeyboardShortcutsContext';
import { SyncIndicator } from './SyncIndicator';
import Image from 'next/image';
import { BoardMember, Card } from '@/types';
import { subscribeToBoardMembers, subscribeToArchivedCards, subscribeToArchivedColumns, subscribeToCards } from '@/lib/firestore';
import { ShareBoardModal, Avatar } from './ShareBoardModal';
import { Tip } from './Tooltip';
import { BackgroundPicker } from './BackgroundPicker';
import { BoardBackground } from '@/types';
import { TranslationSettingsModal } from './TranslationSettingsModal';
import { BatchTranslationModal } from './BatchTranslationModal';
import { LanguageSettingsModal } from './LanguageSettingsModal';
import { useLocale } from '@/contexts/LocaleContext';

// Lazy load heavy modal components for better initial load performance
const ArchivedItemsDrawer = dynamic(() => import('./ArchivedItemsDrawer').then(mod => ({ default: mod.ArchivedItemsDrawer })), {
  ssr: false,
  loading: () => null,
});

const ExportImportModal = dynamic(() => import('./ExportImportModal').then(mod => ({ default: mod.ExportImportModal })), {
  ssr: false,
  loading: () => null,
});

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const themeOrder = ['system', 'light', 'dark'] as const;
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  };

  const getTooltip = () => {
    switch (theme) {
      case 'system':
        return 'Theme: System';
      case 'light':
        return 'Theme: Light';
      case 'dark':
        return 'Theme: Dark';
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10 hover:border-white/20 relative group"
      aria-label={getTooltip()}
      title={getTooltip()}
    >
      {/* Sun icon - shown in dark mode */}
      <svg
        className={`w-5 h-5 transition-all duration-300 ${
          resolvedTheme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90 absolute'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      {/* Moon icon - shown in light mode */}
      <svg
        className={`w-5 h-5 transition-all duration-300 ${
          resolvedTheme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90 absolute'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
      {/* System indicator dot */}
      {theme === 'system' && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full shadow-sm" />
      )}
    </button>
  );
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
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const { t } = useLocale();
  const { 
    searchQuery, 
    setSearchQuery, 
    selectedLabels, 
    toggleLabel, 
    hasActiveFilters, 
    clearFilters 
  } = useFilter();
  const { searchInputRef: keyboardSearchInputRef, expandSearchCallback } = useKeyboardShortcuts();
  
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showArchivedDrawer, setShowArchivedDrawer] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showExportImportModal, setShowExportImportModal] = useState(false);
  const [showTranslationSettings, setShowTranslationSettings] = useState(false);
  const [showBatchTranslation, setShowBatchTranslation] = useState(false);
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const localSearchInputRef = useRef<HTMLInputElement>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    const unsubCards = subscribeToArchivedCards(boardId, (cards) => {
      cardsCount = cards.length;
      updateCount();
    });

    const unsubColumns = subscribeToArchivedColumns(boardId, (columns) => {
      columnsCount = columns.length;
      updateCount();
    });

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

    const unsubscribe = subscribeToCards(boardId, (fetchedCards) => {
      setCards(fetchedCards);
    });

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

  // Close label dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
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

  const showSearchAndFilters = !!boardId;

  return (
    <header 
      className="bg-gradient-to-r from-orange-500 via-orange-500 to-red-500 shadow-lg relative z-50"
      role="banner"
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" aria-hidden="true"></div>
      </div>
      
      <div className="relative px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          {boardId && (
            <Link
              href="/"
              className="p-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
              aria-label={t('header.backToBoards')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            <span className="text-2xl drop-shadow-sm">🍜</span>
            {boardName ? (
              <input
                type="text"
                value={boardName}
                onChange={(e) => onBoardNameChange?.(e.target.value)}
                className="text-lg sm:text-xl font-bold text-white bg-white/10 border border-white/20 focus:bg-white/20 focus:border-white/40 focus:outline-none rounded-lg px-3 py-1.5 min-w-0 max-w-[200px] sm:max-w-none transition-all placeholder:text-white/50"
              />
            ) : (
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Ramen Task Tracker
              </h1>
            )}
          </div>
        </div>

        {/* Search and Filters - only show on board pages */}
        {showSearchAndFilters && (
          <div className="flex items-center gap-2 flex-1 justify-center max-w-xl">
            {/* Search Bar */}
            <div 
              className={`relative flex items-center transition-all duration-300 ease-out ${
                isSearchExpanded ? 'flex-1 max-w-sm' : 'w-10'
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
                    className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
                    aria-label={t('header.searchCards')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
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
                      ? 'bg-white text-orange-600' 
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="hidden sm:inline">{t('header.labels')}</span>
                  {selectedLabels.length > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 text-xs font-bold bg-orange-100 text-orange-700 rounded-full" aria-hidden="true">
                      {selectedLabels.length}
                    </span>
                  )}
                </button>

                {showLabelDropdown && (
                  <div 
                    role="listbox"
                    aria-label="Available labels"
                    aria-multiselectable="true"
                    className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide" id="label-filter-heading">{t('header.filterByLabel')}</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1" role="group" aria-labelledby="label-filter-heading">
                      {availableLabels.map((label) => (
                        <button
                          key={label}
                          role="option"
                          aria-selected={selectedLabels.includes(label)}
                          onClick={() => toggleLabel(label)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                        >
                          <span 
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedLabels.includes(label) 
                                ? 'bg-orange-500 border-orange-500' 
                                : 'border-gray-300'
                            }`}
                            aria-hidden="true"
                          >
                            {selectedLabels.includes(label) && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-orange-50 text-orange-700 border border-orange-200/50">
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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

            {/* Member Avatars, Archive & Share Buttons */}
            <div className="flex items-center gap-2 ml-2">
              {/* Stacked Member Avatars */}
              {members.length > 0 && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center -space-x-2 hover:opacity-90 transition-opacity"
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
                title={t('header.shareBoard')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  {archivedCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center px-1.5 text-xs font-bold bg-white text-orange-600 rounded-full shadow-sm">
                      {archivedCount > 99 ? '99+' : archivedCount}
                    </span>
                  )}
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
                        <span className="min-w-[20px] h-5 flex items-center justify-center px-1.5 text-xs font-bold bg-orange-100 text-orange-600 rounded-full">
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
        
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <SyncIndicator />
          
          {/* Help button with keyboard shortcut hint */}
          <Tip
            id="keyboard-shortcuts"
            tip="Press ? for keyboard shortcuts"
            shortcut="?"
            position="bottom"
          >
            <button
              onClick={() => {
                // Trigger keyboard shortcuts help modal by simulating ? key
                const event = new KeyboardEvent('keydown', { key: '?' });
                document.dispatchEvent(event);
              }}
              className="p-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10 hover:border-white/20"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </Tip>
          
          <ThemeToggle />
          {user && (
            <>
              <div 
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 bg-white/10 rounded-xl backdrop-blur-sm"
                aria-label={`Signed in as ${user.displayName || user.email}`}
              >
                {user.photoURL && (
                  <Image
                    src={user.photoURL}
                    alt=""
                    width={28}
                    height={28}
                    className="rounded-full ring-2 ring-white/30"
                    aria-hidden="true"
                  />
                )}
                <span className="text-white/90 text-sm font-medium hidden sm:block max-w-[150px] truncate">
                  {user.displayName || user.email}
                </span>
              </div>
              <button
                onClick={signOut}
                aria-label={t('common.signOut')}
                className="px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white text-sm font-medium rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10 hover:border-white/20"
              >
                {t('common.signOut')}
              </button>
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
