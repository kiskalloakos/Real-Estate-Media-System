import { useMemo } from 'react';
import { useBrowserPersistedState } from './use-browser-persisted-state';
import { demoEvents, demoTasks } from '@/screens/web/demoData';
import type { CalendarEvent, CreateTaskInput, JobSummary, PortalActionHandlers, PortalData, ProjectTaskSection, TaskSummary } from '@/screens/web/types';

type PreviewState = { jobs: JobSummary[]; projectSections: ProjectTaskSection[]; tasks: TaskSummary[]; calendarEvents: CalendarEvent[] };
const initial: PreviewState = {
  jobs: [
    { id: 'preview-social', clientId: 'client-cabana', name: 'Cabana The One social media', kind: 'content_campaign', brief: 'An ongoing social media engagement. Plan each batch of content inside this project.', status: 'active', startsOn: '2026-09-01', dueOn: '2027-01-31', ownerUserId: 'preview-producer' },
    { id: 'preview-website', clientId: 'client-cabana', name: 'Cabana The One website', kind: 'content_campaign', brief: 'A separate website engagement for the same client.', status: 'planned' },
    { id: 'preview-internal', name: 'Agency brand refresh', kind: 'internal', brief: 'Our own positioning, identity, and launch.', status: 'active' },
  ],
  projectSections: [{ id: 'preview-section-one', jobId: 'preview-social', name: 'First shoot', sortOrder: 0 }, { id: 'preview-section-two', jobId: 'preview-social', name: 'Next content batch', sortOrder: 1 }],
  tasks: [
    ...demoTasks,
    { id: 'preview-edit', jobId: 'preview-social', sectionId: 'preview-section-one', productionPhase: 'post-production', title: 'Edit the first hero reel', description: 'Build the first cut from the selected footage.', clientId: 'client-cabana', clientName: 'Cabana The One', propertyName: 'Client account', assigneeName: 'Alex Morgan', assigneeUserId: 'preview-producer', createdAt: '2026-11-24T09:00:00Z', createdByName: 'Alex Morgan', priority: 'normal', status: 'in_progress', visibility: 'team' },
    { id: 'preview-brief', jobId: 'preview-social', sectionId: 'preview-section-two', productionPhase: 'pre-production', title: 'Prepare the next shoot brief', description: 'Define the shots and message for the next batch.', clientId: 'client-cabana', clientName: 'Cabana The One', propertyName: 'Client account', assigneeName: 'Unassigned', createdAt: '2026-11-24T09:00:00Z', createdByName: 'Alex Morgan', priority: 'normal', status: 'todo', visibility: 'team' },
  ],
  calendarEvents: demoEvents,
};

/** Sample-only mutations never use the configured backend or production records. */
export function useProjectPreview(enabled: boolean) {
  const [state, setState] = useBrowserPersistedState<PreviewState>('rm:engagement-preview:v1', initial);
  const data = useMemo<PortalData>(() => enabled ? {
    ...state, tasks: state.tasks.filter(task => !task.archivedAt), archivedTasks: state.tasks.filter(task => task.archivedAt), projectFoundationReady: true,
    agreements: [{ id: 'preview-agreement-social', clientId: 'client-cabana', clientName: 'Cabana The One', title: 'Social media agreement', startsOn: '2026-09-01', endsOn: '2027-01-31', status: 'active', currency: 'EUR', monthlyAmount: 0, totalValue: 0 }],
    agencyMembers: [{ id: 'preview-producer', userId: 'preview-producer', name: 'Alex Morgan', email: 'alex@example.com', role: 'admin', status: 'active' }],
  } : {}, [enabled, state]);
  const requirePreview = () => { if (!enabled) throw new Error('Sample actions are unavailable in a live workspace.'); };
  const taskFields = (input: CreateTaskInput) => ({
    ...input, attachments: [],
    dueAt: input.dueDate ? new Date(`${input.dueDate}T${input.dueTime || '17:00'}`).toISOString() : undefined,
    assigneeName: input.assigneeUserId ? 'Alex Morgan' : 'Unassigned', clientName: input.clientId ? 'Cabana The One' : 'Internal', propertyName: input.propertyId ? 'Property' : 'Agency',
  });
  const actions: Pick<PortalActionHandlers, 'createJob' | 'updateJob' | 'saveProjectSection' | 'deleteProjectSection' | 'createTask' | 'updateTask' | 'archiveTask' | 'restoreTask' | 'createEvent' | 'updateEvent' | 'archiveEvent'> = {
    createJob: async input => { requirePreview(); setState(current => ({ ...current, jobs: [...current.jobs, { ...input, id: crypto.randomUUID(), kind: input.clientId ? input.kind : 'internal', status: input.status ?? 'planned' }] })); },
    updateJob: async input => { requirePreview(); setState(current => ({ ...current, jobs: current.jobs.map(job => job.id === input.jobId ? { ...job, ...input, kind: input.clientId ? input.kind : 'internal', status: input.status ?? job.status } : job) })); },
    saveProjectSection: async input => {
      requirePreview(); const section = { id: input.sectionId ?? crypto.randomUUID(), jobId: input.jobId, name: input.name.trim(), sortOrder: input.sortOrder };
      if (!section.name) throw new Error('Give the section a name.');
      setState(current => ({ ...current, projectSections: input.sectionId ? current.projectSections.map(item => item.id === input.sectionId ? section : item) : [...current.projectSections, section] }));
    },
    deleteProjectSection: async id => { requirePreview(); setState(current => ({ ...current, projectSections: current.projectSections.filter(item => item.id !== id), tasks: current.tasks.map(task => task.sectionId === id ? { ...task, sectionId: undefined } : task) })); },
    createTask: async input => { requirePreview(); setState(current => ({ ...current, tasks: [...current.tasks, { ...taskFields(input), id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdByName: 'Alex Morgan', status: 'todo' }] })); },
    updateTask: async input => { requirePreview(); setState(current => ({ ...current, tasks: current.tasks.map(task => task.id === input.taskId ? { ...task, ...taskFields(input), status: input.status } : task) })); },
    archiveTask: async id => { requirePreview(); setState(current => ({ ...current, tasks: current.tasks.map(task => task.id === id ? { ...task, archivedAt: new Date().toISOString() } : task) })); },
    restoreTask: async id => { requirePreview(); setState(current => ({ ...current, tasks: current.tasks.map(task => task.id === id ? { ...task, archivedAt: undefined } : task) })); },
    createEvent: async input => { requirePreview(); setState(current => ({ ...current, calendarEvents: [...current.calendarEvents, { ...input, id: crypto.randomUUID(), assignee: 'Alex Morgan', propertyName: input.propertyId ? 'Property' : 'Agency' }] })); },
    updateEvent: async input => { requirePreview(); setState(current => ({ ...current, calendarEvents: current.calendarEvents.map(event => event.id === input.eventId ? { ...event, ...input } : event) })); },
    archiveEvent: async id => { requirePreview(); setState(current => ({ ...current, calendarEvents: current.calendarEvents.filter(event => event.id !== id) })); },
  };
  return { data, actions };
}
