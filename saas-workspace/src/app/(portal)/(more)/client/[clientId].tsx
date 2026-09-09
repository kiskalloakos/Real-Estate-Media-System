import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import {
  NativeEmptyState,
  NativeScreen,
} from '@/components/native';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePortalData } from '@/hooks/use-portal-data';
import { useApp } from '@/providers/app-provider';
import { ClientDetailNativeScreen } from '@/screens/native';
import {
  demoClients,
  demoEvents,
  demoPayments,
  demoProperties,
  demoTasks,
} from '@/screens/web/demoData';

export default function ClientDetailRoute() {
  const params = useLocalSearchParams<{ clientId: string | string[] }>();
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const query = usePortalData({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
  });
  const manualRefresh = useManualRefresh(query.refetch);
  const clientId = Array.isArray(params.clientId)
    ? params.clientId[0]
    : params.clientId;
  const clients = isPreview ? demoClients : (query.data?.clients ?? []);
  const properties = isPreview
    ? demoProperties
    : (query.data?.properties ?? []);
  const events = isPreview ? demoEvents : (query.data?.calendarEvents ?? []);
  const payments = isPreview ? demoPayments : (query.data?.payments ?? []);
  const tasks = isPreview ? demoTasks : (query.data?.tasks ?? []);
  const client = clients.find((item) => item.id === clientId);

  if (!identity) {
    return null;
  }

  if (identity.role !== 'admin' || !client) {
    return (
      <>
        <NativeScreen
          errorMessage={query.error?.message}
          loading={!isPreview && query.isLoading}
          loadingLabel="Loading client"
          onRefresh={() => void manualRefresh.refresh()}
          onRetry={() => void manualRefresh.refresh()}
          refreshing={!isPreview && manualRefresh.refreshing}
        >
          <NativeEmptyState
            message="This client account is not available to your role."
            symbol="lock"
            title="Client unavailable"
          />
        </NativeScreen>
        <Stack.Title>Client</Stack.Title>
      </>
    );
  }

  const clientProperties = properties.filter(
    (property) => property.clientId === client.id,
  );
  const propertyIds = new Set(
    clientProperties.map((property) => property.id),
  );

  return (
    <>
      <ClientDetailNativeScreen
        agreements={(query.data?.agreements ?? []).filter(
          (agreement) => agreement.clientId === client.id,
        )}
        client={client}
        errorMessage={query.error?.message}
        events={events.filter(
          (event) =>
            event.clientId === client.id ||
            (event.propertyId && propertyIds.has(event.propertyId)),
        )}
        loading={!isPreview && query.isLoading}
        members={(query.data?.clientMembers ?? []).filter(
          (member) => member.clientAccountId === client.id,
        )}
        onPressEvent={(eventId) =>
          router.push({
            pathname: '/(portal)/(calendar)/[eventId]',
            params: { eventId },
          })
        }
        onPressProperty={(propertyId) =>
          router.push({
            pathname: '/(portal)/(clients)/property/[propertyId]',
            params: { propertyId },
          })
        }
        onPressTask={
          !isPreview
            ? (taskId) =>
                router.push({
                  pathname: '/(portal)/(more)/task/[taskId]',
                  params: { taskId },
                })
            : undefined
        }
        onRefresh={() => void manualRefresh.refresh()}
        onRetry={() => void manualRefresh.refresh()}
        payments={payments.filter(
          (payment) => payment.clientId === client.id,
        )}
        properties={clientProperties}
        refreshing={!isPreview && manualRefresh.refreshing}
        tasks={tasks.filter((task) => task.clientId === client.id)}
      />
      <Stack.Title>{client.name}</Stack.Title>
    </>
  );
}
