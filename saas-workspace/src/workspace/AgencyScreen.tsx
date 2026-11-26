import { Button, Icon, PageHeader, type PortalScreenKey } from '@/components/web';
import { modules } from './modules';
import { agencyModuleIds, workspacePages } from './navigation';
import { useWorkspace } from './WorkspaceProvider';

export function AgencyScreen({ onNavigate }: { onNavigate: (screen: PortalScreenKey) => void }) {
  const { config } = useWorkspace();
  const pages = workspacePages(config).filter(page => agencyModuleIds.some(id => id === page.key));

  return <div className="rm-page">
    <PageHeader title="Agency" description="Your agency’s documents, people, equipment, and business tools." />
    {pages.length ? <section className="aw-presets" aria-label="Agency tools">
      {pages.map(page => <button className="aw-preset" type="button" key={page.key} aria-label={page.label} onClick={() => onNavigate(page.key)}>
        <Icon name={page.icon} size={22} />
        <strong>{page.label}</strong>
        <span>{modules.find(module => module.id === page.key)?.description}</span>
        <small>Open {page.label} <Icon name="arrow-right" size={14} /></small>
      </button>)}
    </section> : <div>
      <p className="rm-empty-copy">Choose the tools you need in Workspace settings.</p>
      <Button variant="secondary" onClick={() => onNavigate('modules')}>Customize workspace</Button>
    </div>}
  </div>;
}
