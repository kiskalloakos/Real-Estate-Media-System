import type { ReactNode } from 'react';
import { Icon } from '@/components/web';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import { upcomingEvents } from '@/lib/upcoming-events';
import type { PortalLocation } from '@/lib/portal-location';
import { localDateKey, productionPhases, projectSections, projectStage, projectStageLabels, type ProjectSection, type ProductionPhase } from '@/lib/project-workspace';
import { useWorkspace } from '@/workspace/WorkspaceProvider';
import { CalendarScreen } from './CalendarScreen';
import { ReviewsScreen } from './ReviewsScreen';
import { ScriptingScreen } from './ScriptingScreen';
import { TasksScreen } from './TasksScreen';
import type { AgencyMemberSummary, AgreementSummary, CalendarEvent, ClientSummary, PortalActionHandlers, PropertySummary, ReviewItem, TaskSummary } from './types';
import './ProjectWorkspace.css';

const sectionIcons = { Details: 'settings', Overview: 'grid', Scripts: 'file', Tasks: 'list-check', Calendar: 'calendar', Reviews: 'play', Files: 'folder', 'Client details': 'settings' } as const;
const phaseDescriptions: Record<ProductionPhase, string> = {
  'pre-production': 'Shape the brief, write the scripts, and plan the shoot.',
  production: 'Coordinate the shoot, the team, and the work on location.',
  'post-production': 'Track edits, gather feedback, and get client approval.',
  delivery: 'Hand over approved files and wrap up the project.',
};

interface Props {
  client: ClientSummary;
  properties: PropertySummary[];
  tasks: TaskSummary[];
  archivedTasks?: TaskSummary[];
  events: CalendarEvent[];
  reviews: ReviewItem[];
  agreement?: AgreementSummary;
  currentUserId?: string;
  members: AgencyMemberSummary[];
  actions?: PortalActionHandlers;
  details: ReactNode;
  composer: (properties: PropertySummary[]) => ReactNode;
  onBack: () => void;
  projectLocation?: PortalLocation;
  onProjectLocationChange?: (changes: Partial<PortalLocation>) => void;
}

