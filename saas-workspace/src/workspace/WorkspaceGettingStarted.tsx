import { useState } from 'react';
import { Icon } from '@/components/web/Icon';
import type { PortalScreenKey } from '@/components/web/PortalShell';
import type { PortalData } from '@/screens/web/types';
import { workspaceSettings } from './agency-settings';
import { useWorkspace } from './WorkspaceProvider';

export function WorkspaceGettingStarted({ data, ready, onNavigate }: {
  data?: PortalData;
  ready: boolean;
  onNavigate: (screen: PortalScreenKey) => void;
}) {
  const { agency, updateAgency } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const onboarding = workspaceSettings(agency?.settings ?? {}).onboarding;
  if (!ready || !onboarding.completedAt || onboarding.checklistDismissed) return null;
  const items = [
    { label: 'Add your first client', screen: 'clients' as const, icon: 'building' as const, done: Boolean(data?.clients?.length) },
    { label: 'Invite your team', screen: 'team' as const, icon: 'users' as const, done: Boolean(data?.agencyMembers?.some(member => member.role === 'team_member' && member.status !== 'suspended')) },
    { label: 'Create a task or plan a shoot', screen: 'tasks' as const, icon: 'calendar' as const, done: Boolean(data?.tasks?.length || data?.calendarEvents?.length) },
  ];
  const completed = items.filter(item => item.done).length;
  const dismiss = async () => {
    setSaving(true); setError('');
    try { await updateAgency({ settings: { workspace: { onboarding: { checklistDismissed: true } } } }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not dismiss this checklist. Try again.'); }
    finally { setSaving(false); }
  };
  return <section className="aw-getting-started" aria-labelledby="aw-getting-started-title">
    <div className="aw-getting-started__heading"><div><h2 id="aw-getting-started-title">{completed === items.length ? 'You’re up and running.' : 'Your workspace is ready. Make it useful.'}</h2><p>{completed} of {items.length} complete · Start wherever you like. You can do the rest later.</p></div><button type="button" className="aw-getting-started__dismiss" aria-label="Dismiss getting started" title="Dismiss getting started" disabled={saving} onClick={() => void dismiss()}><Icon name="x" size={17} /></button></div>
    <div className="aw-getting-started__items">{items.map(item => <button type="button" key={item.screen} onClick={() => onNavigate(item.screen)}><Icon name={item.done ? 'check' : item.icon} size={19} /><span>{item.label}{item.done ? ' · Done' : ''}</span><Icon name="arrow-right" size={16} /></button>)}</div>
    {error && <p className="aw-getting-started__error" role="alert">{error}</p>}
  </section>;
}

export function WorkspaceWelcome({ role, scope }: { role: 'client' | 'team_member'; scope: string }) {
  const { config } = useWorkspace();
  const key = `agency-workspace:welcome:${scope}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return window.localStorage.getItem(key) === 'dismissed'; } catch { return false; }
  });
  if (dismissed) return null;
  return <section className="aw-welcome" aria-label="Welcome to your workspace"><div><h2>Welcome{config.name === 'Your workspace' ? ' to your workspace' : ` to ${config.name}`}.</h2><p>{role === 'client' ? 'Your agency’s work, feedback, and approvals are all here. Open Reviews when there’s something ready for your feedback.' : 'Your tasks, schedule, and agency guides are all here. Start with Tasks to see what’s assigned to you.'}</p></div><button type="button" aria-label="Dismiss welcome" onClick={() => {
    setDismissed(true);
    try { window.localStorage.setItem(key, 'dismissed'); } catch { /* Dismiss for this session. */ }
  }}><Icon name="x" size={17} /></button></section>;
}
