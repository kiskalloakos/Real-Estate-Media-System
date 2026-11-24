import { useState, type FormEvent } from 'react';
import { Button, Icon, Modal, useToast } from '@/components/web';
import { belongsToEngagement, engagementStatusLabels, projectTaskGroups, taskPhaseLabels, taskProductionPhases } from '@/lib/engagements';
import { upcomingEvents } from '@/lib/upcoming-events';
import type { PortalLocation } from '@/lib/portal-location';
import type { JobSummary, PortalActionHandlers, PortalData, ProjectTaskSection } from './types';
import { ProjectForm } from './ProjectForm';
import { TasksScreen } from './TasksScreen';
import { CalendarScreen } from './CalendarScreen';
import { ReviewsScreen } from './ReviewsScreen';
import './ProjectsScreen.css';

const sections = ['Overview', 'Tasks', 'Calendar', 'Reviews', 'Details'] as const;

export function EngagementWorkspace({ project, data, actions, location, onLocationChange, onBack, onOpenClient, currentUserId }: {
  project: JobSummary;
  data: PortalData;
  actions?: PortalActionHandlers;
  location: PortalLocation;
  onLocationChange: (changes: Partial<PortalLocation>) => void;
  onBack: () => void;
  onOpenClient: (id: string) => void;
  currentUserId?: string;
}) {
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [sectionEditor, setSectionEditor] = useState<Partial<ProjectTaskSection> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const client = data.clients?.find(item => item.id === project.clientId);
  const property = data.properties?.find(item => item.id === project.propertyId);
  const agreement = data.agreements?.find(item => item.id === project.agreementId);
  const owner = data.agencyMembers?.find(item => item.userId === project.ownerUserId);
  const tasks = (data.tasks ?? []).filter(task => belongsToEngagement(task, project.id));
  const events = (data.calendarEvents ?? []).filter(event => belongsToEngagement(event, project.id));
  const groups = projectTaskGroups(tasks, data.projectSections ?? [], project.id);
  const taskSections = (data.projectSections ?? []).filter(item => item.jobId === project.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const section = sections.find(item => item === location.projectSection) ?? 'Overview';
  const context = { jobId: project.id, clientId: project.clientId, propertyId: project.propertyId };
  const ready = data.projectFoundationReady !== false;
  const activeGroup = groups.find(group => group.id === selectedGroup);
  const selectedTasks = (selectedGroup === 'all' ? tasks : activeGroup?.tasks ?? [])
    .filter(task => selectedPhase === 'all' || task.productionPhase === selectedPhase);
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
  return <div className="engagement-workspace">
    <header className="engagement-heading"><div><div className="project-path"><button type="button" onClick={onBack}>Projects</button><Icon name="chevron-right" size={14}/><span>{client?.name ?? 'Internal agency work'}</span></div><h1>{project.name}</h1><p><span className="engagement-status">{engagementStatusLabels[project.status]}</span><span>{owner?.name ?? 'No owner assigned'}</span>{project.startsOn && <span>From {project.startsOn}</span>}{project.dueOn && <span>Until {project.dueOn}</span>}</p></div><Button variant="secondary" disabled={!actions?.updateJob || !ready} onClick={() => setEditing(true)}>Edit project</Button></header>
    <nav className="projects-filters" aria-label="Project sections">{sections.map(item => <button type="button" key={item} aria-pressed={section === item} onClick={() => onLocationChange({ projectSection: item })}>{item}</button>)}</nav>
    {section === 'Overview' && <>
      <section className="engagement-panel"><h2>Project brief</h2><p className="engagement-brief">{project.brief || 'Add the goals and scope of this engagement.'}</p><div className="engagement-metrics"><span><strong>{tasks.filter(task => !['done', 'cancelled'].includes(task.status)).length}</strong> Open tasks</span><span><strong>{tasks.filter(task => task.status === 'blocked').length}</strong> Blocked</span><span><strong>{upcomingEvents(events).length}</strong> Upcoming events</span></div></section>
      <section className="engagement-panel"><div className="engagement-panel-heading"><div><h2>Work sections</h2><p>Use any names that suit this engagement. Sections are optional.</p></div><Button icon="plus" disabled={!actions || !ready} onClick={() => { setError(''); setSectionEditor({ name: '' }); }}>Add section</Button></div>
        {groups.filter(group => group.id || group.tasks.length).map(group => <div className="engagement-section-row" key={group.id}><button type="button" onClick={() => { setSelectedGroup(group.id); onLocationChange({ projectSection: 'Tasks' }); }}><strong>{group.name}</strong><span>{group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'} · {group.tasks.filter(task => task.status === 'done').length} completed</span></button>{group.id && <button type="button" aria-label={`Edit section ${group.name}`} onClick={() => { setError(''); setSectionEditor(taskSections.find(item => item.id === group.id) ?? null); }}><Icon name="settings" size={17}/></button>}</div>)}
        {!taskSections.length && !tasks.length && <p className="engagement-empty">Start with tasks, or create a section such as “November”, “Trial”, or “Launch”.</p>}
      </section>
      <section className="engagement-panel"><h2>Production work</h2><p>Tasks in different production phases can run at the same time.</p><div className="engagement-metrics">{taskProductionPhases.map(phase => <button type="button" key={phase} onClick={() => { setSelectedPhase(phase); setSelectedGroup('all'); onLocationChange({ projectSection: 'Tasks' }); }}><strong>{tasks.filter(task => task.productionPhase === phase && !['done', 'cancelled'].includes(task.status)).length}</strong>{taskPhaseLabels[phase]}</button>)}</div></section>
    </>}
    {section === 'Tasks' && <>
      <div className="engagement-task-filters"><label className="rm-field"><span>Work section</span><select value={selectedGroup} onChange={event => setSelectedGroup(event.target.value)}><option value="all">All sections</option>{groups.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label className="rm-field"><span>Production phase</span><select value={selectedPhase} onChange={event => setSelectedPhase(event.target.value)}><option value="all">All phases</option>{taskProductionPhases.map(phase => <option key={phase} value={phase}>{taskPhaseLabels[phase]}</option>)}</select></label><Button variant="secondary" disabled={!actions || !ready} onClick={() => { setError(''); setSectionEditor({ name: '' }); }}>Add section</Button></div>
      <TasksScreen key={`${project.id}:${selectedGroup}:${selectedPhase}`} role="admin" projectContext={{ ...context, ...(selectedGroup !== 'all' ? { sectionId: selectedGroup } : {}), ...(taskProductionPhases.some(phase => phase === selectedPhase) ? { productionPhase: selectedPhase as typeof taskProductionPhases[number] } : {}) }}
        currentUserId={currentUserId} tasks={selectedTasks} handoffTasks={tasks} archivedTasks={(data.archivedTasks ?? []).filter(task => belongsToEngagement(task, project.id))} clients={data.clients} properties={data.properties} members={data.agencyMembers} jobs={data.jobs} projectSections={data.projectSections}
        onCreateTask={ready && actions ? input => actions.createTask({ ...input, ...context }) : undefined}
        onUpdateTask={ready ? actions?.updateTask : undefined} onArchiveTask={actions?.archiveTask} onRestoreTask={actions?.restoreTask} onDeleteAttachment={actions?.deleteTaskAttachment}/>
    </>}
    {section === 'Calendar' && <CalendarScreen role="admin" projectContext={context} currentUserId={currentUserId} events={events} notes={[]} clients={data.clients} properties={property ? [property] : []} members={data.agencyMembers}
      onCreateEvent={ready && actions ? input => actions.createEvent({ ...input, ...context, workScope: project.clientId ? 'client' : 'internal' }) : undefined}
      onUpdateEvent={ready && actions ? input => actions.updateEvent({ ...input, ...context }) : undefined} onArchiveEvent={actions?.archiveEvent}/>}
    {section === 'Reviews' && <ReviewsScreen role="admin" currentUserId={currentUserId} projectContext={{jobId:project.id}} jobs={data.jobs} properties={data.properties} reviews={(data.reviews ?? []).filter(review => review.jobId === project.id)} onComment={actions?.reviewComment} onDecision={actions?.reviewDecision} onResolve={actions?.resolveReviewComment} onUploadVersion={actions?.uploadReviewVersion} onArchive={actions?.archiveDeliverable} onUpdate={actions?.updateDeliverable} onUpload={actions ? input => actions.uploadDeliverable({...input,jobId:project.id}) : undefined}/> }
    {section === 'Details' && <section className="engagement-panel"><h2>Engagement details</h2><dl className="engagement-details"><dt>Client</dt><dd>{client?.name ?? 'Internal agency work'}</dd><dt>Contract</dt><dd>{agreement?.title ?? 'No linked contract'}</dd><dt>Property / location</dt><dd>{property?.name ?? 'Not linked to a property'}</dd><dt>Owner</dt><dd>{owner?.name ?? 'Unassigned'}</dd></dl>{client && <Button variant="secondary" onClick={() => onOpenClient(client.id)}>Open client workspace</Button>}</section>}
    <Modal open={editing} title="Edit project" onClose={() => setEditing(false)}>{editing && <ProjectForm project={project} data={data} onCancel={() => setEditing(false)} onSave={async input => { if (!actions) return; await actions.updateJob({ ...input, jobId: project.id }); setEditing(false); notify('Project updated.'); }}/>}</Modal>
    <Modal open={Boolean(sectionEditor)} title={sectionEditor?.id ? 'Edit section' : 'New section'} onClose={() => { if (!saving) setSectionEditor(null); }}>
      <form className="rm-action-form" onSubmit={saveSection}>{error && <p role="alert" className="rm-feedback rm-feedback--error">{error}</p>}<label className="rm-field"><span>Section name</span><input autoFocus data-modal-autofocus required disabled={saving} value={sectionEditor?.name ?? ''} placeholder="e.g. November, Trial, Launch" onChange={event => setSectionEditor(current => ({ ...current, name: event.target.value }))}/></label><footer className="rm-dialog-actions">
        {sectionEditor?.id && <Button disabled={saving} variant="secondary" onClick={async () => { if (!actions || !sectionEditor.id || !window.confirm('Remove this section? Its tasks will remain in the project, without a section.')) return; setSaving(true); setError(''); try { await actions.deleteProjectSection(sectionEditor.id); if (selectedGroup === sectionEditor.id) setSelectedGroup('all'); setSectionEditor(null); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not remove the section.'); } finally { setSaving(false); } }}>Remove section</Button>}
        <Button disabled={saving} variant="secondary" onClick={() => setSectionEditor(null)}>Cancel</Button><Button disabled={saving || !sectionEditor?.name?.trim()} type="submit">{saving ? 'Saving…' : 'Save section'}</Button></footer></form>
    </Modal>
  </div>;
}
