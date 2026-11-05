import type { ReactNode } from 'react';
import { Icon } from '@/components/web';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import { upcomingEvents } from '@/lib/upcoming-events';
import { CalendarScreen } from './CalendarScreen';
import { ReviewsScreen } from './ReviewsScreen';
import { TasksScreen } from './TasksScreen';
import type { AgencyMemberSummary, AgreementSummary, CalendarEvent, ClientSummary, PortalActionHandlers, PropertySummary, ReviewItem, TaskSummary } from './types';
import './ProjectWorkspace.css';

const sections = ['Overview', 'Tasks', 'Calendar', 'Content', 'Files', 'Client details'] as const;
const sectionIcons = { Overview: "grid", Tasks: "list-check", Calendar: "calendar", Content: "play", Files: "folder", "Client details": "settings" } as const;
type Section = typeof sections[number];

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
}

export function ProjectWorkspace({ client, properties, tasks, archivedTasks = [], events, reviews, agreement, members, currentUserId, actions, details, composer, onBack }: Props) {
  const key = 'rm:client-work:' + client.id;
  const [selection, select] = useBrowserPersistedState(key + ':project', properties[0]?.id ?? '');
  const [section, navigate] = useBrowserPersistedState<Section>(key + ':section', 'Overview');
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
  const upcoming = upcomingEvents(projectEvents);
  const nextEvent = upcoming.slice().sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
  const nextTask = projectTasks.filter(task => !['done','cancelled'].includes(task.status)).sort((a,b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999'))[0];
  const files = projectReviews.filter(item => item.fileUrl);
  return <div className="project-work" data-section={section}>
    <header className="project-heading">
      {project?.coverUrl && <img className="project-cover" src={project.coverUrl} alt="" />}
      <div className="project-heading-copy">
        <div className="project-path"><button type="button" onClick={onBack}>Clients</button><Icon name="chevron-right" size={14}/><span>{client.name}</span></div>
        <h1>{project?.name ?? (properties.length ? 'Shared client work' : client.name)}</h1>
        {project?.location && <small><Icon name="map-pin" size={14}/>{project.location}</small>}
      </div>
      {properties.length > 1 && <select aria-label="Project" value={project?.id ?? 'general'} onChange={e => select(e.target.value)}>
        {properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="general">Shared client work</option>
      </select>}
    </header>
    <nav aria-label="Project sections">{sections.map(item => <button key={item} aria-current={item === section ? 'page' : undefined} onClick={() => navigate(item)}><Icon name={sectionIcons[item]} size={18}/>{item}</button>)}</nav>
    <main key={project?.id ?? 'general'}>
      {section === 'Overview' && <section className="studio-agenda" aria-label="Project overview">
        <header><h2>Production agenda</h2><span>{upcoming.length} upcoming {upcoming.length === 1 ? 'event' : 'events'}</span></header>
        <button className="studio-shoot" onClick={() => navigate('Calendar')}>
          <span className="studio-date">{nextEvent ? <><small>{new Date(nextEvent.date + 'T12:00:00').toLocaleDateString('en-GB',{month:'short'})}</small><strong>{Number(nextEvent.date.slice(-2))}</strong></> : <Icon name="calendar" size={26}/>}</span>
          <span><small>Next production</small><strong>{nextEvent?.title || 'Schedule a shoot'}</strong>{nextEvent && <small>{nextEvent.allDay ? 'All day' : nextEvent.start}{nextEvent.location ? ' · ' + nextEvent.location : ''}</small>}</span><Icon name="chevron-right" size={18}/>
        </button>
        <button className="studio-agenda-row" onClick={() => navigate('Tasks')}><Icon name="list-check" size={20}/><span><small>Next task</small><strong>{nextTask?.title || 'Plan the next task'}</strong></span><Icon name="chevron-right" size={18}/></button>
        <button className="studio-agenda-row" onClick={() => navigate('Content')}><Icon name="play" size={20}/><span><small>Delivery</small><strong>{projectReviews.length ? projectReviews.filter(item => item.status === 'approved').length + ' of ' + projectReviews.length + ' approved' : 'Add the first deliverable'}</strong></span><Icon name="chevron-right" size={18}/></button>
      </section>}
      {section === 'Tasks' && <TasksScreen role="admin" projectContext={context} currentUserId={currentUserId}
        clients={[client]} properties={scopedProperties} tasks={projectTasks} archivedTasks={archivedTasks.filter(belongs)} members={members}
        onCreateTask={actions && (input => actions.createTask({ ...input, ...context }))} onUpdateTask={actions?.updateTask}
        onDeleteAttachment={actions?.deleteTaskAttachment} onRestoreTask={actions?.restoreTask} onArchiveTask={actions?.archiveTask}/>}
      {section === 'Calendar' && <CalendarScreen role="admin" clientWorkOnly projectContext={context} currentUserId={currentUserId}
        clients={[client]} properties={scopedProperties} members={members} events={projectEvents} notes={[]}
        onCreateEvent={actions && (input => actions.createEvent({ ...input, ...context, workScope: 'client' }))}
        onArchiveEvent={actions?.archiveEvent} onUpdateEvent={actions?.updateEvent}/>}
      {section === 'Content' && <>{project && composer(scopedProperties)}<ReviewsScreen role="admin" reviews={projectReviews} properties={scopedProperties}
        onComment={actions?.reviewComment} onDecision={actions?.reviewDecision} onArchive={actions?.archiveDeliverable}
        onUpdate={actions?.updateDeliverable}/></>}
      {section === 'Files' && <section className="project-summary"><h2>Project files</h2>
        {files.map(file => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer">{file.title} · {file.version}</a>)}
        {!files.length && <p>Files uploaded in Content appear here.</p>}
        <h2>Client documents</h2>{agreement?.documents?.map(file => <a key={file.id} href={file.url} target="_blank" rel="noreferrer">{file.name}</a>)}
        {!agreement?.documents?.length && <p>No client documents yet.</p>}
      </section>}
      {section === 'Client details' && details}
    </main>
  </div>;
}
