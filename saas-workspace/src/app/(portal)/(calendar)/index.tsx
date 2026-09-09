import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import { Stack, useRouter } from 'expo-router';

import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { TeamCalendarNativeScreen } from '@/screens/native';

export default function CalendarRoute() {
  const toolbarIcon = useToolbarIcons();
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  if (!identity) {
    return null;
  }
  const role = identity.role;

  return (
    <>
      <TeamCalendarNativeScreen
        errorMessage={live.errorMessage}
        events={live.bundle.calendar.events}
        loading={live.loading}
        onPressEvent={(event) =>
          router.push({
            pathname: '/(portal)/(calendar)/[eventId]',
            params: { eventId: event.id },
          })
        }
        onRefresh={() => void live.retry()}
        onRetry={() => void live.retry()}
        refreshing={live.refreshing}
      />
      {role === 'admin' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Create calendar event"
            icon={toolbarIcon('plus')}
            onPress={() => router.push('/(portal)/(calendar)/event/edit')}
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
