import { corsHeaders, json } from '../_shared/cors.ts';
import { syncInstagramConnection } from '../_shared/instagram-sync.ts';
import {
  buildFacebookLoginUrl,
  discoverInstagramAccounts,
  exchangeCode,
  tokenExpiry,
} from '../_shared/meta.ts';
import {
  authenticatedUser,
  FunctionHttpError,
  requireAgencyAdmin,
  requireClientAccess,
  requireConnectionAccess,
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
  redirect.searchParams.set('instagram', result);
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
    throw new FunctionHttpError(400, 'Choose a client before connecting Instagram.');
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
  const { error } = await client.from('instagram_oauth_states').insert({
    agency_id: agencyId,
    client_account_id: scopedClientAccountId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    initiated_by: user.id,
    state_hash: stateHash,
  });
  if (error) {
    throw new Error(`Could not start Facebook Login: ${error.message}`);
  }

  return json(request, { url: buildFacebookLoginUrl(state) });
}

async function disconnectConnection(
  request: Request,
  body: { connectionId?: string },
) {
  const client = serviceClient();
  const user = await authenticatedUser(request, client);
  const connectionId = body.connectionId?.trim();
  if (!connectionId) {
    throw new FunctionHttpError(400, 'Choose an Instagram account to disconnect.');
  }

  await requireConnectionAccess(client, user.id, connectionId);
  const { error } = await client.rpc('disconnect_instagram_connection', {
    p_connection_id: connectionId,
  });
  if (error) {
    throw new Error(`Could not disconnect Instagram: ${error.message}`);
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
        'Facebook Login was cancelled.',
    });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return webRedirect('error', { message: 'Facebook Login did not return a valid code.' });
  }

  const stateHash = await hashState(state);
  const { data: storedState, error: stateError } = await client
    .from('instagram_oauth_states')
    .select('state_hash, agency_id, client_account_id, initiated_by, expires_at')
    .eq('state_hash', stateHash)
    .maybeSingle();
  if (stateError || !storedState) {
    return webRedirect('error', { message: 'This Facebook Login link has expired.' });
  }

  await client
    .from('instagram_oauth_states')
    .delete()
    .eq('state_hash', stateHash);

  if (new Date(storedState.expires_at).valueOf() <= Date.now()) {
    return webRedirect('error', { message: 'This Facebook Login link has expired.' });
  }

  const token = await exchangeCode(code);
  const accounts = await discoverInstagramAccounts({
    initialToken: token.initialToken.access_token,
    longLivedToken: token.longLivedToken.access_token,
  });
  if (!accounts.length) {
    return webRedirect('error', {
      message:
        'Facebook authorized the login, but the selected Instagram assets were not returned after token verification. Reconnect and select every relevant Page and Instagram account.',
    });
  }

  const connectionIds: string[] = [];
  for (const account of accounts) {
    const { data: connectionId, error } = await client.rpc(
      'upsert_instagram_connection_secret',
      {
        p_access_token: account.pageAccessToken,
        p_agency_id: storedState.agency_id,
        p_client_account_id: storedState.client_account_id,
        p_connected_by: storedState.initiated_by,
        p_display_name: account.displayName ?? '',
        p_facebook_page_id: account.facebookPageId,
        p_facebook_page_name: account.facebookPageName ?? '',
        p_instagram_business_id: account.instagramBusinessId,
        p_profile_picture_url: account.profilePictureUrl ?? '',
        p_token_expires_at: tokenExpiry(token.longLivedToken.expires_in),
        p_username: account.username ?? '',
      },
    );
    if (error || !connectionId) {
      throw new Error(
        error?.message || 'Could not store the Instagram connection.',
      );
    }
    connectionIds.push(connectionId);
  }

  const syncResults = await Promise.allSettled(
    connectionIds.map((connectionId) =>
      syncInstagramConnection(client, connectionId, 'connect'),
    ),
  );
  const synced = syncResults.filter((result) => result.status === 'fulfilled').length;

  return webRedirect('connected', {
    accounts: connectionIds.length,
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
    return json(request, { error: 'Unknown Instagram action.' }, 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Instagram connection failed.';
    if (request.method === 'GET') {
      return webRedirect('error', { message });
    }
    const status = error instanceof FunctionHttpError ? error.status : 500;
    return json(request, { error: message }, status);
  }
});
