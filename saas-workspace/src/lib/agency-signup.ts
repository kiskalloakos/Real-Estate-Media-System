import { supabase } from '@/lib/supabase';
import { normalizeAgencySignup, type AgencySignupInput } from '@/lib/agency-signup-validation';

export async function signUpAgencyOwner(input: AgencySignupInput) {
  if (!supabase) throw new Error('Account creation is unavailable on this build.');
  const account = normalizeAgencySignup(input);
  const emailRedirectTo = process.env.EXPO_OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/`
    : 'https://app.realtymedia.ro/';
  const { data, error } = await supabase.auth.signUp({
    email: account.email,
    password: account.password,
    options: {
      emailRedirectTo,
      data: {
        signup_role: 'agency_owner',
        agency_name: account.agencyName,
        full_name: account.fullName,
        display_name: account.fullName,
      },
    },
  });
  if (error) throw new Error(error.message);
  // Supabase deliberately returns a non-disclosing response for existing emails.
  // Only a verified new owner is provisioned by the database signup triggers.
  return { needsEmailConfirmation: !data.session };
}
