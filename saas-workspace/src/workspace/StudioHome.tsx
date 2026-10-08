import { upcomingEvents } from '@/lib/upcoming-events';
import { fulfillmentCompletion } from '@/lib/monthly-fulfillment';
import { Icon } from '@/components/web/Icon';
import type { PortalScreenKey } from '@/components/web/PortalShell';
import type { PortalData } from '@/screens/web/types';
import { demoTasks, demoProperties, demoReviews, demoEvents } from '@/screens/web/demoData';
import { useWorkspace } from './WorkspaceProvider';
export function StudioHome({data, onNavigate, userName}: {data?: PortalData; onNavigate: (screen: PortalScreenKey)=>void; userName: string}) {
  const {config} = useWorkspace();
  const tasks = data?.tasks ?? demoTasks;
  const properties = data?.properties ?? demoProperties;
  const reviews = data?.reviews ?? demoReviews;
  const events = data?.calendarEvents ?? demoEvents;
  const openTasks = tasks.filter(t=>t.status!=='done' && t.status!=='cancelled');
  const pending = reviews.filter(r=>r.status==='in_review');
  const enabled = (id: string) => config.enabled.some(m=>m===id);
  const now = new Date();
  const schedule = upcomingEvents(events).slice(0,3);
  const greeting = now.getHours()<12?'Good morning':now.getHours()<18?'Good afternoon':'Good evening';
  return <div className="aw-page aw-home">
    <div className="aw-eyebrow">{now.toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'}).toUpperCase()}{!data && <span className="aw-preview-label">Sample workspace</span>}</div>
    <div className="aw-heading"><div><h1>{greeting}, {userName.split(' ')[0]}<span className="aw-heading-dot">.</span></h1><p>Tasks, production, and client approvals.</p></div></div>
    <div className="aw-pulse">
      {enabled('tasks')&&<button onClick={()=>onNavigate('tasks')}><span className="aw-pulse-icon"><Icon name="list-check"/></span><div><strong>{openTasks.length}<small>Open tasks</small></strong><span>Assigned and in progress</span></div><Icon name="arrow-up-right" size={17}/></button>}
      {enabled('reviews')&&<button onClick={()=>onNavigate('reviews')}><span className="aw-pulse-icon aw-peach"><Icon name="play"/></span><div><strong>{pending.length}<small>Awaiting approval</small></strong><span>Waiting on client feedback</span></div><Icon name="arrow-up-right" size={17}/></button>}
      {enabled('clients')&&<button onClick={()=>onNavigate('clients')}><span className="aw-pulse-icon aw-lilac"><Icon name="building"/></span><div><strong>{properties.filter(p=>p.workspaceStatus==='active').length}<small>Active properties</small></strong><span>Across your client accounts</span></div><Icon name="arrow-up-right" size={17}/></button>}
    </div>
    <div className="aw-home-grid"><div className="aw-main-column">
      {enabled('tasks')&&<section className="aw-panel aw-home-tasks"><div className="aw-panel-heading"><div><span className="aw-eyebrow">YOUR FOCUS</span><h2>Current tasks</h2></div><button className="aw-button aw-button-secondary" onClick={()=>onNavigate('tasks')}>All tasks <Icon name="arrow-right" size={16}/></button></div>{openTasks.slice(0,5).map(task=><button key={task.id} className="aw-task-row" onClick={()=>onNavigate('tasks')}><span className={`aw-task-state ${task.status==='in_progress'?'is-progress':task.status==='blocked'?'is-blocked':''}`}><Icon name={task.status==='blocked'?'minus':task.status==='in_progress'?'clock':'chevron-right'} size={14}/></span><div><strong>{task.title}</strong><span>{task.clientName || task.propertyName || 'Internal work'}</span></div><span className={`aw-task-badge ${task.status==='blocked'?'is-blocked':''}`}>{task.status==='blocked'?'Blocked':task.status==='in_progress'?'In progress':'To do'}</span><span className="aw-initial-avatar" title={task.assigneeName}>{task.assigneeName.split(' ').map(n=>n[0]).slice(0,2).join('')}</span></button>)}{!openTasks.length&&<p className="aw-empty">Nothing waiting here. Your next task starts in Tasks.</p>}</section>}
      {enabled('clients')&&<section className="aw-home-production"><div className="aw-section-heading"><div><span className="aw-eyebrow">IN THE STUDIO</span><h2>Active production</h2></div></div><div className="aw-project-grid">{properties.slice(0,3).map(property=>{const fulfillment = fulfillmentCompletion(data?.agreements?.find(agreement=>agreement.clientId===property.clientId)?.deliverables); return <button key={property.id} className="aw-project" onClick={()=>onNavigate('clients')}><div className="aw-project-image">{property.coverUrl?<img src={property.coverUrl} alt={property.name}/>:<Icon name="building" size={36}/>}<span>{property.status.replaceAll('_',' ')}</span></div><div className="aw-project-copy"><small>{property.location}</small><h3>{property.name}</h3><p>{property.nextMilestone}</p><div className="aw-progress" role="progressbar" aria-label={`${property.name} progress`} aria-valuenow={Math.min(100,Math.max(0,fulfillment.percentage))} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${Math.min(100,Math.max(0,fulfillment.percentage))}%`}}/></div><div className="aw-project-footer"><span>{property.assignedTeamNames.length} team members</span><strong title="Delivered quantity ÷ contracted quantity">{fulfillment.total ? `${fulfillment.percentage}% delivered` : 'No contract scope'}</strong></div></div></button>})}</div>{!properties.length&&<p className="aw-empty">Add your first client and property to bring work into view.</p>}</section>}
    </div><div className="aw-side-column">
      {enabled('calendar')&&<section className="aw-panel aw-home-schedule"><div className="aw-panel-heading"><h2>Schedule</h2><Icon name="calendar" size={18}/></div>{schedule.map(event=><button className="aw-event" key={event.id} onClick={()=>onNavigate('calendar')}><span className="aw-event-date"><strong>{event.date.slice(-2)}</strong><small>{new Date(`${event.date}T12:00:00`).toLocaleDateString('en',{month:'short'})}</small></span><div><strong>{event.title}</strong><span>{event.start} · {event.location || event.propertyName}</span></div></button>)}{!schedule.length&&<p className="aw-empty">A clear calendar. Plan your next shoot when you’re ready.</p>}<button className="aw-calendar-link" onClick={()=>onNavigate('calendar')}>Open calendar <Icon name="arrow-right" size={15}/></button></section>}
    </div></div>
    {!config.enabled.length&&<section className="aw-panel aw-empty"><h2>A fresh canvas.</h2><p>Use Customize workspace in the sidebar to enable your tools.</p></section>}
  </div>;
}
