import type { NativeStatusTone } from '@/components/native';
import type { NativeLocale } from '@/lib/native-i18n';
import type { TaskSummary } from '@/screens/web/types';

export type TaskBoardStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export function taskBoardStatus(status: TaskSummary['status']): TaskBoardStatus {
  if (status === 'in_progress') return 'in_progress';
  if (status === 'blocked') return 'blocked';
  if (status === 'done') return 'done';
  if (status === 'cancelled') return 'cancelled';
  return 'todo';
}

export function taskStatusLabel(
  status: TaskSummary['status'],
  locale: NativeLocale = 'en',
) {
  if (status === 'in_progress') return locale === 'ro' ? 'În lucru' : 'In progress';
  if (status === 'blocked') return locale === 'ro' ? 'Blocate' : 'Blocked';
  if (status === 'done') {
    return locale === 'ro' ? 'Finalizate' : 'Completed';
  }
  if (status === 'cancelled') return locale === 'ro' ? 'Anulate' : 'Cancelled';
  return locale === 'ro' ? 'Sarcini noi' : 'New tasks';
}

export function taskStatusTone(status: TaskSummary['status']): NativeStatusTone {
  if (status === 'in_progress') return 'info';
  if (status === 'blocked') return 'critical';
  if (status === 'done') return 'success';
  if (status === 'cancelled') return 'neutral';
  return 'warning';
}
