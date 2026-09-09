import { useRouter } from 'expo-router';

import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { PropertiesNativeScreen } from '@/screens/native';

export default function PropertiesRoute() {
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  if (!identity) {
    return null;
  }
  const role = identity.role;

  return (
    <PropertiesNativeScreen
      role={role}
      {...live.bundle.properties}
      errorMessage={live.errorMessage}
      loading={live.loading}
      onPressProperty={(property) =>
        router.push({
          pathname: '/(portal)/(properties)/[propertyId]',
          params: { propertyId: property.id },
        })
      }
      onRefresh={() => void live.retry()}
      onRetry={() => void live.retry()}
      refreshing={live.refreshing}
    />
  );
}
