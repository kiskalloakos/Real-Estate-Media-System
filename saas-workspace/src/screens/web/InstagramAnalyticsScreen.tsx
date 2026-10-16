import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  Modal,
  useToast,
  type PortalRole,
} from '@/components/web';
import {
  beginSocialConnection,
  disconnectSocialConnection,
  syncSocialAccount,
  type SocialProvider,
} from '@/lib/social-service';

import type {
  ClientSummary,
  InstagramAccountSummary,
  TikTokAccountSummary,
} from './types';

export interface InstagramAnalyticsScreenProps {
  accounts?: InstagramAccountSummary[];
  clientAccountId?: string | null;
  clients?: ClientSummary[];
  role: Extract<PortalRole, 'admin' | 'client'>;
  scope?: 'agency' | 'client';
  tiktokAccounts?: TikTokAccountSummary[];
}

type RangeDays = 7 | 30 | 90;

function compact(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: includeTime ? '2-digit' : undefined,
    minute: includeTime ? '2-digit' : undefined,
    month: 'short',
    year: includeTime ? undefined : 'numeric',
  }).format(new Date(value));
}

type SocialAccountSummary = (InstagramAccountSummary | TikTokAccountSummary) & {
  provider: SocialProvider;
};

const providerLabels: Record<SocialProvider, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

function latestFollowerCount(metrics: SocialAccountSummary['metrics']) {
  return [...metrics].reverse().find((metric) => metric.followers !== null)
    ?.followers ?? 0;
}

function metricReach(metric: SocialAccountSummary['metrics'][number]) {
  return 'reach' in metric ? metric.reach : 0;
}

function metricProfileViews(metric: SocialAccountSummary['metrics'][number]) {
  return 'profileViews' in metric ? metric.profileViews : 0;
}

function mediaReach(media: SocialAccountSummary['media'][number]) {
  return 'reach' in media ? media.reach : 0;
}

function syncNote(message?: string) {
  if (!message) return undefined;
  if (/history was unavailable/i.test(message)) {
    return 'Some historical account metrics are not available from Instagram yet.';
  }
  return message;
}

