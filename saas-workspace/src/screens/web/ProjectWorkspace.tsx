import type { ReactNode } from 'react';
import { useTabTransition } from '@/hooks/use-tab-transition';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import { upcomingEvents } from '@/lib/upcoming-events';
import type { PortalLocation } from '@/lib/portal-location';
import { localDateKey, propertyProjectSections, projectStage, projectStageLabels, type ProjectSection } from '@/lib/project-workspace';
import { ProjectOverview } from './ProjectOverview';
import { useWorkspace } from '@/workspace/WorkspaceProvider';
import { CalendarScreen } from './CalendarScreen';
import { ReviewsScreen } from './ReviewsScreen';
import { ScriptingScreen } from './ScriptingScreen';
import { TasksScreen } from './TasksScreen';
import type { AgencyMemberSummary, AgreementSummary, CalendarEvent, ClientSummary, PortalActionHandlers, PropertySummary, ReviewItem, TaskSummary } from './types';
import './ProjectWorkspace.css';

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
  projectLocation?: PortalLocation;
  onProjectLocationChange?: (changes: Partial<PortalLocation>) => void;
}

export function ProjectWorkspace({ client, properties, tasks, archivedTasks = [], events, reviews, agreement, members, currentUserId, actions, details, composer, projectLocation, onProjectLocationChange }: Props) {
  const { config } = useWorkspace();
  const key = 'rm:client-work:' + client.id;
  const [storedSelection, select] = useBrowserPersistedState(key + ':project', properties[0]?.id ?? '');
  const [storedSection, setSection] = useBrowserPersistedState<string>(key + ':section', 'Overview');
  const selection = projectLocation ? projectLocation.projectId ?? 'general' : storedSelection;
  const sections = propertyProjectSections(config.enabled);
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
  const upcoming = upcomingEvents(projectEvents).length;
  const openTasks = projectTasks.filter(task => !['done', 'cancelled'].includes(task.status)).length;
  const approvedOnly = projectLocation?.projectStage === 'delivery';
  const files = projectReviews.filter(item => item.fileUrl && (!approvedOnly || item.status === 'approved'));
  const transitionRef = useTabTransition<HTMLDivElement>(`${section}:${selection}`);
  const switchProperty = (id: string) => {
    if (onProjectLocationChange) {
      onProjectLocationChange({ projectId: id, projectSection: undefined, projectStage: undefined });
    } else {
      select(id);
      setSection('Overview');
    }
  };
  return <div className="project-work" data-section={section}>
    <div className="aw-project-content" key={project?.id ?? 'general'} ref={transitionRef}>
      {section === 'Overview' && <ProjectOverview
        brief={project?.description}
        actions={properties.length > 1 ? (
          <select aria-label="Switch property" value={project?.id ?? 'general'} onChange={event => switchProperty(event.target.value)}>
            {properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            <option value="general">Shared client work</option>
          </select>
        ) : undefined}
        sections={sections.filter(item => project || item !== 'Scripts')}
        summaries={{
          Tasks: openTasks ? `${openTasks} open` : undefined,
          Calendar: upcoming ? `${upcoming} upcoming` : undefined,
          Reviews: projectReviews.length ? String(projectReviews.length) : undefined,
          Files: files.length ? String(files.length) : undefined,
          'Client details': project ? projectStageLabels[currentStage] : undefined,
        }}
        onOpen={navigate}
      />}
      {section === 'Scripts' && (project ? <ScriptingScreen key={project.id} properties={scopedProperties} projectId={project.id}/> : <section className="project-summary"><h2>Scripts</h2><p>Open a property project to work on its scripts.</p></section>)}
      {section === 'Tasks' && <TasksScreen role="admin" projectContext={context} currentUserId={currentUserId}
        clients={[client]} properties={scopedProperties} tasks={projectTasks} archivedTasks={archivedTasks.filter(belongs)} members={members}
        onCreateTask={actions && (input => actions.createTask({ ...input, ...context }))} onUpdateTask={actions?.updateTask}
        onDeleteAttachment={actions?.deleteTaskAttachment} onRestoreTask={actions?.restoreTask} onArchiveTask={actions?.archiveTask}/>}
      {section === 'Calendar' && <CalendarScreen role="admin" clientWorkOnly projectContext={context} currentUserId={currentUserId}
        clients={[client]} properties={scopedProperties} members={members} events={projectEvents} notes={[]}
        onCreateEvent={actions && (input => actions.createEvent({ ...input, ...context, workScope: 'client' }))}
        onArchiveEvent={actions?.archiveEvent} onUpdateEvent={actions?.updateEvent}/>}
      {section === 'Reviews' && <>{project && composer(scopedProperties)}<ReviewsScreen role="admin" reviews={projectReviews} properties={scopedProperties}
        currentUserId={currentUserId} projectContext={project ? {propertyId:project.id} : undefined} onUpload={actions?.uploadDeliverable} onResolve={actions?.resolveReviewComment} onUploadVersion={actions?.uploadReviewVersion} onComment={actions?.reviewComment} onDecision={actions?.reviewDecision} onArchive={actions?.archiveDeliverable}
        onUpdate={actions?.updateDeliverable}/></>}
      {section === 'Files' && <section className="project-summary"><h2>{approvedOnly ? 'Approved delivery files' : 'Project files'}</h2>
        {files.map(file => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer">{file.title} · {file.version}</a>)}
        {!files.length && <p>{approvedOnly ? 'Approved files will appear here after client review.' : 'Files uploaded in Reviews appear here.'}</p>}
        <h2>Client documents</h2>{agreement?.documents?.map(file => <a key={file.id} href={file.url} target="_blank" rel="noreferrer">{file.name}</a>)}
        {!agreement?.documents?.length && <p>No client documents yet.</p>}
      </section>}
      {section === 'Client details' && details}
    </div>
  </div>;
}
