const apiBase = 'https://open.tiktokapis.com';

type TikTokErrorPayload = {
  error?:
    | string
    | {
        code?: string;
        log_id?: string;
        message?: string;
      };
  error_description?: string;
  message?: string;
};

export class TikTokApiError extends Error {
  readonly code?: string;

  constructor(operation: string, payload: TikTokErrorPayload, status: number) {
    const structuredError =
      payload.error && typeof payload.error === 'object'
        ? payload.error
        : undefined;
    const oauthError =
      typeof payload.error === 'string' ? payload.error : undefined;
    const message =
      structuredError?.message ||
      payload.error_description ||
      payload.message ||
      oauthError ||
      `TikTok returned HTTP ${status}.`;
    super(`${operation}: ${message}`);
    this.code = structuredError?.code ?? oauthError;
  }

  get isAuthenticationError() {
    return [
      'access_token_invalid',
      'invalid_token',
      'invalid_grant',
      'scope_not_authorized',
      'unauthorized',
    ].includes(this.code ?? '');
  }
}

function tiktokConfiguration() {
  const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY');
  const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET');
  const redirectUri =
    Deno.env.get('TIKTOK_REDIRECT_URI') ||
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/tiktok-oauth`;

  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error('TikTok OAuth is not configured.');
  }

  return { clientKey, clientSecret, redirectUri };
}

export function buildTikTokLoginUrl(state: string) {
  const { clientKey, redirectUri } = tiktokConfiguration();
  const scopes =
    Deno.env.get('TIKTOK_OAUTH_SCOPES') ||
    'user.info.basic,user.info.stats,video.list,video.publish';
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', clientKey);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', state);
  return url.toString();
}

async function formPost<T>(
  path: string,
  body: Record<string, string>,
  operation: string,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    body: new URLSearchParams(body),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const payload = (await response.json().catch(() => ({}))) as T &
    TikTokErrorPayload;
  if (!response.ok || payload.error_description || payload.error) {
    throw new TikTokApiError(operation, payload, response.status);
  }
  return payload;
}

export type TikTokToken = {
  access_token: string;
  expires_in?: number;
  open_id: string;
  refresh_expires_in?: number;
  refresh_token: string;
  scope?: string;
  token_type?: string;
};

export type TikTokCreatorInfo = {
  comment_disabled?: boolean;
  creator_avatar_url?: string;
  creator_nickname?: string;
  creator_username?: string;
  duet_disabled?: boolean;
  max_video_post_duration_sec?: number;
  privacy_level_options?: string[];
  stitch_disabled?: boolean;
};

export async function exchangeTikTokCode(code: string) {
  const { clientKey, clientSecret, redirectUri } = tiktokConfiguration();
  return formPost<TikTokToken>(
    '/v2/oauth/token/',
    {
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    },
    'TikTok authorization code exchange',
  );
}

export async function refreshTikTokToken(refreshToken: string) {
  const { clientKey, clientSecret } = tiktokConfiguration();
  return formPost<TikTokToken>(
    '/v2/oauth/token/',
    {
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    'TikTok token refresh',
  );
}

export async function revokeTikTokToken(accessToken: string) {
  const { clientKey, clientSecret } = tiktokConfiguration();
  await formPost<Record<string, never>>(
    '/v2/oauth/revoke/',
    {
      client_key: clientKey,
      client_secret: clientSecret,
      token: accessToken,
    },
    'TikTok token revoke',
  );
}

export async function queryTikTokCreatorInfo(accessToken: string) {
  const payload = await tiktokPost<{ data?: TikTokCreatorInfo }>(
    '/v2/post/publish/creator_info/query/',
    accessToken,
    {},
    {},
    'TikTok creator info',
  );
  if (!payload.data) {
    throw new Error('TikTok did not return creator info.');
  }
  return payload.data;
}

export async function tiktokGet<T>(
  path: string,
  token: string,
  parameters: Record<string, string>,
  operation: string,
): Promise<T> {
  const url = new URL(`${apiBase}${path}`);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = (await response.json()) as T & TikTokErrorPayload;
  const errorCode =
    payload.error && typeof payload.error === 'object'
      ? payload.error.code
      : payload.error;
  if (!response.ok || (errorCode && errorCode !== 'ok')) {
    throw new TikTokApiError(operation, payload, response.status);
  }
  return payload;
}

export async function tiktokPost<T>(
  path: string,
  token: string,
  parameters: Record<string, string>,
  body: unknown,
  operation: string,
): Promise<T> {
  const url = new URL(`${apiBase}${path}`);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = (await response.json()) as T & TikTokErrorPayload;
  const errorCode =
    payload.error && typeof payload.error === 'object'
      ? payload.error.code
      : payload.error;
  if (!response.ok || (errorCode && errorCode !== 'ok')) {
    throw new TikTokApiError(operation, payload, response.status);
  }
  return payload;
}

export function tokenExpiry(expiresIn?: number) {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}
