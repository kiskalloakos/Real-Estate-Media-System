import type { TaskSummary, UpdateTaskInput } from '../screens/web/types';

export const taskViews = [
  { id: 'all', label: 'All tasks' },
  { id: 'mine', label: 'Mine' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'week', label: 'Due this week' },
  { id: 'blocked', label: 'Blocked' },
] as const;
export type TaskView = typeof taskViews[number]['id'];
export const taskStatusLabels: Record<TaskSummary['status'], string> = {
  todo: 'New tasks', in_progress: 'In progress', blocked: 'Blocked', done: 'Delivered', cancelled: 'Cancelled',
};
export function isTaskView(value: unknown): value is TaskView {
  return taskViews.some(view => view.id === value);
}
export function isOpenTask(task: TaskSummary) {
  return task.status !== 'done' && task.status !== 'cancelled';
}
export function isOverdueTask(task: TaskSummary, now = new Date()) {
  return Boolean(isOpenTask(task) && task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
}
export function matchesTaskView(task: TaskSummary, view: TaskView, userId?: string, now = new Date()) {
  if (view === 'mine') return Boolean(userId) && task.assigneeUserId === userId;
  if (view === 'overdue') return isOverdueTask(task, now);
  if (view === 'blocked') return task.status === 'blocked';
  if (view === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return Boolean(isOpenTask(task) && task.dueAt && new Date(task.dueAt) >= start && new Date(task.dueAt) < end);
  }
  return true;
}
export function matchesTaskSearch(task: TaskSummary, query: string) {
  const text = [task.title, task.description, task.clientName, task.propertyName, task.assigneeName].filter(Boolean).join(' ').toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => text.includes(word));
}
export function taskContext(task: TaskSummary) {
  return [task.clientName, task.propertyName].filter((name, index, names) => name?.trim() && names.indexOf(name) === index).join(' · ') || 'Internal work';
}
export function taskPreviewText(task: TaskSummary) {
  const description = task.description.trim().split(/\r?\n/).find(line => line.trim())?.trim();
  return [taskContext(task), description].filter(Boolean).join(' · ');
}
export function taskDateParts(value?: string) {
  if (!value) return { dueDate: '', dueTime: '17:00' };
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return { dueDate: local.toISOString().slice(0, 10), dueTime: local.toISOString().slice(11, 16) };
}
export function taskUpdateInput(task: TaskSummary): UpdateTaskInput {
  return {
    taskId: task.id, title: task.title, description: task.description, status: task.status,
    assigneeUserId: task.assigneeUserId, clientId: task.clientId, propertyId: task.propertyId,
    priority: task.priority, visibility: task.visibility, ...taskDateParts(task.dueAt),
  };
}
export function attentionTasks(tasks: TaskSummary[], now = new Date()) {
  const priorities = { urgent: 0, high: 1, normal: 2, low: 3 };
  return tasks.filter(isOpenTask).sort((left, right) =>
    Number(isOverdueTask(right, now)) - Number(isOverdueTask(left, now))
    || Number(right.status === 'blocked') - Number(left.status === 'blocked')
    || priorities[left.priority] - priorities[right.priority]
    || (left.dueAt ? new Date(left.dueAt).getTime() : Infinity) - (right.dueAt ? new Date(right.dueAt).getTime() : Infinity)
    || left.title.localeCompare(right.title));
}
