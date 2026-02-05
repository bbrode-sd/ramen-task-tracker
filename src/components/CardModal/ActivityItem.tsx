'use client';

import { format } from 'date-fns';
import { ja, enUS } from 'date-fns/locale';
import { Activity } from '@/types';
import { useTranslation } from '@/contexts/TranslationContext';

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
  'cardModal.activity.changedTitle': 'changed the title',
  'cardModal.activity.changedTitleTranslation': 'manually translated the title ({{lang}})',
  'cardModal.activity.changedDescription': 'changed the description',
  'cardModal.activity.changedDescriptionTranslation': 'manually translated the description ({{lang}})',
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
  'cardModal.activity.changedTitle': 'タイトルを変更しました',
  'cardModal.activity.changedTitleTranslation': 'タイトル({{lang}})を手動翻訳しました',
  'cardModal.activity.changedDescription': '説明を変更しました',
  'cardModal.activity.changedDescriptionTranslation': '説明({{lang}})を手動翻訳しました',
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
  const { settings: translationSettings } = useTranslation();
  const userTextDisplayMode = translationSettings.userTextDisplayMode;
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
      case 'title_changed':
        return activity.metadata?.isManualTranslation
          ? 'cardModal.activity.changedTitleTranslation'
          : 'cardModal.activity.changedTitle';
      case 'description_changed':
        return activity.metadata?.isManualTranslation
          ? 'cardModal.activity.changedDescriptionTranslation'
          : 'cardModal.activity.changedDescription';
      default:
        return 'cardModal.activity.performedAction';
    }
  };

  const getParams = (): Record<string, string> => {
    const language = String(activity.metadata?.language ?? '');
    const langLabel = language === 'en' ? 'EN' : language === 'ja' ? 'JP' : '';
    return {
      from: String(activity.metadata?.from ?? ''),
      to: String(activity.metadata?.to ?? ''),
      checklistName: String(activity.metadata?.checklistName ?? ''),
      assigneeName: String(activity.metadata?.assigneeName ?? ''),
      dueDate: String(activity.metadata?.dueDate ?? ''),
      attachmentName: String(activity.metadata?.attachmentName ?? ''),
      lang: langLabel,
    };
  };

  const key = getActivityKey();
  const params = getParams();
  const enText = interpolate(enTranslations[key] || '', params);
  const jaText = interpolate(jaTranslations[key] || '', params);

  return (
    <div className={`grid grid-cols-1 ${userTextDisplayMode === 'both' ? 'md:grid-cols-2' : ''} gap-x-6 gap-y-1`}>
      {/* English version */}
      {(userTextDisplayMode === 'both' || userTextDisplayMode === 'en') && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">{activity.userName}</span>{' '}
          {enText}
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
            {format(activity.createdAt.toDate(), 'MMM d, h:mm a', { locale: enUS })}
          </span>
        </p>
      )}
      
      {/* Japanese version */}
      {(userTextDisplayMode === 'both' || userTextDisplayMode === 'ja') && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">{activity.userName}</span>{' '}
          {jaText}
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
            {format(activity.createdAt.toDate(), 'M月d日 H:mm', { locale: ja })}
          </span>
        </p>
      )}
    </div>
  );
}
