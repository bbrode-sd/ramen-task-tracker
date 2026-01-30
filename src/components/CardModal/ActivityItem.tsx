'use client';

import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Activity } from '@/types';
import { getAvatarColor, getInitials } from './utils';

interface ActivityItemProps {
  activity: Activity;
}

/**
 * Displays a single activity log item
 */
export function ActivityItem({ activity }: ActivityItemProps) {
  const getActivityText = () => {
    switch (activity.type) {
      case 'card_created':
        return 'created this card';
      case 'card_moved':
        return `moved this card from ${activity.metadata?.from} to ${activity.metadata?.to}`;
      case 'card_updated':
        return 'updated this card';
      case 'card_archived':
        return 'archived this card';
      case 'comment_added':
        return 'added a comment';
      case 'checklist_completed':
        return `completed checklist "${activity.metadata?.checklistName}"`;
      case 'assignee_added':
        return `assigned ${activity.metadata?.assigneeName}`;
      case 'due_date_set':
        return `set due date to ${activity.metadata?.dueDate}`;
      case 'attachment_added':
        return `attached ${activity.metadata?.attachmentName}`;
      default:
        return 'performed an action';
    }
  };

  return (
    <div className="flex items-start gap-3 text-sm">
      {activity.userPhoto ? (
        <Image
          src={activity.userPhoto}
          alt={activity.userName}
          width={28}
          height={28}
          className="w-7 h-7 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div 
          className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(activity.userId)} flex items-center justify-center flex-shrink-0`}
        >
          <span className="text-[10px] font-medium text-white">{getInitials(activity.userName)}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-slate-600">
          <span className="font-medium text-slate-800">{activity.userName}</span>{' '}
          {getActivityText()}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
