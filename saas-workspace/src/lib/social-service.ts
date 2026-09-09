import { supabase } from '@/lib/supabase';

type FunctionErrorPayload = {
  error?: string;
  message?: string;
};

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

export type SocialProvider = 'instagram' | 'tiktok';

function functionNames(provider: SocialProvider) {
  return provider === 'instagram'
    ? { oauth: 'instagram-oauth', sync: 'instagram-sync' }
    : { oauth: 'tiktok-oauth', sync: 'tiktok-sync' };
}

export async function beginSocialConnection(
  provider: SocialProvider,
  input:
    | { scope: 'agency' }
    | { clientAccountId: string; scope: 'client' },
) {
  const client = configuredClient();
  const { data, error } = await client.functions.invoke<{
    url?: string;
    error?: string;
  }>(functionNames(provider).oauth, {
    body: {
      action: 'start',
      clientAccountId: input.scope === 'client' ? input.clientAccountId : null,
      scope: input.scope,
    },
  });
  if (error || !data?.url) {
    throw new Error(
      data?.error ||
        (await functionErrorMessage(
          error,
          `Could not start ${provider === 'instagram' ? 'Facebook Login' : 'TikTok Login'}. Please try again.`,
        )),
    );
  }
  return data.url;
}

export async function disconnectSocialConnection(
  provider: SocialProvider,
  connectionId: string,
) {
  const client = configuredClient();
  const { data, error } = await client.functions.invoke<{
    disconnected?: boolean;
    error?: string;
  }>(functionNames(provider).oauth, {
    body: { action: 'disconnect', connectionId },
  });
  if (error || !data?.disconnected) {
    throw new Error(
      data?.error ||
        (await functionErrorMessage(
          error,
          `Could not disconnect ${provider === 'instagram' ? 'Instagram' : 'TikTok'}. Please try again.`,
        )),
    );
  }
}

export async function syncSocialAccount(
  provider: SocialProvider,
  connectionId: string,
) {
  const client = configuredClient();
  const { data, error } = await client.functions.invoke<{
    error?: string;
    mediaCount?: number;
    status?: 'succeeded' | 'partial';
    warnings?: string[];
  }>(functionNames(provider).sync, {
    body: { connectionId },
  });
  if (error || !data?.status) {
    throw new Error(
      data?.error ||
        (await functionErrorMessage(
          error,
          `Could not refresh ${provider === 'instagram' ? 'Instagram' : 'TikTok'} analytics. Please try again.`,
        )),
    );
  }
  return data;
}
