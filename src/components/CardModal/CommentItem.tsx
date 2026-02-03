'use client';

import { useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { ja, enUS } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import { Comment } from '@/types';
import { updateCommentTranslation } from '@/lib/firestore';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { RichTextEditor, RichTextDisplay } from '@/components/RichTextEditor';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  currentUserName: string;
  boardId: string;
  cardId: string;
  onDelete: () => void;
}

/**
 * Displays a bilingual comment with edit capability for translations
 */
export function CommentItem({
  comment,
  currentUserId,
  currentUserName,
  boardId,
  cardId,
  onDelete,
}: CommentItemProps) {
  const { t, locale } = useLocale();
  const { settings: translationSettings } = useTranslation();
  const userTextDisplayMode = translationSettings.userTextDisplayMode;
  const isOwner = currentUserId === comment.createdBy;
  
  // Editing state
  const [editingLang, setEditingLang] = useState<'en' | 'ja' | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete confirmation state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  // Get content for both languages, falling back to original content for old comments
  const englishContent = comment.contentEn || comment.content;
  const japaneseContent = comment.contentJa || comment.content;
  const detectedLang = comment.detectedLanguage || 'en';
  
  // Helper to get the translation status label
  const getTranslationLabel = (lang: 'en' | 'ja') => {
    const isOriginal = lang === detectedLang;
    if (isOriginal) {
      return t('cardModal.comment.original');
    }
    
    // Check if there's a manual translator
    const translator = lang === 'en' ? comment.translatorEn : comment.translatorJa;
    if (translator) {
      return t('cardModal.comment.translatedBy', { name: translator.displayName });
    }
    
    return t('cardModal.comment.autoTranslated');
  };
  
  const handleStartEdit = (lang: 'en' | 'ja') => {
    setEditingLang(lang);
    setEditingContent(lang === 'en' ? englishContent : japaneseContent);
  };
  
  const handleCancelEdit = () => {
    setEditingLang(null);
    setEditingContent('');
  };
  
  const handleConfirmEdit = async () => {
    if (!editingLang || !currentUserId || !editingContent.trim()) return;
    
    setIsSaving(true);
    try {
      await updateCommentTranslation(
        boardId,
        cardId,
        comment.id,
        editingLang,
        editingContent.trim(),
        currentUserId,
        currentUserName
      );
      setEditingLang(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to update translation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderAvatar = () => (
    comment.createdByPhoto ? (
      <Image
        src={comment.createdByPhoto}
        alt={comment.createdByName}
        width={36}
        height={36}
        className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-slate-800 object-cover shadow-sm"
      />
    ) : (
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-white dark:ring-slate-800">
        <span className="text-sm font-medium text-white">
          {comment.createdByName.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  );

  const renderNameAndTime = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-semibold text-slate-800 dark:text-white">
        {comment.createdByName}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-400">
        {comment.createdAt instanceof Timestamp
          ? format(comment.createdAt.toDate(), locale === 'ja' ? 'yyyy年M月d日 H:mm' : 'MMM d, yyyy h:mm a', { locale: locale === 'ja' ? ja : enUS })
          : ''}
      </span>
      {isOwner && (
        isConfirmingDelete ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('common.confirmDelete')}
            </span>
            <button
              onClick={() => {
                onDelete();
                setIsConfirmingDelete(false);
              }}
              className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium transition-colors"
            >
              {t('common.yes')}
            </button>
            <button
              onClick={() => setIsConfirmingDelete(false)}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {t('common.no')}
            </button>
          </span>
        ) : (
          <button
            onClick={() => setIsConfirmingDelete(true)}
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            {t('common.delete')}
          </button>
        )
      )}
    </div>
  );

  return (
    <div className="flex gap-3 group">
      <div className="flex-1 min-w-0">
        {/* Bilingual comment display - side by side */}
        <div className={`grid grid-cols-1 ${userTextDisplayMode === 'both' ? 'md:grid-cols-2' : ''} gap-3`}>
          {/* English version */}
          {(userTextDisplayMode === 'both' || userTextDisplayMode === 'en') && (
          <div className="relative pt-5">
            {/* Avatar overlapping the comment box */}
            <div className="absolute top-0 left-3 z-10">
              {renderAvatar()}
            </div>
            <div className={`bg-slate-50 dark:bg-slate-900/70 border rounded-xl pt-5 pb-3 px-4 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${detectedLang === 'en' ? 'border-blue-200 dark:border-blue-700/70' : 'border-slate-100 dark:border-slate-700/80'}`}>
              {/* Name, time, and language badge row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {renderNameAndTime()}
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80 dark:bg-blue-300/80" />
                  EN
                </span>
                <span className={`text-[10px] font-medium ${detectedLang === 'en' ? 'text-blue-500 dark:text-blue-300' : 'text-slate-400 dark:text-slate-400'}`}>
                  {getTranslationLabel('en')}
                </span>
                {/* Edit button for translated content (not original) */}
                {detectedLang !== 'en' && editingLang !== 'en' && currentUserId && (
                  <button
                    onClick={() => handleStartEdit('en')}
                    className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                    title={t('cardModal.comment.editTranslation')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
              {editingLang === 'en' ? (
                <div className="space-y-2">
                  <RichTextEditor
                    content={editingContent}
                    onChange={setEditingContent}
                    minHeight="60px"
                    autoFocus
                    accentColor="blue"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="text-xs px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleConfirmEdit}
                      disabled={isSaving || !editingContent.trim() || editingContent === '<p></p>'}
                      className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? t('cardModal.comment.saving') : t('common.confirm')}
                    </button>
                  </div>
                </div>
              ) : (
                <RichTextDisplay content={englishContent} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed" />
              )}
            </div>
          </div>
          )}
          
          {/* Japanese version */}
          {(userTextDisplayMode === 'both' || userTextDisplayMode === 'ja') && (
          <div className="relative pt-5">
            {/* Avatar overlapping the comment box */}
            <div className="absolute top-0 left-3 z-10">
              {renderAvatar()}
            </div>
            <div className={`bg-slate-50 dark:bg-slate-900/70 border rounded-xl pt-5 pb-3 px-4 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${detectedLang === 'ja' ? 'border-red-200 dark:border-red-700/70' : 'border-slate-100 dark:border-slate-700/80'}`}>
              {/* Name, time, and language badge row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {renderNameAndTime()}
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 dark:bg-red-300/80" />
                  JP
                </span>
                <span className={`text-[10px] font-medium ${detectedLang === 'ja' ? 'text-red-500 dark:text-red-300' : 'text-slate-400 dark:text-slate-400'}`}>
                  {getTranslationLabel('ja')}
                </span>
                {/* Edit button for translated content (not original) */}
                {detectedLang !== 'ja' && editingLang !== 'ja' && currentUserId && (
                  <button
                    onClick={() => handleStartEdit('ja')}
                    className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                    title={t('cardModal.comment.editTranslation')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
              {editingLang === 'ja' ? (
                <div className="space-y-2">
                  <RichTextEditor
                    content={editingContent}
                    onChange={setEditingContent}
                    minHeight="60px"
                    autoFocus
                    accentColor="red"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="text-xs px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleConfirmEdit}
                      disabled={isSaving || !editingContent.trim() || editingContent === '<p></p>'}
                      className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? t('cardModal.comment.saving') : t('common.confirm')}
                    </button>
                  </div>
                </div>
              ) : (
                <RichTextDisplay content={japaneseContent} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed" />
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
