import {
  Stack,
  useLocalSearchParams,
} from 'expo-router';

import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePortalData } from '@/hooks/use-portal-data';
import { useApp } from '@/providers/app-provider';
import { DocumentDetailNativeScreen } from '@/screens/native';

export default function DocumentDetailRoute() {
  const params = useLocalSearchParams<{
    documentId: string | string[];
  }>();
  const { identity, isPreview } = useApp();
  const query = usePortalData({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
  });
  const manualRefresh = useManualRefresh(query.refetch);
  const documentId = Array.isArray(params.documentId)
    ? params.documentId[0]
    : params.documentId;
  const document = query.data?.companyDocuments?.find(
    (item) => item.id === documentId,
  );

  if (!identity) return null;

  return (
    <>
      <DocumentDetailNativeScreen
        document={document}
        errorMessage={query.error?.message}
        loading={!isPreview && query.isLoading}
        onRefresh={() => void manualRefresh.refresh()}
        onRetry={() => void manualRefresh.refresh()}
        refreshing={!isPreview && manualRefresh.refreshing}
      />
      <Stack.Title>
        {document?.title ?? (document?.kind === 'note' ? 'Note' : 'Document')}
      </Stack.Title>
    </>
  );
}
