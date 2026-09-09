import { passwordResetRedirectUrl } from '@/lib/app-urls';
import { supabase } from '@/lib/supabase';

export async function sendPasswordSetupEmail(email: string) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: passwordResetRedirectUrl() },
  );

  if (error) {
    throw new Error(`Could not send the password setup email: ${error.message}`);
  }
}
