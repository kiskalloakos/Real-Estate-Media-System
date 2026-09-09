import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { graphGet, MetaApiError } from './meta.ts';

type Connection = {
  agency_id: string;
  client_account_id: string | null;
  facebook_page_id: string;
  id: string;
  instagram_business_id: string;
  status: string;
};

type TriggerSource = 'connect' | 'manual' | 'scheduled';

type MediaRow = {
  agency_id: string;
  caption: string | null;
  client_account_id: string | null;
  comments: number | null;
  connection_id: string;
  fetched_at: string;
  instagram_media_id: string;
  likes: number | null;
  media_product_type: string | null;
  media_type: string | null;
  permalink: string | null;
  posted_at: string | null;
  reach: number | null;
  saves: number | null;
  shares: number | null;
  thumbnail_url: string | null;
  total_interactions: number | null;
  views: number | null;
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
  if (value && typeof value === 'object' && 'value' in value) {
    return numericValue((value as { value: unknown }).value);
  }
  return null;
}

async function fetchDailyMetric(
  instagramBusinessId: string,
  accessToken: string,
  metric: string,
  since: Date,
  until: Date,
) {
  const payload = await graphGet<{
    data?: Array<{
      name?: string;
      total_value?: { value?: unknown };
      values?: Array<{ end_time?: string; value?: unknown }>;
    }>;
  }>(
    `/${instagramBusinessId}/insights`,
    accessToken,
    {
      metric,
      period: 'day',
      since: Math.floor(since.valueOf() / 1000).toString(),
      until: Math.floor(until.valueOf() / 1000).toString(),
    },
    `Instagram ${metric} insights`,
  );

  const result = new Map<string, number>();
  for (const series of payload.data ?? []) {
    for (const point of series.values ?? []) {
      if (!point.end_time) continue;
      const value = numericValue(point.value);
      if (value !== null) result.set(dateKey(point.end_time), value);
    }
    const total = numericValue(series.total_value?.value);
    if (total !== null && result.size === 0) {
      result.set(dateKey(until), total);
    }
  }
  return result;
}

async function fetchMediaInsight(
  mediaId: string,
  accessToken: string,
  metric: string,
) {
  try {
    const payload = await graphGet<{
      data?: Array<{
        total_value?: { value?: unknown };
        values?: Array<{ value?: unknown }>;
      }>;
    }>(
      `/${mediaId}/insights`,
      accessToken,
      { metric },
      `Instagram media ${metric}`,
    );
    const insight = payload.data?.[0];
    return numericValue(
      insight?.total_value?.value ?? insight?.values?.[0]?.value,
    );
  } catch (error) {
    if (error instanceof MetaApiError && !error.isAuthenticationError) {
      return null;
    }
    throw error;
  }
}

async function fetchRecentMedia(
  connection: Connection,
  accessToken: string,
  warnings: string[],
) {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const rows: MediaRow[] = [];
  let path: string | null = `/${connection.instagram_business_id}/media`;
  let parameters: Record<string, string> = {
    fields:
      'id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp,like_count,comments_count',
    limit: '50',
  };

  while (path && rows.length < 300) {
    const batch: {
      data?: Array<{
        caption?: string;
        comments_count?: number;
        id: string;
        like_count?: number;
        media_product_type?: string;
        media_type?: string;
        permalink?: string;
        thumbnail_url?: string;
        timestamp?: string;
      }>;
      paging?: { next?: string };
    } = await graphGet(path, accessToken, parameters, 'Instagram recent media');

    let reachedCutoff = false;
    for (const media of batch.data ?? []) {
      if (media.timestamp && new Date(media.timestamp).valueOf() < cutoff) {
        reachedCutoff = true;
        continue;
      }

      const [views, reach, saved, shares, totalInteractions] = await Promise.all([
        fetchMediaInsight(media.id, accessToken, 'views'),
        fetchMediaInsight(media.id, accessToken, 'reach'),
        fetchMediaInsight(media.id, accessToken, 'saved'),
        fetchMediaInsight(media.id, accessToken, 'shares'),
        fetchMediaInsight(media.id, accessToken, 'total_interactions'),
      ]);
      const likes = numericValue(media.like_count);
      const comments = numericValue(media.comments_count);

      rows.push({
        agency_id: connection.agency_id,
        caption: media.caption ?? null,
        client_account_id: connection.client_account_id,
        comments,
        connection_id: connection.id,
        fetched_at: new Date().toISOString(),
        instagram_media_id: media.id,
        likes,
        media_product_type: media.media_product_type ?? null,
        media_type: media.media_type ?? null,
        permalink: media.permalink ?? null,
        posted_at: media.timestamp ?? null,
        reach,
        saves: saved,
        shares,
        thumbnail_url: media.thumbnail_url ?? null,
        total_interactions:
          totalInteractions ??
          [likes, comments, saved, shares].reduce<number>(
            (sum, value) => sum + (value ?? 0),
            0,
          ),
        views,
      });
    }

    if (reachedCutoff || !batch.paging?.next) break;
    const next: URL = new URL(batch.paging.next);
    path = next.pathname.replace(/^\/v\d+\.\d+/, '');
    parameters = Object.fromEntries(next.searchParams);
    delete parameters.access_token;
  }

  if (rows.length === 300) {
    warnings.push('Media history was limited to the latest 300 posts.');
  }
  return rows;
}

