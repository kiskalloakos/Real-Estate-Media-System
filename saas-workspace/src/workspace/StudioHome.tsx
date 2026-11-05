import { Icon } from '@/components/web/Icon';
import type { PortalScreenKey } from '@/components/web/PortalShell';
import { fulfillmentCompletion } from '@/lib/monthly-fulfillment';
import { attentionTasks, isOverdueTask, matchesTaskView, taskPreviewText, type TaskView } from '@/lib/task-workspace';
import { upcomingEvents } from '@/lib/upcoming-events';
import { demoEvents, demoProperties, demoReviews, demoTasks } from '@/screens/web/demoData';
import type { PortalData } from '@/screens/web/types';
import { useWorkspace } from './WorkspaceProvider';
import './StudioHome.css';

export function StudioHome({ data, onNavigate, onOpenTask, onOpenTaskView, onOpenClient, onOpenCalendarEvent }: {
  data?: PortalData;
  onNavigate: (screen: PortalScreenKey) => void;
  userName: string;
  onOpenTask: (id: string) => void;
  onOpenTaskView: (view: TaskView) => void;
  onOpenClient: (id: string) => void;
  onOpenCalendarEvent: (id: string) => void;
}) {
  const { config } = useWorkspace();
  const tasks = data?.tasks ?? demoTasks;
  const properties = data?.properties ?? demoProperties;
  const reviews = data?.reviews ?? demoReviews;
  const events = data?.calendarEvents ?? demoEvents;
  const openTasks = tasks.filter(task => task.status !== 'done' && task.status !== 'cancelled');
  const pending = reviews.filter(review => review.status === 'in_review');
  const blocked = openTasks.filter(task => task.status === 'blocked').length;
  const enabled = (id: string) => config.enabled.some(module => module === id);
  const now = new Date();
  const schedule = upcomingEvents(events, now).slice(0, 3);
  const visibleTasks = attentionTasks(tasks, now).slice(0, 5);
  const overdue = openTasks.filter(task => isOverdueTask(task, now)).length;
  const dueThisWeek = openTasks.filter(task => matchesTaskView(task, 'week', undefined, now)).length;

  return (
    <div className="aw-overview">
      <header className="aw-overview__header">
        <div>
          <h1>Studio overview</h1>
        </div>
        <div className="aw-overview__date">
          <time dateTime={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`}>
            {now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}
          </time>
          {!data && <span>Sample workspace</span>}
        </div>
      </header>

      <div className="aw-overview__summary" aria-label="Workspace summary">
        {enabled('tasks') && (
          <button type="button" onClick={() => onOpenTaskView('all')}>
            <strong>{openTasks.length}</strong>
            <span>Open tasks{blocked > 0 && <small>{blocked} blocked</small>}</span>
          </button>
        )}
        {enabled('reviews') && (
          <button type="button" onClick={() => onNavigate('reviews')}>
            <strong>{pending.length}</strong><span>Awaiting approval</span>
          </button>
        )}
        {enabled('clients') && (
          <button type="button" onClick={() => onNavigate('clients')}>
            <strong>{properties.filter(property => property.workspaceStatus === 'active').length}</strong>
            <span>Active properties</span>
          </button>
        )}
      </div>

      {enabled('clients') && (
        <section className="aw-overview__panel" aria-labelledby="overview-production-title" data-production-library>
          <header className="aw-overview__section-heading">
            <div><h2 id="overview-production-title">Production</h2></div>
            <button type="button" className="aw-overview__link" onClick={() => onNavigate('clients')}>All properties <Icon name="arrow-right" size={16} /></button>
          </header>
          <div className="studio-production-strip">
          {properties.slice(0, 3).map(property => {
            const fulfillment = fulfillmentCompletion(data?.agreements?.find(agreement => agreement.clientId === property.clientId)?.deliverables);
            const percentage = Math.min(100, Math.max(0, fulfillment.percentage));
            return (
              <button type="button" className="aw-overview__property" key={property.id} onClick={() => onOpenClient(property.clientId)}>
                <span className="studio-production-cover">
                  {property.coverUrl && <img src={property.coverUrl} alt="" loading="lazy" />}
                  <span className="studio-production-identity"><small>{property.location}</small><strong>{property.name}</strong></span>
                </span>
                <span className="studio-production-meta"><strong>{property.status.replaceAll('_', ' ')} · {property.assignedTeamNames.length} on team</strong><span>{fulfillment.total ? percentage + '% delivered' : 'No contract scope'}</span></span>
                {property.nextMilestone && <span className="studio-production-next">{property.nextMilestone}</span>}
                <Icon name="chevron-right" size={18} />
              </button>
            );
          })}
          </div>
          {!properties.length && <p className="aw-overview__empty">Add a client and property to start tracking production.</p>}
        </section>
      )}

      <div className="aw-overview__work">
        {enabled('tasks') && (
          <section className="aw-overview__panel" aria-labelledby="overview-tasks-title">
            <header className="aw-overview__section-heading">
              <div><h2 id="overview-tasks-title">Needs attention</h2><p>{openTasks.length ? `Prioritized by deadline, blockers, and urgency` : 'No open tasks'}</p></div>
              <button type="button" className="aw-overview__link" onClick={() => onNavigate('tasks')}>All tasks <Icon name="arrow-right" size={16} /></button>
            </header>
            <div className="aw-overview__task-views" role="group" aria-label="Task priorities">
              <button type="button" onClick={() => onOpenTaskView('overdue')}><strong>{overdue}</strong> Overdue</button>
              <button type="button" onClick={() => onOpenTaskView('blocked')}><strong>{blocked}</strong> Blocked</button>
              <button type="button" onClick={() => onOpenTaskView('week')}><strong>{dueThisWeek}</strong> Due this week</button>
            </div>
            <div className="aw-overview__tasks">
              {visibleTasks.map(task => (
                <button type="button" className="aw-overview__task" key={task.id} onClick={() => onOpenTask(task.id)}>
                  <span className="aw-overview__task-copy"><strong>{task.title}</strong><span title={taskPreviewText(task)}>{taskPreviewText(task)}</span></span>
                  <span className={`aw-overview__status${task.status === 'blocked' || isOverdueTask(task, now) ? ' is-blocked' : ''}`}>
                    {isOverdueTask(task, now) ? 'Overdue' : task.status === 'blocked' ? 'Blocked' : task.status === 'in_progress' ? 'In progress' : 'To do'}
                  </span>
                  <span className="aw-overview__assignee" title={task.assigneeName} aria-label={`Assigned to ${task.assigneeName || 'nobody'}`}>
                    {task.assigneeName.trim().split(/\s+/).filter(Boolean).map(name => name[0]).slice(0, 2).join('') || <Icon name="user" size={14} />}
                  </span>
                </button>
              ))}
              {!openTasks.length && <p className="aw-overview__empty">New tasks will appear here.</p>}
            </div>
          </section>
        )}

        {enabled('calendar') && (
          <section className="aw-overview__panel aw-overview__schedule" aria-labelledby="overview-schedule-title">
            <header className="aw-overview__section-heading">
              <div><h2 id="overview-schedule-title">Coming up</h2><p>Your next scheduled events</p></div>
              <button type="button" className="aw-overview__link" onClick={() => onNavigate('calendar')}>Calendar <Icon name="arrow-right" size={16} /></button>
            </header>
            {schedule.map(event => (
              <button type="button" className="aw-overview__event" key={event.id} onClick={() => onOpenCalendarEvent(event.id)}>
                <time className="aw-overview__event-date" dateTime={event.date}>
                  <span>{new Date(`${event.date}T12:00:00`).toLocaleDateString('en', { month: 'short' })}</span>
                  <strong>{Number(event.date.slice(-2))}</strong>
                </time>
                <span className="aw-overview__event-copy"><strong>{event.title}</strong><span>{event.allDay ? 'All day' : event.start}</span>{(event.location || event.propertyName) && <span>{event.location || event.propertyName}</span>}</span>
              </button>
            ))}
            {!schedule.length && <p className="aw-overview__empty">No upcoming events.</p>}
          </section>
        )}
      </div>

      {!config.enabled.length && <section className="aw-overview__panel"><p className="aw-overview__empty">Enable your tools in Customize workspace to get started.</p></section>}
    </div>
  );
}
