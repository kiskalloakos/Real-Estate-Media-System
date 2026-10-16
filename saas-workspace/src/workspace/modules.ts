export const modules = [
  { id: 'tasks', label: 'Tasks', icon: 'list-check', description: 'Assignments, deadlines, and the work in between.', group: 'Work' },
  { id: 'clients', label: 'Clients & properties', icon: 'building', description: 'Your clients, their properties, and every deliverable.', group: 'Work' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', description: 'Shoots, reviews, and production schedules.', group: 'Work' },
  { id: 'reviews', label: 'Reviews', icon: 'play', description: 'Versions, feedback, and client approvals.', group: 'Work' },
  { id: 'documents', label: 'Documents', icon: 'folder', description: 'Briefs, references, templates, and company knowledge.', group: 'Studio' },
  { id: 'team', label: 'Team', icon: 'users', description: 'The people making it all happen.', group: 'Studio' },
  { id: 'marketing', label: 'Marketing', icon: 'trend-up', description: 'Connected social accounts and performance analytics.', group: 'Studio' },
  { id: 'sales', label: 'Sales', icon: 'briefcase', description: 'Leads and conversations that become clients.', group: 'Studio' },
  { id: 'gear', label: 'Gear', icon: 'camera', description: 'Equipment, custody, and shoot readiness.', group: 'Studio' },
  { id: 'finances', label: 'Finances', icon: 'wallet', description: 'Revenue, expenses, payments, and recurring costs.', group: 'Studio' },
  { id: 'scripting', label: 'Scripts', icon: 'file', description: 'Write and organize scripts. Includes the existing cabin generator.', group: 'Studio' },
] as const;
export type ModuleId = typeof modules[number]['id'];
export type SidebarMode = 'expanded' | 'collapsed' | 'hover';
export type WorkspaceConfig = { sidebarMode: SidebarMode; name: string; enabled: ModuleId[]; order: ModuleId[] };
export const presets = {
  production: { label: 'Production studio', description: 'Shoots, edits, and client approvals.', enabled: ['tasks', 'clients', 'calendar', 'reviews', 'documents', 'team', 'gear'] },
  content: { label: 'Content agency', description: 'Client work, content, and collaboration.', enabled: ['tasks', 'clients', 'calendar', 'reviews', 'documents', 'team', 'marketing', 'scripting'] },
  essentials: { label: 'Just the essentials', description: 'A focused place to start.', enabled: ['tasks', 'clients', 'calendar', 'documents'] },
} satisfies Record<string, {label: string; description: string; enabled: ModuleId[]}>;
export const defaultConfig: WorkspaceConfig = { sidebarMode: 'hover', name: 'Realty Media Studio', enabled: [...presets.production.enabled], order: modules.map(m => m.id) };
export function normalizeConfig(value: unknown): WorkspaceConfig {
  const config = value && typeof value === 'object' ? value as Partial<WorkspaceConfig> : {};
  const valid = (items: unknown): ModuleId[] => Array.isArray(items) ? [...new Set(items.filter((id): id is ModuleId => modules.some(m => m.id === id)))] : [];
  const order = valid(config.order);
  return { sidebarMode: config.sidebarMode === 'expanded' || config.sidebarMode === 'collapsed' ? config.sidebarMode : 'hover', name: typeof config.name === 'string' && config.name.trim() ? config.name.trim().slice(0, 60) : defaultConfig.name, enabled: Array.isArray(config.enabled) ? valid(config.enabled) : [...defaultConfig.enabled], order: [...order, ...modules.map(m => m.id).filter(id => !order.includes(id))] };
}
