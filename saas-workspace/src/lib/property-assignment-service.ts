import { supabase } from '@/lib/supabase';
import type { UpdatePropertyAssignmentsInput } from '@/screens/web/types';

type AssignmentContext = {
  agencyId: string;
};

export async function setPropertyTeamAssignments(
  input: UpdatePropertyAssignmentsInput,
  context: AssignmentContext,
) {
  if (!supabase) {
    throw new Error('Supabase is not configured for this build.');
  }

  const { error } = await supabase.rpc('set_property_team_assignments', {
    p_agency_id: context.agencyId,
    p_property_ids: [...new Set(input.propertyIds)],
    p_user_id: input.userId,
  });

  if (error) {
    throw new Error(`Could not update property assignments: ${error.message}`);
  }
}
