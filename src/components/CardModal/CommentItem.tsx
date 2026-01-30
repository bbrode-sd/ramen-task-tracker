'use client';

import { useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Comment } from '@/types';
import { updateCommentTranslation } from '@/lib/firestore';

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
  const isOwner = currentUserId === comment.createdBy;
  
  // Editing state
  const [editingLang, setEditingLang] = useState<'en' | 'ja' | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Get content for both languages, falling back to original content for old comments
  const englishContent = comment.contentEn || comment.content;
  const japaneseContent = comment.contentJa || comment.content;
  const detectedLang = comment.detectedLanguage || 'en';
  
  // Helper to get the translation status label
  const getTranslationLabel = (lang: 'en' | 'ja') => {
    const isOriginal = lang === detectedLang;
    if (isOriginal) {
      return lang === 'en' ? 'Original' : 'オリジナル';
    }
    
    // Check if there's a manual translator
    const translator = lang === 'en' ? comment.translatorEn : comment.translatorJa;
    if (translator) {
      return `Translated by ${translator.displayName}`;
    }
    
    return 'Auto-Translated';
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

  return (
    <div className="flex gap-3 group">
      {comment.createdByPhoto ? (
        <Image
          src={comment.createdByPhoto}
          alt={comment.createdByName}
          width={36}
          height={36}
          className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-slate-100 object-cover"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-sm font-medium text-white">
            {comment.createdByName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-slate-800">
            {comment.createdByName}
          </span>
          <span className="text-xs text-slate-400">
            {comment.createdAt instanceof Timestamp
              ? format(comment.createdAt.toDate(), 'MMM d, yyyy h:mm a')
              : ''}
          </span>
          {isOwner && (
            <button
              onClick={onDelete}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            >
              Delete
            </button>
          )}
        </div>
        
        {/* Bilingual comment display - side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* English version */}
          <div className={`bg-slate-50 border rounded-xl px-4 py-3 ${detectedLang === 'en' ? 'border-blue-200' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[9px] font-bold text-blue-600 bg-blue-50 rounded border border-blue-100">EN</span>
              <span className={`text-[10px] font-medium ${detectedLang === 'en' ? 'text-blue-500' : 'text-slate-400'}`}>
                {getTranslationLabel('en')}
              </span>
              {/* Edit button for translated content (not original) */}
              {detectedLang !== 'en' && editingLang !== 'en' && currentUserId && (
                <button
                  onClick={() => handleStartEdit('en')}
                  className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit translation"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
            {editingLang === 'en' ? (
              <div className="space-y-2">
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmEdit}
                    disabled={isSaving || !editingContent.trim()}
                    className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{englishContent}</p>
            )}
          </div>
          
          {/* Japanese version */}
          <div className={`bg-slate-50 border rounded-xl px-4 py-3 ${detectedLang === 'ja' ? 'border-red-200' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[9px] font-bold text-red-600 bg-red-50 rounded border border-red-100">JP</span>
              <span className={`text-[10px] font-medium ${detectedLang === 'ja' ? 'text-red-500' : 'text-slate-400'}`}>
                {getTranslationLabel('ja')}
              </span>
              {/* Edit button for translated content (not original) */}
              {detectedLang !== 'ja' && editingLang !== 'ja' && currentUserId && (
                <button
                  onClick={() => handleStartEdit('ja')}
                  className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit translation"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
            {editingLang === 'ja' ? (
              <div className="space-y-2">
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmEdit}
                    disabled={isSaving || !editingContent.trim()}
                    className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{japaneseContent}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
