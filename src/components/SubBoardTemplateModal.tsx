'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
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
  const [newCardTitle, setNewCardTitle] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingTemplateName, setEditingTemplateName] = useState(false);

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
          setNewCardTitle('');
        } else if (isAddingColumn) {
          setIsAddingColumn(false);
          setNewColumnName('');
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
  }, [isOpen, editingTemplate, addingCardToColumn, isAddingColumn, onClose]);

  // Get cards for a specific column, sorted by order
  const getCardsForColumn = useCallback((columnId: string): EditingCard[] => {
    if (!editingTemplate) return [];
    const column = editingTemplate.columns.find(c => c.id === columnId);
    return column?.cards.sort((a, b) => a.order - b.order) || [];
  }, [editingTemplate]);

  // Handle drag end for both columns and cards
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!editingTemplate) return;
    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'column') {
      // Column reordering
      const newColumns = Array.from(editingTemplate.columns).sort((a, b) => a.order - b.order);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);

      setEditingTemplate({
        ...editingTemplate,
        columns: newColumns.map((col, idx) => ({ ...col, order: idx })),
      });
    } else if (type === 'card') {
      // Card reordering
      const sourceColId = source.droppableId;
      const destColId = destination.droppableId;

      const newColumns = editingTemplate.columns.map(col => ({
        ...col,
        cards: [...col.cards],
      }));

      const sourceCol = newColumns.find(c => c.id === sourceColId);
      const destCol = newColumns.find(c => c.id === destColId);
      if (!sourceCol || !destCol) return;

      // Find and remove the card from source
      const cardIndex = sourceCol.cards.findIndex(c => c.id === draggableId);
      if (cardIndex === -1) return;
      const [movedCard] = sourceCol.cards.splice(cardIndex, 1);

      // Add to destination
      destCol.cards.splice(destination.index, 0, movedCard);

      // Re-order cards in affected columns
      sourceCol.cards.forEach((card, idx) => { card.order = idx; });
      if (sourceColId !== destColId) {
        destCol.cards.forEach((card, idx) => { card.order = idx; });
      }

      setEditingTemplate({
        ...editingTemplate,
        columns: newColumns,
      });
    }
  }, [editingTemplate]);

  if (!isOpen) return null;

  const handleCreateNew = () => {
    setEditingTemplate({
      name: t('subBoardTemplate.newTemplateName'),
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
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== templateId));
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
    if (!editingTemplate || !newColumnName.trim()) return;
    const maxOrder = editingTemplate.columns.length > 0 
      ? Math.max(...editingTemplate.columns.map((c) => c.order)) + 1 
      : 0;
    setEditingTemplate({
      ...editingTemplate,
      columns: [
        ...editingTemplate.columns,
        { 
          id: generateId(), 
          nameEn: newColumnName.trim(), 
          nameJa: newColumnName.trim(), // Will be translated later if needed
          order: maxOrder, 
          cards: [] 
        },
      ],
    });
    setNewColumnName('');
    setIsAddingColumn(false);
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
    if (!editingTemplate || !newCardTitle.trim()) return;
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
              titleEn: newCardTitle.trim(), 
              titleJa: newCardTitle.trim(), // Will be translated later if needed
              order: maxOrder 
            },
          ],
        };
      }),
    });
    setNewCardTitle('');
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

  // When editing, show a full-screen board view
  if (editingTemplate) {
    const sortedColumns = [...editingTemplate.columns].sort((a, b) => a.order - b.order);
    
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Template Editor Header - styled like a board header but indicates template mode */}
        <header className="flex-shrink-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/50 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back button */}
            <button
              onClick={() => setEditingTemplate(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              aria-label={t('common.back')}
            >
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Template indicator badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                {t('subBoardTemplate.templateMode')}
              </span>
            </div>
            
            {/* Editable template name */}
            {editingTemplateName ? (
              <input
                type="text"
                value={editingTemplate.name}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                onBlur={() => setEditingTemplateName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setEditingTemplateName(false);
                  }
                }}
                className="text-xl font-bold text-slate-900 dark:text-white bg-transparent border-b-2 border-purple-500 outline-none px-1"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setEditingTemplateName(true)}
                className="text-xl font-bold text-slate-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                {editingTemplate.name || t('subBoardTemplate.untitledTemplate')}
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Column/card count */}
            <div className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              {editingTemplate.columns.length} {t('subBoardTemplate.columnsLabel')}
              {editingTemplate.columns.reduce((acc, c) => acc + c.cards.length, 0) > 0 && (
                <span className="ml-1">
                  · {editingTemplate.columns.reduce((acc, c) => acc + c.cards.length, 0)} {t('subBoardTemplate.cardsLabel')}
                </span>
              )}
            </div>
            
            {/* Cancel button */}
            <button
              onClick={() => setEditingTemplate(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              {t('common.cancel')}
            </button>
            
            {/* Save button */}
            <button
              onClick={handleSaveTemplate}
              disabled={!editingTemplate.name.trim() || editingTemplate.columns.length === 0 || isSaving}
              className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              {isSaving && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              )}
              {t('subBoardTemplate.saveTemplate')}
            </button>
          </div>
        </header>

        {/* Main board area - matches KanbanBoard layout */}
        <main className="flex-1 overflow-x-auto p-4 sm:p-6">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="template-board" type="column" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex gap-5 h-full items-start pb-4 transition-all duration-200 ${
                    snapshot.isDraggingOver ? 'gap-6' : ''
                  }`}
                >
                  {sortedColumns.map((column, index) => (
                    <Draggable key={column.id} draggableId={column.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex-shrink-0 w-[300px] max-h-[calc(100vh-160px)] flex flex-col bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 dark:border-slate-700/60 overflow-hidden ${
                            snapshot.isDragging ? 'shadow-2xl ring-2 ring-purple-400 rotate-2' : ''
                          }`}
                        >
                          {/* Column header - styled like real Column component */}
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {getColumnName(column)}
                              </h3>
                              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                                {column.cards.length}
                              </span>
                            </div>
                            <button
                              onClick={() => removeColumn(column.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title={t('subBoardTemplate.removeColumn')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>

                          {/* Cards area with drag-and-drop */}
                          <Droppable droppableId={column.id} type="card">
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px] transition-colors ${
                                  snapshot.isDraggingOver ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                                }`}
                              >
                                {getCardsForColumn(column.id).map((card, cardIndex) => (
                                  <Draggable key={card.id} draggableId={card.id} index={cardIndex}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`group bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200/80 dark:border-slate-700/60 cursor-grab active:cursor-grabbing transition-all ${
                                          snapshot.isDragging ? 'shadow-xl ring-2 ring-purple-400 rotate-2' : 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="text-sm text-slate-800 dark:text-slate-200 break-words">
                                            {getCardTitle(card)}
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeCard(column.id, card.id);
                                            }}
                                            className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                                            title={t('subBoardTemplate.removeCard')}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>

                          {/* Add card section - styled like real Column component */}
                          <div className="p-2 border-t border-slate-100 dark:border-slate-700/50">
                            {addingCardToColumn === column.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={newCardTitle}
                                  onChange={(e) => setNewCardTitle(e.target.value)}
                                  placeholder={t('column.enterTitle')}
                                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
                                  rows={2}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && newCardTitle.trim()) {
                                      e.preventDefault();
                                      handleAddCard(column.id);
                                    }
                                    if (e.key === 'Escape') {
                                      setAddingCardToColumn(null);
                                      setNewCardTitle('');
                                    }
                                  }}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddCard(column.id)}
                                    disabled={!newCardTitle.trim()}
                                    className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                  >
                                    {t('column.addCard')}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAddingCardToColumn(null);
                                      setNewCardTitle('');
                                    }}
                                    className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddingCardToColumn(column.id)}
                                className="w-full px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl flex items-center gap-2 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                {t('column.addCard')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {/* Add column button - styled like real KanbanBoard */}
                  <div className="flex-shrink-0 w-[300px]">
                    {isAddingColumn ? (
                      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 dark:border-slate-700/60 p-4">
                        <input
                          type="text"
                          value={newColumnName}
                          onChange={(e) => setNewColumnName(e.target.value)}
                          placeholder={t('column.enterListName')}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newColumnName.trim()) {
                              handleAddColumn();
                            }
                            if (e.key === 'Escape') {
                              setIsAddingColumn(false);
                              setNewColumnName('');
                            }
                          }}
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={handleAddColumn}
                            disabled={!newColumnName.trim()}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                          >
                            {t('column.addList')}
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingColumn(false);
                              setNewColumnName('');
                            }}
                            className="px-4 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingColumn(true)}
                        className="w-full px-4 py-3.5 bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-800/80 backdrop-blur-sm rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all flex items-center gap-3 shadow-sm hover:shadow-md border border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 group"
                      >
                        <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 rounded-xl transition-colors">
                          <svg
                            className="w-5 h-5 text-slate-400 group-hover:text-purple-500 transition-colors"
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
                        </span>
                        <span className="font-medium">{t('column.addAnotherList')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </main>
      </div>
    );
  }

  // Template list view (when not editing)
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
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 dark:text-white truncate">
                          {template.name}
                        </h3>
                        {template.description && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-2 text-slate-400 hover:text-purple-500 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                          title={t('subBoardTemplate.edit')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
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
                      <span>{template.columns.length} {t('subBoardTemplate.columnsLabel')}</span>
                      {template.columns.some((c) => c.cards && c.cards.length > 0) && (
                        <>
                          <span>·</span>
                          <span>{template.columns.reduce((acc, c) => acc + (c.cards?.length || 0), 0)} {t('subBoardTemplate.cardsLabel')}</span>
                        </>
                      )}
                      {template.approvalColumnName && (
                        <>
                          <span>·</span>
                          <span>{t('subBoardTemplate.approvalLabel')}: {template.approvalColumnName}</span>
                        </>
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
        </div>
      </div>
    </div>
  );
}

export default SubBoardTemplateModal;
