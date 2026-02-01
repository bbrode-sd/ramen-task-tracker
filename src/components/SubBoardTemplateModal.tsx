'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useToast } from '@/contexts/ToastContext';
import { Board } from '@/types';
import {
  getTemplateBoardsForBoard,
  createTemplateBoard,
  deleteTemplateBoard,
  subscribeToColumns,
  subscribeToCards,
} from '@/lib/firestore';
import { Column, Card } from '@/types';

interface SubBoardTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId?: string; // Templates are stored per-board
}

interface TemplateStats {
  columnCount: number;
  cardCount: number;
}

export function SubBoardTemplateModal({ isOpen, onClose, boardId }: SubBoardTemplateModalProps) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { showToast } = useToast();
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<Board[]>([]);
  const [templateStats, setTemplateStats] = useState<Map<string, TemplateStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Fetch template boards for the current board
  useEffect(() => {
    if (isOpen && boardId && user) {
      const fetchTemplates = async () => {
        setLoading(true);
        try {
          const templateBoards = await getTemplateBoardsForBoard(boardId, user.uid);
          setTemplates(templateBoards);
          
          // Fetch stats for each template
          const stats = new Map<string, TemplateStats>();
          for (const template of templateBoards) {
            // Subscribe briefly to get counts, then unsubscribe
            const columnsPromise = new Promise<number>((resolve) => {
              const unsub = subscribeToColumns(template.id, (cols) => {
                resolve(cols.length);
                unsub();
              });
            });
            const cardsPromise = new Promise<number>((resolve) => {
              const unsub = subscribeToCards(template.id, (cards) => {
                resolve(cards.length);
                unsub();
              });
            });
            
            const [columnCount, cardCount] = await Promise.all([columnsPromise, cardsPromise]);
            stats.set(template.id, { columnCount, cardCount });
          }
          setTemplateStats(stats);
        } catch (error) {
          console.error('Failed to fetch template boards:', error);
          showToast('error', 'Failed to load templates');
        } finally {
          setLoading(false);
        }
      };
      fetchTemplates();
    }
  }, [isOpen, boardId, user, showToast]);

  // Focus modal when it opens
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isCreating) {
          setIsCreating(false);
          setNewTemplateName('');
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCreating, onClose]);

  if (!isOpen) return null;

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !user || !boardId) return;
    
    setIsCreating(true);
    try {
      const templateId = await createTemplateBoard(boardId, newTemplateName.trim(), user.uid);
      showToast('success', t('subBoardTemplate.created'));
      
      // Navigate to the new template board to edit it
      onClose();
      router.push(`/boards/${templateId}`);
    } catch (error) {
      console.error('Failed to create template:', error);
      showToast('error', t('subBoardTemplate.saveFailed'));
    } finally {
      setIsCreating(false);
      setNewTemplateName('');
    }
  };

  const handleEditTemplate = (templateId: string) => {
    onClose();
    router.push(`/boards/${templateId}`);
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!confirm(t('subBoardTemplate.confirmDelete'))) return;

    try {
      await deleteTemplateBoard(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      showToast('success', t('subBoardTemplate.deleted'));
    } catch (error) {
      console.error('Failed to delete template:', error);
      showToast('error', t('subBoardTemplate.deleteFailed'));
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-board-template-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div>
              <h2 id="sub-board-template-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('subBoardTemplate.title')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('subBoardTemplate.description')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Create New Template */}
            {isCreating ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={t('subBoardTemplate.namePlaceholder')}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTemplateName.trim()) {
                      handleCreateTemplate();
                    }
                    if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewTemplateName('');
                    }
                  }}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleCreateTemplate}
                    disabled={!newTemplateName.trim()}
                    className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                  >
                    {t('subBoardTemplate.createNew')}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setNewTemplateName('');
                    }}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-400 dark:hover:border-purple-500 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('subBoardTemplate.createNew')}
              </button>
            )}

            {/* Template List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                {t('subBoardTemplate.noTemplates')}
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => {
                  const stats = templateStats.get(template.id);
                  return (
                    <div
                      key={template.id}
                      className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-900 dark:text-white truncate">
                            {template.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => handleEditTemplate(template.id)}
                            className="p-2 text-slate-400 hover:text-purple-500 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            title={t('subBoardTemplate.edit')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id, template.name)}
                            className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title={t('subBoardTemplate.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {stats && (
                          <>
                            <span>{stats.columnCount} {t('subBoardTemplate.columnsLabel')}</span>
                            <span>·</span>
                            <span>{stats.cardCount} {t('subBoardTemplate.cardsLabel')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubBoardTemplateModal;
