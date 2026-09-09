import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { MoreDestinationNativeScreen } from '@/screens/native';

export default function ClientBillingRoute() {
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  if (!identity) return null;

  const clientHome = live.bundle.clientHome;
  const previewData = isPreview && clientHome?.agreement
    ? { agreements: [clientHome.agreement] }
    : undefined;

  return (
    <MoreDestinationNativeScreen
      clientAccountId={isPreview ? undefined : identity.clientAccountId}
      data={isPreview ? previewData : live.data}
      destination="deal"
      errorMessage={live.errorMessage}
      loading={live.loading}
      role={identity.role}
      locale={identity.locale}
      onRefresh={() => void live.retry()}
      onRetry={() => void live.retry()}
      refreshing={live.refreshing}
    />
  );
}
