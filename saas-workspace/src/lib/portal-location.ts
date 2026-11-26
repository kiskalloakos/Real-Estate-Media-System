import { engagementStatusLabels } from './engagements';
import type { JobSummary } from '../screens/web/types';
import type { PortalScreenKey } from '../components/web/PortalShell';
import { isTaskView, type TaskView } from './task-workspace';
import { projectSections, projectStages, type ProjectSection, type ProjectStage } from './project-workspace';

export interface PortalLocation {
  screen: PortalScreenKey;
  taskId?: string;
  clientId?: string;
  projectId?: string;
  pageId?: string;
  projectStatus?: JobSummary['status'];
  projectStage?: ProjectStage;
  projectSection?: ProjectSection;
  taskView?: TaskView;
  taskQuery?: string;
  taskAssignee?: string;
}
const routeKeys = ['screen', 'task', 'client', 'project', 'stage', 'status', 'section', 'view', 'q', 'assignee', 'page'];
export function readPortalLocation(search: string, fallback: PortalScreenKey, allowed: readonly PortalScreenKey[]): PortalLocation {
  const params = new URLSearchParams(search);
  const requested = params.get('screen') as PortalScreenKey;
  const screen = allowed.includes(requested) ? requested : fallback;
  const clientId = params.get('client') || undefined;
  const hasProjectContext = screen === 'projects' || (screen === 'clients' && Boolean(clientId));
  const projectId = hasProjectContext ? params.get('project') : undefined;
  const projectStage = hasProjectContext ? projectStages.find(stage => stage === params.get('stage')) : undefined;
  const projectSection = hasProjectContext ? projectSections.find(section => section === params.get('section')) : undefined;
  return {
    screen,
    ...(['documents','projects'].includes(screen) && params.get('page') ? {pageId: params.get('page')!} : {}),
    ...(screen === 'tasks' ? {
      taskId: params.get('task') || undefined,
      taskView: isTaskView(params.get('view')) ? params.get('view') as TaskView : 'all',
      taskQuery: params.get('q') ?? '',
      taskAssignee: params.get('assignee') || 'all',
    } : {}),
    ...(hasProjectContext && clientId ? { clientId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(projectStage ? { projectStage } : {}),
    ...(projectSection ? { projectSection } : {}),
    ...(screen === 'projects' ? {
      ...(params.get('status') && Object.hasOwn(engagementStatusLabels, params.get('status')!) ? { projectStatus: params.get('status') as JobSummary['status'] } : {}),
    } : {}),
  };
}
export function portalLocationUrl(current: string, location: PortalLocation) {
  const url = new URL(current);
  routeKeys.forEach(key => url.searchParams.delete(key));
  url.searchParams.set('screen', location.screen);
  if (['documents','projects'].includes(location.screen) && location.pageId) url.searchParams.set('page',location.pageId);
  if (location.screen === 'tasks') {
    if (location.taskId) url.searchParams.set('task', location.taskId);
    if (location.taskView && location.taskView !== 'all') url.searchParams.set('view', location.taskView);
    if (location.taskQuery) url.searchParams.set('q', location.taskQuery);
    if (location.taskAssignee && location.taskAssignee !== 'all') url.searchParams.set('assignee', location.taskAssignee);
  }
  if (location.screen === 'projects' || (location.screen === 'clients' && location.clientId)) {
    if (location.clientId) url.searchParams.set('client', location.clientId);
    if (location.projectId) url.searchParams.set('project', location.projectId);
    if (location.projectStage) url.searchParams.set('stage', location.projectStage);
    if (location.screen === 'projects' && location.projectStatus) url.searchParams.set('status', location.projectStatus);
    if (location.projectSection) url.searchParams.set('section', location.projectSection);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
