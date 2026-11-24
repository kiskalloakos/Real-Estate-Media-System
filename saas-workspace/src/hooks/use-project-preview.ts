import { useMemo } from 'react';
import { useBrowserPersistedState } from './use-browser-persisted-state';
import { demoEvents, demoTasks } from '@/screens/web/demoData';
import { handoffTaskOptions } from '@/lib/task-workspace';
import type { PortalNotification } from '@/components/web';
import type { CalendarEvent, CreateTaskInput, JobSummary, PortalActionHandlers, PortalData, ProjectTaskSection, TaskSummary } from '@/screens/web/types';

type PreviewState = { jobs: JobSummary[]; projectSections: ProjectTaskSection[]; tasks: TaskSummary[]; calendarEvents: CalendarEvent[]; handoffNotifications: PortalNotification[] };
const initial: PreviewState = {
  handoffNotifications: [],
  jobs: [
    { id: 'preview-social', clientId: 'client-cabana', name: 'Cabana The One social media', kind: 'content_campaign', brief: 'An ongoing social media engagement. Plan each batch of content inside this project.', status: 'active', startsOn: '2026-09-01', dueOn: '2027-01-31', ownerUserId: 'preview-producer' },
    { id: 'preview-website', clientId: 'client-cabana', name: 'Cabana The One website', kind: 'content_campaign', brief: 'A separate website engagement for the same client.', status: 'planned' },
    { id: 'preview-internal', name: 'Agency brand refresh', kind: 'internal', brief: 'Our own positioning, identity, and launch.', status: 'active' },
  ],
  projectSections: [{ id: 'preview-section-one', jobId: 'preview-social', name: 'First shoot', sortOrder: 0 }, { id: 'preview-section-two', jobId: 'preview-social', name: 'Next content batch', sortOrder: 1 }],
  tasks: [
    ...demoTasks,
    { id: 'preview-film', jobId: 'preview-social', sectionId: 'preview-section-one', productionPhase: 'production', title: 'Film the first hero reel', description: 'Capture the agreed shots and upload the footage.', clientId: 'client-cabana', clientName: 'Cabana The One', propertyName: 'Client account', assigneeName: 'Alex Morgan', assigneeUserId: 'preview-producer', createdAt: '2026-11-24T09:00:00Z', createdByName: 'Alex Morgan', priority: 'normal', status: 'todo', visibility: 'team' },
    { id: 'preview-edit', waitsForTaskId: 'preview-film', jobId: 'preview-social', sectionId: 'preview-section-one', productionPhase: 'post-production', title: 'Edit the first hero reel', description: 'Build the first cut from the selected footage.', clientId: 'client-cabana', clientName: 'Cabana The One', propertyName: 'Client account', assigneeName: 'Sam Lee', assigneeUserId: 'preview-editor', createdAt: '2026-11-24T09:00:00Z', createdByName: 'Alex Morgan', priority: 'normal', status: 'todo', visibility: 'team' },
    { id: 'preview-brief', jobId: 'preview-social', sectionId: 'preview-section-two', productionPhase: 'pre-production', title: 'Prepare the next shoot brief', description: 'Define the shots and message for the next batch.', clientId: 'client-cabana', clientName: 'Cabana The One', propertyName: 'Client account', assigneeName: 'Unassigned', createdAt: '2026-11-24T09:00:00Z', createdByName: 'Alex Morgan', priority: 'normal', status: 'todo', visibility: 'team' },
  ],
  calendarEvents: demoEvents,
};

