'use client';

import Image from 'next/image';
import { Attachment } from '@/types';

interface AttachmentItemProps {
  attachment: Attachment;
  onRemove: () => void;
}

/**
 * Displays a single attachment (image, link, or file) with remove button
 */
export function AttachmentItem({ attachment, onRemove }: AttachmentItemProps) {
  const isImage = attachment.type === 'image';
  const isLink = attachment.type === 'link';

  return (
    <div className="relative group bg-slate-50 dark:bg-slate-800/80 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      {isImage ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="relative h-28">
            <Image
              src={attachment.url}
              alt={attachment.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
          <p className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 truncate font-medium">{attachment.name}</p>
        </a>
      ) : isLink ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-500 dark:text-blue-400"
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
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                {attachment.name}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{attachment.url}</p>
            </div>
          </div>
        </a>
      ) : (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-slate-500 dark:text-slate-400"
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
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 truncate font-medium">{attachment.name}</p>
          </div>
        </a>
      )}

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-slate-800/90 hover:bg-red-500 hover:text-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-slate-200 dark:border-slate-700 hover:border-red-500"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
