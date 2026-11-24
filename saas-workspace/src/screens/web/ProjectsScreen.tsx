import { useState, type FormEvent } from 'react';
import { Button, Icon, Modal, PageHeader, useToast } from '@/components/web';
import { localDateKey, projectStage, projectStageLabels, projectStages, type ProjectStage } from '@/lib/project-workspace';
import type { CreatePropertyInput, PortalActionHandlers, PortalData, PropertySummary } from './types';
import type { PortalScreenKey } from '@/components/web/PortalShell';
import { useWorkspace } from '@/workspace/WorkspaceProvider';
import { workspacePages } from '@/workspace/navigation';
import './ProjectsScreen.css';

interface Props {
  data: PortalData;
  actions?: PortalActionHandlers;
  stage?: ProjectStage;
  onStageChange: (stage?: ProjectStage) => void;
  onOpenProject: (project: PropertySummary) => void;
  onOpenClients: () => void;
  onNavigate: (screen: PortalScreenKey) => void;
}

export function ProjectsScreen({ data, actions, stage, onStageChange, onOpenProject, onOpenClients, onNavigate }: Props) {
  const { notify } = useToast();
  const { config } = useWorkspace();
  const tools = workspacePages(config).filter(item => item.key === 'reviews' || item.key === 'scripting');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreatePropertyInput>({ clientId: '', name: '', location: '', description: '', scriptingBrief: '', status: 'onboarding' });
  const properties = data.properties ?? [];
  const today = localDateKey();
  const projects = properties.map(property => ({ property, stage: projectStage(property, data.reviews ?? [], data.calendarEvents ?? [], today) }));
  const search = query.trim().toLowerCase();
  const visible = projects.filter(item => (!stage || stage === item.stage)
    && (!search || [item.property.name, item.property.clientName, item.property.location].join(' ').toLowerCase().includes(search)));
  const clients = data.clients ?? [];
  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!actions?.createProperty) return;
    setSaving(true); setError('');
    try {
      await actions.createProperty(form);
      setCreating(false);
      onStageChange();
      setQuery('');
      notify(`${form.name} was added to Projects.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create the project.'); }
    finally { setSaving(false); }
  };

  return <div className="rm-page projects-page">
    <PageHeader eyebrow="CLIENT WORK" title="Projects" description="From the first brief to the final delivery."
      actions={<div className="projects-actions">{tools.map(tool => <Button key={tool.key} icon={tool.icon} variant="secondary" onClick={() => onNavigate(tool.key)}>{tool.label}</Button>)}{clients.length ? <Button icon="plus" disabled={!actions?.createProperty} onClick={() => {
        setForm({ clientId: clients[0].id, name: '', location: '', description: '', scriptingBrief: '', status: 'onboarding' });
        setError(''); setCreating(true);
      }}>New project</Button> : <Button icon="plus" onClick={onOpenClients}>Add a client</Button>}</div>} />
    <div className="projects-toolbar">
      <nav className="projects-filters" aria-label="Filter projects by stage">
        <button type="button" aria-pressed={!stage} onClick={() => onStageChange()}>All projects <span>{projects.length}</span></button>
        {projectStages.map(value => <button type="button" key={value} aria-pressed={stage === value} onClick={() => onStageChange(value)}>{projectStageLabels[value]} <span>{projects.filter(item => item.stage === value).length}</span></button>)}
      </nav>
      <label className="projects-search"><Icon name="search" size={17}/><span className="rm-visually-hidden">Search projects</span><input type="search" placeholder="Search projects or clients…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    </div>
    <p className="projects-stage-note">Stages reflect project status, shoot schedules, and deliverable approvals.</p>
    {visible.length ? <div className="projects-grid">{visible.map(({ property, stage: currentStage }) => {
      const reviews = (data.reviews ?? []).filter(item => item.propertyId === property.id && item.kind !== 'script');
      const tasks = (data.tasks ?? []).filter(item => item.propertyId === property.id && !['done', 'cancelled'].includes(item.status));
      const approved = reviews.filter(item => item.status === 'approved').length;
      return <button type="button" className="project-card" key={property.id} onClick={() => onOpenProject(property)} aria-label={`Open project ${property.name}`}>
        <div className="project-card__cover">{property.coverUrl ? <img src={property.coverUrl} alt="" loading="lazy"/> : <Icon name="folder" size={30}/>}<span className="project-card__stage">{projectStageLabels[currentStage]}</span></div>
        <div className="project-card__body"><small>{property.clientName}</small><h2>{property.name}</h2><p><Icon name="map-pin" size={14}/>{property.location}</p>
          <footer><span>{tasks.length} open {tasks.length === 1 ? 'task' : 'tasks'}</span><span>{approved}/{reviews.length} approved</span><Icon name="arrow-right" size={17}/></footer>
        </div>
      </button>;
    })}</div> : <div className="projects-empty"><Icon name="folder" size={32}/><h2>{properties.length ? 'No projects in this view' : 'Your first project starts here'}</h2>
      <p>{properties.length ? 'Try another stage or search for a different project.' : 'Add a client, then create a project for their property or campaign.'}</p>
      {properties.length ? <Button variant="secondary" onClick={() => { setQuery(''); onStageChange(); }}>Show all projects</Button> : !clients.length ? <Button onClick={onOpenClients}>Go to clients</Button> : null}
    </div>}
    <Modal title="New project" description="Connect a property or campaign to a client." open={creating} onClose={() => { if (!saving) setCreating(false); }}>
      <form className="rm-action-form" onSubmit={createProject}>
        {error && <p className="rm-feedback rm-feedback--error" role="alert">{error}</p>}
        <label className="rm-field"><span>Client</span><select required value={form.clientId} onChange={event => setForm({ ...form, clientId: event.target.value })}>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label className="rm-field"><span>Project name</span><input required value={form.name} placeholder="e.g. Mountain View — Listing launch" onChange={event => setForm({ ...form, name: event.target.value })}/></label>
        <label className="rm-field"><span>Location</span><input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })}/></label>
        <label className="rm-field"><span>Project brief</span><textarea rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></label>
        <label className="rm-field"><span>Scripting brief</span><textarea rows={3} value={form.scriptingBrief} onChange={event => setForm({ ...form, scriptingBrief: event.target.value })}/></label>
        <footer className="rm-dialog-actions"><Button variant="secondary" disabled={saving} onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" disabled={saving || !form.name.trim()}>{saving ? 'Creating…' : 'Create project'}</Button></footer>
      </form>
    </Modal>
  </div>;
}
