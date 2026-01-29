'use client';

import { ReactNode } from 'react';

export type EmptyStateVariant = 
  | 'boards' 
  | 'columns' 
  | 'cards' 
  | 'comments' 
  | 'search' 
  | 'generic';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
  secondaryAction?: () => void;
  secondaryActionLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Ramen-themed illustrations for each variant
const variantIcons: Record<EmptyStateVariant, ReactNode> = {
  boards: (
    <div className="relative">
      <div className="text-6xl animate-float">📋</div>
      <div className="absolute -bottom-1 -right-1 text-2xl">🍜</div>
    </div>
  ),
  columns: (
    <div className="relative">
      <div className="text-6xl animate-float">📝</div>
      <div className="absolute -bottom-1 -right-1 text-2xl">🍜</div>
    </div>
  ),
  cards: (
    <div className="text-4xl opacity-40">📄</div>
  ),
  comments: (
    <div className="relative">
      <div className="text-5xl opacity-60">💬</div>
    </div>
  ),
  search: (
    <div className="relative">
      <div className="text-6xl animate-float">🔍</div>
      <div className="absolute -bottom-1 -right-1 text-2xl">🍜</div>
    </div>
  ),
  generic: (
    <div className="text-6xl animate-float">🍜</div>
  ),
};

// Size configurations
const sizeConfig = {
  sm: {
    container: 'py-6 px-4',
    iconWrapper: 'mb-3 p-3',
    title: 'text-sm font-medium',
    description: 'text-xs',
    button: 'px-3 py-1.5 text-xs',
    maxWidth: 'max-w-xs',
  },
  md: {
    container: 'py-10 px-6',
    iconWrapper: 'mb-5 p-5',
    title: 'text-lg font-semibold',
    description: 'text-sm',
    button: 'px-5 py-2.5 text-sm',
    maxWidth: 'max-w-sm',
  },
  lg: {
    container: 'py-16 px-8',
    iconWrapper: 'mb-6 p-6',
    title: 'text-2xl font-bold',
    description: 'text-base',
    button: 'px-6 py-3 text-base',
    maxWidth: 'max-w-md',
  },
};

export function EmptyState({
  variant = 'generic',
  icon,
  title,
  description,
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const config = sizeConfig[size];
  const displayIcon = icon || variantIcons[variant];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${config.container} ${className}`}>
      {/* Icon/Illustration */}
      <div className={`inline-block ${config.iconWrapper} bg-gradient-to-br from-orange-50 to-slate-50 rounded-3xl shadow-sm border border-orange-100/50`}>
        {displayIcon}
      </div>

      {/* Title */}
      <h3 className={`text-gray-800 mb-2 ${config.title} ${config.maxWidth}`}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className={`text-gray-500 mb-6 ${config.description} ${config.maxWidth} mx-auto`}>
          {description}
        </p>
      )}

      {/* Actions */}
      {(action && actionLabel) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={action}
            className={`${config.button} bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-md hover:shadow-lg active:scale-[0.98]`}
          >
            {actionLabel}
          </button>
          
          {secondaryAction && secondaryActionLabel && (
            <button
              onClick={secondaryAction}
              className={`${config.button} bg-slate-100 text-slate-600 font-medium rounded-xl hover:bg-slate-200 transition-all`}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Specialized empty state for columns (more compact, drop hint)
export function ColumnEmptyState({ 
  isDraggingOver = false,
  showTip = true,
}: { 
  isDraggingOver?: boolean;
  showTip?: boolean;
}) {
  return (
    <div 
      className={`flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 border-dashed transition-all duration-200 ${
        isDraggingOver 
          ? 'border-orange-400 bg-orange-50/50' 
          : 'border-slate-200/60 bg-slate-50/30'
      }`}
    >
      <div className={`text-2xl mb-2 transition-transform duration-200 ${isDraggingOver ? 'scale-110' : ''}`}>
        {isDraggingOver ? '📥' : '📄'}
      </div>
      <p className="text-xs text-slate-400 text-center">
        {isDraggingOver ? 'Drop card here' : 'No cards yet'}
      </p>
      {showTip && !isDraggingOver && (
        <p className="text-[10px] text-slate-300 mt-2 text-center">
          💡 Drag cards here to organize
        </p>
      )}
    </div>
  );
}

// Specialized empty state for search results
export function SearchEmptyState({
  searchQuery,
  onClearSearch,
}: {
  searchQuery: string;
  onClearSearch?: () => void;
}) {
  return (
    <EmptyState
      variant="search"
      title="No matching cards found"
      description={`No cards match "${searchQuery}". Try a different search term or clear the filters.`}
      action={onClearSearch}
      actionLabel="Clear Search"
      size="md"
    />
  );
}

// Specialized empty state for comments section
export function CommentsEmptyState() {
  return (
    <div className="flex flex-col items-center py-6 px-4 text-center">
      <div className="text-3xl mb-3 opacity-50">💬</div>
      <p className="text-sm text-slate-400">No comments yet</p>
      <p className="text-xs text-slate-300 mt-1">
        Be the first to start the conversation
      </p>
    </div>
  );
}
