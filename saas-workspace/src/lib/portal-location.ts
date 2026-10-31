import type { PortalScreenKey } from '../components/web/PortalShell';
import { isTaskView, type TaskView } from './task-workspace';

export interface PortalLocation {
  screen: PortalScreenKey;
  taskId?: string;
  clientId?: string;
  taskView?: TaskView;
  taskQuery?: string;
  taskAssignee?: string;
}
const routeKeys = ['screen', 'task', 'client', 'view', 'q', 'assignee'];
export function readPortalLocation(search: string, fallback: PortalScreenKey, allowed: readonly PortalScreenKey[]): PortalLocation {
  const params = new URLSearchParams(search);
  const requested = params.get('screen') as PortalScreenKey;
  const screen = allowed.includes(requested) ? requested : fallback;
  return {
    screen,
    ...(screen === 'tasks' ? {
      taskId: params.get('task') || undefined,
      taskView: isTaskView(params.get('view')) ? params.get('view') as TaskView : 'all',
      taskQuery: params.get('q') ?? '',
      taskAssignee: params.get('assignee') || 'all',
    } : {}),
    ...(screen === 'clients' ? { clientId: params.get('client') || undefined } : {}),
  };
}
export function portalLocationUrl(current: string, location: PortalLocation) {
  const url = new URL(current);
  routeKeys.forEach(key => url.searchParams.delete(key));
  url.searchParams.set('screen', location.screen);
  if (location.screen === 'tasks') {
    if (location.taskId) url.searchParams.set('task', location.taskId);
    if (location.taskView && location.taskView !== 'all') url.searchParams.set('view', location.taskView);
    if (location.taskQuery) url.searchParams.set('q', location.taskQuery);
    if (location.taskAssignee && location.taskAssignee !== 'all') url.searchParams.set('assignee', location.taskAssignee);
  }
  if (location.screen === 'clients' && location.clientId) url.searchParams.set('client', location.clientId);
  return `${url.pathname}${url.search}${url.hash}`;
}
