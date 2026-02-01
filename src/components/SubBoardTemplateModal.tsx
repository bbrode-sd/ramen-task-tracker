'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useToast } from '@/contexts/ToastContext';
import { SubBoardTemplate, SubBoardTemplateColumn } from '@/types';
import {
  getSubBoardTemplates,
  createSubBoardTemplate,
  deleteSubBoardTemplate,
  updateSubBoardTemplate,
} from '@/lib/firestore';

interface SubBoardTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EditingTemplate {
  id?: string; // undefined for new templates
  name: string;
  description: string;
  columns: EditingColumn[];
  approvalColumnName: string;
}

interface EditingColumn {
  id: string; // temporary client-side ID
  name: string;
  order: number;
  cards: { id: string; title: string; order: number }[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function SubBoardTemplateModal({ isOpen, onClose }: SubBoardTemplateModalProps) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { showToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<SubBoardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EditingTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch templates
  useEffect(() => {
    if (isOpen && user) {
      const fetchTemplates = async () => {
        setLoading(true);
        const templates = await getSubBoardTemplates(user.uid);
        setTemplates(templates);
        setLoading(false);
      };
      fetchTemplates();
    }
  }, [isOpen, user]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (editingTemplate) {
          setEditingTemplate(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingTemplate, onClose]);

  if (!isOpen) return null;

  const handleCreateNew = () => {
    setEditingTemplate({
      name: '',
      description: '',
      columns: [
        { id: generateId(), name: 'Backlog', order: 0, cards: [] },
        { id: generateId(), name: 'In Progress', order: 1, cards: [] },
        { id: generateId(), name: 'Approved', order: 2, cards: [] },
      ],
      approvalColumnName: 'Approved',
    });
  };

  const handleEdit = (template: SubBoardTemplate) => {
    if (template.id.startsWith('sub-built-in-')) {
      showToast('error', t('subBoardTemplate.cannotEditBuiltIn'));
      return;
    }
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description || '',
      columns: template.columns.map((col, idx) => ({
        id: generateId(),
        name: col.name,
        order: col.order,
        cards: col.cards?.map((c, cIdx) => ({
          id: generateId(),
          title: c.title,
          order: c.order,
        })) || [],
      })),
      approvalColumnName: template.approvalColumnName || 'Approved',
    });
  };

  const handleDelete = async (templateId: string) => {
    if (templateId.startsWith('sub-built-in-')) {
      showToast('error', t('subBoardTemplate.cannotDeleteBuiltIn'));
      return;
    }
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
    if (!editingTemplate || !user || !editingTemplate.name.trim()) return;

    setIsSaving(true);
    try {
      const templateData: Omit<SubBoardTemplate, 'id' | 'createdAt'> = {
        name: editingTemplate.name.trim(),
        description: editingTemplate.description.trim() || undefined,
        columns: editingTemplate.columns.map((col) => ({
          name: col.name,
          order: col.order,
          cards: col.cards.length > 0 ? col.cards.map((c) => ({ title: c.title, order: c.order })) : undefined,
        })),
        approvalColumnName: editingTemplate.approvalColumnName || 'Approved',
        createdBy: user.uid,
      };

      if (editingTemplate.id) {
        // Update existing
        await updateSubBoardTemplate(editingTemplate.id, templateData);
        showToast('success', t('subBoardTemplate.updated'));
      } else {
        // Create new
        await createSubBoardTemplate(templateData);
        showToast('success', t('subBoardTemplate.created'));
      }

      // Refresh templates
      const updated = await getSubBoardTemplates(user.uid);
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
  const addColumn = () => {
    if (!editingTemplate) return;
    const maxOrder = Math.max(...editingTemplate.columns.map((c) => c.order), -1);
    setEditingTemplate({
      ...editingTemplate,
      columns: [
        ...editingTemplate.columns,
        { id: generateId(), name: '', order: maxOrder + 1, cards: [] },
      ],
    });
  };

  const updateColumn = (columnId: string, name: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map((col) =>
        col.id === columnId ? { ...col, name } : col
      ),
    });
  };

  const removeColumn = (columnId: string) => {
    if (!editingTemplate) return;
    if (editingTemplate.columns.length <= 1) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.filter((col) => col.id !== columnId),
    });
  };

  // Card management in columns
  const addCardToColumn = (columnId: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map((col) => {
        if (col.id !== columnId) return col;
        const maxOrder = Math.max(...col.cards.map((c) => c.order), -1);
        return {
          ...col,
          cards: [...col.cards, { id: generateId(), title: '', order: maxOrder + 1 }],
        };
      }),
    });
  };

  const updateCardInColumn = (columnId: string, cardId: string, title: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          cards: col.cards.map((card) =>
            card.id === cardId ? { ...card, title } : card
          ),
        };
      }),
    });
  };

  const removeCardFromColumn = (columnId: string, cardId: string) => {
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
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col"
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
                {editingTemplate ? (editingTemplate.id ? t('subBoardTemplate.editTitle') : t('subBoardTemplate.createTitle')) : t('subBoardTemplate.title')}
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
            // Template Editor
            <div className="space-y-6">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('subBoardTemplate.name')}
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  placeholder={t('subBoardTemplate.namePlaceholder')}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              {/* Description */}
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

              {/* Approval Column Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('subBoardTemplate.approvalColumn')}
                </label>
                <select
                  value={editingTemplate.approvalColumnName}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, approvalColumnName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                >
                  {editingTemplate.columns.map((col) => (
                    <option key={col.id} value={col.name}>
                      {col.name || t('subBoardTemplate.unnamedColumn')}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('subBoardTemplate.approvalColumnHelp')}
                </p>
              </div>

              {/* Columns */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('subBoardTemplate.columns')}
                  </label>
                  <button
                    onClick={addColumn}
                    className="px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {t('subBoardTemplate.addColumn')}
                  </button>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2">
                  {editingTemplate.columns.map((column) => (
                    <div
                      key={column.id}
                      className="flex-shrink-0 w-64 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700"
                    >
                      {/* Column Name */}
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          value={column.name}
                          onChange={(e) => updateColumn(column.id, e.target.value)}
                          placeholder={t('subBoardTemplate.columnNamePlaceholder')}
                          className="flex-1 px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                        <button
                          onClick={() => removeColumn(column.id)}
                          disabled={editingTemplate.columns.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title={t('subBoardTemplate.removeColumn')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Cards in Column */}
                      <div className="space-y-2 min-h-[60px]">
                        {column.cards.map((card) => (
                          <div key={card.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={card.title}
                              onChange={(e) => updateCardInColumn(column.id, card.id, e.target.value)}
                              placeholder={t('subBoardTemplate.cardTitlePlaceholder')}
                              className="flex-1 px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            />
                            <button
                              onClick={() => removeCardFromColumn(column.id, card.id)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title={t('subBoardTemplate.removeCard')}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Card Button */}
                      <button
                        onClick={() => addCardToColumn(column.id)}
                        className="w-full mt-2 px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {t('subBoardTemplate.addCard')}
                      </button>
                    </div>
                  ))}
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
                          <h3 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                            {template.name}
                            {template.id.startsWith('sub-built-in-') && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                                {t('subBoardTemplate.builtIn')}
                              </span>
                            )}
                          </h3>
                          {template.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                              {template.description}
                            </p>
                          )}
                        </div>
                        {!template.id.startsWith('sub-built-in-') && (
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
                        )}
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
                            title={col.name}
                          >
                            {col.name}
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

        {/* Footer */}
        {editingTemplate && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              onClick={() => setEditingTemplate(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={!editingTemplate.name.trim() || editingTemplate.columns.every((c) => !c.name.trim()) || isSaving}
              className="px-4 py-2 text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              )}
              {editingTemplate.id ? t('subBoardTemplate.save') : t('subBoardTemplate.create')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubBoardTemplateModal;
