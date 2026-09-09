const apiVersion = Deno.env.get('META_API_VERSION') || 'v23.0';
const graphBase = `https://graph.facebook.com/${apiVersion}`;

type MetaErrorPayload = {
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
    type?: string;
  };
};

export class MetaApiError extends Error {
  readonly code?: number;
  readonly subcode?: number;

  constructor(operation: string, payload: MetaErrorPayload, status: number) {
    const metaError = payload.error;
    super(
      `${operation}: ${
        metaError?.message || `Meta returned HTTP ${status}.`
      }`,
    );
    this.code = metaError?.code;
    this.subcode = metaError?.error_subcode;
  }

  get isAuthenticationError() {
    return this.code === 190 || this.code === 102;
  }
}

function metaConfiguration() {
  const appId = Deno.env.get('META_APP_ID');
  const appSecret = Deno.env.get('META_APP_SECRET');
  const redirectUri =
    Deno.env.get('META_REDIRECT_URI') ||
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/instagram-oauth`;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error('Meta OAuth is not configured.');
  }

  return { appId, appSecret, redirectUri };
}

export function buildFacebookLoginUrl(state: string) {
  const { appId, redirectUri } = metaConfiguration();
  const url = new URL('https://www.facebook.com/dialog/oauth');
  const configId = Deno.env.get('META_OAUTH_CONFIG_ID');
  const scopes =
    Deno.env.get('META_OAUTH_SCOPES') ||
    'public_profile,pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_manage_insights';

  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  if (configId) {
    url.searchParams.set('config_id', configId);
    url.searchParams.set('override_default_response_type', 'true');
  } else {
    url.searchParams.set('scope', scopes);
  }

  return url.toString();
}

export async function graphGet<T>(
  path: string,
  token: string,
  parameters: Record<string, string> = {},
  operation = 'Meta request',
): Promise<T> {
  const url = new URL(`${graphBase}${path}`);
  if (token) {
    url.searchParams.set('access_token', token);
  }
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  const payload = (await response.json()) as T & MetaErrorPayload;
  if (!response.ok || payload.error) {
    throw new MetaApiError(operation, payload, response.status);
  }
  return payload;
}

export async function exchangeCode(code: string) {
  const { appId, appSecret, redirectUri } = metaConfiguration();
  const shortToken = await graphGet<{
    access_token: string;
    expires_in?: number;
  }>(
    '/oauth/access_token',
    '',
    {
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    },
    'Facebook Login code exchange',
  );

  const longLivedToken = await graphGet<{
    access_token: string;
    expires_in?: number;
  }>(
    '/oauth/access_token',
    '',
    {
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken.access_token,
      grant_type: 'fb_exchange_token',
    },
    'Facebook long-lived token exchange',
  );

  return {
    initialToken: shortToken,
    longLivedToken,
  };
}

type FacebookPage = {
  access_token?: string;
  id: string;
  name?: string;
  tasks?: string[];
};

export type DiscoveredInstagramAccount = {
  facebookPageId: string;
  facebookPageName?: string;
  instagramBusinessId: string;
  pageAccessToken: string;
  profilePictureUrl?: string;
  username?: string;
  displayName?: string;
};

type InstagramProfile = {
  id: string;
  name?: string;
  profile_picture_url?: string;
  username?: string;
};

type TokenTargets = {
  businessManagement: boolean;
  instagramIds: string[];
  pageIds: string[];
};

type MetaBatch<T> = {
  data?: T[];
  paging?: {
    next?: string;
  };
};

async function collectEdge<T>(
  path: string,
  token: string,
  parameters: Record<string, string>,
  operation: string,
) {
  const items: T[] = [];
  let nextPath: string | null = path;
  let nextParameters = parameters;
  const seen = new Set<string>();

  while (nextPath && items.length < 1000) {
    const batch: MetaBatch<T> = await graphGet(
      nextPath,
      token,
      nextParameters,
      operation,
    );
    items.push(...(batch.data ?? []));
    if (!batch.paging?.next || seen.has(batch.paging.next)) break;
    seen.add(batch.paging.next);
    const next = new URL(batch.paging.next);
    nextPath = next.pathname.replace(`/${apiVersion}`, '');
    nextParameters = Object.fromEntries(next.searchParams);
  }

  return items;
}

async function inspectTokenTargets(token: string): Promise<TokenTargets> {
  const { appId, appSecret } = metaConfiguration();
  const debug = await graphGet<{
    data?: {
      granular_scopes?: Array<{
        scope?: string;
        target_ids?: string[];
      }>;
      scopes?: string[];
    };
  }>(
    '/debug_token',
    '',
    {
      access_token: `${appId}|${appSecret}`,
      input_token: token,
    },
    'Facebook token inspection',
  );
  const pageIds = new Set<string>();
  const instagramIds = new Set<string>();
  for (const scope of debug.data?.granular_scopes ?? []) {
    if (scope.scope === 'pages_show_list') {
      (scope.target_ids ?? []).forEach((id) => pageIds.add(id));
    }
    if (scope.scope === 'instagram_basic') {
      (scope.target_ids ?? []).forEach((id) => instagramIds.add(id));
    }
  }
  return {
    businessManagement:
      debug.data?.scopes?.includes('business_management') ?? false,
    instagramIds: [...instagramIds],
    pageIds: [...pageIds],
  };
}

function fetchInstagramProfile(id: string, token: string) {
  return graphGet<InstagramProfile>(
    `/${id}`,
    token,
    { fields: 'id,username,name,profile_picture_url' },
    `Instagram profile discovery for ${id}`,
  );
}

async function discoverWithToken(userToken: string) {
  const pages = new Map<string, FacebookPage>();
  const directInstagram = new Map<string, InstagramProfile>();
  let targets: TokenTargets = {
    businessManagement: false,
    instagramIds: [],
    pageIds: [],
  };

  try {
    targets = await inspectTokenTargets(userToken);
  } catch {
    // Token inspection is diagnostic. Page discovery can still succeed without it.
  }

  try {
    const managedPages = await collectEdge<FacebookPage>(
      '/me/accounts',
      userToken,
      { fields: 'id,name,access_token,tasks', limit: '100' },
      'Facebook Page discovery',
    );
    managedPages.forEach((page) => pages.set(page.id, page));
  } catch {
    // Granular targets and Business Portfolio assets below are valid fallbacks.
  }

  targets.pageIds.forEach((id) => {
    if (!pages.has(id)) pages.set(id, { id });
  });

  if (targets.businessManagement) {
    try {
      const businesses = await collectEdge<{ id: string; name?: string }>(
        '/me/businesses',
        userToken,
        { fields: 'id,name', limit: '100' },
        'Business Portfolio discovery',
      );
      for (const business of businesses) {
        for (const edge of ['owned_pages', 'client_pages'] as const) {
          try {
            const portfolioPages = await collectEdge<FacebookPage>(
              `/${business.id}/${edge}`,
              userToken,
              { fields: 'id,name,access_token,tasks', limit: '100' },
              `Business Portfolio ${edge} discovery`,
            );
            portfolioPages.forEach((page) => {
              const existing = pages.get(page.id);
              pages.set(page.id, {
                ...existing,
                ...page,
                access_token: page.access_token ?? existing?.access_token,
              });
            });
          } catch {
            // A portfolio can expose one edge while denying another.
          }
        }
        try {
          const portfolioInstagram = await collectEdge<InstagramProfile>(
            `/${business.id}/owned_instagram_accounts`,
            userToken,
            { fields: 'id,username,name,profile_picture_url', limit: '100' },
            'Business Portfolio Instagram discovery',
          );
          portfolioInstagram.forEach((account) =>
            directInstagram.set(account.id, account),
          );
        } catch {
          // Page-linked discovery can still succeed.
        }
      }
    } catch {
      // The user may have granted granular assets without portfolio enumeration.
    }
  }

  for (const instagramId of targets.instagramIds) {
    if (directInstagram.has(instagramId)) continue;
    try {
      directInstagram.set(
        instagramId,
        await fetchInstagramProfile(instagramId, userToken),
      );
    } catch {
      // A Page-linked lookup may still provide the same account.
    }
  }

  const discovered = new Map<string, DiscoveredInstagramAccount>();
  for (const page of pages.values()) {
    const tokens = [...new Set([page.access_token, userToken].filter(Boolean))] as string[];
    for (const token of tokens) {
      try {
        const linked = await graphGet<{
          id: string;
          name?: string;
          instagram_business_account?: InstagramProfile;
        }>(
          `/${page.id}`,
          token,
          {
            fields:
              'id,name,instagram_business_account{id,username,name,profile_picture_url}',
          },
          `Instagram account discovery for ${page.name || page.id}`,
        );
        const instagram = linked.instagram_business_account;
        if (!instagram?.id) break;
        discovered.set(instagram.id, {
          displayName: instagram.name,
          facebookPageId: page.id,
          facebookPageName: linked.name || page.name,
          instagramBusinessId: instagram.id,
          pageAccessToken: token,
          profilePictureUrl: instagram.profile_picture_url,
          username: instagram.username,
        });
        directInstagram.delete(instagram.id);
        break;
      } catch {
        // Retry the same Page with the user token when its Page token is stale.
      }
    }
  }

  for (const account of directInstagram.values()) {
    if (discovered.has(account.id)) continue;
    discovered.set(account.id, {
      displayName: account.name,
      // The legacy schema requires a non-empty asset id. For portfolio/granular
      // discovery there may be no visible Page edge, so retain the IG asset id.
      facebookPageId: account.id,
      facebookPageName: 'Business Portfolio',
      instagramBusinessId: account.id,
      pageAccessToken: userToken,
      profilePictureUrl: account.profile_picture_url,
      username: account.username,
    });
  }

  return [...discovered.values()];
}

export async function discoverInstagramAccounts(input: {
  initialToken: string;
  longLivedToken: string;
}) {
  const longLivedAccounts = await discoverWithToken(input.longLivedToken);
  if (longLivedAccounts.length) return longLivedAccounts;
  if (input.initialToken === input.longLivedToken) return [];

  const initialAccounts = await discoverWithToken(input.initialToken);
  const verified: DiscoveredInstagramAccount[] = [];
  for (const account of initialAccounts) {
    try {
      const profile = await fetchInstagramProfile(
        account.instagramBusinessId,
        input.longLivedToken,
      );
      verified.push({
        ...account,
        displayName: profile.name ?? account.displayName,
        pageAccessToken: input.longLivedToken,
        profilePictureUrl:
          profile.profile_picture_url ?? account.profilePictureUrl,
        username: profile.username ?? account.username,
      });
    } catch {
      // Do not persist an expiring short-lived credential.
    }
  }
  return verified;
}

export function tokenExpiry(expiresIn?: number) {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}
