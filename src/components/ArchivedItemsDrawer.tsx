'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Column } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import {
  subscribeToArchivedCards,
  subscribeToArchivedColumns,
  restoreCard,
  restoreColumn,
  permanentlyDeleteCard,
  permanentlyDeleteColumn,
} from '@/lib/firestore';

interface ArchivedItemsDrawerProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'cards' | 'lists';

interface DeleteConfirmation {
  type: 'card' | 'column';
  id: string;
  name: string;
}

function formatDate(timestamp: { toDate: () => Date } | null | undefined): string {
  if (!timestamp) return 'Unknown date';
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function ArchivedItemsDrawer({ boardId, isOpen, onClose }: ArchivedItemsDrawerProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [archivedCards, setArchivedCards] = useState<Card[]>([]);
  const [archivedColumns, setArchivedColumns] = useState<Column[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to archived items
  useEffect(() => {
    if (!isOpen || !boardId) return;

    const unsubCards = subscribeToArchivedCards(boardId, setArchivedCards);
    const unsubColumns = subscribeToArchivedColumns(boardId, setArchivedColumns);

    return () => {
      unsubCards();
      unsubColumns();
    };
  }, [boardId, isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmation) {
          setDeleteConfirmation(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, deleteConfirmation]);

  // Filter items by search query
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return archivedCards;
    const query = searchQuery.toLowerCase();
    return archivedCards.filter(
      (card) =>
        card.titleEn.toLowerCase().includes(query) ||
        card.titleJa.toLowerCase().includes(query)
    );
  }, [archivedCards, searchQuery]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return archivedColumns;
    const query = searchQuery.toLowerCase();
    return archivedColumns.filter((col) => col.name.toLowerCase().includes(query));
  }, [archivedColumns, searchQuery]);

  const handleRestoreCard = async (cardId: string) => {
    setRestoringIds((prev) => new Set(prev).add(cardId));
    try {
      await restoreCard(boardId, cardId);
      showToast('success', 'Card restored successfully');
    } catch (error) {
      console.error('Error restoring card:', error);
      showToast('error', 'Failed to restore card');
    } finally {
      setRestoringIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    }
  };

  const handleRestoreColumn = async (columnId: string) => {
    setRestoringIds((prev) => new Set(prev).add(columnId));
    try {
      await restoreColumn(boardId, columnId);
      showToast('success', 'List restored successfully');
    } catch (error) {
      console.error('Error restoring list:', error);
      showToast('error', 'Failed to restore list');
    } finally {
      setRestoringIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(columnId);
        return newSet;
      });
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteConfirmation) return;

    setIsDeleting(true);
    try {
      if (deleteConfirmation.type === 'card') {
        await permanentlyDeleteCard(boardId, deleteConfirmation.id);
        showToast('success', 'Card permanently deleted');
      } else {
        await permanentlyDeleteColumn(boardId, deleteConfirmation.id);
        showToast('success', 'List permanently deleted');
      }
      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Error deleting item:', error);
      showToast('error', 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalArchived = archivedCards.length + archivedColumns.length;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
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
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Archived Items
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {totalArchived} {totalArchived === 1 ? 'item' : 'items'} archived
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived items..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'cards'
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Cards ({archivedCards.length})
            </button>
            <button
              onClick={() => setActiveTab('lists')}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'lists'
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Lists ({archivedColumns.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'cards' ? (
            filteredCards.length === 0 ? (
              <EmptyState
                icon="card"
                title={searchQuery ? 'No cards found' : 'No archived cards'}
                description={
                  searchQuery
                    ? 'Try a different search term'
                    : 'Cards you archive will appear here'
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredCards.map((card) => (
                  <ArchivedItem
                    key={card.id}
                    id={card.id}
                    name={card.titleEn || card.titleJa}
                    archivedAt={card.updatedAt}
                    type="card"
                    isRestoring={restoringIds.has(card.id)}
                    onRestore={() => handleRestoreCard(card.id)}
                    onDelete={() =>
                      setDeleteConfirmation({
                        type: 'card',
                        id: card.id,
                        name: card.titleEn || card.titleJa,
                      })
                    }
                    labels={card.labels}
                  />
                ))}
              </div>
            )
          ) : filteredColumns.length === 0 ? (
            <EmptyState
              icon="list"
              title={searchQuery ? 'No lists found' : 'No archived lists'}
              description={
                searchQuery
                  ? 'Try a different search term'
                  : 'Lists you archive will appear here'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredColumns.map((column) => (
                <ArchivedItem
                  key={column.id}
                  id={column.id}
                  name={column.name}
                  archivedAt={column.updatedAt}
                  type="column"
                  isRestoring={restoringIds.has(column.id)}
                  onRestore={() => handleRestoreColumn(column.id)}
                  onDelete={() =>
                    setDeleteConfirmation({
                      type: 'column',
                      id: column.id,
                      name: column.name,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteConfirmation(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Delete permanently?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold">"{deleteConfirmation.name}"</span>?
              {deleteConfirmation.type === 'column' && (
                <span className="block mt-2 text-sm text-red-600 dark:text-red-400">
                  This will also delete all cards in this list.
                </span>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ArchivedItemProps {
  id: string;
  name: string;
  archivedAt: { toDate: () => Date } | null | undefined;
  type: 'card' | 'column';
  isRestoring: boolean;
  onRestore: () => void;
  onDelete: () => void;
  labels?: string[];
}

function ArchivedItem({
  name,
  archivedAt,
  type,
  isRestoring,
  onRestore,
  onDelete,
  labels,
}: ArchivedItemProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            type === 'card'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
          }`}
        >
          {type === 'card' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white truncate">{name}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Archived {formatDate(archivedAt)}
          </p>
          {labels && labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {labels.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className="px-2 py-0.5 text-xs font-medium rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/50"
                >
                  {label}
                </span>
              ))}
              {labels.length > 3 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300">
                  +{labels.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onRestore}
            disabled={isRestoring}
            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
            title="Restore"
          >
            {isRestoring ? (
              <div className="w-5 h-5 border-2 border-green-400/30 border-t-green-500 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
            )}
          </button>
          <button
            onClick={onDelete}
            disabled={isRestoring}
            className="p-2 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
            title="Delete permanently"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: 'card' | 'list';
  title: string;
  description: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
        {icon === 'card' ? (
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ) : (
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}
