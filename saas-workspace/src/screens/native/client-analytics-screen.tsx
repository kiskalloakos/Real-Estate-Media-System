import { StyleSheet, View } from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import type { PortalData } from '@/screens/web/types';
import { nativeText, type NativeLocale } from '@/lib/native-i18n';

import type { PropertySummary } from './properties-screen';

export interface ClientAnalyticsNativeScreenProps extends NativeAsyncScreenProps {
  data?: PortalData;
  locale?: NativeLocale;
  properties?: readonly PropertySummary[];
}

function compact(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

function viewsForAccount(
  account: { provider: 'Instagram' | 'TikTok'; metrics: readonly { date: string; views: number }[] },
) {
  if (account.provider === 'TikTok') {
    return [...account.metrics].sort((left, right) => left.date.localeCompare(right.date)).at(-1)?.views ?? 0;
  }
  return account.metrics.reduce((sum, metric) => sum + metric.views, 0);
}

export function ClientAnalyticsNativeScreen({
  data,
  errorMessage,
  loading,
  onRefresh,
  onRetry,
  properties = [],
  refreshing,
  locale = 'en',
}: ClientAnalyticsNativeScreenProps) {
  const accounts = [
    ...(data?.instagramAccounts ?? []).map((account) => ({ ...account, provider: 'Instagram' as const })),
    ...(data?.tiktokAccounts ?? []).map((account) => ({ ...account, provider: 'TikTok' as const })),
  ];
  const followers = accounts.reduce((sum, account) => {
    const latest = [...account.metrics].reverse().find((metric) => metric.followers !== null)?.followers;
    return sum + (latest ?? 0);
  }, 0);
  const views = accounts.reduce(
    (sum, account) => sum + viewsForAccount(account),
    0,
  );
  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={locale === 'ro' ? 'Se încarcă analiza' : 'Loading analytics'}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      {accounts.length ? (
        <NativeSection title={nativeText(locale, 'last30Days')}>
          <NativeCard>
            <NativeListRow detail={nativeText(locale, 'currentAudience')} showChevron={false} symbol="person.2" title={nativeText(locale, 'followers')} trailing={<Text style={styles.value}>{compact(followers)}</Text>} />
            <NativeSeparator inset={60} />
            <NativeListRow detail={nativeText(locale, 'videoContentViews')} showChevron={false} symbol="play.rectangle" title={nativeText(locale, 'views')} trailing={<Text style={styles.value}>{compact(views)}</Text>} />
          </NativeCard>
        </NativeSection>
      ) : null}

      <NativeSection title={nativeText(locale, 'properties')}>
        {properties.length ? (
          <NativeCard>
            {properties.map((property, index) => (
                <View key={property.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  detail={property.socialSummary ?? nativeText(locale, 'noConnectedAnalytics')}
                  showChevron={false}
                  symbol="chart.line.uptrend.xyaxis"
                  title={property.name}
                  trailing={<Text style={styles.value}>{property.location}</Text>}
                />
                </View>
            ))}
          </NativeCard>
        ) : (
          <NativeCard>
            <NativeEmptyState compact message={nativeText(locale, 'propertyPerformanceMessage')} symbol="chart.xyaxis.line" title={nativeText(locale, 'noPropertyAnalytics')} />
          </NativeCard>
        )}
      </NativeSection>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  value: { color: nativeColors.label, fontFamily: 'OutfitSemiBold', fontSize: 15, fontWeight: '600' },
});
