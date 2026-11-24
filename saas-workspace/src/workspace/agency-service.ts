import { supabase } from '@/lib/supabase';
import { mergeAgencySettings, type AgencyPatch } from './agency-settings';

export async function loadWorkspaceAgency(agencyId: string) {
  if (!supabase) throw new Error('Workspace connection is unavailable.');
  const { data, error } = await supabase.from('agencies').select('*').eq('id', agencyId).single();
  if (error) throw new Error('Could not load your workspace. Please try again.');
  return data;
}

export async function saveWorkspaceAgency(agencyId: string, patch: AgencyPatch) {
  if (!supabase) throw new Error('Workspace connection is unavailable.');
  const current = await loadWorkspaceAgency(agencyId);
  const { settings, ...fields } = patch;
  const { data, error } = await supabase.from('agencies')
    .update({ ...fields, settings: mergeAgencySettings(current.settings, settings) })
    .eq('id', agencyId).eq('updated_at', current.updated_at).select('*').single();
  if (error) throw new Error('Could not save your workspace. Check your connection and try again. If another person changed it, reload first.');
  return data;
}

export async function uploadAgencyLogo(agencyId: string, file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose a PNG, JPG, or WebP logo smaller than 5 MB.');
  }
  if (!supabase) throw new Error('Logo uploads are unavailable in this preview.');
  const path = `${agencyId}/branding/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const { error } = await supabase.storage.from('agency-files').upload(path, file);
  if (error) throw new Error('Could not upload your logo. Please try again.');
  return path;
}

export async function workspaceLogoUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from('agency-files').createSignedUrl(path, 60 * 60);
  if (error) throw new Error('Could not load your agency logo.');
  return data.signedUrl;
}