export async function syncInstagramConnection(
  client: SupabaseClient,
  connectionId: string,
  triggerSource: TriggerSource,
) {
  const { data: connection, error: connectionError } = await client
    .from('instagram_connections')
    .select(
      'id, agency_id, client_account_id, instagram_business_id, facebook_page_id, status',
    )
    .eq('id', connectionId)
    .single();
  if (connectionError || !connection) {
    throw new Error('Instagram connection no longer exists.');
  }

  const { data: run, error: runError } = await client
    .from('instagram_sync_runs')
    .insert({
      agency_id: connection.agency_id,
      client_account_id: connection.client_account_id,
      connection_id: connection.id,
      status: 'running',
      trigger_source: triggerSource,
    })
    .select('id')
    .single();
  if (runError || !run) throw new Error('Could not start the Instagram sync.');

  const warnings: string[] = [];

  try {
    const { data: accessToken, error: secretError } = await client.rpc(
      'get_instagram_connection_secret',
      { p_connection_id: connection.id },
    );
    if (secretError || !accessToken) {
      throw new Error('The Instagram access token is missing.');
    }

    const profile = await graphGet<{
      followers_count?: number;
      follows_count?: number;
      id: string;
      media_count?: number;
      name?: string;
      profile_picture_url?: string;
      username?: string;
    }>(
      `/${connection.instagram_business_id}`,
      accessToken,
      {
        fields:
          'id,username,name,profile_picture_url,followers_count,follows_count,media_count',
      },
      'Instagram profile',
    );

    const today = startOfUtcDay(new Date());
    const since = new Date(today.valueOf() - 89 * 24 * 60 * 60 * 1000);
    const until = new Date(today.valueOf() + 24 * 60 * 60 * 1000);
    const dailyByDate = new Map<
      string,
      { profile_views?: number; reach?: number; views?: number }
    >();

    for (const metric of ['views', 'reach', 'profile_views'] as const) {
      try {
        const values = await fetchDailyMetric(
          connection.instagram_business_id,
          accessToken,
          metric,
          since,
          until,
        );
        for (const [metricDate, value] of values) {
          dailyByDate.set(metricDate, {
            ...dailyByDate.get(metricDate),
            [metric]: value,
          });
        }
      } catch (error) {
        if (error instanceof MetaApiError && error.isAuthenticationError) throw error;
        warnings.push(`${metric.replace('_', ' ')} history was unavailable.`);
      }
    }

    const todayKey = dateKey(today);
    dailyByDate.set(todayKey, {
      ...dailyByDate.get(todayKey),
    });
    const dailyRows = [...dailyByDate].map(([metricDate, metrics]) => ({
      agency_id: connection.agency_id,
      client_account_id: connection.client_account_id,
      connection_id: connection.id,
      fetched_at: new Date().toISOString(),
      followers_count:
        metricDate === todayKey ? numericValue(profile.followers_count) : null,
      follows_count:
        metricDate === todayKey ? numericValue(profile.follows_count) : null,
      media_count:
        metricDate === todayKey ? numericValue(profile.media_count) : null,
      metric_date: metricDate,
      profile_views: metrics.profile_views ?? null,
      reach: metrics.reach ?? null,
      views: metrics.views ?? null,
    }));

    if (dailyRows.length) {
      const { error } = await client
        .from('instagram_account_daily_metrics')
        .upsert(dailyRows, { onConflict: 'connection_id,metric_date' });
      if (error) throw new Error(`Could not store Instagram account metrics: ${error.message}`);
    }

    const mediaRows = await fetchRecentMedia(connection, accessToken, warnings);
    if (mediaRows.length) {
      const { error } = await client
        .from('instagram_media')
        .upsert(mediaRows, { onConflict: 'connection_id,instagram_media_id' });
      if (error) throw new Error(`Could not store Instagram media: ${error.message}`);
    }

    const completedAt = new Date().toISOString();
    const status = warnings.length ? 'partial' : 'succeeded';
    await Promise.all([
      client
        .from('instagram_connections')
        .update({
          display_name: profile.name ?? null,
          last_sync_error: warnings.length ? warnings.join(' ') : null,
          last_synced_at: completedAt,
          next_sync_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          profile_picture_url: profile.profile_picture_url ?? null,
          status: 'active',
          username: profile.username ?? null,
        })
        .eq('id', connection.id),
      client
        .from('instagram_sync_runs')
        .update({
          completed_at: completedAt,
          status,
          warning_messages: warnings,
        })
        .eq('id', run.id),
    ]);

    return {
      account: profile.username || profile.name || profile.id,
      mediaCount: mediaRows.length,
      status,
      warnings,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Instagram synchronization failed.';
    const needsReauth =
      error instanceof MetaApiError && error.isAuthenticationError;
    const completedAt = new Date().toISOString();
    await Promise.all([
      client
        .from('instagram_connections')
        .update({
          last_sync_error: message,
          next_sync_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          status: needsReauth ? 'needs_reauth' : 'sync_error',
        })
        .eq('id', connection.id),
      client
        .from('instagram_sync_runs')
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
