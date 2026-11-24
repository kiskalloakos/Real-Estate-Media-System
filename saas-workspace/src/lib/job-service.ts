import { supabase } from '@/lib/supabase';
import type { CreateJobInput, SaveProjectSectionInput, UpdateJobInput } from '@/screens/web/types';

function jobValues(input: CreateJobInput) {
  const name = input.name.trim();
  if (!name) throw new Error('Give the project a name.');
  if (input.propertyId && !input.clientId) throw new Error('Choose the client that owns this property.');
  if (input.agreementId && !input.clientId) throw new Error('Choose a client before linking a contract.');
  if (input.startsOn && input.dueOn && input.dueOn < input.startsOn) throw new Error('The end date must be on or after the start date.');
  return {
    name, brief: input.brief.trim() || null,
    client_account_id: input.clientId || null, property_id: input.propertyId || null,
    agreement_id: input.agreementId || null, owner_user_id: input.ownerUserId || null,
    kind: input.clientId ? input.kind === 'internal' ? 'content_campaign' as const : input.kind : 'internal' as const,
    status: input.status ?? 'planned', starts_on: input.startsOn || null, due_on: input.dueOn || null,
  };
}

export async function createJob(input: CreateJobInput, context: { agencyId: string; userId: string }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('jobs').insert({
    ...jobValues(input), agency_id: context.agencyId, created_by: context.userId,
  }).select('id').single();
  if (error || !data) throw new Error(`Could not create the project: ${error?.message ?? 'Unknown error'}`);
  return data.id;
}

export async function updateJob(input: UpdateJobInput, context: { agencyId: string }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('jobs').update(jobValues(input))
    .eq('id', input.jobId).eq('agency_id', context.agencyId).is('archived_at', null).select('id').single();
  if (error || !data) throw new Error(`Could not update the project: ${error?.message ?? 'Project is no longer available'}`);
}

export async function saveProjectSection(input: SaveProjectSectionInput, context: { agencyId: string }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const name = input.name.trim();
  if (!name) throw new Error('Give the section a name.');
  const values = { name, sort_order: input.sortOrder };
  const result = input.sectionId
    ? await supabase.from('job_sections').update(values).eq('id', input.sectionId)
      .eq('agency_id', context.agencyId).eq('job_id', input.jobId).select('id').single()
    : await supabase.from('job_sections').insert({ ...values, agency_id: context.agencyId, job_id: input.jobId }).select('id').single();
  if (result.error || !result.data) throw new Error(`Could not save the section: ${result.error?.message ?? 'Section is no longer available'}`);
}

export async function deleteProjectSection(sectionId: string, context: { agencyId: string }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('job_sections').delete().eq('id', sectionId)
    .eq('agency_id', context.agencyId).select('id').single();
  if (error || !data) throw new Error(`Could not remove the section: ${error?.message ?? 'Section is no longer available'}`);
}
