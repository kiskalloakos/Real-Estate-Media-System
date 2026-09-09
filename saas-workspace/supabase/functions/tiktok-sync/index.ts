import { corsHeaders, json } from '../_shared/cors.ts';
import { syncTikTokConnection } from '../_shared/tiktok-sync.ts';
import {
  authenticatedUser,
  FunctionHttpError,
  requireTikTokConnectionAccess,
  serviceClient,
} from '../_shared/supabase.ts';

async function syncOne(request: Request, connectionId: string) {
  const client = serviceClient();
  const user = await authenticatedUser(request, client);
  await requireTikTokConnectionAccess(client, user.id, connectionId);
  return syncTikTokConnection(client, connectionId, 'manual');
}

async function syncDue(request: Request) {
  const expectedSecret = Deno.env.get('TIKTOK_SYNC_SECRET');
  const receivedSecret = request.headers.get('x-tiktok-sync-secret');
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    throw new FunctionHttpError(401, 'Invalid scheduled sync credential.');
  }

  const client = serviceClient();
  const { data: connections, error } = await client
    .from('tiktok_connections')
    .select('id')
    .in('status', ['active', 'sync_error'])
    .is('archived_at', null)
    .lte('next_sync_at', new Date().toISOString())
    .order('next_sync_at', { ascending: true })
    .limit(10);
  if (error) throw new Error(`Could not load due TikTok accounts: ${error.message}`);

  const results = [];
  for (const connection of connections ?? []) {
    try {
      results.push({
        connectionId: connection.id,
        result: await syncTikTokConnection(client, connection.id, 'scheduled'),
      });
    } catch (syncError) {
      results.push({
        connectionId: connection.id,
        error:
          syncError instanceof Error
            ? syncError.message
            : 'TikTok synchronization failed.',
      });
    }
  }
  return { results };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const body = (await request.json()) as {
      allDue?: boolean;
      connectionId?: string;
    };
    if (body.allDue) {
      return json(request, await syncDue(request));
    }
    if (!body.connectionId?.trim()) {
      throw new FunctionHttpError(400, 'Choose a TikTok account to refresh.');
    }
    return json(request, await syncOne(request, body.connectionId.trim()));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'TikTok synchronization failed.';
    const status = error instanceof FunctionHttpError ? error.status : 500;
    return json(request, { error: message }, status);
  }
});
