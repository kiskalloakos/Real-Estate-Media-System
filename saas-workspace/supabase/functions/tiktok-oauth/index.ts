import { corsHeaders, json } from '../_shared/cors.ts';
import { syncTikTokConnection } from '../_shared/tiktok-sync.ts';
import {
  buildTikTokLoginUrl,
  exchangeTikTokCode,
  queryTikTokCreatorInfo,
  revokeTikTokToken,
  tokenExpiry,
} from '../_shared/tiktok.ts';
import {
  authenticatedUser,
  FunctionHttpError,
  requireAgencyAdmin,
  requireClientAccess,
  requireTikTokConnectionAccess,
  serviceClient,
} from '../_shared/supabase.ts';

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hashState(state: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(state),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function webRedirect(
  result: 'connected' | 'error',
  parameters: Record<string, string | number> = {},
) {
  const webUrl =
    Deno.env.get('REALTY_MEDIA_WEB_URL') ||
    'https://app.realtymedia.ro';
  const redirect = new URL(webUrl);
  redirect.searchParams.set('tiktok', result);
  for (const [key, value] of Object.entries(parameters)) {
    redirect.searchParams.set(key, String(value));
  }
  return Response.redirect(redirect, 302);
}

async function beginConnection(
  request: Request,
  body: { clientAccountId?: string; scope?: 'agency' | 'client' },
) {
  const client = serviceClient();
  const user = await authenticatedUser(request, client);
  const clientAccountId = body.clientAccountId?.trim();
  const scope = body.scope === 'agency' ? 'agency' : 'client';
  if (scope === 'client' && !clientAccountId) {
    throw new FunctionHttpError(400, 'Choose a client before connecting TikTok.');
  }

  let agencyId: string;
  let scopedClientAccountId: string | null;

  if (scope === 'agency') {
    const agencyAccess = await requireAgencyAdmin(client, user.id);
    agencyId = agencyAccess.agencyId;
    scopedClientAccountId = null;
  } else {
    const clientAccess = await requireClientAccess(client, user.id, clientAccountId as string);
    agencyId = clientAccess.agencyId;
    scopedClientAccountId = clientAccess.clientAccountId;
  }

  const state = randomState();
  const stateHash = await hashState(state);
  const { error } = await client.from('tiktok_oauth_states').insert({
    agency_id: agencyId,
    client_account_id: scopedClientAccountId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    initiated_by: user.id,
    state_hash: stateHash,
  });
  if (error) {
    throw new Error(`Could not start TikTok Login: ${error.message}`);
  }

  return json(request, { url: buildTikTokLoginUrl(state) });
}

async function disconnectConnection(
  request: Request,
  body: { connectionId?: string },
) {
  const client = serviceClient();
  const user = await authenticatedUser(request, client);
  const connectionId = body.connectionId?.trim();
  if (!connectionId) {
    throw new FunctionHttpError(400, 'Choose a TikTok account to disconnect.');
  }

  await requireTikTokConnectionAccess(client, user.id, connectionId);
  const { data: secrets } = await client.rpc('get_tiktok_connection_secrets', {
    p_connection_id: connectionId,
  });
  const accessToken = Array.isArray(secrets) ? secrets[0]?.access_token : secrets?.access_token;
  if (accessToken) {
    try {
      await revokeTikTokToken(accessToken);
    } catch {
      // Local disconnect should still complete if TikTok revoke is temporarily unavailable.
    }
  }
  const { error } = await client.rpc('disconnect_tiktok_connection', {
    p_connection_id: connectionId,
  });
  if (error) {
    throw new Error(`Could not disconnect TikTok: ${error.message}`);
  }

  return json(request, { disconnected: true });
}

async function finishConnection(request: Request) {
  const client = serviceClient();
  const url = new URL(request.url);
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    return webRedirect('error', {
      message:
        url.searchParams.get('error_description') ||
        'TikTok Login was cancelled.',
    });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return webRedirect('error', { message: 'TikTok Login did not return a valid code.' });
  }

  const stateHash = await hashState(state);
  const { data: storedState, error: stateError } = await client
    .from('tiktok_oauth_states')
    .select('state_hash, agency_id, client_account_id, initiated_by, expires_at')
    .eq('state_hash', stateHash)
    .maybeSingle();
  if (stateError || !storedState) {
    return webRedirect('error', { message: 'This TikTok Login link has expired.' });
  }

  await client
    .from('tiktok_oauth_states')
    .delete()
    .eq('state_hash', stateHash);

  if (new Date(storedState.expires_at).valueOf() <= Date.now()) {
    return webRedirect('error', { message: 'This TikTok Login link has expired.' });
  }

  const token = await exchangeTikTokCode(code);
  const creator = await queryTikTokCreatorInfo(token.access_token);

  const { data: connectionId, error } = await client.rpc(
    'upsert_tiktok_connection_secret',
    {
      p_access_token: token.access_token,
      p_agency_id: storedState.agency_id,
      p_client_account_id: storedState.client_account_id,
      p_connected_by: storedState.initiated_by,
      p_display_name: creator.creator_nickname ?? '',
      p_open_id: token.open_id,
      p_profile_picture_url: creator.creator_avatar_url ?? '',
      p_profile_url: '',
      p_refresh_token: token.refresh_token,
      p_refresh_token_expires_at: tokenExpiry(token.refresh_expires_in),
      p_token_expires_at: tokenExpiry(token.expires_in),
      p_union_id: '',
      p_username: creator.creator_username ?? creator.creator_nickname ?? token.open_id,
    },
  );
  if (error || !connectionId) {
    throw new Error(error?.message || 'Could not store the TikTok connection.');
  }

  const syncResult = await Promise.allSettled([
    syncTikTokConnection(client, connectionId, 'connect'),
  ]);
  const synced = syncResult.filter((result) => result.status === 'fulfilled').length;

  return webRedirect('connected', {
    accounts: 1,
    synced,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) });
  }

  try {
    if (request.method === 'GET') {
      return await finishConnection(request);
    }
    if (request.method !== 'POST') {
      return json(request, { error: 'Method not allowed.' }, 405);
    }

    const body = (await request.json()) as {
      action?: string;
      clientAccountId?: string;
      connectionId?: string;
      scope?: 'agency' | 'client';
    };
    const action = body.action || 'start';
    if (action === 'start') return await beginConnection(request, body);
    if (action === 'disconnect') return await disconnectConnection(request, body);
    return json(request, { error: 'Unknown TikTok action.' }, 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'TikTok connection failed.';
    if (request.method === 'GET') {
      return webRedirect('error', { message });
    }
    const status = error instanceof FunctionHttpError ? error.status : 500;
    return json(request, { error: message }, status);
  }
});
