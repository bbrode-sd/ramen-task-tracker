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
          className={`bg-white rounded-xl shadow-sm hover:shadow-md mb-2.5 cursor-pointer transition-all duration-200 border border-slate-100 group ${
            snapshot.isDragging ? 'shadow-xl ring-2 ring-orange-400/30 rotate-2 scale-[1.02]' : 'hover:border-slate-200'
          }`}
        >
          {/* Cover image if exists */}
          {imageAttachment && (
            <div className="relative h-36 rounded-t-xl overflow-hidden">
              <Image
                src={imageAttachment.url}
                alt="Card cover"
                fill
                className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
          )}

          <div className="p-3.5">
            {/* Labels */}
            {card.labels && card.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {card.labels.map((label, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border border-orange-200/50"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Bilingual Title */}
            <div className="space-y-2">
              {/* English */}
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded mt-0.5 border border-blue-100">
                  EN
                </span>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">{card.titleEn || '—'}</p>
              </div>
              
              {/* Japanese */}
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-5 text-[10px] font-bold text-red-600 bg-red-50 rounded mt-0.5 border border-red-100">
                  JP
                </span>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {card.titleJa || (
                    <span className="text-slate-300 italic flex items-center gap-1">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      翻訳中...
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Card metadata */}
            {(card.descriptionEn || card.descriptionJa || hasAttachments) && (
              <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-slate-100">
                {/* Description indicator */}
                {(card.descriptionEn || card.descriptionJa) && (
                  <div className="flex items-center gap-1.5 text-slate-400" title="Has description">
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
                  <div className="flex items-center gap-1.5 text-slate-400" title="Has attachments">
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
                    <span className="text-xs font-medium">{card.attachments.length}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
