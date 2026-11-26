import type { IconName } from '@/components/web/Icon';
import type { PortalRole, PortalScreenKey } from '@/components/web/PortalShell';
import { modules, type ModuleId, type WorkspaceConfig } from './modules';

export const agencyModuleIds = ['sales', 'marketing', 'finances', 'team', 'gear', 'documents'] as const;
export const workspaceModuleGroups = ['Workspace', 'Projects', 'Agency'] as const;
export function workspaceModuleGroup(id: ModuleId) {
  return id === 'reviews' || id === 'scripting' ? 'Projects'
    : agencyModuleIds.some(item => item === id) ? 'Agency' : 'Workspace';
}
export interface WorkspacePage {
  key: PortalScreenKey;
  label: string;
  icon: IconName;
}

/** Four frequent destinations leave room for the phone's More menu. */
export function mobileNavigation(pages: readonly WorkspacePage[], role: PortalRole): WorkspacePage[] {
  const keys: PortalScreenKey[] = role === 'admin' ? ['dashboard', 'projects', 'tasks', 'calendar']
    : role === 'client' ? ['dashboard', 'reviews', 'calendar', 'documents']
    : ['dashboard', 'tasks', 'calendar', 'reviews'];
  return keys.flatMap(key => pages.filter(page => page.key === key));
}

/** Search and section pages share the same enabled tools. */
export function workspacePages(config: WorkspaceConfig): WorkspacePage[] {
  return [
    { key: 'dashboard', label: 'Overview', icon: 'grid' },
    ...(config.enabled.some(id => ['clients', 'reviews', 'scripting'].includes(id)) ? [{ key: 'projects' as const, label: 'Projects', icon: 'folder' as const }] : []),
    ...(config.enabled.some(id => agencyModuleIds.some(agencyId => agencyId === id)) ? [{ key: 'agency' as const, label: 'Agency', icon: 'briefcase' as const }] : []),
    ...config.order.filter(id => config.enabled.includes(id)).map(id => {
      const module = modules.find(item => item.id === id)!;
      return { key: module.id, label: id === 'clients' ? 'Clients' : module.label, icon: module.icon };
    }),
  ];
}
