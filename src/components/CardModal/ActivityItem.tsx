'use client';

import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ja, enUS } from 'date-fns/locale';
import { Activity } from '@/types';
import { getAvatarColor, getInitials } from './utils';
import { useLocale } from '@/contexts/LocaleContext';

interface ActivityItemProps {
  activity: Activity;
}

/**
 * Displays a single activity log item
 */
export function ActivityItem({ activity }: ActivityItemProps) {
  const { t, locale } = useLocale();
  
  const getActivityText = () => {
    switch (activity.type) {
      case 'card_created':
        return t('cardModal.activity.createdCard');
      case 'card_moved':
        return t('cardModal.activity.movedCard', {
          from: String(activity.metadata?.from ?? ''),
          to: String(activity.metadata?.to ?? '')
        });
      case 'card_updated':
        return t('cardModal.activity.updatedCard');
      case 'card_archived':
        return t('cardModal.activity.archivedCard');
      case 'comment_added':
        return t('cardModal.activity.addedComment');
      case 'checklist_completed':
        return t('cardModal.activity.completedChecklist', {
          checklistName: String(activity.metadata?.checklistName ?? '')
        });
      case 'assignee_added':
        return t('cardModal.activity.assignedUser', {
          assigneeName: String(activity.metadata?.assigneeName ?? '')
        });
      case 'due_date_set':
        return t('cardModal.activity.setDueDate', {
          dueDate: String(activity.metadata?.dueDate ?? '')
        });
      case 'attachment_added':
        return t('cardModal.activity.attachedFile', {
          attachmentName: String(activity.metadata?.attachmentName ?? '')
        });
      default:
        return t('cardModal.activity.performedAction');
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
        <p className="text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-800 dark:text-white">{activity.userName}</span>{' '}
          {getActivityText()}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {formatDistanceToNow(activity.createdAt.toDate(), { 
            addSuffix: true,
            locale: locale === 'ja' ? ja : enUS
          })}
        </p>
      </div>
    </div>
  );
}
