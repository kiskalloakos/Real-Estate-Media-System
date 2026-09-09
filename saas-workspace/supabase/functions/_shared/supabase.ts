import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase function environment is incomplete.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function bearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function authenticatedUser(
  request: Request,
  client = serviceClient(),
): Promise<User> {
  const token = bearerToken(request);
  if (!token) {
    throw new FunctionHttpError(401, 'Sign in before managing Instagram accounts.');
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new FunctionHttpError(401, 'Your session has expired. Please sign in again.');
  }

  return data.user;
}

export class FunctionHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ConnectionAccess = {
  agencyId: string;
  clientAccountId: string;
  isAdmin: boolean;
};

export async function requireAgencyAdmin(
  client: SupabaseClient,
  userId: string,
  agencyId?: string,
) {
  let query = client
    .from('agency_memberships')
    .select('agency_id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .eq('status', 'active');

  if (agencyId) query = query.eq('agency_id', agencyId);

  const { data: membership, error } = await query.limit(1).maybeSingle();
  if (error || !membership) {
    throw new FunctionHttpError(
      403,
      'Only a Realty Media administrator can manage agency Instagram accounts.',
    );
  }

  return { agencyId: membership.agency_id as string };
}

export async function requireClientAccess(
  client: SupabaseClient,
  userId: string,
  clientAccountId: string,
): Promise<ConnectionAccess> {
  const { data: account, error: accountError } = await client
    .from('client_accounts')
    .select('id, agency_id, archived_at')
    .eq('id', clientAccountId)
    .maybeSingle();

  if (accountError || !account || account.archived_at) {
    throw new FunctionHttpError(404, 'Client account not found.');
  }

  const [{ data: adminMembership }, { data: clientMembership }] = await Promise.all([
    client
      .from('agency_memberships')
      .select('id')
      .eq('agency_id', account.agency_id)
      .eq('user_id', userId)
      .eq('role', 'admin')
      .eq('status', 'active')
      .maybeSingle(),
    client
      .from('client_memberships')
      .select('id')
      .eq('client_account_id', clientAccountId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  if (!adminMembership && !clientMembership) {
    throw new FunctionHttpError(
      403,
      'Only Realty Media admins and members of this client account can manage Instagram.',
    );
  }

  return {
    agencyId: account.agency_id,
    clientAccountId,
    isAdmin: Boolean(adminMembership),
  };
}

export async function requireConnectionAccess(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
) {
  const { data: connection, error } = await client
    .from('instagram_connections')
    .select(
      'id, agency_id, client_account_id, instagram_business_id, username, status, archived_at',
    )
    .eq('id', connectionId)
    .maybeSingle();

  if (error || !connection || connection.archived_at) {
    throw new FunctionHttpError(404, 'Instagram connection not found.');
  }

  if (connection.client_account_id) {
    await requireClientAccess(client, userId, connection.client_account_id);
  } else {
    await requireAgencyAdmin(client, userId, connection.agency_id);
  }
  return connection;
}

export async function requireTikTokConnectionAccess(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
) {
  const { data: connection, error } = await client
    .from('tiktok_connections')
    .select(
      'id, agency_id, client_account_id, open_id, username, status, archived_at',
    )
    .eq('id', connectionId)
    .maybeSingle();

  if (error || !connection || connection.archived_at) {
    throw new FunctionHttpError(404, 'TikTok connection not found.');
  }

  if (connection.client_account_id) {
    await requireClientAccess(client, userId, connection.client_account_id);
  } else {
    await requireAgencyAdmin(client, userId, connection.agency_id);
  }
  return connection;
}
