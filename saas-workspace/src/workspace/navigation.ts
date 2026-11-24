import type { IconName } from '@/components/web/Icon';
import type { PortalScreenKey } from '@/components/web/PortalShell';
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

/** Search and grouped navigation use the same enabled pages. */
export function workspacePages(config: WorkspaceConfig): WorkspacePage[] {
  return [
    { key: 'dashboard', label: 'Overview', icon: 'grid' },
    ...(config.enabled.includes('clients') ? [{ key: 'projects' as const, label: 'Projects', icon: 'folder' as const }] : []),
    ...config.order.filter(id => config.enabled.includes(id)).map(id => {
      const module = modules.find(item => item.id === id)!;
      return { key: module.id, label: id === 'clients' ? 'Clients' : module.label, icon: module.icon };
    }),
  ];
}
