import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  refreshTikTokToken,
  tiktokGet,
  tiktokPost,
  TikTokApiError,
  tokenExpiry,
} from './tiktok.ts';

type Connection = {
  agency_id: string;
  client_account_id: string | null;
  id: string;
  open_id: string;
  status: string;
  token_expires_at: string | null;
};

type TriggerSource = 'connect' | 'manual' | 'scheduled';

type TikTokUser = {
  avatar_url?: string;
  bio_description?: string;
  display_name?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  open_id: string;
  union_id?: string;
  video_count?: number;
};

type TikTokVideo = {
  comment_count?: number;
  cover_image_url?: string;
  create_time?: number;
  id: string;
  like_count?: number;
  share_count?: number;
  share_url?: string;
  title?: string;
  video_description?: string;
  view_count?: number;
};

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function dateKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Math.max(0, Number(value));
  }
  return null;
}

async function secretsForConnection(client: SupabaseClient, connectionId: string) {
  const { data, error } = await client.rpc('get_tiktok_connection_secrets', {
    p_connection_id: connectionId,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.access_token || !row?.refresh_token) {
    throw new Error('The TikTok access token is missing.');
  }
  return {
    accessToken: row.access_token as string,
    refreshToken: row.refresh_token as string,
  };
}

async function refreshIfNeeded(
  client: SupabaseClient,
  connection: Connection,
  accessToken: string,
  refreshToken: string,
) {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).valueOf()
    : 0;
  if (expiresAt > Date.now() + 10 * 60 * 1000) {
    return { accessToken, refreshToken };
  }

  const refreshed = await refreshTikTokToken(refreshToken);
  await client.rpc('update_tiktok_connection_secrets', {
    p_access_token: refreshed.access_token,
    p_connection_id: connection.id,
    p_refresh_token: refreshed.refresh_token,
    p_refresh_token_expires_at: tokenExpiry(refreshed.refresh_expires_in),
    p_token_expires_at: tokenExpiry(refreshed.expires_in),
  });
  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
  };
}

async function fetchTikTokProfile(accessToken: string) {
  const payload = await tiktokGet<{
    data?: { user?: TikTokUser };
  }>(
    '/v2/user/info/',
    accessToken,
    {
      fields:
        'open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count',
    },
    'TikTok profile',
  );
  if (!payload.data?.user?.open_id) {
    throw new Error('TikTok did not return a user profile.');
  }
  return payload.data.user;
}

async function fetchTikTokVideos(
  connection: Connection,
  accessToken: string,
  warnings: string[],
) {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const rows = [];
  let cursor = 0;
  let hasMore = true;

  while (hasMore && rows.length < 300) {
    const payload = await tiktokPost<{
      data?: {
        cursor?: number;
        has_more?: boolean;
        videos?: TikTokVideo[];
      };
    }>(
      '/v2/video/list/',
      accessToken,
      {
        fields:
          'id,title,video_description,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count',
      },
      { cursor, max_count: 20 },
      'TikTok video list',
    );

    let reachedCutoff = false;
    for (const video of payload.data?.videos ?? []) {
      const postedAt = video.create_time
        ? new Date(video.create_time * 1000).toISOString()
        : null;
      if (postedAt && new Date(postedAt).valueOf() < cutoff) {
        reachedCutoff = true;
        continue;
      }

      const likes = numericValue(video.like_count);
      const comments = numericValue(video.comment_count);
      const shares = numericValue(video.share_count);
      rows.push({
        agency_id: connection.agency_id,
        caption: video.video_description ?? video.title ?? null,
        client_account_id: connection.client_account_id,
        comments,
        connection_id: connection.id,
        fetched_at: new Date().toISOString(),
        likes,
        media_type: 'VIDEO',
        permalink: video.share_url ?? null,
        posted_at: postedAt,
        saves: null,
        shares,
        thumbnail_url: video.cover_image_url ?? null,
        tiktok_video_id: video.id,
        total_interactions: [likes, comments, shares].reduce<number>(
          (sum, value) => sum + (value ?? 0),
          0,
        ),
        views: numericValue(video.view_count),
      });
    }

    hasMore = Boolean(payload.data?.has_more) && !reachedCutoff;
    cursor = payload.data?.cursor ?? cursor;
    if (!hasMore || reachedCutoff) break;
  }

  if (rows.length === 300) {
    warnings.push('Video history was limited to the latest 300 TikToks.');
  }
  return rows;
}

