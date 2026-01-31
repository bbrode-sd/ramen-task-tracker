'use client';

import Image from 'next/image';
import { format } from 'date-fns';
import { ja, enUS } from 'date-fns/locale';
import { Activity } from '@/types';
import { getAvatarColor, getInitials } from './utils';
import { useLocale } from '@/contexts/LocaleContext';

// English translations for activities
const enTranslations: Record<string, string> = {
  'cardModal.activity.createdCard': 'created this card',
  'cardModal.activity.movedCard': 'moved this card from {{from}} to {{to}}',
  'cardModal.activity.updatedCard': 'updated this card',
  'cardModal.activity.archivedCard': 'archived this card',
  'cardModal.activity.addedComment': 'added a comment',
  'cardModal.activity.completedChecklist': 'completed checklist "{{checklistName}}"',
  'cardModal.activity.assignedUser': 'assigned {{assigneeName}}',
  'cardModal.activity.setDueDate': 'set due date to {{dueDate}}',
  'cardModal.activity.attachedFile': 'attached {{attachmentName}}',
  'cardModal.activity.performedAction': 'performed an action',
};

// Japanese translations for activities
const jaTranslations: Record<string, string> = {
  'cardModal.activity.createdCard': 'このカードを作成しました',
  'cardModal.activity.movedCard': 'このカードを{{from}}から{{to}}に移動しました',
  'cardModal.activity.updatedCard': 'このカードを更新しました',
  'cardModal.activity.archivedCard': 'このカードをアーカイブしました',
  'cardModal.activity.addedComment': 'コメントを追加しました',
  'cardModal.activity.completedChecklist': 'チェックリスト「{{checklistName}}」を完了しました',
  'cardModal.activity.assignedUser': '{{assigneeName}}を担当に設定しました',
  'cardModal.activity.setDueDate': '期限を{{dueDate}}に設定しました',
  'cardModal.activity.attachedFile': '{{attachmentName}}を添付しました',
  'cardModal.activity.performedAction': 'アクションを実行しました',
};

// Helper to interpolate translation strings
function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] || '');
}

interface ActivityItemProps {
  activity: Activity;
}

/**
 * Displays a bilingual activity log item (English and Japanese side by side)
 */
export function ActivityItem({ activity }: ActivityItemProps) {
  const { locale } = useLocale();
  
  const getActivityKey = () => {
    switch (activity.type) {
      case 'card_created':
        return 'cardModal.activity.createdCard';
      case 'card_moved':
        return 'cardModal.activity.movedCard';
      case 'card_updated':
        return 'cardModal.activity.updatedCard';
      case 'card_archived':
        return 'cardModal.activity.archivedCard';
      case 'comment_added':
        return 'cardModal.activity.addedComment';
      case 'checklist_completed':
        return 'cardModal.activity.completedChecklist';
      case 'assignee_added':
        return 'cardModal.activity.assignedUser';
      case 'due_date_set':
        return 'cardModal.activity.setDueDate';
      case 'attachment_added':
        return 'cardModal.activity.attachedFile';
      default:
        return 'cardModal.activity.performedAction';
    }
  };

  const getParams = (): Record<string, string> => {
    return {
      from: String(activity.metadata?.from ?? ''),
      to: String(activity.metadata?.to ?? ''),
      checklistName: String(activity.metadata?.checklistName ?? ''),
      assigneeName: String(activity.metadata?.assigneeName ?? ''),
      dueDate: String(activity.metadata?.dueDate ?? ''),
      attachmentName: String(activity.metadata?.attachmentName ?? ''),
    };
  };

  const key = getActivityKey();
  const params = getParams();
  const enText = interpolate(enTranslations[key] || '', params);
  const jaText = interpolate(jaTranslations[key] || '', params);

  const renderHeader = (lang: 'en' | 'ja') => (
    <div className="flex items-center gap-2 mb-2">
      {activity.userPhoto ? (
        <Image
          src={activity.userPhoto}
          alt={activity.userName}
          width={36}
          height={36}
          className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-slate-100 dark:ring-slate-800/80 object-cover"
        />
      ) : (
        <div 
          className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(activity.userId)} flex items-center justify-center flex-shrink-0 shadow-sm`}
        >
          <span className="text-sm font-medium text-white">{getInitials(activity.userName)}</span>
        </div>
      )}
      <span className="text-sm font-semibold text-slate-800 dark:text-white">
        {activity.userName}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-400">
        {format(
          activity.createdAt.toDate(), 
          lang === 'ja' ? 'yyyy年M月d日 H:mm' : 'MMM d, yyyy h:mm a', 
          { locale: lang === 'ja' ? ja : enUS }
        )}
      </span>
    </div>
  );

  return (
    <div className="flex gap-3 group">
      <div className="flex-1 min-w-0">
        {/* Bilingual activity display - side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* English version */}
          <div>
            {renderHeader('en')}
            <div className="bg-slate-50 dark:bg-slate-900/70 border border-blue-200 dark:border-blue-700/70 rounded-xl px-4 py-3 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80 dark:bg-blue-300/80" />
                  EN
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{enText}</p>
            </div>
          </div>
          
          {/* Japanese version */}
          <div>
            {renderHeader('ja')}
            <div className="bg-slate-50 dark:bg-slate-900/70 border border-red-200 dark:border-red-700/70 rounded-xl px-4 py-3 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200 bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 dark:bg-red-300/80" />
                  JP
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{jaText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