/** Sample-only mutations never use the configured backend or production records. */
export function useProjectPreview(enabled: boolean) {
  const [state, setState] = useBrowserPersistedState<PreviewState>('rm:engagement-preview:v2', initial);
  const data = useMemo<PortalData>(() => enabled ? {
    ...state, tasks: state.tasks.filter(task => !task.archivedAt), archivedTasks: state.tasks.filter(task => task.archivedAt), projectFoundationReady: true,
    agreements: [{ id: 'preview-agreement-social', clientId: 'client-cabana', clientName: 'Cabana The One', title: 'Social media agreement', startsOn: '2026-09-01', endsOn: '2027-01-31', status: 'active', currency: 'EUR', monthlyAmount: 0, totalValue: 0 }],
    agencyMembers: [{ id: 'preview-producer', userId: 'preview-producer', name: 'Alex Morgan', email: 'alex@example.com', role: 'admin', status: 'active' }, { id: 'preview-editor', userId: 'preview-editor', name: 'Sam Lee', email: 'sam@example.com', role: 'team_member', status: 'active' }],
  } : {}, [enabled, state]);
  const requirePreview = () => { if (!enabled) throw new Error('Sample actions are unavailable in a live workspace.'); };
  const taskFields = (input: CreateTaskInput) => ({
    ...input, attachments: [],
    dueAt: input.dueDate ? new Date(`${input.dueDate}T${input.dueTime || '17:00'}`).toISOString() : undefined,
    assigneeName: input.assigneeUserId === 'preview-editor' ? 'Sam Lee' : input.assigneeUserId ? 'Alex Morgan' : 'Unassigned', clientName: input.clientId ? 'Cabana The One' : 'Internal', propertyName: input.propertyId ? 'Property' : 'Agency',
  });
  const validateHandoff = (task: TaskSummary) => {
    if (!task.waitsForTaskId) return;
    const preceding = state.tasks.find(item => item.id === task.waitsForTaskId);
    const previous = state.tasks.find(item => item.id === task.id);
    if (!task.jobId || !handoffTaskOptions(state.tasks, task.jobId, task.id).some(item => item.id === task.waitsForTaskId)) throw new Error('Choose a preceding task in the same project without creating a loop.');
    if (preceding?.status !== 'done' && ['in_progress', 'done'].includes(task.status) && previous?.status !== task.status) throw new Error('Complete the preceding task before starting or completing this task.');
  };
  const withHandoffs = (tasks: TaskSummary[]): PreviewState => {
    const notifications = [...state.handoffNotifications];
    const updated = tasks.map(task => {
      const preceding = tasks.find(item => item.id === task.waitsForTaskId);
      const handoffReadyAt = preceding?.status === 'done' && !preceding.archivedAt ? preceding.completedAt ?? preceding.createdAt : undefined;
      const notificationId = `handoff:${task.id}:${task.waitsForTaskId}:${handoffReadyAt}:${task.assigneeUserId}`;
      if (task.waitsForTaskId && handoffReadyAt && task.assigneeUserId && !task.archivedAt && ['todo', 'blocked'].includes(task.status) && !notifications.some(item => item.id === notificationId)) {
        notifications.unshift({ id: notificationId, title: `Task ready: ${task.title}`, body: `Ready for ${task.assigneeName}. The preceding task is complete.`, screen: 'tasks', taskId: task.id, read: false, timeLabel: 'Just now' });
      }
      return { ...task, handoffReadyAt };
    });
    return { ...state, tasks: updated, handoffNotifications: notifications };
  };
  const actions: Pick<PortalActionHandlers, 'createJob' | 'updateJob' | 'saveProjectSection' | 'deleteProjectSection' | 'createTask' | 'updateTask' | 'archiveTask' | 'restoreTask' | 'createEvent' | 'updateEvent' | 'archiveEvent'> = {
    createJob: async input => { requirePreview(); setState(current => ({ ...current, jobs: [...current.jobs, { ...input, id: crypto.randomUUID(), kind: input.clientId ? input.kind : 'internal', status: input.status ?? 'planned' }] })); },
    updateJob: async input => { requirePreview(); setState(current => ({ ...current, jobs: current.jobs.map(job => job.id === input.jobId ? { ...job, ...input, kind: input.clientId ? input.kind : 'internal', status: input.status ?? job.status } : job) })); },
    saveProjectSection: async input => {
      requirePreview(); const section = { id: input.sectionId ?? crypto.randomUUID(), jobId: input.jobId, name: input.name.trim(), sortOrder: input.sortOrder };
      if (!section.name) throw new Error('Give the section a name.');
      setState(current => ({ ...current, projectSections: input.sectionId ? current.projectSections.map(item => item.id === input.sectionId ? section : item) : [...current.projectSections, section] }));
    },
    deleteProjectSection: async id => { requirePreview(); setState(current => ({ ...current, projectSections: current.projectSections.filter(item => item.id !== id), tasks: current.tasks.map(task => task.sectionId === id ? { ...task, sectionId: undefined } : task) })); },
    createTask: async input => { requirePreview(); const task: TaskSummary = { ...taskFields(input), id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdByName: 'Alex Morgan', status: 'todo' }; validateHandoff(task); setState(withHandoffs([...state.tasks, task])); },
    updateTask: async input => { requirePreview(); const previous = state.tasks.find(task => task.id === input.taskId); if (!previous) throw new Error('Task is unavailable.'); const task = { ...previous, ...taskFields(input), waitsForTaskId: input.waitsForTaskId ?? previous.waitsForTaskId, status: input.status, completedAt: input.status === 'done' ? previous.completedAt ?? new Date().toISOString() : undefined }; validateHandoff(task); setState(withHandoffs(state.tasks.map(item => item.id === task.id ? task : item))); },
    archiveTask: async id => { requirePreview(); setState(withHandoffs(state.tasks.map(task => task.id === id ? { ...task, archivedAt: new Date().toISOString() } : task))); },
    restoreTask: async id => { requirePreview(); setState(withHandoffs(state.tasks.map(task => task.id === id ? { ...task, archivedAt: undefined } : task))); },
    createEvent: async input => { requirePreview(); setState(current => ({ ...current, calendarEvents: [...current.calendarEvents, { ...input, id: crypto.randomUUID(), assignee: 'Alex Morgan', propertyName: input.propertyId ? 'Property' : 'Agency' }] })); },
    updateEvent: async input => { requirePreview(); setState(current => ({ ...current, calendarEvents: current.calendarEvents.map(event => event.id === input.eventId ? { ...event, ...input } : event) })); },
    archiveEvent: async id => { requirePreview(); setState(current => ({ ...current, calendarEvents: current.calendarEvents.filter(event => event.id !== id) })); },
  };
  return { data, actions, notifications: enabled ? state.handoffNotifications : [] };
}
