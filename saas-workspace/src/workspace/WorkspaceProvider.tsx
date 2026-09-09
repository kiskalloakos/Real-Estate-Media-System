import { createContext, useContext, useState, type ReactNode } from 'react';
import { defaultConfig, normalizeConfig, type WorkspaceConfig } from './modules';
const Context = createContext<{config: WorkspaceConfig; save: (config: WorkspaceConfig) => void; storageError: boolean} | null>(null);
export function WorkspaceProvider({children, scope}: {children: ReactNode; scope: string}) {
  const key = `agency-workspace:v1:${scope}`;
  const [storageError, setStorageError] = useState(false);
  const [config, setConfig] = useState(() => {
    try { return normalizeConfig(JSON.parse(window.localStorage.getItem(key) ?? 'null')); }
    catch { return normalizeConfig(defaultConfig); }
  });
  const save = (next: WorkspaceConfig) => {
    const normalized = normalizeConfig(next);
    setConfig(normalized);
    try { window.localStorage.setItem(key, JSON.stringify(normalized)); setStorageError(false); }
    catch { setStorageError(true); }
  };
  return <Context.Provider value={{config, save, storageError}}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider missing');
  return value;
}
