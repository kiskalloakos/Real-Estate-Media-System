import type { CreateJobInput, JobSummary, ProjectTaskSection, TaskProductionPhase, TaskSummary } from '../screens/web/types';

export const engagementStatuses = ['planned', 'active', 'on_hold', 'complete'] as const;
export const engagementStatusLabels: Record<JobSummary['status'], string> = {
  draft: 'Draft', planned: 'Planned', active: 'Active', on_hold: 'On hold', complete: 'Completed', cancelled: 'Cancelled',
};
export const taskProductionPhases: TaskProductionPhase[] = ['pre-production', 'production', 'post-production'];
export const taskPhaseLabels: Record<TaskProductionPhase, string> = {
  'pre-production': 'Pre-production', production: 'Production', 'post-production': 'Post-production',
};
export function projectFormValues(project?: JobSummary): CreateJobInput {
  return {
    name: project?.name ?? '', brief: project?.brief ?? '', clientId: project?.clientId,
    propertyId: project?.propertyId, agreementId: project?.agreementId, ownerUserId: project?.ownerUserId,
    kind: project?.kind ?? 'content_campaign', status: project?.status ?? 'planned',
    startsOn: project?.startsOn ?? '', dueOn: project?.dueOn ?? '',
  };
}

/** Only an explicit project link owns a record; a shared client/property is not sufficient. */
export function belongsToEngagement(record: { jobId?: string }, jobId: string) {
  return record.jobId === jobId;
}

export function projectTaskGroups(tasks: TaskSummary[], sections: ProjectTaskSection[], jobId: string) {
  const owned = tasks.filter(task => belongsToEngagement(task, jobId));
  const ordered = sections.filter(section => section.jobId === jobId)
    .slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const known = new Set(ordered.map(section => section.id));
  return [
    { id: '', name: 'Unsectioned', tasks: owned.filter(task => !task.sectionId || !known.has(task.sectionId)) },
    ...ordered.map(section => ({ ...section, tasks: owned.filter(task => task.sectionId === section.id) })),
  ];
}
