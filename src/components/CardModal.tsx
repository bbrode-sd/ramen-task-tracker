'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Comment, Attachment } from '@/types';
import {
  getCard,
  updateCard,
  archiveCard,
  subscribeToComments,
  addComment,
  deleteComment,
  addAttachment,
  removeAttachment,
} from '@/lib/firestore';
import { uploadFile, uploadFromPaste, getFileType } from '@/lib/storage';
import { Timestamp } from 'firebase/firestore';

interface CardModalProps {
  boardId: string;
  cardId: string;
  onClose: () => void;
}

export function CardModal({ boardId, cardId, onClose }: CardModalProps) {
  const { user } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [titleEn, setTitleEn] = useState('');
  const [titleJa, setTitleJa] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionJa, setDescriptionJa] = useState('');

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Translation state
  const [isTranslating, setIsTranslating] = useState<string | null>(null);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Link input
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  // Fetch card data
  useEffect(() => {
    const fetchCard = async () => {
      const cardData = await getCard(boardId, cardId);
      if (cardData) {
        setCard(cardData);
        setTitleEn(cardData.titleEn);
        setTitleJa(cardData.titleJa);
        setDescriptionEn(cardData.descriptionEn);
        setDescriptionJa(cardData.descriptionJa);
      }
      setLoading(false);
    };
    fetchCard();
  }, [boardId, cardId]);

  // Subscribe to comments
  useEffect(() => {
    const unsubscribe = subscribeToComments(boardId, cardId, setComments);
    return () => unsubscribe();
  }, [boardId, cardId]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingField) {
          setEditingField(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editingField, onClose]);

  const translate = useCallback(async (text: string, targetLanguage: 'en' | 'ja'): Promise<string> => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage }),
      });
      const data = await response.json();
      return data.translation || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }, []);

  const handleTitleEnChange = async (value: string) => {
    setTitleEn(value);
    await updateCard(boardId, cardId, { titleEn: value });

    // Auto-translate to Japanese
    if (value.trim()) {
      setIsTranslating('titleJa');
      const translated = await translate(value, 'ja');
      setTitleJa(translated);
      await updateCard(boardId, cardId, { titleJa: translated });
      setIsTranslating(null);
    }
  };

  const handleTitleJaChange = async (value: string) => {
    setTitleJa(value);
    await updateCard(boardId, cardId, { titleJa: value });

    // Auto-translate to English
    if (value.trim()) {
      setIsTranslating('titleEn');
      const translated = await translate(value, 'en');
      setTitleEn(translated);
      await updateCard(boardId, cardId, { titleEn: translated });
      setIsTranslating(null);
    }
  };

  const handleDescriptionEnChange = async (value: string) => {
    setDescriptionEn(value);
    await updateCard(boardId, cardId, { descriptionEn: value });

    if (value.trim()) {
      setIsTranslating('descriptionJa');
      const translated = await translate(value, 'ja');
      setDescriptionJa(translated);
      await updateCard(boardId, cardId, { descriptionJa: translated });
      setIsTranslating(null);
    }
  };

  const handleDescriptionJaChange = async (value: string) => {
    setDescriptionJa(value);
    await updateCard(boardId, cardId, { descriptionJa: value });

    if (value.trim()) {
      setIsTranslating('descriptionEn');
      const translated = await translate(value, 'en');
      setDescriptionEn(translated);
      await updateCard(boardId, cardId, { descriptionEn: translated });
      setIsTranslating(null);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;

    setIsAddingComment(true);
    await addComment(
      boardId,
      cardId,
      newComment.trim(),
      user.uid,
      user.displayName || 'Anonymous',
      user.photoURL
    );
    setNewComment('');
    setIsAddingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(boardId, cardId, commentId);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadFile(file, boardId, user.uid);
        await addAttachment(boardId, cardId, {
          type: getFileType(file),
          url: result.url,
          name: result.name,
          createdBy: user.uid,
        });
      }
      // Refresh card
      const updatedCard = await getCard(boardId, cardId);
      if (updatedCard) setCard(updatedCard);
    } catch (error) {
      console.error('Upload error:', error);
    }
    setIsUploading(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!user) return;

    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        setIsUploading(true);

        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            try {
              const result = await uploadFromPaste(dataUrl, boardId, user.uid);
              await addAttachment(boardId, cardId, {
                type: 'image',
                url: result.url,
                name: result.name,
                createdBy: user.uid,
              });
              const updatedCard = await getCard(boardId, cardId);
              if (updatedCard) setCard(updatedCard);
            } catch (error) {
              console.error('Paste upload error:', error);
            }
            setIsUploading(false);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim() || !user) return;

    await addAttachment(boardId, cardId, {
      type: 'link',
      url: linkUrl.trim(),
      name: linkName.trim() || linkUrl.trim(),
      createdBy: user.uid,
    });

    setLinkUrl('');
    setLinkName('');
    setShowLinkInput(false);

    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    await removeAttachment(boardId, cardId, attachmentId);
    const updatedCard = await getCard(boardId, cardId);
    if (updatedCard) setCard(updatedCard);
  };

  const handleArchive = async () => {
    await archiveCard(boardId, cardId);
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  if (!card) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <span className="text-sm text-gray-500">Card Details</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 p-4 space-y-6">
            {/* Bilingual Title Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* English Title */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-blue-600">
                  <span className="px-1.5 py-0.5 bg-blue-100 rounded text-xs">EN</span>
                  Title (English)
                  {isTranslating === 'titleEn' && (
                    <span className="animate-pulse text-xs text-gray-500">Translating...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  onBlur={() => handleTitleEnChange(titleEn)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleEnChange(titleEn);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter title in English..."
                />
              </div>

              {/* Japanese Title */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <span className="px-1.5 py-0.5 bg-red-100 rounded text-xs">JP</span>
                  Title (日本語)
                  {isTranslating === 'titleJa' && (
                    <span className="animate-pulse text-xs text-gray-500">翻訳中...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={titleJa}
                  onChange={(e) => setTitleJa(e.target.value)}
                  onBlur={() => handleTitleJaChange(titleJa)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleJaChange(titleJa);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="日本語でタイトルを入力..."
                />
              </div>
            </div>

            {/* Bilingual Description Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* English Description */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-blue-600">
                  <span className="px-1.5 py-0.5 bg-blue-100 rounded text-xs">EN</span>
                  Description (English)
                  {isTranslating === 'descriptionEn' && (
                    <span className="animate-pulse text-xs text-gray-500">Translating...</span>
                  )}
                </label>
                <textarea
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  onBlur={() => handleDescriptionEnChange(descriptionEn)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
                  placeholder="Add a description in English..."
                />
              </div>

              {/* Japanese Description */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <span className="px-1.5 py-0.5 bg-red-100 rounded text-xs">JP</span>
                  Description (日本語)
                  {isTranslating === 'descriptionJa' && (
                    <span className="animate-pulse text-xs text-gray-500">翻訳中...</span>
                  )}
                </label>
                <textarea
                  value={descriptionJa}
                  onChange={(e) => setDescriptionJa(e.target.value)}
                  onBlur={() => handleDescriptionJaChange(descriptionJa)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[120px] resize-y"
                  placeholder="日本語で説明を追加..."
                />
              </div>
            </div>

            {/* Attachments */}
            {card.attachments && card.attachments.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  Attachments
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {card.attachments.map((attachment) => (
                    <AttachmentItem
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => handleRemoveAttachment(attachment.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
                Comments
              </h4>

              {/* Add comment */}
              <div className="flex gap-3">
                {user?.photoURL && (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[80px] resize-y"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleAddComment();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isAddingComment}
                    className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {isAddingComment ? 'Posting...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Comment list */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserId={user?.uid}
                    onDelete={() => handleDeleteComment(comment.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-48 p-4 bg-gray-50 lg:rounded-br-xl space-y-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Add to card
            </h4>

            {/* Upload file */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm text-left flex items-center gap-2 transition-colors disabled:opacity-50"
            >
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
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              {isUploading ? 'Uploading...' : 'Attachment'}
            </button>

            {/* Add link */}
            {showLinkInput ? (
              <div className="space-y-2">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste link URL..."
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
                <input
                  type="text"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Link name (optional)"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddLink}
                    disabled={!linkUrl.trim()}
                    className="flex-1 px-2 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowLinkInput(false);
                      setLinkUrl('');
                      setLinkName('');
                    }}
                    className="px-2 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLinkInput(true)}
                className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm text-left flex items-center gap-2 transition-colors"
              >
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
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Link
              </button>
            )}

            <hr className="border-gray-300" />

            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </h4>

            <button
              onClick={handleArchive}
              className="w-full px-3 py-2 bg-gray-200 hover:bg-red-100 hover:text-red-700 rounded text-sm text-left flex items-center gap-2 transition-colors"
            >
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
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
              Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Attachment Item Component
function AttachmentItem({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const isImage = attachment.type === 'image';
  const isLink = attachment.type === 'link';

  return (
    <div className="relative group bg-gray-100 rounded-lg overflow-hidden">
      {isImage ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="relative h-24">
            <Image
              src={attachment.url}
              alt={attachment.name}
              fill
              className="object-cover"
            />
          </div>
          <p className="p-2 text-xs text-gray-600 truncate">{attachment.name}</p>
        </a>
      ) : isLink ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 hover:bg-gray-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-8 h-8 text-blue-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-600 truncate">
                {attachment.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{attachment.url}</p>
            </div>
          </div>
        </a>
      ) : (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 hover:bg-gray-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-8 h-8 text-gray-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-gray-700 truncate">{attachment.name}</p>
          </div>
        </a>
      )}

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="absolute top-1 right-1 p-1 bg-white/80 hover:bg-red-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-all"
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
    </div>
  );
}

// Comment Item Component
function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: Comment;
  currentUserId?: string;
  onDelete: () => void;
}) {
  const isOwner = currentUserId === comment.createdBy;

  return (
    <div className="flex gap-3">
      {comment.createdByPhoto ? (
        <Image
          src={comment.createdByPhoto}
          alt={comment.createdByName}
          width={32}
          height={32}
          className="rounded-full flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
          <span className="text-sm text-gray-600">
            {comment.createdByName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-800">
            {comment.createdByName}
          </span>
          <span className="text-xs text-gray-500">
            {comment.createdAt instanceof Timestamp
              ? format(comment.createdAt.toDate(), 'MMM d, yyyy h:mm a')
              : ''}
          </span>
          {isOwner && (
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}
