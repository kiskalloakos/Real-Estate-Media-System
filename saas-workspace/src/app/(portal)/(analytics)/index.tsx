import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { ClientAnalyticsNativeScreen } from '@/screens/native';

export default function ClientAnalyticsRoute() {
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  if (!identity) return null;

  const clientHome = live.bundle.clientHome;
  return (
    <ClientAnalyticsNativeScreen
      data={live.data}
      errorMessage={live.errorMessage}
      loading={live.loading}
      locale={identity.locale}
      onRefresh={() => void live.retry()}
      onRetry={() => void live.retry()}
      properties={clientHome?.properties}
      refreshing={live.refreshing}
    />
  );
}
