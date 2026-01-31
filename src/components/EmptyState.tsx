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

// Custom SVG illustrations for each variant - Tomobodo themed with orange accent
const TomobodoBowlIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Steam lines */}
    <g className="animate-steam">
      <path d="M25 18C25 18 27 12 25 8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round"/>
      <path d="M40 14C40 14 42 8 40 4" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round"/>
      <path d="M55 18C55 18 57 12 55 8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round"/>
    </g>
    {/* Bowl */}
    <ellipse cx="40" cy="36" rx="30" ry="8" className="fill-orange-100 dark:fill-orange-900/30"/>
    <path d="M10 36C10 36 10 58 40 62C70 58 70 36 70 36" className="fill-orange-500" />
    <ellipse cx="40" cy="36" rx="30" ry="8" className="fill-orange-400"/>
    {/* Noodles */}
    <path d="M20 40C20 40 25 50 35 48C45 46 40 55 50 52" stroke="#FEF3C7" strokeWidth="3" strokeLinecap="round"/>
    <path d="M25 42C25 42 30 52 40 50C50 48 48 56 55 54" stroke="#FEF3C7" strokeWidth="3" strokeLinecap="round"/>
    {/* Egg */}
    <ellipse cx="55" cy="42" rx="8" ry="6" fill="#FEF3C7"/>
    <ellipse cx="55" cy="42" rx="4" ry="3" className="fill-orange-300"/>
    {/* Naruto */}
    <circle cx="28" cy="44" r="6" fill="#FDF2F8"/>
    <path d="M25 44C25 44 28 41 31 44" stroke="#FB7185" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const BoardsIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Board cards stacked */}
    <rect x="8" y="18" width="28" height="38" rx="4" className="fill-slate-200 dark:fill-slate-700"/>
    <rect x="12" y="14" width="28" height="38" rx="4" className="fill-slate-100 dark:fill-slate-600"/>
    <rect x="16" y="10" width="28" height="38" rx="4" className="fill-white dark:fill-slate-500" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"/>
    {/* Lines on top card */}
    <rect x="22" y="18" width="16" height="3" rx="1.5" className="fill-orange-300"/>
    <rect x="22" y="25" width="12" height="2" rx="1" className="fill-slate-200 dark:fill-slate-400"/>
    <rect x="22" y="30" width="14" height="2" rx="1" className="fill-slate-200 dark:fill-slate-400"/>
    {/* Tomobodo bowl decoration */}
    <g className="translate-x-[40px] translate-y-[32px]">
      <circle cx="16" cy="16" r="14" className="fill-orange-100 dark:fill-orange-900/40"/>
      <circle cx="16" cy="16" r="11" className="fill-orange-400"/>
      <path d="M10 16C12 14 14 18 16 16C18 14 20 18 22 16" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="19" cy="14" rx="3" ry="2" fill="#FEF3C7"/>
    </g>
  </svg>
);

const ColumnsIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Column containers */}
    <rect x="6" y="14" width="20" height="52" rx="4" className="fill-slate-100 dark:fill-slate-700" stroke="currentColor" strokeOpacity="0.1"/>
    <rect x="30" y="14" width="20" height="52" rx="4" className="fill-slate-100 dark:fill-slate-700" stroke="currentColor" strokeOpacity="0.1"/>
    <rect x="54" y="14" width="20" height="52" rx="4" className="fill-slate-100 dark:fill-slate-700" stroke="currentColor" strokeOpacity="0.1"/>
    {/* Column headers */}
    <rect x="9" y="17" width="14" height="4" rx="2" className="fill-orange-300"/>
    <rect x="33" y="17" width="14" height="4" rx="2" className="fill-orange-400"/>
    <rect x="57" y="17" width="14" height="4" rx="2" className="fill-orange-500"/>
    {/* Card placeholders with dashed borders */}
    <rect x="9" y="26" width="14" height="10" rx="2" className="fill-white dark:fill-slate-600" strokeDasharray="2 2" stroke="currentColor" strokeOpacity="0.2"/>
    <rect x="33" y="26" width="14" height="10" rx="2" className="fill-white dark:fill-slate-600" strokeDasharray="2 2" stroke="currentColor" strokeOpacity="0.2"/>
    {/* Add icon in third column */}
    <circle cx="64" cy="31" r="5" className="fill-orange-100 dark:fill-orange-900/40"/>
    <path d="M64 28V34M61 31H67" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Decorative noodle swirl */}
    <path d="M12 50C14 48 18 52 20 50" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const CardsIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="36" height="32" rx="4" className="fill-slate-100 dark:fill-slate-700" stroke="currentColor" strokeOpacity="0.1"/>
    <rect x="10" y="14" width="18" height="3" rx="1.5" className="fill-slate-300 dark:fill-slate-500"/>
    <rect x="10" y="20" width="28" height="2" rx="1" className="fill-slate-200 dark:fill-slate-600"/>
    <rect x="10" y="25" width="24" height="2" rx="1" className="fill-slate-200 dark:fill-slate-600"/>
    <rect x="10" y="30" width="20" height="2" rx="1" className="fill-slate-200 dark:fill-slate-600"/>
  </svg>
);

const CommentsIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main bubble */}
    <path d="M8 12C8 9.79086 9.79086 8 12 8H44C46.2091 8 48 9.79086 48 12V32C48 34.2091 46.2091 36 44 36H20L12 44V36H12C9.79086 36 8 34.2091 8 32V12Z" 
      className="fill-slate-100 dark:fill-slate-700" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"/>
    {/* Message lines */}
    <rect x="14" y="16" width="24" height="3" rx="1.5" className="fill-slate-300 dark:fill-slate-500"/>
    <rect x="14" y="23" width="18" height="2" rx="1" className="fill-slate-200 dark:fill-slate-600"/>
    <rect x="14" y="28" width="12" height="2" rx="1" className="fill-slate-200 dark:fill-slate-600"/>
    {/* Decorative dots */}
    <circle cx="40" cy="17" r="2" className="fill-orange-300"/>
    <circle cx="40" cy="24" r="1.5" className="fill-orange-200"/>
  </svg>
);

const SearchIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Magnifying glass */}
    <circle cx="34" cy="34" r="18" className="fill-slate-100 dark:fill-slate-700" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3"/>
    <circle cx="34" cy="34" r="12" className="fill-white dark:fill-slate-600"/>
    <line x1="48" y1="48" x2="62" y2="62" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" strokeLinecap="round"/>
    {/* Question mark in glass */}
    <path d="M30 30C30 28 32 26 34 26C36 26 38 28 38 30C38 32 36 32 34 34" 
      className="stroke-orange-400" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="34" cy="39" r="1.5" className="fill-orange-400"/>
    {/* Decorative elements */}
    <circle cx="58" cy="22" r="4" className="fill-orange-100 dark:fill-orange-900/30"/>
    <circle cx="62" cy="30" r="2" className="fill-orange-200 dark:fill-orange-800/40"/>
  </svg>
);

// Variant icon mapping
const variantIcons: Record<EmptyStateVariant, ReactNode> = {
  boards: <BoardsIcon className="w-full h-full" />,
  columns: <ColumnsIcon className="w-full h-full" />,
  cards: <CardsIcon className="w-full h-full" />,
  comments: <CommentsIcon className="w-full h-full" />,
  search: <SearchIcon className="w-full h-full" />,
  generic: <TomobodoBowlIcon className="w-full h-full" />,
};

// Size configurations with enhanced spacing
const sizeConfig = {
  sm: {
    container: 'py-8 px-4',
    iconWrapper: 'w-16 h-16 mb-4',
    title: 'text-sm font-semibold',
    description: 'text-xs leading-relaxed',
    button: 'px-4 py-2 text-xs',
    maxWidth: 'max-w-xs',
    gap: 'gap-2',
  },
  md: {
    container: 'py-12 px-6',
    iconWrapper: 'w-24 h-24 mb-5',
    title: 'text-lg font-semibold',
    description: 'text-sm leading-relaxed',
    button: 'px-5 py-2.5 text-sm',
    maxWidth: 'max-w-sm',
    gap: 'gap-3',
  },
  lg: {
    container: 'py-16 px-8',
    iconWrapper: 'w-32 h-32 mb-6',
    title: 'text-2xl font-bold',
    description: 'text-base leading-relaxed',
    button: 'px-6 py-3 text-base',
    maxWidth: 'max-w-md',
    gap: 'gap-4',
  },
};

