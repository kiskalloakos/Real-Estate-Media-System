import { supabase } from '@/lib/supabase';
import type { CreateJobInput, JobSummary } from '@/screens/web/types';

export async function createJob(
  input: CreateJobInput,
  context: { agencyId: string; userId: string },
) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const name = input.name.trim();
  if (!name) throw new Error('Give the job a name.');
  if (input.propertyId && !input.clientId) {
    throw new Error('A property job must also be linked to its client.');
  }
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      agency_id: context.agencyId,
      brief: input.brief.trim() || null,
      client_account_id: input.clientId ?? null,
      created_by: context.userId,
      due_on: input.dueOn || null,
      kind: input.kind,
      name,
      property_id: input.propertyId ?? null,
      starts_on: input.startsOn || null,
      status: 'planned',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not create the job: ${error?.message ?? 'Unknown error'}`);
  return data.id;
}
