import { useState, type FormEvent } from 'react';
import { useTabTransition } from '@/hooks/use-tab-transition';
import { Button, Modal, useToast } from '@/components/web';
import { belongsToEngagement, engagementStatusLabels } from '@/lib/engagements';
import { engagementSections } from '@/lib/project-workspace';
import { ProjectOverview } from './ProjectOverview';
import { upcomingEvents } from '@/lib/upcoming-events';
import type { PortalLocation } from '@/lib/portal-location';
import type { JobSummary, PortalActionHandlers, PortalData, ProjectTaskSection } from './types';
import { ProjectForm } from './ProjectForm';
import { TasksScreen } from './TasksScreen';
import { CalendarScreen } from './CalendarScreen';
import { ReviewsScreen } from './ReviewsScreen';
import { ProjectPagesScreen } from './ProjectPagesScreen';
import './ProjectsScreen.css';

export function EngagementWorkspace({ project, data, actions, location, onLocationChange, onOpenClient, currentUserId, agencyId }: {
  project: JobSummary;
  data: PortalData;
  actions?: PortalActionHandlers;
  location: PortalLocation;
  onLocationChange: (changes: Partial<PortalLocation>) => void;
  onOpenClient: (id: string) => void;
  currentUserId?: string;
  agencyId?: string;
}) {
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [sectionEditor, setSectionEditor] = useState<Partial<ProjectTaskSection> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const client = data.clients?.find(item => item.id === project.clientId);
  const property = data.properties?.find(item => item.id === project.propertyId);
  const agreement = data.agreements?.find(item => item.id === project.agreementId);
  const owner = data.agencyMembers?.find(item => item.userId === project.ownerUserId);
  const tasks = (data.tasks ?? []).filter(task => belongsToEngagement(task, project.id));
  const events = (data.calendarEvents ?? []).filter(event => belongsToEngagement(event, project.id));
  const taskSections = (data.projectSections ?? []).filter(item => item.jobId === project.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const section = engagementSections.find(item => item === location.projectSection) ?? 'Overview';
  const transitionRef = useTabTransition(section);
  const context = { jobId: project.id, clientId: project.clientId, propertyId: project.propertyId };
  const ready = data.projectFoundationReady !== false;
  const reviews = (data.reviews ?? []).filter(review => belongsToEngagement(review, project.id));
  const openTasks = tasks.filter(task => !['done', 'cancelled'].includes(task.status)).length;
  const upcoming = upcomingEvents(events).length;
  const editProject = (
    <Button variant="secondary" disabled={!actions?.updateJob || !ready} onClick={() => setEditing(true)}>
      Edit project
    </Button>
  );
  const saveSection = async (event: FormEvent) => {
    event.preventDefault();
    if (!sectionEditor?.name?.trim() || !actions) return;
    setSaving(true); setError('');
    try {
      await actions.saveProjectSection({ jobId: project.id, sectionId: sectionEditor.id, name: sectionEditor.name, sortOrder: sectionEditor.sortOrder ?? taskSections.length });
      setSectionEditor(null); notify('Section saved.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the section.'); }
    finally { setSaving(false); }
  };
  return <div className="engagement-workspace" ref={transitionRef}>
    {section === 'Overview' && <ProjectOverview
      actions={editProject}
      brief={project.brief}
      sections={engagementSections}
      summaries={{
        Tasks: openTasks ? `${openTasks} open` : undefined,
        Calendar: upcoming ? `${upcoming} upcoming` : undefined,
        Reviews: reviews.length ? String(reviews.length) : undefined,
        Details: engagementStatusLabels[project.status],
      }}
      onOpen={projectSection => onLocationChange({ projectSection })}
    />}
    {section === 'Pages' && <ProjectPagesScreen agencyId={agencyId} userId={currentUserId} projectId={project.id} jobs={data.jobs ?? [project]} role="admin" pageId={location.pageId} onSelectPage={pageId=>onLocationChange({pageId})}/>}
    {section === 'Tasks' && <TasksScreen role="admin" projectContext={context}
      currentUserId={currentUserId} tasks={tasks} archivedTasks={(data.archivedTasks ?? []).filter(task => belongsToEngagement(task, project.id))}
      clients={data.clients} properties={data.properties} members={data.agencyMembers} jobs={data.jobs} projectSections={data.projectSections}
      onCreateTask={ready && actions ? input => actions.createTask({ ...input, ...context }) : undefined}
      onUpdateTask={ready ? actions?.updateTask : undefined} onArchiveTask={actions?.archiveTask} onRestoreTask={actions?.restoreTask} onDeleteAttachment={actions?.deleteTaskAttachment}/>}
    {section === 'Calendar' && <CalendarScreen role="admin" projectContext={context} currentUserId={currentUserId} events={events} notes={[]} clients={data.clients} properties={property ? [property] : []} members={data.agencyMembers}
      onCreateEvent={ready && actions ? input => actions.createEvent({ ...input, ...context, workScope: project.clientId ? 'client' : 'internal' }) : undefined}
      onUpdateEvent={ready && actions ? input => actions.updateEvent({ ...input, ...context }) : undefined} onArchiveEvent={actions?.archiveEvent}/>}
    {section === 'Reviews' && <ReviewsScreen role="admin" currentUserId={currentUserId} projectContext={{jobId:project.id}} jobs={data.jobs} properties={data.properties} reviews={reviews} onComment={actions?.reviewComment} onDecision={actions?.reviewDecision} onResolve={actions?.resolveReviewComment} onUploadVersion={actions?.uploadReviewVersion} onArchive={actions?.archiveDeliverable} onUpdate={actions?.updateDeliverable} onUpload={actions ? input => actions.uploadDeliverable({...input,jobId:project.id}) : undefined}/> }
    {section === 'Details' && <>
      <section className="engagement-panel">
        <header className="engagement-panel-heading"><h1>Project details</h1>{editProject}</header>
        <dl className="engagement-details">
          <dt>Status</dt><dd>{engagementStatusLabels[project.status]}</dd>
          <dt>Client</dt><dd>{client?.name ?? 'Internal agency work'}</dd>
          <dt>Contract</dt><dd>{agreement?.title ?? 'No linked contract'}</dd>
          <dt>Property</dt><dd>{property?.name ?? 'No linked property'}</dd>
          <dt>Owner</dt><dd>{owner?.name ?? 'Unassigned'}</dd>
          {project.startsOn && <><dt>Starts</dt><dd>{project.startsOn}</dd></>}
          {project.dueOn && <><dt>Ends</dt><dd>{project.dueOn}</dd></>}
        </dl>
        {client && <Button variant="secondary" onClick={() => onOpenClient(client.id)}>Open client workspace</Button>}
      </section>
      <details className="engagement-panel aw-project-settings">
        <summary>Task sections</summary>
        {taskSections.map(item => (
          <div className="aw-project-setting" key={item.id}>
            <span>{item.name}</span>
            <Button variant="secondary" disabled={!actions || !ready} onClick={() => { setError(''); setSectionEditor(item); }}>Edit</Button>
          </div>
        ))}
        <Button icon="plus" variant="secondary" disabled={!actions || !ready} onClick={() => { setError(''); setSectionEditor({ name: '' }); }}>
          Add section
        </Button>
      </details>
    </>}
    <Modal open={editing} title="Edit project" onClose={() => setEditing(false)}>{editing && <ProjectForm project={project} data={data} onCancel={() => setEditing(false)} onSave={async input => { if (!actions) return; await actions.updateJob({ ...input, jobId: project.id }); setEditing(false); notify('Project updated.'); }}/>}</Modal>
    <Modal open={Boolean(sectionEditor)} title={sectionEditor?.id ? 'Edit section' : 'New section'} onClose={() => { if (!saving) setSectionEditor(null); }}>
      <form className="rm-action-form" onSubmit={saveSection}>{error && <p role="alert" className="rm-feedback rm-feedback--error">{error}</p>}<label className="rm-field"><span>Section name</span><input autoFocus data-modal-autofocus required disabled={saving} value={sectionEditor?.name ?? ''} placeholder="e.g. November, Trial, Launch" onChange={event => setSectionEditor(current => ({ ...current, name: event.target.value }))}/></label><footer className="rm-dialog-actions">
        {sectionEditor?.id && <Button disabled={saving} variant="secondary" onClick={async () => { if (!actions || !sectionEditor.id || !window.confirm('Remove this section? Its tasks will remain in the project, without a section.')) return; setSaving(true); setError(''); try { await actions.deleteProjectSection(sectionEditor.id); setSectionEditor(null); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not remove the section.'); } finally { setSaving(false); } }}>Remove section</Button>}
        <Button disabled={saving} variant="secondary" onClick={() => setSectionEditor(null)}>Cancel</Button><Button disabled={saving || !sectionEditor?.name?.trim()} type="submit">{saving ? 'Saving…' : 'Save section'}</Button></footer></form>
    </Modal>
  </div>;
}
