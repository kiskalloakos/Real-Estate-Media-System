import { readProduction } from './screenplay';
import type { SavedCabanaScript } from './scripting-service';

// Used only by the explicit, unconfigured sample workspace. Never a fallback
// for failed authenticated writes.
const previewKey = 'rm:sample-screenplays:v1';
export function listPreviewScripts(): SavedCabanaScript[] {
  const raw = window.localStorage.getItem(previewKey);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((script) => !script || typeof script.id !== 'string'
    || typeof script.title !== 'string' || typeof script.script !== 'string'
    || !Array.isArray(script.hooks) || script.hooks.some((hook: unknown) => typeof hook !== 'string')
    || typeof script.updatedAt !== 'string' || !Number.isFinite(Date.parse(script.updatedAt))
    || !['draft', 'approved'].includes(script.status))) throw new Error('Could not read the saved preview scripts.');
  return (parsed as SavedCabanaScript[]).map((script) => ({ ...script, production: readProduction(script.production), productionInvalid: script.production != null && !readProduction(script.production) }));
}
export function storePreviewScripts(scripts: SavedCabanaScript[]) {
  window.localStorage.setItem(previewKey, JSON.stringify(scripts));
}
