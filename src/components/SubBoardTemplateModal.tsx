'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useToast } from '@/contexts/ToastContext';
import { SubBoardTemplate, SubBoardTemplateColumn, SubBoardTemplateCard } from '@/types';
import {
  getSubBoardTemplates,
  createSubBoardTemplate,
  deleteSubBoardTemplate,
  updateSubBoardTemplate,
} from '@/lib/firestore';

interface SubBoardTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId?: string; // Templates are stored per-board
}

interface EditingColumn {
  id: string;
  nameEn: string;
  nameJa: string;
  order: number;
  cards: EditingCard[];
}

interface EditingCard {
  id: string;
  titleEn: string;
  titleJa: string;
  order: number;
}

interface EditingTemplate {
  id?: string;
  name: string;
  description: string;
  columns: EditingColumn[];
  approvalColumnName: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function SubBoardTemplateModal({ isOpen, onClose, boardId }: SubBoardTemplateModalProps) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<SubBoardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EditingTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addingCardToColumn, setAddingCardToColumn] = useState<string | null>(null);
  const [newCardTitleEn, setNewCardTitleEn] = useState('');
  const [newCardTitleJa, setNewCardTitleJa] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnNameEn, setNewColumnNameEn] = useState('');
  const [newColumnNameJa, setNewColumnNameJa] = useState('');

  // Fetch templates for the current board
  useEffect(() => {
    if (isOpen && boardId) {
      const fetchTemplates = async () => {
        setLoading(true);
        const templates = await getSubBoardTemplates(boardId);
        setTemplates(templates);
        setLoading(false);
      };
      fetchTemplates();
    }
  }, [isOpen, boardId]);

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
        if (addingCardToColumn) {
          setAddingCardToColumn(null);
          setNewCardTitleEn('');
          setNewCardTitleJa('');
        } else if (addingColumn) {
          setAddingColumn(false);
          setNewColumnNameEn('');
          setNewColumnNameJa('');
        } else if (editingTemplate) {
          setEditingTemplate(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingTemplate, addingCardToColumn, addingColumn, onClose]);

  if (!isOpen) return null;

  const handleCreateNew = () => {
    setEditingTemplate({
      name: '',
      description: '',
      columns: [],
      approvalColumnName: '',
    });
  };

  const handleEdit = (template: SubBoardTemplate) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description || '',
      columns: template.columns.map((col) => ({
        id: generateId(),
        nameEn: col.nameEn,
        nameJa: col.nameJa,
        order: col.order,
        cards: col.cards?.map((c) => ({
          id: generateId(),
          titleEn: c.titleEn,
          titleJa: c.titleJa,
          order: c.order,
        })) || [],
      })),
      approvalColumnName: template.approvalColumnName || '',
    });
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm(t('subBoardTemplate.confirmDelete'))) return;

    try {
      await deleteSubBoardTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      showToast('success', t('subBoardTemplate.deleted'));
    } catch (error) {
      console.error('Failed to delete template:', error);
      showToast('error', t('subBoardTemplate.deleteFailed'));
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !user || !boardId || !editingTemplate.name.trim()) return;
    if (editingTemplate.columns.length === 0) {
      showToast('error', t('subBoardTemplate.needAtLeastOneColumn'));
      return;
    }

    setIsSaving(true);
    try {
      const columns: SubBoardTemplateColumn[] = editingTemplate.columns.map((col) => ({
        nameEn: col.nameEn,
        nameJa: col.nameJa,
        order: col.order,
        cards: col.cards.length > 0 ? col.cards.map((c): SubBoardTemplateCard => ({
          titleEn: c.titleEn,
          titleJa: c.titleJa,
          order: c.order,
        })) : undefined,
      }));

      if (editingTemplate.id) {
        await updateSubBoardTemplate(editingTemplate.id, {
          name: editingTemplate.name.trim(),
          description: editingTemplate.description.trim() || undefined,
          columns,
          approvalColumnName: editingTemplate.approvalColumnName || undefined,
        });
        showToast('success', t('subBoardTemplate.updated'));
      } else {
        await createSubBoardTemplate({
          boardId,
          name: editingTemplate.name.trim(),
          description: editingTemplate.description.trim() || undefined,
          columns,
          approvalColumnName: editingTemplate.approvalColumnName || undefined,
          createdBy: user.uid,
        });
        showToast('success', t('subBoardTemplate.created'));
      }

      const updated = await getSubBoardTemplates(boardId);
      setTemplates(updated);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Failed to save template:', error);
      showToast('error', t('subBoardTemplate.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // Column management
  const handleAddColumn = () => {
    if (!editingTemplate || !newColumnNameEn.trim()) return;
    const maxOrder = editingTemplate.columns.length > 0 
      ? Math.max(...editingTemplate.columns.map((c) => c.order)) + 1 
      : 0;
    setEditingTemplate({
      ...editingTemplate,
      columns: [
        ...editingTemplate.columns,
        { 
          id: generateId(), 
          nameEn: newColumnNameEn.trim(), 
          nameJa: newColumnNameJa.trim() || newColumnNameEn.trim(),
          order: maxOrder, 
          cards: [] 
        },
      ],
    });
    setNewColumnNameEn('');
    setNewColumnNameJa('');
    setAddingColumn(false);
  };

  const removeColumn = (columnId: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.filter((col) => col.id !== columnId),
    });
  };

  // Card management
  const handleAddCard = (columnId: string) => {
    if (!editingTemplate || !newCardTitleEn.trim()) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map((col) => {
        if (col.id !== columnId) return col;
        const maxOrder = col.cards.length > 0 
          ? Math.max(...col.cards.map((c) => c.order)) + 1 
          : 0;
        return {
          ...col,
          cards: [
            ...col.cards,
            { 
              id: generateId(), 
              titleEn: newCardTitleEn.trim(), 
              titleJa: newCardTitleJa.trim() || newCardTitleEn.trim(),
              order: maxOrder 
            },
          ],
        };
      }),
    });
    setNewCardTitleEn('');
    setNewCardTitleJa('');
    setAddingCardToColumn(null);
  };

  const removeCard = (columnId: string, cardId: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          cards: col.cards.filter((card) => card.id !== cardId),
        };
      }),
    });
  };

  // Get display name based on locale
  const getColumnName = (col: EditingColumn) => locale === 'ja' ? col.nameJa || col.nameEn : col.nameEn;
  const getCardTitle = (card: EditingCard) => locale === 'ja' ? card.titleJa || card.titleEn : card.titleEn;
  const getTemplateColumnName = (col: SubBoardTemplateColumn) => locale === 'ja' ? col.nameJa || col.nameEn : col.nameEn;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-board-template-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col"
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
                {editingTemplate 
                  ? (editingTemplate.id ? t('subBoardTemplate.editTitle') : t('subBoardTemplate.createTitle')) 
                  : t('subBoardTemplate.title')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {editingTemplate ? t('subBoardTemplate.editDescription') : t('subBoardTemplate.description')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (editingTemplate) {
                setEditingTemplate(null);
              } else {
                onClose();
              }
            }}
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
          {editingTemplate ? (
            // Template Editor - Kanban Style
            <div className="space-y-6">
              {/* Template Name & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('subBoardTemplate.name')} *
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder={t('subBoardTemplate.namePlaceholder')}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('subBoardTemplate.approvalColumn')}
                  </label>
                  <select
                    value={editingTemplate.approvalColumnName}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, approvalColumnName: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  >
                    <option value="">{t('subBoardTemplate.noApprovalColumn')}</option>
                    {editingTemplate.columns.map((col) => (
                      <option key={col.id} value={col.nameEn}>
                        {getColumnName(col)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('subBoardTemplate.descriptionLabel')}
                </label>
                <textarea
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  placeholder={t('subBoardTemplate.descriptionPlaceholder')}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
                />
              </div>

              {/* Kanban Board Editor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  {t('subBoardTemplate.listsAndCards')}
                </label>
                <div className="flex gap-4 overflow-x-auto pb-4 min-h-[300px]">
                  {/* Columns */}
                  {editingTemplate.columns.map((column) => (
                    <div
                      key={column.id}
                      className="flex-shrink-0 w-72 bg-slate-100 dark:bg-slate-900/50 rounded-xl p-3 flex flex-col"
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex-1">
                          <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                            {getColumnName(column)}
                          </div>
                          {column.nameEn !== column.nameJa && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {locale === 'ja' ? column.nameEn : column.nameJa}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeColumn(column.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                          title={t('subBoardTemplate.removeColumn')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Cards */}
                      <div className="flex-1 space-y-2 min-h-[100px]">
                        {column.cards.map((card) => (
                          <div
                            key={card.id}
                            className="bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm border border-slate-200 dark:border-slate-700 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-800 dark:text-slate-200">
                                  {getCardTitle(card)}
                                </div>
                                {card.titleEn !== card.titleJa && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {locale === 'ja' ? card.titleEn : card.titleJa}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => removeCard(column.id, card.id)}
                                className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                title={t('subBoardTemplate.removeCard')}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Card */}
                      {addingCardToColumn === column.id ? (
                        <div className="mt-2 space-y-2">
                          <input
                            type="text"
                            value={newCardTitleEn}
                            onChange={(e) => setNewCardTitleEn(e.target.value)}
                            placeholder={t('subBoardTemplate.cardTitleEnPlaceholder')}
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newCardTitleEn.trim()) {
                                handleAddCard(column.id);
                              }
                            }}
                          />
                          <input
                            type="text"
                            value={newCardTitleJa}
                            onChange={(e) => setNewCardTitleJa(e.target.value)}
                            placeholder={t('subBoardTemplate.cardTitleJaPlaceholder')}
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newCardTitleEn.trim()) {
                                handleAddCard(column.id);
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddCard(column.id)}
                              disabled={!newCardTitleEn.trim()}
                              className="flex-1 px-3 py-1.5 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {t('subBoardTemplate.addCard')}
                            </button>
                            <button
                              onClick={() => {
                                setAddingCardToColumn(null);
                                setNewCardTitleEn('');
                                setNewCardTitleJa('');
                              }}
                              className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingCardToColumn(column.id)}
                          className="mt-2 w-full px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          {t('subBoardTemplate.addCard')}
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add Column */}
                  <div className="flex-shrink-0 w-72">
                    {addingColumn ? (
                      <div className="bg-slate-100 dark:bg-slate-900/50 rounded-xl p-3 space-y-2">
                        <input
                          type="text"
                          value={newColumnNameEn}
                          onChange={(e) => setNewColumnNameEn(e.target.value)}
                          placeholder={t('subBoardTemplate.columnNameEnPlaceholder')}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newColumnNameEn.trim()) {
                              handleAddColumn();
                            }
                          }}
                        />
                        <input
                          type="text"
                          value={newColumnNameJa}
                          onChange={(e) => setNewColumnNameJa(e.target.value)}
                          placeholder={t('subBoardTemplate.columnNameJaPlaceholder')}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newColumnNameEn.trim()) {
                              handleAddColumn();
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddColumn}
                            disabled={!newColumnNameEn.trim()}
                            className="flex-1 px-3 py-2 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('subBoardTemplate.addList')}
                          </button>
                          <button
                            onClick={() => {
                              setAddingColumn(false);
                              setNewColumnNameEn('');
                              setNewColumnNameJa('');
                            }}
                            className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingColumn(true)}
                        className="w-full h-12 px-4 bg-slate-100/50 dark:bg-slate-900/30 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-400 dark:hover:border-purple-500 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {t('subBoardTemplate.addList')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Template List
            <div className="space-y-4">
              {/* Create New Button */}
              <button
                onClick={handleCreateNew}
                className="w-full px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-400 dark:hover:border-purple-500 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('subBoardTemplate.createNew')}
              </button>

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-slate-900 dark:text-white">
                            {template.name}
                          </h3>
                          {template.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-1.5 text-slate-400 hover:text-purple-500 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            title={t('subBoardTemplate.edit')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title={t('subBoardTemplate.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {template.columns.length} {t('subBoardTemplate.columnsLabel')}
                        {template.columns.some((c) => c.cards && c.cards.length > 0) && (
                          <span className="ml-2">
                            · {template.columns.reduce((acc, c) => acc + (c.cards?.length || 0), 0)} {t('subBoardTemplate.cardsLabel')}
                          </span>
                        )}
                        {template.approvalColumnName && (
                          <span className="ml-2">
                            · {t('subBoardTemplate.approvalLabel')}: {template.approvalColumnName}
                          </span>
                        )}
                      </div>
                      {/* Column Preview */}
                      <div className="flex gap-1.5 mt-3 overflow-x-auto">
                        {template.columns.slice(0, 5).map((col, idx) => (
                          <div
                            key={idx}
                            className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg truncate max-w-[100px]"
                            title={getTemplateColumnName(col)}
                          >
                            {getTemplateColumnName(col)}
                          </div>
                        ))}
                        {template.columns.length > 5 && (
                          <div className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500">
                            +{template.columns.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Only show when editing */}
        {editingTemplate && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {editingTemplate.columns.length} {t('subBoardTemplate.columnsLabel')}
              {editingTemplate.columns.reduce((acc, c) => acc + c.cards.length, 0) > 0 && (
                <span className="ml-2">
                  · {editingTemplate.columns.reduce((acc, c) => acc + c.cards.length, 0)} {t('subBoardTemplate.cardsLabel')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!editingTemplate.name.trim() || editingTemplate.columns.length === 0 || isSaving}
                className="px-6 py-2 text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                )}
                {t('subBoardTemplate.saveTemplate')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubBoardTemplateModal;
