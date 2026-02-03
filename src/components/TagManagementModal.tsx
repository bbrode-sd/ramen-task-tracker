'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BoardTag, TranslatorInfo } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useLocale, Locale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { updateBoard } from '@/lib/firestore';

interface TagManagementModalProps {
  boardId: string;
  tags: BoardTag[];
  isOpen: boolean;
  onClose: () => void;
  onTagsChange: (tags: BoardTag[]) => void;
}

// Helper to get the localized tag name based on user's locale
export function getLocalizedTagName(tag: BoardTag, locale: Locale): string {
  if (locale === 'ja') {
    return tag.nameJa || tag.name;
  }
  return tag.name;
}

// Available tag colors with their display values
const TAG_COLORS = [
  { id: 'red', name: 'Red', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', border: 'border-red-200 dark:border-red-800/50' },
  { id: 'orange', name: 'Orange', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-800/50' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-800/50' },
  { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500', border: 'border-yellow-200 dark:border-yellow-800/50' },
  { id: 'lime', name: 'Lime', bg: 'bg-lime-100 dark:bg-lime-900/30', text: 'text-lime-700 dark:text-lime-400', dot: 'bg-lime-500', border: 'border-lime-200 dark:border-lime-800/50' },
  { id: 'green', name: 'Green', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500', border: 'border-green-200 dark:border-green-800/50' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800/50' },
  { id: 'teal', name: 'Teal', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500', border: 'border-teal-200 dark:border-teal-800/50' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', dot: 'bg-cyan-500', border: 'border-cyan-200 dark:border-cyan-800/50' },
  { id: 'sky', name: 'Sky', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-500', border: 'border-sky-200 dark:border-sky-800/50' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-800/50' },
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500', border: 'border-indigo-200 dark:border-indigo-800/50' },
  { id: 'violet', name: 'Violet', bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500', border: 'border-violet-200 dark:border-violet-800/50' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500', border: 'border-purple-200 dark:border-purple-800/50' },
  { id: 'fuchsia', name: 'Fuchsia', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', text: 'text-fuchsia-700 dark:text-fuchsia-400', dot: 'bg-fuchsia-500', border: 'border-fuchsia-200 dark:border-fuchsia-800/50' },
  { id: 'pink', name: 'Pink', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400', dot: 'bg-pink-500', border: 'border-pink-200 dark:border-pink-800/50' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500', border: 'border-rose-200 dark:border-rose-800/50' },
  { id: 'slate', name: 'Slate', bg: 'bg-slate-100 dark:bg-slate-800/50', text: 'text-slate-700 dark:text-slate-400', dot: 'bg-slate-500', border: 'border-slate-200 dark:border-slate-700/50' },
];

export function getTagColorConfig(colorId: string) {
  return TAG_COLORS.find(c => c.id === colorId) || TAG_COLORS[0];
}

export { TAG_COLORS };

// Default tags that match the old priority system (with EN/JA translations)
export const DEFAULT_TAGS: BoardTag[] = [
  { id: 'default-low', name: 'Low', nameJa: '低', nameOriginalLanguage: 'en', color: 'slate', order: 0 },
  { id: 'default-medium', name: 'Medium', nameJa: '中', nameOriginalLanguage: 'en', color: 'yellow', order: 1 },
  { id: 'default-high', name: 'High', nameJa: '高', nameOriginalLanguage: 'en', color: 'orange', order: 2 },
  { id: 'default-urgent', name: 'Urgent', nameJa: '緊急', nameOriginalLanguage: 'en', color: 'red', order: 3 },
];

// Create a fresh copy of default tags with unique IDs (for new boards)
export function createDefaultTags(): BoardTag[] {
  const timestamp = Date.now();
  return DEFAULT_TAGS.map((tag, index) => ({
    ...tag,
    id: `tag-${timestamp}-${index}`,
  }));
}

// Helper to get translation status label
function getTranslationLabel(
  lang: 'en' | 'ja',
  tag: BoardTag,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const originalLang = tag.nameOriginalLanguage || 'en';
  const isOriginal = lang === originalLang;
  
  if (isOriginal) {
    return t('tags.original') || 'Original';
  }
  
  // Check if there's a manual translator
  const translator = lang === 'en' ? tag.nameTranslatorEn : tag.nameTranslatorJa;
  if (translator) {
    return (t('tags.translatedBy') || 'Translated by {name}').replace('{name}', translator.displayName);
  }
  
  return t('tags.autoTranslated') || 'Auto-translated';
}

export function TagManagementModal({ boardId, tags, isOpen, onClose, onTagsChange }: TagManagementModalProps) {
  const { showToast } = useToast();
  const { t, locale } = useLocale();
  const { translateWithAutoDetect, translationState } = useTranslation();
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [localTags, setLocalTags] = useState<BoardTag[]>(tags);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingNameEn, setEditingNameEn] = useState('');
  const [editingNameJa, setEditingNameJa] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Sync local tags when prop changes
  useEffect(() => {
    setLocalTags(tags);
  }, [tags]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const saveTags = useCallback(async (newTags: BoardTag[]) => {
    setIsSaving(true);
    try {
      // Clean tags to remove undefined values (Firestore doesn't accept undefined)
      const cleanedTags = newTags.map(tag => {
        const cleaned: BoardTag = {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          order: tag.order,
        };
        if (tag.nameJa) cleaned.nameJa = tag.nameJa;
        if (tag.nameOriginalLanguage) cleaned.nameOriginalLanguage = tag.nameOriginalLanguage;
        if (tag.nameTranslatorEn) cleaned.nameTranslatorEn = tag.nameTranslatorEn;
        if (tag.nameTranslatorJa) cleaned.nameTranslatorJa = tag.nameTranslatorJa;
        return cleaned;
      });
      
      await updateBoard(boardId, { tags: cleanedTags });
      onTagsChange(cleanedTags);
      setLocalTags(cleanedTags);
    } catch (error) {
      console.error('Failed to save tags:', error);
      showToast('error', t('tags.saveFailed') || 'Failed to save tags');
    } finally {
      setIsSaving(false);
    }
  }, [boardId, onTagsChange, showToast, t]);

  // Add a new tag with auto-detection and translation
  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    setIsTranslating(true);
    try {
      // Auto-detect language and translate
      const result = await translateWithAutoDetect(name, `new-tag-${Date.now()}`);
      const detectedLang = result.detectedLanguage || 'en';
      
      // Set English and Japanese based on detected language
      const nameEn = detectedLang === 'en' ? name : (result.translation || name);
      const nameJa = detectedLang === 'ja' ? name : (result.translation || '');

      const newTag: BoardTag = {
        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: nameEn,
        nameJa: nameJa || '',
        nameOriginalLanguage: detectedLang,
        color: newTagColor,
        order: localTags.length,
      };

      const newTags = [...localTags, newTag];
      await saveTags(newTags);
      setNewTagName('');
      showToast('success', t('tags.created') || 'Tag created');
    } catch (error) {
      console.error('Failed to create tag:', error);
      showToast('error', t('tags.createFailed') || 'Failed to create tag');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    const newTags = localTags.filter(t => t.id !== tagId).map((t, i) => ({ ...t, order: i }));
    await saveTags(newTags);
    showToast('success', t('tags.deleted') || 'Tag deleted');
  };

  const handleColorChange = async (tagId: string, colorId: string) => {
    const newTags = localTags.map(t => t.id === tagId ? { ...t, color: colorId } : t);
    await saveTags(newTags);
    setShowColorPicker(null);
  };

  const startEditing = (tag: BoardTag) => {
    setEditingTagId(tag.id);
    setEditingNameEn(tag.name);
    setEditingNameJa(tag.nameJa || '');
  };

  // Handle saving edits - with translation logic
  const handleSaveEdit = async (tagId: string, editedLang: 'en' | 'ja') => {
    const tag = localTags.find(t => t.id === tagId);
    if (!tag) return;

    const newNameEn = editingNameEn.trim();
    const newNameJa = editingNameJa.trim();
    
    if (!newNameEn && !newNameJa) {
      setEditingTagId(null);
      return;
    }

    const originalLang = tag.nameOriginalLanguage || 'en';
    const isEditingOriginal = editedLang === originalLang;

    setIsTranslating(true);
    try {
      let updatedTag: BoardTag = { ...tag };

      if (isEditingOriginal) {
        // Editing the original - re-translate the other language
        const textToTranslate = editedLang === 'en' ? newNameEn : newNameJa;
        const targetLang = editedLang === 'en' ? 'ja' : 'en';
        
        if (textToTranslate) {
          const result = await translateWithAutoDetect(textToTranslate, `tag-edit-${tagId}`);
          
          if (editedLang === 'en') {
            updatedTag.name = newNameEn;
            updatedTag.nameJa = result.translation || newNameJa;
            delete updatedTag.nameTranslatorJa; // Clear manual translation marker
          } else {
            updatedTag.name = result.translation || newNameEn;
            updatedTag.nameJa = newNameJa;
            delete updatedTag.nameTranslatorEn; // Clear manual translation marker
          }
        }
      } else {
        // Editing the translation - just save without re-translating
        const translatorInfo: TranslatorInfo | undefined = user ? {
          uid: user.uid,
          displayName: user.displayName || 'Unknown',
        } : undefined;

        if (editedLang === 'en') {
          updatedTag.name = newNameEn;
          updatedTag.nameTranslatorEn = translatorInfo;
        } else {
          updatedTag.nameJa = newNameJa;
          updatedTag.nameTranslatorJa = translatorInfo;
        }
      }

      const newTags = localTags.map(t => t.id === tagId ? updatedTag : t);
      await saveTags(newTags);
      setEditingTagId(null);
      setEditingNameEn('');
      setEditingNameJa('');
    } catch (error) {
      console.error('Failed to save tag:', error);
      showToast('error', t('tags.saveFailed') || 'Failed to save tag');
    } finally {
      setIsTranslating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 id="tag-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {t('tags.manage') || 'Manage Tags'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Add new tag - single input with auto-translate */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('tags.addNew') || 'Add New Tag'}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {t('tags.addHint') || 'Type in English or Japanese. The other language will be auto-translated.'}
            </p>
            <div className="flex gap-2">
              {/* Color selector */}
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === 'new' ? null : 'new')}
                  className={`w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center ${getTagColorConfig(newTagColor).bg}`}
                  title={t('tags.selectColor') || 'Select color'}
                >
                  <span className={`w-4 h-4 rounded-full ${getTagColorConfig(newTagColor).dot}`} />
                </button>
                {showColorPicker === 'new' && (
                  <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-10 grid grid-cols-6 gap-1 w-48">
                    {TAG_COLORS.map(color => (
                      <button
                        key={color.id}
                        onClick={() => {
                          setNewTagColor(color.id);
                          setShowColorPicker(null);
                        }}
                        className={`w-6 h-6 rounded-full ${color.dot} hover:scale-110 transition-transform ${newTagColor === color.id ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                        title={color.name}
                      />
                    ))}
                  </div>
                )}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder={t('tags.namePlaceholder') || 'Tag name (EN or JP)...'}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={isTranslating}
              />
              <button
                onClick={handleAddTag}
                disabled={!newTagName.trim() || isSaving || isTranslating}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isTranslating && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {t('tags.add') || 'Add'}
              </button>
            </div>
          </div>

          {/* Existing tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('tags.current') || 'Current Tags'} ({localTags.length})
            </label>
            {localTags.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p>{t('tags.noTags') || 'No tags yet. Add your first tag above.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {localTags.sort((a, b) => a.order - b.order).map(tag => {
                  const colorConfig = getTagColorConfig(tag.color);
                  const isEditing = editingTagId === tag.id;
                  const originalLang = tag.nameOriginalLanguage || 'en';
                  
                  return (
                    <div
                      key={tag.id}
                      className={`p-3 rounded-lg ${colorConfig.bg} border ${colorConfig.border}`}
                    >
                      {isEditing ? (
                        // Edit mode - EN/JP side by side as equals
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            {/* English field */}
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">EN</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  originalLang === 'en' 
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                                }`}>
                                  {getTranslationLabel('en', tag, t)}
                                </span>
                              </div>
                              <input
                                type="text"
                                value={editingNameEn}
                                onChange={(e) => setEditingNameEn(e.target.value)}
                                onBlur={() => handleSaveEdit(tag.id, 'en')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEdit(tag.id, 'en');
                                  } else if (e.key === 'Escape') {
                                    setEditingTagId(null);
                                  }
                                }}
                                autoFocus={originalLang === 'en'}
                                placeholder="English..."
                                className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 ${colorConfig.text} font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                              />
                            </div>
                            
                            {/* Japanese field */}
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">JA</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  originalLang === 'ja' 
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                                }`}>
                                  {getTranslationLabel('ja', tag, t)}
                                </span>
                              </div>
                              <input
                                type="text"
                                value={editingNameJa}
                                onChange={(e) => setEditingNameJa(e.target.value)}
                                onBlur={() => handleSaveEdit(tag.id, 'ja')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEdit(tag.id, 'ja');
                                  } else if (e.key === 'Escape') {
                                    setEditingTagId(null);
                                  }
                                }}
                                autoFocus={originalLang === 'ja'}
                                placeholder="日本語..."
                                className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 ${colorConfig.text} font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingTagId(null)}
                              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-900/30 rounded-lg transition-colors"
                            >
                              {t('common.cancel') || 'Cancel'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View mode - EN/JP side by side as equals
                        <div className="flex items-start gap-2">
                          {/* Color picker button */}
                          <div className="relative pt-1">
                            <button
                              onClick={() => setShowColorPicker(showColorPicker === tag.id ? null : tag.id)}
                              className={`w-6 h-6 rounded-full ${colorConfig.dot} hover:scale-110 transition-transform`}
                              title={t('tags.changeColor') || 'Change color'}
                            />
                            {showColorPicker === tag.id && (
                              <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-10 grid grid-cols-6 gap-1 w-48">
                                {TAG_COLORS.map(color => (
                                  <button
                                    key={color.id}
                                    onClick={() => handleColorChange(tag.id, color.id)}
                                    className={`w-6 h-6 rounded-full ${color.dot} hover:scale-110 transition-transform ${tag.color === color.id ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                                    title={color.name}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Tag names - EN/JP side by side as equals */}
                          <button
                            onClick={() => startEditing(tag)}
                            className="flex-1 text-left px-2 py-1 rounded hover:bg-white/30 dark:hover:bg-gray-900/30 transition-colors"
                            title={t('tags.clickToEdit') || 'Click to edit'}
                          >
                            <div className="flex gap-4">
                              {/* English */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">EN</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    originalLang === 'en' 
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                                      : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {getTranslationLabel('en', tag, t)}
                                  </span>
                                </div>
                                <div className={`${colorConfig.text} font-medium truncate`}>
                                  {tag.name || '—'}
                                </div>
                              </div>
                              
                              {/* Divider */}
                              <div className="w-px bg-gray-300 dark:bg-gray-600 self-stretch" />
                              
                              {/* Japanese */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">JA</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    originalLang === 'ja' 
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                                      : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {getTranslationLabel('ja', tag, t)}
                                  </span>
                                </div>
                                <div className={`${colorConfig.text} font-medium truncate`}>
                                  {tag.nameJa || '—'}
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteTag(tag.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-colors mt-1"
                            title={t('tags.delete') || 'Delete tag'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            {t('common.done') || 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