// CSS keyframes as inline styles for custom animations
const steamAnimation = `
  @keyframes steam {
    0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.3; }
    50% { transform: translateY(-4px) scaleY(1.1); opacity: 0.6; }
  }
`;

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
    <>
      <style>{steamAnimation}</style>
      <div 
        className={`
          flex flex-col items-center justify-center text-center 
          ${config.container} ${className}
          animate-fade-in
        `}
      >
        {/* Icon container with enhanced styling */}
        <div 
          className={`
            ${config.iconWrapper} 
            relative flex items-center justify-center
            text-slate-400 dark:text-slate-500
          `}
        >
          {/* Decorative background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-slate-800/40 rounded-3xl blur-xl opacity-60" />
          
          {/* Icon background */}
          <div 
            className={`
              relative ${config.iconWrapper} 
              bg-gradient-to-br from-white to-slate-50 
              dark:from-slate-800 dark:to-slate-900
              rounded-3xl shadow-lg
              border border-orange-100/50 dark:border-orange-900/30
              flex items-center justify-center
              p-3
              transition-transform duration-300 hover:scale-105
            `}
          >
            <div className="w-full h-full animate-float" style={{ animationDuration: '4s' }}>
              {displayIcon}
            </div>
          </div>
        </div>

        {/* Title with better typography */}
        <h3 
          className={`
            ${config.title} ${config.maxWidth}
            text-slate-800 dark:text-slate-100
            mb-2 tracking-tight
          `}
        >
          {title}
        </h3>

        {/* Description with improved readability */}
        {description && (
          <p 
            className={`
              ${config.description} ${config.maxWidth}
              text-slate-500 dark:text-slate-400
              mb-6 mx-auto
            `}
          >
            {description}
          </p>
        )}

        {/* Action buttons with enhanced styling */}
        {(action && actionLabel) && (
          <div className={`flex flex-col sm:flex-row items-center ${config.gap}`}>
            <button
              onClick={action}
              className={`
                ${config.button}
                bg-gradient-to-r from-orange-500 to-orange-600
                hover:from-orange-600 hover:to-orange-700
                text-white font-medium rounded-xl
                shadow-lg shadow-orange-500/25
                hover:shadow-xl hover:shadow-orange-500/30
                transform hover:-translate-y-0.5
                transition-all duration-200
                active:scale-[0.98]
                flex items-center gap-2
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {actionLabel}
            </button>
            
            {secondaryAction && secondaryActionLabel && (
              <button
                onClick={secondaryAction}
                className={`
                  ${config.button}
                  bg-slate-100 dark:bg-slate-800
                  text-slate-600 dark:text-slate-300
                  font-medium rounded-xl
                  hover:bg-slate-200 dark:hover:bg-slate-700
                  transition-all duration-200
                  active:scale-[0.98]
                `}
              >
                {secondaryActionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </>
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
      className={`
        flex flex-col items-center justify-center 
        py-8 px-4 rounded-xl 
        border-2 border-dashed 
        transition-all duration-300
        ${isDraggingOver 
          ? 'border-orange-400 bg-orange-50/60 dark:bg-orange-900/20 scale-[1.02]' 
          : 'border-slate-200/60 dark:border-slate-700/60 bg-slate-50/30 dark:bg-slate-800/30'
        }
      `}
    >
      {/* Icon */}
      <div className={`
        w-12 h-12 rounded-xl flex items-center justify-center mb-3
        transition-all duration-300
        ${isDraggingOver 
          ? 'bg-orange-100 dark:bg-orange-900/40' 
          : 'bg-slate-100 dark:bg-slate-800'
        }
      `}>
        {isDraggingOver ? (
          <svg className="w-6 h-6 text-orange-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      
      <p className={`
        text-sm font-medium text-center
        transition-colors duration-300
        ${isDraggingOver 
          ? 'text-orange-600 dark:text-orange-400' 
          : 'text-slate-400 dark:text-slate-500'
        }
      `}>
        {isDraggingOver ? 'Drop card here' : 'No cards yet'}
      </p>
      
      {showTip && !isDraggingOver && (
        <p className="text-xs text-slate-300 dark:text-slate-600 mt-2 text-center flex items-center gap-1.5">
          <span className="inline-block w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
          Drag cards here or click + to add
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
    <div className="animate-fade-in">
      <EmptyState
        variant="search"
        title="No matching cards found"
        description={`No cards match "${searchQuery}". Try a different search term or clear the filters.`}
        action={onClearSearch}
        actionLabel="Clear Search"
        size="md"
      />
    </div>
  );
}

// Specialized empty state for comments section
export function CommentsEmptyState() {
  return (
    <div className="flex flex-col items-center py-8 px-4 text-center animate-fade-in">
      {/* Icon container */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <CommentsIcon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
      </div>
      
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No comments yet</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1.5">
        <span className="inline-block w-1 h-1 rounded-full bg-orange-400" />
        Be the first to start the conversation
      </p>
    </div>
  );
}
