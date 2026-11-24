import type { AgencyRow, Json } from '@/types/database';
import { normalizeConfig, presets, type ModuleId } from './modules';

export type PresetId = keyof typeof presets;
export type AgencyPatch = Partial<Pick<AgencyRow, 'name' | 'legal_name' | 'logo_path' | 'timezone' | 'default_currency'>> & {
  settings?: Record<string, Json | undefined>;
};

export function settingsObject(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json | undefined> : {};
}

export function workspaceSettings(settings: Json) {
  const workspace = settingsObject(settingsObject(settings).workspace);
  const onboarding = settingsObject(workspace.onboarding);
  const preset: PresetId = typeof onboarding.preset === 'string' && Object.hasOwn(presets, onboarding.preset)
    ? onboarding.preset as PresetId : 'production';
  return {
    enabled: Array.isArray(workspace.enabledModules) ? normalizeConfig({ enabled: workspace.enabledModules }).enabled : undefined,
    onboarding: {
      step: onboarding.step === 2 ? 2 as const : 1 as const,
      completedAt: typeof onboarding.completedAt === 'string' ? onboarding.completedAt : null,
      checklistDismissed: onboarding.checklistDismissed === true,
      preset,
    },
  };
}

// Merge only the settings namespaces this feature owns; preserve other agency settings.
export function mergeAgencySettings(current: Json, patch: AgencyPatch['settings']): Json {
  const settings = settingsObject(current);
  if (!patch) return settings;
  const next = { ...settings, ...patch };
  if (patch.workspace) {
    const workspace = settingsObject(settings.workspace);
    const changes = settingsObject(patch.workspace);
    next.workspace = { ...workspace, ...changes };
    if (changes.onboarding) {
      next.workspace.onboarding = { ...settingsObject(workspace.onboarding), ...settingsObject(changes.onboarding) };
    }
  }
  return next;
}

export function shouldOnboardAgency(agency: AgencyRow | null | undefined, userId: string | undefined, role: string, requested: boolean) {
  return Boolean(agency && requested && role === 'admin' && agency.created_by === userId
    && !workspaceSettings(agency.settings).onboarding.completedAt);
}

export function enabledModulesPatch(enabled: ModuleId[]): AgencyPatch {
  return { settings: { workspace: { enabledModules: enabled } } };
}
