import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgencyRow } from '@/types/database';
import { enabledModulesPatch, mergeAgencySettings, workspaceSettings, type AgencyPatch } from './agency-settings';
import { loadWorkspaceAgency, saveWorkspaceAgency, workspaceLogoUrl } from './agency-service';
import { defaultConfig, normalizeConfig, type ModuleId, type WorkspaceConfig } from './modules';

const Context = createContext<{
  config: WorkspaceConfig;
  save: (config: WorkspaceConfig) => void;
  saveModules: (enabled: ModuleId[]) => Promise<void>;
  storageError: boolean;
  agency: AgencyRow | null;
  logoUrl: string | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  updateAgency: (patch: AgencyPatch) => Promise<void>;
  isLive: boolean;
} | null>(null);

export function WorkspaceProvider({ children, scope, legacyScope, agencyId, currentUserId, organizationName, role = 'admin' }: {
  children: ReactNode;
  scope: string;
  legacyScope: string;
  agencyId?: string | null;
  currentUserId?: string;
  organizationName?: string;
  role?: string;
}) {
  const key = `agency-workspace:v2:${scope}`;
  const isLive = Boolean(currentUserId && !currentUserId.startsWith('preview-'));
  const [storageError, setStorageError] = useState(false);
  const [localConfig, setLocalConfig] = useState(() => {
    try {
      return normalizeConfig(JSON.parse(window.localStorage.getItem(key)
        ?? window.localStorage.getItem(`agency-workspace:v1:${legacyScope}`) ?? 'null'));
    } catch { return normalizeConfig(defaultConfig); }
  });
  const [previewAgency, setPreviewAgency] = useState<AgencyRow>(() => {
    try {
      const stored = window.localStorage.getItem(`${key}:agency`);
      if (stored) return JSON.parse(stored);
    } catch { /* A preview can still work without browser storage. */ }
    return {
      id: agencyId ?? 'preview', name: organizationName ?? 'Your workspace', slug: 'preview', created_by: currentUserId ?? null,
      legal_name: null, logo_path: null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      default_currency: 'EUR', settings: {}, created_at: '', updated_at: '', archived_at: null,
    };
  });
  const queryClient = useQueryClient();
  const queryKey = ['workspace-agency', agencyId, currentUserId];
  // Client access remains controlled by the existing RLS policies. Clients do not query the agency table.
  const canLoadAgency = Boolean(isLive && agencyId && role !== 'client');
  const query = useQuery({ queryKey, queryFn: () => loadWorkspaceAgency(agencyId!), enabled: canLoadAgency });
  const agency = isLive ? query.data ?? null : previewAgency;
  const sharedModules = agency ? workspaceSettings(agency.settings).enabled : undefined;
  const config = {
    ...localConfig,
    name: agency?.name ?? organizationName ?? defaultConfig.name,
    enabled: sharedModules ?? localConfig.enabled,
  };
  const logo = useQuery({
    queryKey: ['workspace-logo', currentUserId, agency?.logo_path],
    queryFn: () => workspaceLogoUrl(agency!.logo_path!),
    enabled: Boolean(isLive && agency?.logo_path), staleTime: 30 * 60 * 1000, refetchInterval: 30 * 60 * 1000,
  });
  const save = (next: WorkspaceConfig) => {
    const normalized = normalizeConfig(next);
    setLocalConfig(normalized);
    try { window.localStorage.setItem(key, JSON.stringify(normalized)); setStorageError(false); }
    catch { setStorageError(true); }
  };
  const updateAgency = async (patch: AgencyPatch) => {
    if (isLive) {
      if (!agencyId || role !== 'admin') throw new Error('Only an agency administrator can change workspace settings.');
      const saved = await saveWorkspaceAgency(agencyId, patch);
      queryClient.setQueryData(queryKey, saved);
    } else {
      const { settings, ...fields } = patch;
      const next = { ...previewAgency, ...fields, settings: mergeAgencySettings(previewAgency.settings, settings) };
      setPreviewAgency(next);
      try { window.localStorage.setItem(`${key}:agency`, JSON.stringify(next)); setStorageError(false); }
      catch { setStorageError(true); }
    }
  };
  const saveModules = async (enabled: ModuleId[]) => {
    await updateAgency(enabledModulesPatch(enabled));
  };
  return <Context.Provider value={{
    config, save, saveModules, storageError, agency, logoUrl: logo.data ?? null, isLive,
    loading: canLoadAgency && query.isPending,
    error: query.error ?? (canLoadAgency && !agency && query.fetchStatus === 'paused' ? new Error('You’re offline. Reconnect to load your workspace.') : null),
    retry: () => { void query.refetch(); }, updateAgency,
  }}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider missing');
  return value;
}
