import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

type FunctionErrorPayload = {
  error?: string;
  message?: string;
};

export type CabanaScriptTone =
  | 'calm_cinematic'
  | 'warm_family'
  | 'premium'
  | 'playful'
  | 'direct_sales';

export interface CabanaScriptBrief {
  amenities: string;
  avoid: string;
  bookingCta: string;
  clientAccountId?: string;
  contentTemplate?: 'property_showcase' | 'personal_brand' | 'service_explainer' | 'testimonial' | 'campaign_offer';
  location: string;
  mustMention: string;
  name: string;
  propertyId?: string;
  targetGuest: string;
  tone: CabanaScriptTone;
  generationMode?: 'new' | 'more';
  variationIndex?: number;
}

export interface GeneratedCabanaScriptDocument {
  hooks: string[];
  id: string;
  script: string;
  title: string;
}

export interface SavedCabanaScript extends GeneratedCabanaScriptDocument {
  approvedAt: string | null;
  brief: CabanaScriptBrief | null;
  clientAccountId: string | null;
  createdAt: string;
  model: string | null;
  propertyId: string | null;
  status: 'draft' | 'approved';
  updatedAt: string;
}

export interface CabanaScriptGenerationResult {
  model: string;
  script: GeneratedCabanaScriptDocument;
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const context = 'context' in error ? error.context : undefined;

  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as FunctionErrorPayload;
      return payload.error || payload.message || fallback;
    } catch {
      return fallback;
    }
  }

  return 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback;
}

function configuredClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured for this build.');
  }
  return supabase;
}

function hooksFromJson(value: Json) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function briefFromJson(value: Json): CabanaScriptBrief | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as unknown as CabanaScriptBrief;
}

function scriptFromRow(row: {
  approved_at: string | null;
  brief: Json;
  client_account_id: string | null;
  created_at: string;
  hooks: Json;
  id: string;
  model: string | null;
  property_id: string | null;
  script: string;
  status: 'draft' | 'approved';
  title: string;
  updated_at: string;
}): SavedCabanaScript {
  return {
    approvedAt: row.approved_at,
    brief: briefFromJson(row.brief),
    clientAccountId: row.client_account_id,
    createdAt: row.created_at,
    hooks: hooksFromJson(row.hooks),
    id: row.id,
    model: row.model,
    propertyId: row.property_id,
    script: row.script,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function currentWorkspaceContext() {
  const client = configuredClient();
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError || !userResult.user) {
    throw new Error('Sign in before saving scripts.');
  }

  const { data, error } = await client
    .from('agency_memberships')
    .select('agency_id')
    .eq('user_id', userResult.user.id)
    .eq('status', 'active')
    .in('role', ['admin', 'team_member'])
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not load your workspace: ${error.message}`);
  if (!data?.agency_id) throw new Error('No active workspace found for script saving.');

  return {
    agencyId: data.agency_id,
    userId: userResult.user.id,
  };
}

export async function generateCabanaScripts(
  brief: CabanaScriptBrief,
): Promise<CabanaScriptGenerationResult> {
  const client = configuredClient();
  const { data, error } = await client.functions.invoke<CabanaScriptGenerationResult & { error?: string }>(
    'generate-cabana-script',
    { body: { brief } },
  );

  if (error || !data?.script?.script) {
    throw new Error(
      data?.error ||
        (await functionErrorMessage(
          error,
          'Could not generate the cabana script. Please check the AI setup and try again.',
        )),
    );
  }

  return data;
}

export async function writeCabanaScript(
  brief: CabanaScriptBrief,
): Promise<CabanaScriptGenerationResult> {
  return generateCabanaScripts({
    ...brief,
    generationMode: 'new',
    variationIndex: 0,
  });
}

export async function listCabanaScripts() {
  const client = configuredClient();
  const { data, error } = await client
    .from('cabana_scripts')
    .select('id, property_id, client_account_id, status, approved_at, title, hooks, script, brief, model, created_at, updated_at')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Could not load scripts: ${error.message}`);
  }

  return (data ?? []).map(scriptFromRow);
}

export async function saveCabanaScript(input: {
  brief?: CabanaScriptBrief | null;
  clientAccountId?: string | null;
  model?: string | null;
  propertyId?: string | null;
  script: GeneratedCabanaScriptDocument;
  status?: 'draft' | 'approved';
}) {
  const client = configuredClient();
  const context = await currentWorkspaceContext();
  const title = input.script.title.trim() || 'Generated cabana script';
  const payload = {
    approved_at: input.status === 'approved' ? new Date().toISOString() : null,
    brief: (input.brief ?? {}) as unknown as Json,
    client_account_id: input.clientAccountId ?? input.brief?.clientAccountId ?? null,
    hooks: input.script.hooks as unknown as Json,
    model: input.model ?? null,
    property_id: input.propertyId ?? input.brief?.propertyId ?? null,
    script: input.script.script.trim(),
    status: input.status ?? 'draft',
    title,
  };

  if (!payload.script) throw new Error('Script text is required.');

  const shouldUpdate = isUuid(input.script.id);
  const result = shouldUpdate
    ? await client
        .from('cabana_scripts')
        .update(payload)
        .eq('id', input.script.id)
        .is('archived_at', null)
        .select('id, property_id, client_account_id, status, approved_at, title, hooks, script, brief, model, created_at, updated_at')
        .single()
    : await client
        .from('cabana_scripts')
        .insert({
          ...payload,
          agency_id: context.agencyId,
          created_by: context.userId,
        })
        .select('id, property_id, client_account_id, status, approved_at, title, hooks, script, brief, model, created_at, updated_at')
        .single();

  if (result.error) {
    throw new Error(`Could not save script: ${result.error.message}`);
  }

  return scriptFromRow(result.data);
}

export async function deleteCabanaScript(scriptId: string) {
  const client = configuredClient();
  const { error } = await client
    .from('cabana_scripts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', scriptId)
    .is('archived_at', null);

  if (error) throw new Error(`Could not delete script: ${error.message}`);
}