export async function syncTikTokConnection(
  client: SupabaseClient,
  connectionId: string,
  triggerSource: TriggerSource,
) {
  const { data: connection, error: connectionError } = await client
    .from('tiktok_connections')
    .select('id, agency_id, client_account_id, open_id, status, token_expires_at')
    .eq('id', connectionId)
    .single();
  if (connectionError || !connection) {
    throw new Error('TikTok connection no longer exists.');
  }

  const { data: run, error: runError } = await client
    .from('tiktok_sync_runs')
    .insert({
      agency_id: connection.agency_id,
      client_account_id: connection.client_account_id,
      connection_id: connection.id,
      status: 'running',
      trigger_source: triggerSource,
    })
    .select('id')
    .single();
  if (runError || !run) throw new Error('Could not start the TikTok sync.');

  const warnings: string[] = [];

  try {
    const secrets = await secretsForConnection(client, connection.id);
    const refreshed = await refreshIfNeeded(
      client,
      connection,
      secrets.accessToken,
      secrets.refreshToken,
    );
    const profile = await fetchTikTokProfile(refreshed.accessToken);
    const mediaRows = await fetchTikTokVideos(connection, refreshed.accessToken, warnings);
    const todayKey = dateKey(startOfUtcDay(new Date()));
    const views = mediaRows.reduce((sum, media) => sum + (media.views ?? 0), 0);
    const comments = mediaRows.reduce((sum, media) => sum + (media.comments ?? 0), 0);
    const shares = mediaRows.reduce((sum, media) => sum + (media.shares ?? 0), 0);
    const likes = numericValue(profile.likes_count);
    const dailyRow = {
      agency_id: connection.agency_id,
      client_account_id: connection.client_account_id,
      comments,
      connection_id: connection.id,
      fetched_at: new Date().toISOString(),
      followers_count: numericValue(profile.follower_count),
      follows_count: numericValue(profile.following_count),
      likes,
      media_count: numericValue(profile.video_count),
      metric_date: todayKey,
      shares,
      total_interactions: [likes, comments, shares].reduce<number>(
        (sum, value) => sum + (value ?? 0),
        0,
      ),
      views,
    };

    const { error: metricsError } = await client
      .from('tiktok_account_daily_metrics')
      .upsert(dailyRow, { onConflict: 'connection_id,metric_date' });
    if (metricsError) {
      throw new Error(`Could not store TikTok account metrics: ${metricsError.message}`);
    }

    if (mediaRows.length) {
      const { error } = await client
        .from('tiktok_media')
        .upsert(mediaRows, { onConflict: 'connection_id,tiktok_video_id' });
      if (error) throw new Error(`Could not store TikTok videos: ${error.message}`);
    }

    const completedAt = new Date().toISOString();
    const status = warnings.length ? 'partial' : 'succeeded';
    await Promise.all([
      client
        .from('tiktok_connections')
        .update({
          display_name: profile.display_name ?? null,
          last_sync_error: warnings.length ? warnings.join(' ') : null,
          last_synced_at: completedAt,
          next_sync_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          profile_picture_url: profile.avatar_url ?? null,
          profile_url: null,
          status: 'active',
          union_id: profile.union_id ?? null,
          username: profile.display_name ?? profile.open_id,
        })
        .eq('id', connection.id),
      client
        .from('tiktok_sync_runs')
        .update({
          completed_at: completedAt,
          status,
          warning_messages: warnings,
        })
        .eq('id', run.id),
    ]);

    return {
      account: profile.display_name || profile.open_id,
      mediaCount: mediaRows.length,
      status,
      warnings,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'TikTok synchronization failed.';
    const needsReauth =
      error instanceof TikTokApiError && error.isAuthenticationError;
    const completedAt = new Date().toISOString();
    await Promise.all([
      client
        .from('tiktok_connections')
        .update({
          last_sync_error: message,
          next_sync_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          status: needsReauth ? 'needs_reauth' : 'sync_error',
        })
        .eq('id', connection.id),
      client
        .from('tiktok_sync_runs')
        .update({
          completed_at: completedAt,
          error_message: message,
          status: 'failed',
          warning_messages: warnings,
        })
        .eq('id', run.id),
    ]);
    throw error;
  }
}
