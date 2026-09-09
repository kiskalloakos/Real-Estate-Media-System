import { Stack, useRouter } from 'expo-router';

import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import {
  MoreDestinationNativeScreen,
  PropertiesNativeScreen,
} from '@/screens/native';

export default function ClientsRoute() {
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  if (!identity) return null;
  const isRo = identity.locale === 'ro';

  if (identity.role === 'admin') {
    return (
      <>
        <MoreDestinationNativeScreen
          data={live.data}
          destination="clients"
          errorMessage={live.errorMessage}
          loading={live.loading}
          role={identity.role}
          onPressClient={(client) =>
            router.push({
              pathname: '/(portal)/(clients)/client/[clientId]',
              params: { clientId: client.id },
            })
          }
          onRefresh={() => void live.retry()}
          onRetry={() => void live.retry()}
          refreshing={live.refreshing}
        />
        <Stack.Title>{isRo ? 'Clienți' : 'Clients'}</Stack.Title>
      </>
    );
  }

  return (
    <>
      <PropertiesNativeScreen
        role={identity.role}
        {...live.bundle.properties}
        errorMessage={live.errorMessage}
        loading={live.loading}
        onPressProperty={(property) =>
          router.push({
            pathname: '/(portal)/(clients)/property/[propertyId]',
            params: { propertyId: property.id },
          })
        }
        onRefresh={() => void live.retry()}
        onRetry={() => void live.retry()}
        refreshing={live.refreshing}
      />
      <Stack.Title>
        {identity.role === 'client'
          ? isRo ? 'Proprietățile mele' : 'My Properties'
          : isRo ? 'Clienți' : 'Clients'}
      </Stack.Title>
    </>
  );
}
