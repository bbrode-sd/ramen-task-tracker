'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { Activity } from '@/types';
import { subscribeToBoardActivities } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';

// Helper to generate consistent color from user ID
function getAvatarColor(userId: string): string {
  const colors = [
    'from-orange-400 to-red-500',
    'from-blue-400 to-indigo-500',
    'from-green-400 to-emerald-500',
    'from-purple-400 to-violet-500',
    'from-pink-400 to-rose-500',
    'from-yellow-400 to-amber-500',
    'from-cyan-400 to-teal-500',
    'from-fuchsia-400 to-purple-500',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Helper to get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

interface BoardActivityPanelProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  onCardClick: (cardId: string) => void;
}

interface GroupedActivities {
  today: Activity[];
  yesterday: Activity[];
  thisWeek: Activity[];
  older: Activity[];
}

export function BoardActivityPanel({ 
  boardId, 
  isOpen, 
  onClose, 
  onCardClick 
}: BoardActivityPanelProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    const unsubscribe = subscribeToBoardActivities(
      boardId,
      (fetchedActivities) => {
        setActivities(fetchedActivities);
        setLoading(false);
      },
      100, // limitCount
      (error) => {
        console.error('Error subscribing to board activities:', error);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [boardId, isOpen]);

  // Group activities by time period
  const groupedActivities: GroupedActivities = activities.reduce(
    (groups, activity) => {
      const date = activity.createdAt.toDate();
      if (isToday(date)) {
        groups.today.push(activity);
      } else if (isYesterday(date)) {
        groups.yesterday.push(activity);
      } else if (isThisWeek(date)) {
        groups.thisWeek.push(activity);
      } else {
        groups.older.push(activity);
      }
      return groups;
    },
    { today: [], yesterday: [], thisWeek: [], older: [] } as GroupedActivities
  );

  const handleActivityClick = (activity: Activity) => {
    if (activity.cardId) {
      onCardClick(activity.cardId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className="fixed top-0 right-0 h-full w-full max-w-md shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4"
          style={{ 
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(to right, var(--background-subtle), var(--surface))'
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-light)' }}
            >
              <svg
                className="w-5 h-5"
                style={{ color: 'var(--primary)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Activity</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Recent board activity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors group"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg
              className="w-5 h-5 transition-colors"
              style={{ color: 'var(--text-muted)' }}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="relative">
                <div 
                  className="animate-spin rounded-full h-10 w-10 border-3"
                  style={{ borderColor: 'var(--primary-muted)', borderTopColor: 'var(--primary)' }}
                ></div>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--surface-hover)' }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: 'var(--text-muted)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="font-medium" style={{ color: 'var(--text-tertiary)' }}>No activity yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Activity will appear here as you work
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedActivities.today.length > 0 && (
                <ActivityGroup 
                  title="Today" 
                  activities={groupedActivities.today} 
                  onActivityClick={handleActivityClick}
                />
              )}
              {groupedActivities.yesterday.length > 0 && (
                <ActivityGroup 
                  title="Yesterday" 
                  activities={groupedActivities.yesterday} 
                  onActivityClick={handleActivityClick}
                />
              )}
              {groupedActivities.thisWeek.length > 0 && (
                <ActivityGroup 
                  title="This Week" 
                  activities={groupedActivities.thisWeek} 
                  onActivityClick={handleActivityClick}
                />
              )}
              {groupedActivities.older.length > 0 && (
                <ActivityGroup 
                  title="Older" 
                  activities={groupedActivities.older} 
                  onActivityClick={handleActivityClick}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ActivityGroup({ 
  title, 
  activities, 
  onActivityClick 
}: { 
  title: string; 
  activities: Activity[]; 
  onActivityClick: (activity: Activity) => void;
}) {
  return (
    <div>
      <h3 
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        {title}
      </h3>
      <div className="space-y-1">
        {activities.map((activity) => (
          <ActivityListItem 
            key={activity.id} 
            activity={activity} 
            onClick={() => onActivityClick(activity)}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityListItem({ 
  activity, 
  onClick 
}: { 
  activity: Activity; 
  onClick: () => void;
}) {
  const getRelativeTime = (timestamp: Timestamp): string => {
    const now = new Date();
    const activityDate = timestamp.toDate();
    const diffMs = now.getTime() - activityDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return format(activityDate, 'MMM d');
  };

  const getActivityDescription = (): string => {
    const metadata = activity.metadata as Record<string, string>;
    switch (activity.type) {
      case 'card_created':
        return `created a card in ${metadata?.columnName || 'the board'}`;
      case 'card_moved':
        return `moved a card from ${metadata?.from || '?'} to ${metadata?.to || '?'}`;
      case 'card_archived':
        return 'archived a card';
      case 'comment_added':
        return 'commented on a card';
      case 'assignee_added':
        return `assigned ${metadata?.assigneeName || 'someone'}`;
      case 'due_date_set':
        return 'set a due date';
      case 'checklist_completed':
        return 'completed a checklist';
      case 'card_updated':
        return 'updated a card';
      case 'attachment_added':
        return metadata?.attachmentType === 'image' 
          ? 'added an image' 
          : `added an attachment`;
      default:
        return 'made a change';
    }
  };

  const getActivityIcon = () => {
    switch (activity.type) {
      case 'card_created':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'card_moved':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case 'card_archived':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        );
      case 'comment_added':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
      case 'assignee_added':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      case 'due_date_set':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'attachment_added':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const hasCard = !!activity.cardId;

  return (
    <button
      onClick={onClick}
      disabled={!hasCard}
      className={`w-full text-left p-3 rounded-xl transition-all group ${
        hasCard 
          ? 'cursor-pointer' 
          : 'cursor-default'
      }`}
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => hasCard && (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <div className="flex items-start gap-3">
        {/* User Avatar */}
        {activity.userPhoto ? (
          <Image
            src={activity.userPhoto}
            alt={activity.userName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div 
            className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(activity.userId)} flex items-center justify-center flex-shrink-0`}
          >
            <span className="text-xs font-medium text-white">
              {getInitials(activity.userName)}
            </span>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{activity.userName}</span>{' '}
                {getActivityDescription()}
              </p>
              {activity.cardTitle && (
                <p 
                  className="text-xs font-medium mt-0.5 truncate"
                  style={{ color: hasCard ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {activity.cardTitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span 
                className="w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-muted)' }}
              >
                {getActivityIcon()}
              </span>
              <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {getRelativeTime(activity.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