function ConnectMenu({
  busy,
  disabled,
  onConnect,
  open,
  setOpen,
}: {
  busy: boolean;
  disabled: boolean;
  onConnect: (provider: SocialProvider) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <div className="rm-social-connect">
      <Button
        className="rm-instagram-account-tabs__connect"
        disabled={disabled}
        icon="plus"
        onClick={() => setOpen(!open)}
      >
        {busy ? 'Opening…' : 'Connect'}
      </Button>
      {open ? (
        <Modal
          className="rm-social-connect-modal"
          description="Choose the social profile type you want to connect to this analytics workspace."
          onClose={() => setOpen(false)}
          open={open}
          title="Which profile do you want to connect?"
        >
          <div className="rm-social-connect-options">
            {(['instagram', 'tiktok'] as const).map((provider) => (
              <button
                data-modal-autofocus={provider === 'instagram' ? true : undefined}
                key={provider}
                onClick={() => onConnect(provider)}
                type="button"
              >
                <strong>{providerLabels[provider]}</strong>
                <span>
                  {provider === 'instagram'
                    ? 'Connect a professional Instagram account through Facebook Login.'
                    : 'Connect a TikTok profile through TikTok Login.'}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function InstagramAnalyticsScreen({
  accounts = [],
  clientAccountId,
  clients = [],
  role,
  scope = role === 'admin' ? 'agency' : 'client',
  tiktokAccounts = [],
}: InstagramAnalyticsScreenProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [range, setRange] = useState<RangeDays>(30);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectMenuOpen, setConnectMenuOpen] = useState(false);
  const [accountSelection, setAccountSelection] = useState<{ key: string; id: string } | null>(null);
  const selectedClientId = scope === 'client' ? clientAccountId ?? '' : '';
  const selectionStorageKey = `rm.socialAnalytics.selectedAccount.${scope}.${selectedClientId || 'agency'}`;

  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get('instagram');
    const tiktokResult = url.searchParams.get('tiktok');
    if (!result && !tiktokResult) return;
    const activeProvider: SocialProvider = tiktokResult ? 'tiktok' : 'instagram';
    const activeResult = tiktokResult || result;
    const activeLabel = providerLabels[activeProvider];

    if (activeResult === 'connected') {
      const count = Number(url.searchParams.get('accounts') ?? 0);
      notify(
        `${count || 'Your'} ${activeLabel} account${count === 1 ? '' : 's'} ${
          count === 1 ? 'is' : 'are'
        } connected.`,
      );
    } else {
      notify(
        url.searchParams.get('message') ||
          `${activeLabel} Login could not connect.`,
        'error',
      );
    }
    void queryClient.invalidateQueries({ queryKey: ['portal-data'] });
    ['instagram', 'tiktok', 'accounts', 'synced', 'message'].forEach((key) =>
      url.searchParams.delete(key),
    );
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [notify, queryClient]);

  const allAccounts = useMemo<SocialAccountSummary[]>(
    () => [
      ...accounts.map((account) => ({ ...account, provider: 'instagram' as const })),
      ...tiktokAccounts.map((account) => ({ ...account, provider: 'tiktok' as const })),
    ],
    [accounts, tiktokAccounts],
  );
  const scopedAccounts = useMemo(
    () =>
      allAccounts.filter((account) =>
        scope === 'agency'
          ? account.clientId === null
          : account.clientId === selectedClientId),
    [allAccounts, scope, selectedClientId],
  );

  // Resolve the preference for this workspace without a cascading state update.
  const selectedAccountId = useMemo(() => {
    if (accountSelection?.key === selectionStorageKey) return accountSelection.id;
    try {
      return window.localStorage.getItem(selectionStorageKey) ?? '';
    } catch {
      return '';
    }
  }, [accountSelection, selectionStorageKey]);

  const selectAccount = (accountId: string) => {
    setAccountSelection({ key: selectionStorageKey, id: accountId });
    try {
      window.localStorage.setItem(selectionStorageKey, accountId);
    } catch {
      // Selection still works when browser storage is unavailable.
    }
  };

  const visibleAccountId =
    scopedAccounts.some((account) => account.id === selectedAccountId)
      ? selectedAccountId
      : scopedAccounts[0]?.id ?? '';
  const visibleAccounts = useMemo(
    () =>
      scopedAccounts.filter((account) => account.id === visibleAccountId),
    [scopedAccounts, visibleAccountId],
  );
  const activeProvider = visibleAccounts[0]?.provider ?? 'instagram';
  const activeProviderLabel = providerLabels[activeProvider];

  const analytics = useMemo(() => {
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - range + 1);
    const daily = new Map<
      string,
      { profileViews: number; reach: number; views: number }
    >();
    let followers = 0;

    for (const account of visibleAccounts) {
      followers += latestFollowerCount(account.metrics);
      // TikTok rows are cumulative snapshots, not daily activity.
      if (account.provider === 'tiktok') continue;
      for (const metric of account.metrics) {
        if (new Date(metric.date).valueOf() < rangeStart.valueOf()) continue;
        const current = daily.get(metric.date) ?? {
          profileViews: 0,
          reach: 0,
          views: 0,
        };
        current.profileViews += metricProfileViews(metric);
        current.reach += metricReach(metric);
        current.views += metric.views;
        daily.set(metric.date, current);
      }
    }

    const series = Array.from({ length: range }, (_, index) => {
      const date = new Date(rangeStart);
      date.setDate(rangeStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, ...(daily.get(key) ?? { profileViews: 0, reach: 0, views: 0 }) };
    });
    const media = visibleAccounts
      .flatMap((account) =>
        account.media.map((item) => ({
          ...item,
          accountUsername: account.username,
          provider: account.provider,
          reach: mediaReach(item),
        })),
      )
      .filter(
        (item) =>
          !item.postedAt ||
          new Date(item.postedAt).valueOf() >= rangeStart.valueOf(),
      )
      .sort((left, right) =>
        (right.postedAt ?? '').localeCompare(left.postedAt ?? ''),
      );
    const accountViews = series.reduce((sum, point) => sum + point.views, 0);
    const reach = series.reduce((sum, point) => sum + point.reach, 0);
    const profileViews = series.reduce(
      (sum, point) => sum + point.profileViews,
      0,
    );
    const interactions = media.reduce(
      (sum, item) => sum + item.totalInteractions,
      0,
    );
    const likes = media.reduce((sum, item) => sum + item.likes, 0);
    const comments = media.reduce((sum, item) => sum + item.comments, 0);
    const shares = media.reduce((sum, item) => sum + item.shares, 0);
    const views = accountViews;

    return {
      comments,
      engagement: (interactions / Math.max(views, 1)) * 100,
      followers,
      interactions,
      likes,
      media,
      posts: media.length,
      profileViews,
      reach,
      shares,
      series,
      views,
    };
  }, [range, visibleAccounts]);

  const connect = async (provider: SocialProvider) => {
    if (scope === 'client' && !selectedClientId) {
      notify(`Choose a client before connecting ${providerLabels[provider]}.`, 'error');
      return;
    }
    setBusyId('connect');
    setConnectMenuOpen(false);
    try {
      const url = await beginSocialConnection(
        provider,
        scope === 'agency'
          ? { scope: 'agency' }
          : { clientAccountId: selectedClientId, scope: 'client' },
      );
      window.location.assign(url);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : `Could not start ${providerLabels[provider]} Login.`,
        'error',
      );
      setBusyId(null);
    }
  };

  const refresh = async (account: SocialAccountSummary) => {
    selectAccount(account.id);
    setBusyId(account.id);
    try {
      const result = await syncSocialAccount(account.provider, account.id);
      await queryClient.invalidateQueries({ queryKey: ['portal-data'] });
      selectAccount(account.id);
      notify(
        result.status === 'partial'
          ? `${providerLabels[account.provider]} refreshed with some unavailable metrics.`
          : `@${account.username} analytics are up to date.`,
        result.status === 'partial' ? 'info' : 'success',
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : `Could not refresh ${providerLabels[account.provider]}.`,
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (account: SocialAccountSummary) => {
    if (
      !window.confirm(
        `Disconnect @${account.username}? Stored analytics remain available, but no new data will sync.`,
      )
    ) {
      return;
    }
    setBusyId(account.id);
    try {
      await disconnectSocialConnection(account.provider, account.id);
      await queryClient.invalidateQueries({ queryKey: ['portal-data'] });
      notify(`@${account.username} has been disconnected.`);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : `Could not disconnect ${providerLabels[account.provider]}.`,
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const canConnect = scope === 'agency' || Boolean(selectedClientId);
  const kpis = activeProvider === 'instagram'
    ? [
        ['Followers', compact(analytics.followers), 'Current audience'],
        ['Views', compact(analytics.views), `Last ${range} days`],
        ['Reach', compact(analytics.reach), `Last ${range} days`],
        ['Interactions', compact(analytics.interactions), `${analytics.posts} posts`],
        ['Engagement', `${analytics.engagement.toFixed(1)}%`, 'Interactions ÷ views'],
        ['Profile visits', compact(analytics.profileViews), `Last ${range} days`],
      ]
    : [
        ['Followers', compact(analytics.followers), 'Current audience'],
        ['Videos', compact(analytics.posts), `Last ${range} days`],
        ['Likes', compact(analytics.likes), `Last ${range} days`],
        ['Comments', compact(analytics.comments), `Last ${range} days`],
        ['Shares', compact(analytics.shares), `Last ${range} days`],
      ];

  return (
    <div className="rm-page rm-instagram">
      {!canConnect || scopedAccounts.length === 0 ? (
        <Card className="rm-instagram-empty" tone="paper">
          <EmptyState
            action={
              <ConnectMenu
                busy={busyId === 'connect'}
                disabled={!canConnect || busyId !== null}
                onConnect={(provider) => void connect(provider)}
                open={connectMenuOpen}
                setOpen={setConnectMenuOpen}
              />
            }
            description={
              scope === 'agency'
                ? 'Connect Realty Media Instagram accounts or TikTok profiles. Their account and content analytics stay in the agency marketing workspace.'
                : 'Connect this client’s Instagram account or TikTok profile. Its analytics will stay in this client workspace.'
            }
            icon="trend-up"
            title={
              scope === 'agency'
                ? 'Connect Realty Media social accounts'
                : selectedClientId
                  ? `Connect social accounts for ${selectedClient?.name ?? 'this client'}`
                  : 'Choose a client first'
            }
          />
        </Card>
      ) : (
        <>
          <div className="rm-instagram-account-bar">
            <div className="rm-instagram-account-bar__accounts">
              <div className="rm-instagram-account-tabs">
                {scopedAccounts.map((account) => (
                  <button
                    aria-pressed={visibleAccountId === account.id}
                    className={visibleAccountId === account.id ? 'is-active' : undefined}
                    key={account.id}
                    onClick={() => selectAccount(account.id)}
                    type="button"
                  >
                    <Avatar
                      name={account.displayName}
                      size="sm"
                      src={account.profilePictureUrl}
                    />
                    <span>
                      <strong>@{account.username}</strong>
                      <small>{providerLabels[account.provider]} · {account.displayName}</small>
                    </span>
                  </button>
                ))}
                <ConnectMenu
                  busy={busyId === 'connect'}
                  disabled={busyId !== null}
                  onConnect={(provider) => void connect(provider)}
                  open={connectMenuOpen}
                  setOpen={setConnectMenuOpen}
                />
              </div>
            </div>
            <div aria-label="Analytics range" className="rm-tabs" role="tablist">
              {([7, 30, 90] as const).map((days) => (
                <button
                  aria-selected={range === days}
                  className={range === days ? 'is-active' : undefined}
                  key={days}
                  onClick={() => setRange(days)}
                  role="tab"
                  type="button"
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>

          <div className={`rm-instagram-kpis${activeProvider === 'tiktok' ? ' rm-instagram-kpis--tiktok' : ''}`}>
            {kpis.map(([label, value, detail]) => (
              <Card
                className="rm-instagram-kpi"
                key={label}
                tone="paper"
              >
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </Card>
            ))}
          </div>

          <Card className="rm-instagram-media-card" tone="paper">
            <div className="rm-instagram-card-heading">
              <div>
                <p className="rm-section-kicker">RECENT CONTENT</p>
                <h2>Performance by post</h2>
              </div>
              <span>{analytics.media.length} in this range</span>
            </div>
            {analytics.media.length ? (
              <div className="rm-instagram-media-grid">
                {analytics.media.slice(0, 12).map((media) => (
                  <a
                    href={media.permalink}
                    key={media.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="rm-instagram-media-thumb">
                      {media.thumbnailUrl ? (
                        <img alt="" loading="lazy" src={media.thumbnailUrl} />
                      ) : (
                        <Icon name="image" size={24} />
                      )}
                      <span>{media.mediaType.toLowerCase()}</span>
                    </div>
                    <div className="rm-instagram-media-copy">
                      <small>
                        @{media.accountUsername}
                        {media.postedAt ? ` · ${formatDate(media.postedAt)}` : ''}
                      </small>
                      <strong>{media.caption || `${activeProviderLabel} post`}</strong>
                      <div>
                        {activeProvider === 'instagram' ? <span>{compact(media.views)} views</span> : null}
                        {activeProvider === 'instagram' ? <span>{compact(media.reach)} reach</span> : null}
                        <span>{compact(media.totalInteractions)} interactions</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState
                description={`No ${activeProviderLabel} posts were returned for the selected ${range}-day range.`}
                icon="image"
                title="No recent content"
              />
            )}
          </Card>

          <div className="rm-instagram-main-grid">
            <Card className="rm-instagram-connections" tone="paper">
              <div className="rm-instagram-card-heading">
                <div>
                  <p className="rm-section-kicker">CONNECTIONS</p>
                  <h2>Connected accounts</h2>
                </div>
              </div>
              <div className="rm-instagram-connection-list">
                {scopedAccounts.map((account) => (
                  <article key={account.id}>
                    <Avatar
                      name={account.displayName}
                      size="sm"
                      src={account.profilePictureUrl}
                    />
                    <div>
                      <strong>@{account.username}</strong>
                      <span>
                        {providerLabels[account.provider]} · {account.lastSyncedAt
                          ? `Updated ${formatDate(account.lastSyncedAt, true)}`
                          : 'Initial sync pending'}
                      </span>
                      {syncNote(account.lastSyncError) ? (
                        <small>{syncNote(account.lastSyncError)}</small>
                      ) : null}
                    </div>
                    <div className="rm-instagram-connection-actions">
                      <Button
                        disabled={busyId !== null}
                        onClick={() => void refresh(account)}
                        variant="secondary"
                      >
                        {busyId === account.id ? 'Refreshing…' : 'Refresh'}
                      </Button>
                      <Button
                        disabled={busyId !== null}
                        onClick={() => void disconnect(account)}
                        variant="ghost"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
