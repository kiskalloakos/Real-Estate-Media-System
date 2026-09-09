import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import { Linking } from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import {
  NativeEmptyState,
  NativeScreen,
} from '@/components/native';
import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { CalendarEventDetailNativeScreen } from '@/screens/native';

export default function CalendarEventDetailRoute() {
  const toolbarIcon = useToolbarIcons();
  const params = useLocalSearchParams<{ eventId: string | string[] }>();
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  const eventId = Array.isArray(params.eventId)
    ? params.eventId[0]
    : params.eventId;
  const summary = live.bundle.calendar.events.find(
    (item) => item.id === eventId,
  );
  const event = live.data?.calendarEvents?.find((item) => item.id === eventId);
  const location = summary?.location ?? event?.location;

  if (!identity) {
    return null;
  }

  if (!summary) {
    return (
      <>
        <NativeScreen
          errorMessage={live.errorMessage}
          loading={live.loading}
          loadingLabel="Loading calendar event"
          onRefresh={() => void live.retry()}
          onRetry={() => void live.retry()}
          refreshing={live.refreshing}
        >
          <NativeEmptyState
            message="This calendar event is no longer available to your account."
            symbol="calendar.badge.exclamationmark"
            title="Event unavailable"
          />
        </NativeScreen>
        <Stack.Title>Calendar Event</Stack.Title>
      </>
    );
  }

  return (
    <>
      <CalendarEventDetailNativeScreen
        errorMessage={live.errorMessage}
        event={event}
        loading={live.loading}
        onPressProperty={(propertyId) =>
          router.push({
            pathname: '/(portal)/(clients)/property/[propertyId]',
            params: { propertyId },
          })
        }
        onRefresh={() => void live.retry()}
        onRetry={() => void live.retry()}
        refreshing={live.refreshing}
        summary={summary}
        locale={identity.locale}
      />
      <Stack.Title>{summary.title}</Stack.Title>
      {location || (identity.role === 'admin' && event) ? (
        <Stack.Toolbar placement="right">
          {location ? (
            <Stack.Toolbar.Button
              accessibilityLabel="Open location in Maps"
              icon={toolbarIcon('map')}
              onPress={() =>
                void Linking.openURL(
                  `https://maps.apple.com/?q=${encodeURIComponent(location)}`,
                )
              }
            />
          ) : null}
          {identity.role === 'admin' && event ? (
            <Stack.Toolbar.Button
              accessibilityLabel="Edit calendar event"
              icon={toolbarIcon('pencil')}
              onPress={() =>
                router.push({
                  pathname: '/(portal)/(calendar)/event/edit',
                  params: { eventId: event.id },
                })
              }
            />
          ) : null}
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
