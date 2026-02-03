'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFilterOptional, DueDateFilter, MemberFilter } from '@/contexts/FilterContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, BoardMember, CardPriority, BoardTag } from '@/types';
import { getTagColorConfig } from './TagManagementModal';
import Image from 'next/image';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  availableLabels: string[];
  cards: Card[];
  members: BoardMember[];
  boardTags?: BoardTag[];
  onCardClick?: (cardId: string) => void;
}

export function FilterPanel({
  isOpen,
  onClose,
  availableLabels,
  cards,
  members,
  boardTags = [],
  onCardClick,
}: FilterPanelProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const filterContext = useFilterOptional();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMemberSelect, setShowMemberSelect] = useState(false);

  // Get filter values with fallbacks
  const searchQuery = filterContext?.searchQuery ?? '';
  const setSearchQuery = filterContext?.setSearchQuery ?? (() => {});
  const selectedLabels = filterContext?.selectedLabels ?? [];
  const toggleLabel = filterContext?.toggleLabel ?? (() => {});
  const selectedPriorities = filterContext?.selectedPriorities ?? [];
  const togglePriority = filterContext?.togglePriority ?? (() => {});
  const selectedTagIds = filterContext?.selectedTagIds ?? [];
  const toggleTag = filterContext?.toggleTag ?? (() => {});
  const selectedMembers = filterContext?.selectedMembers ?? [];
  const toggleMember = filterContext?.toggleMember ?? (() => {});
  const selectedDueDates = filterContext?.selectedDueDates ?? [];
  const toggleDueDate = filterContext?.toggleDueDate ?? (() => {});
  const showComplete = filterContext?.showComplete ?? null;
  const setShowComplete = filterContext?.setShowComplete ?? (() => {});
  const hasActiveFilters = filterContext?.hasActiveFilters ?? false;
  const clearFilters = filterContext?.clearFilters ?? (() => {});
  const searchCards = filterContext?.searchCards ?? (() => []);

  // Priority options
  const priorityOptions: { value: CardPriority; label: string; color: string }[] = [
    { value: 'urgent', label: t('header.priorityUrgent'), color: 'bg-red-500' },
    { value: 'high', label: t('header.priorityHigh'), color: 'bg-amber-500' },
    { value: 'medium', label: t('header.priorityMedium'), color: 'bg-yellow-500' },
    { value: 'low', label: t('header.priorityLow'), color: 'bg-blue-500' },
  ];

  // Due date options
  const dueDateOptions: { value: DueDateFilter; label: string; icon: React.ReactNode }[] = [
    {
      value: 'none',
      label: t('filter.noDates'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      value: 'overdue',
      label: t('filter.overdue'),
      icon: (
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      value: 'due_day',
      label: t('filter.dueNextDay'),
      icon: (
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      value: 'due_week',
      label: t('filter.dueNextWeek'),
      icon: (
        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      value: 'due_month',
      label: t('filter.dueNextMonth'),
      icon: (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  // Sync local search with context
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Focus search input when panel opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearchQuery(value);
    setShowSearchResults(value.length > 0);
  }, []);

  // Apply search to filter
  const handleSearchSubmit = useCallback(() => {
    setSearchQuery(localSearchQuery);
    setShowSearchResults(false);
  }, [localSearchQuery, setSearchQuery]);

  // Get search results
  const searchResults = localSearchQuery.length > 0 ? searchCards(cards, localSearchQuery) : [];

  // Handle card click from search results
  const handleSearchResultClick = useCallback((cardId: string) => {
    onCardClick?.(cardId);
    onClose();
  }, [onCardClick, onClose]);

  // Check if member is selected
  const isMemberSelected = (memberId: string) => selectedMembers.includes(memberId);
  const isNoMembersSelected = selectedMembers.includes('none');
  const isMyCardsSelected = selectedMembers.includes('me');

  // Get column name for a card
  const getCardColumn = useCallback((card: Card) => {
    // This would need column data passed in, for now we'll skip it
    return '';
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t('filter.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Keyword Search */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('filter.keyword')}
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={localSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit();
                  }
                }}
                onFocus={() => setShowSearchResults(localSearchQuery.length > 0)}
                placeholder={t('filter.enterKeyword')}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {localSearchQuery && (
                <button
                  onClick={() => {
                    setLocalSearchQuery('');
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  <div className="py-1">
                    {searchResults.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => handleSearchResultClick(card.id)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {card.titleEn || card.titleJa || t('card.untitled')}
                            </div>
                            {card.isArchived && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                • {t('common.archive')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t('filter.searchHint')}
            </p>
          </div>

          {/* Members */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('filter.members')}
            </label>
            <div className="space-y-1">
              {/* No members */}
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={isNoMembersSelected}
                  onChange={() => toggleMember('none')}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                />
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-200">{t('filter.noMembers')}</span>
              </label>

              {/* Cards assigned to me */}
              {user && (
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={isMyCardsSelected}
                    onChange={() => toggleMember('me')}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt=""
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                    </div>
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-200">{t('filter.cardsAssignedToMe')}</span>
                </label>
              )}

              {/* Select members button */}
              <button
                onClick={() => setShowMemberSelect(!showMemberSelect)}
                className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="w-4 h-4" /> {/* Spacer for alignment */}
                <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1">
                  {t('filter.selectMembers')}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showMemberSelect ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {/* Member list */}
              {showMemberSelect && members.length > 0 && (
                <div className="ml-6 pl-2 border-l-2 border-gray-100 dark:border-gray-700 space-y-1">
                  {members.map((member) => (
                    <label
                      key={member.uid}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isMemberSelected(member.uid)}
                        onChange={() => toggleMember(member.uid)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                      />
                      {member.photoURL ? (
                        <Image
                          src={member.photoURL}
                          alt=""
                          width={28}
                          height={28}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-semibold">
                          {member.displayName?.charAt(0) || member.email?.charAt(0) || '?'}
                        </div>
                      )}
                      <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                        {member.displayName || member.email}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card Status */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('filter.cardStatus')}
            </label>
            <div className="space-y-1">
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showComplete === true}
                  onChange={() => setShowComplete(showComplete === true ? null : true)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{t('filter.markedComplete')}</span>
              </label>
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showComplete === false}
                  onChange={() => setShowComplete(showComplete === false ? null : false)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{t('filter.notMarkedComplete')}</span>
              </label>
            </div>
          </div>

          {/* Due Date */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('filter.dueDate')}
            </label>
            <div className="space-y-1">
              {dueDateOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedDueDates.includes(option.value)}
                    onChange={() => toggleDueDate(option.value)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  {option.icon}
                  <span className="text-sm text-gray-700 dark:text-gray-200">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Labels */}
          {availableLabels.length > 0 && (
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {t('header.labels')}
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedLabels.length === 0 && hasActiveFilters}
                    onChange={() => {
                      // Toggle "no labels" - clear all label filters
                      selectedLabels.forEach(l => toggleLabel(l));
                    }}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-200">{t('filter.noLabels')}</span>
                </label>
                {availableLabels.map((label) => (
                  <label
                    key={label}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLabels.includes(label)}
                      onChange={() => toggleLabel(label)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-500 text-white">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="p-4">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Tags
            </label>
            {boardTags.length > 0 ? (
              <div className="space-y-1">
                {boardTags.sort((a, b) => a.order - b.order).map((tag) => {
                  const colorConfig = getTagColorConfig(tag.color);
                  return (
                    <label
                      key={tag.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={() => toggleTag(tag.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className={`w-3 h-3 rounded-full ${colorConfig.dot}`} />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{tag.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No tags defined. Add tags via board menu.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        {hasActiveFilters && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              {t('header.clearFilters')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
