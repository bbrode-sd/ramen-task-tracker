'use client';

import { Draggable } from '@hello-pangea/dnd';
import { Card as CardType } from '@/types';
import Image from 'next/image';

interface CardProps {
  card: CardType;
  index: number;
  boardId: string;
  onClick: () => void;
}

export function Card({ card, index, onClick }: CardProps) {
  const hasAttachments = card.attachments && card.attachments.length > 0;
  const imageAttachment = card.attachments?.find((a) => a.type === 'image');

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white rounded-lg shadow-sm hover:shadow-md mb-2 cursor-pointer transition-all ${
            snapshot.isDragging ? 'shadow-lg rotate-2' : ''
          }`}
        >
          {/* Cover image if exists */}
          {imageAttachment && (
            <div className="relative h-32 rounded-t-lg overflow-hidden">
              <Image
                src={imageAttachment.url}
                alt="Card cover"
                fill
                className="object-cover"
              />
            </div>
          )}

          <div className="p-3">
            {/* Labels */}
            {card.labels && card.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {card.labels.map((label, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Bilingual Title */}
            <div className="space-y-1">
              {/* English */}
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-blue-600 mt-0.5 flex-shrink-0">
                  EN
                </span>
                <p className="text-sm text-gray-800 leading-snug">{card.titleEn || '—'}</p>
              </div>
              
              {/* Japanese */}
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-red-600 mt-0.5 flex-shrink-0">
                  JP
                </span>
                <p className="text-sm text-gray-600 leading-snug">
                  {card.titleJa || (
                    <span className="text-gray-400 italic">翻訳待ち...</span>
                  )}
                </p>
              </div>
            </div>

            {/* Card metadata */}
            <div className="flex items-center gap-3 mt-3 text-gray-500">
              {/* Description indicator */}
              {(card.descriptionEn || card.descriptionJa) && (
                <div className="flex items-center gap-1" title="Has description">
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
                      d="M4 6h16M4 12h16M4 18h7"
                    />
                  </svg>
                </div>
              )}

              {/* Attachments indicator */}
              {hasAttachments && (
                <div className="flex items-center gap-1" title="Has attachments">
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
                  <span className="text-xs">{card.attachments.length}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
