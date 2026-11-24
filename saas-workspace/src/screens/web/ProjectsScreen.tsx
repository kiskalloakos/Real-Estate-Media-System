import { useState } from 'react';
import { Button, Icon, Modal, PageHeader, useToast } from '@/components/web';
import { engagementStatuses, engagementStatusLabels, belongsToEngagement } from '@/lib/engagements';
import type { JobSummary, PortalActionHandlers, PortalData, PropertySummary } from './types';
import { ProjectForm } from './ProjectForm';
import './ProjectsScreen.css';

interface Props {
  data: PortalData;
  actions?: PortalActionHandlers;
  status?: JobSummary['status'];
  onStatusChange: (status?: JobSummary['status']) => void;
  onOpenProject: (project: JobSummary) => void;
  onOpenProperty: (property: PropertySummary) => void;
}

export function ProjectsScreen({ data, actions, status, onStatusChange, onOpenProject, onOpenProperty }: Props) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const projects = data.jobs ?? [];
  const clients = data.clients ?? [];
  const search = query.trim().toLowerCase();
  const clientName = (project: JobSummary) => clients.find(client => client.id === project.clientId)?.name ?? 'Internal agency work';
  const visible = projects.filter(project => (!status || status === project.status)
    && (!search || [project.name, clientName(project), project.brief].join(' ').toLowerCase().includes(search)));
  const ready = data.projectFoundationReady !== false;
  return <div className="rm-page projects-page">
    <PageHeader eyebrow="ENGAGEMENTS" title="Projects" description="One place for each client engagement or internal project."
      actions={<Button icon="plus" disabled={!actions?.createJob || !ready} onClick={() => setCreating(true)}>New project</Button>}/>
    {!ready && <p className="rm-feedback" role="status">Project setup is temporarily unavailable. You can still open existing work.</p>}
    <div className="projects-toolbar">
      <nav className="projects-filters" aria-label="Filter projects by status">
        <button type="button" aria-pressed={!status} onClick={() => onStatusChange()}>All projects <span>{projects.length}</span></button>
        {engagementStatuses.map(value => <button type="button" key={value} aria-pressed={status === value} onClick={() => onStatusChange(value)}>{engagementStatusLabels[value]} <span>{projects.filter(item => item.status === value).length}</span></button>)}
      </nav>
      <label className="projects-search"><Icon name="search" size={17}/><span className="rm-visually-hidden">Search projects</span><input type="search" placeholder="Search projects or clients…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    </div>
    <p className="projects-stage-note">Projects last as long as the engagement. Organize their tasks into sections you name yourself.</p>
    {visible.length ? <div className="projects-grid">{visible.map(project => {
      const property = data.properties?.find(item => item.id === project.propertyId);
      const tasks = (data.tasks ?? []).filter(task => belongsToEngagement(task, project.id));
      const open = tasks.filter(task => !['done', 'cancelled'].includes(task.status));
      const owner = data.agencyMembers?.find(member => member.userId === project.ownerUserId);
      return <button type="button" className="project-card" key={project.id} onClick={() => onOpenProject(project)} aria-label={`Open project ${project.name}`}>
        <div className="project-card__cover">{property?.coverUrl ? <img src={property.coverUrl} alt="" loading="lazy"/> : <Icon name={project.clientId ? 'folder' : 'briefcase'} size={30}/>}<span className="project-card__stage">{engagementStatusLabels[project.status]}</span></div>
        <div className="project-card__body"><small>{clientName(project)}</small><h2>{project.name}</h2><p>{owner?.name ?? 'No owner assigned'}{project.dueOn ? ` · Ends ${project.dueOn}` : ''}</p>
          <footer><span>{open.length} open {open.length === 1 ? 'task' : 'tasks'}</span><span>{tasks.filter(task => task.status === 'done').length} completed</span><Icon name="arrow-right" size={17}/></footer>
        </div>
      </button>;
    })}</div> : <div className="projects-empty"><Icon name="folder" size={32}/><h2>{projects.length ? 'No projects in this view' : 'Start with an engagement'}</h2>
      <p>{projects.length ? 'Try another status or search for a different project.' : 'Create a client engagement, trial job, or internal project. Choose any duration.'}</p>
      {projects.length ? <Button variant="secondary" onClick={() => { setQuery(''); onStatusChange(); }}>Show all projects</Button> : ready ? <Button disabled={!actions?.createJob} onClick={() => setCreating(true)}>Create your first project</Button> : null}
    </div>}
    {!!data.properties?.length && <section className="engagement-legacy"><h2>Property work</h2><p>Open a property's existing production history, reviews, and files.</p><div className="engagement-legacy-list">{data.properties.filter(property => !search || [property.name, property.clientName].join(' ').toLowerCase().includes(search)).map(property => <button type="button" key={property.id} onClick={() => onOpenProperty(property)}><Icon name="building" size={18}/><span><strong>{property.name}</strong><small>{property.clientName}</small></span><Icon name="arrow-right" size={16}/></button>)}</div></section>}
    <Modal title="New project" description="A client engagement or internal project, for any duration." open={creating} onClose={() => setCreating(false)}>
      {creating && <ProjectForm data={data} onCancel={() => setCreating(false)} onSave={async input => {
        if (!actions?.createJob) throw new Error('Project creation is unavailable.');
        await actions.createJob(input); setCreating(false); onStatusChange(); setQuery(''); notify(`${input.name} was created.`);
      }}/>}
    </Modal>
  </div>;
}