export function ProjectWorkspace({ client, properties, tasks, archivedTasks = [], events, reviews, agreement, members, currentUserId, actions, details, composer, onBack, projectLocation, onProjectLocationChange }: Props) {
  const { config } = useWorkspace();
  const key = 'rm:client-work:' + client.id;
  const [storedSelection, select] = useBrowserPersistedState(key + ':project', properties[0]?.id ?? '');
  const [storedSection, setSection] = useBrowserPersistedState<string>(key + ':section', 'Overview');
  const selection = projectLocation ? projectLocation.projectId ?? 'general' : storedSelection;
  const sections = projectSections.filter(item => item === 'Overview' || item === 'Client details'
    || (item === 'Scripts' && config.enabled.includes('scripting'))
    || (item === 'Reviews' && config.enabled.includes('reviews'))
    || (item === 'Files' && config.enabled.includes('reviews'))
    || (item === 'Tasks' && config.enabled.includes('tasks'))
    || (item === 'Calendar' && config.enabled.includes('calendar')));
  const requestedSection = projectLocation?.projectSection ?? (projectLocation ? 'Overview' : storedSection === 'Content' ? 'Reviews' : storedSection);
  const section = sections.find(item => item === requestedSection) ?? 'Overview';
  const navigate = (next: ProjectSection) => {
    if (onProjectLocationChange) onProjectLocationChange({ projectSection: next });
    else setSection(next);
  };
  const project = selection === 'general' ? undefined : properties.find(item => item.id === selection) ?? properties[0];
  const context = { clientId: client.id, propertyId: project?.id };
  const scopedProperties = project ? [project] : [];
  // Older records can belong to a client without a property. A single-project client
  // keeps those records in view. Larger portfolios have a separate shared-work view.
  const matches = (id?: string) => id ? id === project?.id : properties.length <= 1 || !project;
  const belongs = (task: TaskSummary) => matches(task.propertyId) && (task.clientId === client.id || Boolean(project && task.propertyId === project.id));
  const projectTasks = tasks.filter(belongs);
  const projectEvents = events.filter(item => matches(item.propertyId));
  const projectReviews = reviews.filter(item => matches(item.propertyId));
  const currentStage = project ? projectStage(project, reviews, events, localDateKey()) : 'pre-production';
  const [storedPhase, setPhase] = useBrowserPersistedState<ProductionPhase>(key + ':phase', currentStage === 'completed' ? 'delivery' : currentStage);
  const requestedPhase = projectLocation ? projectLocation.projectStage ?? currentStage : storedPhase;
  const phase = productionPhases.find(item => item === requestedPhase) ?? 'delivery';
  const phaseTarget: ProjectSection = phase === 'pre-production' ? 'Scripts' : phase === 'production' ? 'Calendar' : phase === 'post-production' ? 'Reviews' : 'Files';
  const primarySection = sections.includes(phaseTarget) ? phaseTarget : sections.includes('Tasks') ? 'Tasks' : 'Client details';
  const upcoming = upcomingEvents(projectEvents);
  const nextEvent = upcoming.slice().sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
  const nextTask = projectTasks.filter(task => !['done','cancelled'].includes(task.status)).sort((a,b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999'))[0];
  const files = projectReviews.filter(item => item.fileUrl && (phase !== 'delivery' || item.status === 'approved'));
  return <div className="project-work" data-section={section}>
    <header className="project-heading">
      {project?.coverUrl && <img className="project-cover" src={project.coverUrl} alt="" />}
      <div className="project-heading-copy">
        <div className="project-path"><button type="button" onClick={onBack}>{projectLocation ? 'Projects' : 'Clients'}</button><Icon name="chevron-right" size={14}/><span>{client.name}</span></div>
        <h1>{project?.name ?? (properties.length ? 'Shared client work' : client.name)}</h1>
        {project?.location && <small><Icon name="map-pin" size={14}/>{project.location}</small>}
        {project && <div className="project-heading-meta"><span className="project-current-stage" title="Based on shoot schedules and deliverable approvals">{projectStageLabels[currentStage]}</span>{nextTask?.dueAt && <small>Next deadline · {new Date(nextTask.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small>}</div>}
      </div>
      {properties.length > 1 && <select aria-label="Project" value={project?.id ?? 'general'} onChange={e => {
        if (onProjectLocationChange) onProjectLocationChange({ projectId: e.target.value === 'general' ? undefined : e.target.value, projectSection: 'Overview', projectStage: undefined });
        else select(e.target.value);
      }}>
        {properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="general">Shared client work</option>
      </select>}
    </header>
    <div className="project-phases" role="group" aria-label="Production stages">{productionPhases.map((item, index) => <button type="button" key={item} aria-pressed={phase === item} onClick={() => {
      if (onProjectLocationChange) onProjectLocationChange({ projectStage: item, projectSection: 'Overview' });
      else { setPhase(item); setSection('Overview'); }
    }}><span>{String(index + 1).padStart(2, '0')}</span>{projectStageLabels[item]}<Icon name="chevron-right" size={14}/></button>)}</div>
    <nav aria-label="Project sections">{sections.map(item => <button key={item} aria-current={item === section ? 'page' : undefined} onClick={() => navigate(item)}><Icon name={sectionIcons[item]} size={18}/>{item}</button>)}</nav>
    <main key={project?.id ?? 'general'}>
      {section === 'Overview' && <>
        <section className="project-phase-summary" aria-label={`${projectStageLabels[phase]} overview`}><div><small>PROJECT WORKFLOW</small><h2>{projectStageLabels[phase]}</h2><p>{phaseDescriptions[phase]}</p></div><button type="button" onClick={() => navigate(primarySection)}>Open {primarySection.toLowerCase()}<Icon name="arrow-right" size={16}/></button>
          {phase === 'pre-production' && project?.description && <p className="project-phase-summary__brief">{project.description}</p>}
          {phase === 'production' && <p className="project-phase-summary__brief">{project?.assignedTeamNames.length ? `Assigned team: ${project.assignedTeamNames.join(', ')}` : 'Assign the production team in Client details.'}</p>}
          {phase === 'post-production' && <p className="project-phase-summary__brief">{projectReviews.filter(item => item.status !== 'approved').length} deliverables awaiting approval.</p>}
          {phase === 'delivery' && <p className="project-phase-summary__brief">{files.length} approved {files.length === 1 ? 'file' : 'files'} ready to download.</p>}
        </section>
        <section className="studio-agenda" aria-label="Project overview">
        <header><h2>Production agenda</h2><span>{upcoming.length} upcoming {upcoming.length === 1 ? 'event' : 'events'}</span></header>
        {sections.includes('Calendar') && <button className="studio-shoot" onClick={() => navigate('Calendar')}>
          <span className="studio-date">{nextEvent ? <><small>{new Date(nextEvent.date + 'T12:00:00').toLocaleDateString('en-GB',{month:'short'})}</small><strong>{Number(nextEvent.date.slice(-2))}</strong></> : <Icon name="calendar" size={26}/>}</span>
          <span><small>Next production</small><strong>{nextEvent?.title || 'Schedule a shoot'}</strong>{nextEvent && <small>{nextEvent.allDay ? 'All day' : nextEvent.start}{nextEvent.location ? ' · ' + nextEvent.location : ''}</small>}</span><Icon name="chevron-right" size={18}/>
        </button>}
        {sections.includes('Tasks') && <button className="studio-agenda-row" onClick={() => navigate('Tasks')}><Icon name="list-check" size={20}/><span><small>Next task</small><strong>{nextTask?.title || 'Plan the next task'}</strong></span><Icon name="chevron-right" size={18}/></button>}
        {sections.includes('Reviews') && <button className="studio-agenda-row" onClick={() => navigate('Reviews')}><Icon name="play" size={20}/><span><small>Delivery</small><strong>{projectReviews.length ? projectReviews.filter(item => item.status === 'approved').length + ' of ' + projectReviews.length + ' approved' : 'Add the first deliverable'}</strong></span><Icon name="chevron-right" size={18}/></button>}
      </section></>}
      {section === 'Scripts' && (project ? <ScriptingScreen key={project.id} properties={scopedProperties} projectId={project.id}/> : <section className="project-summary"><h2>Select a project</h2><p>Choose a project above to work on its scripts.</p></section>)}
      {section === 'Tasks' && <TasksScreen role="admin" projectContext={context} currentUserId={currentUserId}
        clients={[client]} properties={scopedProperties} tasks={projectTasks} archivedTasks={archivedTasks.filter(belongs)} members={members}
        onCreateTask={actions && (input => actions.createTask({ ...input, ...context }))} onUpdateTask={actions?.updateTask}
        onDeleteAttachment={actions?.deleteTaskAttachment} onRestoreTask={actions?.restoreTask} onArchiveTask={actions?.archiveTask}/>}
      {section === 'Calendar' && <CalendarScreen role="admin" clientWorkOnly projectContext={context} currentUserId={currentUserId}
        clients={[client]} properties={scopedProperties} members={members} events={projectEvents} notes={[]}
        onCreateEvent={actions && (input => actions.createEvent({ ...input, ...context, workScope: 'client' }))}
        onArchiveEvent={actions?.archiveEvent} onUpdateEvent={actions?.updateEvent}/>}
      {section === 'Reviews' && <>{project && composer(scopedProperties)}<ReviewsScreen role="admin" reviews={projectReviews} properties={scopedProperties}
        onComment={actions?.reviewComment} onDecision={actions?.reviewDecision} onArchive={actions?.archiveDeliverable}
        onUpdate={actions?.updateDeliverable}/></>}
      {section === 'Files' && <section className="project-summary"><h2>{phase === 'delivery' ? 'Approved delivery files' : 'Project files'}</h2>
        {files.map(file => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer">{file.title} · {file.version}</a>)}
        {!files.length && <p>{phase === 'delivery' ? 'Approved files will appear here after client review.' : 'Files uploaded in Reviews appear here.'}</p>}
        <h2>Client documents</h2>{agreement?.documents?.map(file => <a key={file.id} href={file.url} target="_blank" rel="noreferrer">{file.name}</a>)}
        {!agreement?.documents?.length && <p>No client documents yet.</p>}
      </section>}
      {section === 'Client details' && details}
    </main>
  </div>;
}
