import { Stack, useRouter } from 'expo-router';

import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { SopsNativeScreen } from '@/screens/native';

export default function SopsRoute() {
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });

  if (!identity) return null;

  return (
    <>
      <SopsNativeScreen
        documents={live.data?.companyDocuments}
        errorMessage={live.errorMessage}
        loading={live.loading}
        onPressDocument={(document) =>
          router.push({
            pathname: '/(portal)/(more)/document/[documentId]',
            params: { documentId: document.id },
          })
        }
        onRefresh={() => void live.retry()}
        onRetry={() => void live.retry()}
        refreshing={live.refreshing}
      />
      <Stack.Title>SOPs</Stack.Title>
    </>
  );
}
