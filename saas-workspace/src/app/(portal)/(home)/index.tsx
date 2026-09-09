import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import { Stack, useRouter } from 'expo-router';

import { useNotifications } from '@/hooks/use-notifications';
import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import {
  ClientHomeNativeScreen,
  HomeNativeScreen,
  TeamDashboardNativeScreen,
} from '@/screens/native';

export default function HomeRoute() {
  const toolbarIcon = useToolbarIcons();
  const router = useRouter();
  const { identity, isPreview, notificationPreferences } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  const notificationQuery = useNotifications({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
    subscribeToChanges: false,
    userId: identity?.userId ?? 'anonymous',
  });
  if (!identity) {
    return null;
  }
  const role = identity.role;
  const unreadCount = notificationPreferences.master
    ? (notificationQuery.data ?? []).filter(
        (notification) =>
          !notification.readAt &&
          (notification.kind === 'system' ||
            (notification.kind === 'review' &&
              notificationPreferences.reviews) ||
            (notification.kind === 'task' && notificationPreferences.tasks) ||
            (notification.kind === 'calendar' &&
              notificationPreferences.calendar) ||
            (notification.kind === 'payment' &&
              notificationPreferences.payments)),
      ).length
    : 0;

  if (role === 'client') {
    const clientHome = live.bundle.clientHome;
    return (
      <>
        <ClientHomeNativeScreen
          agreement={clientHome?.agreement}
          approvals={clientHome?.approvals}
          deliveredAssets={clientHome?.deliveredAssets}
          errorMessage={live.errorMessage}
          loading={live.loading}
          onPressAgreement={() =>
            router.push('/(portal)/(billing)')
          }
          onPressProductionDay={(item) =>
            router.push({
              pathname: '/(portal)/(calendar)/[eventId]',
              params: { eventId: item.id },
            })
          }
          onPressProperty={(property) =>
            router.push({
              pathname: '/(portal)/(properties)/[propertyId]',
              params: { propertyId: property.id },
            })
          }
          onPressReview={(review) =>
            router.push({
              pathname: '/(portal)/(reviews)/[reviewId]',
              params: { reviewId: review.id },
            })
          }
          onRefresh={() => void live.retry()}
          onRetry={() => void live.retry()}
          productionDays={clientHome?.productionDays}
          properties={clientHome?.properties}
          refreshing={live.refreshing}
          tasks={clientHome?.tasks}
          locale={identity.locale}
          userName={identity.displayName}
        />
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={toolbarIcon(unreadCount ? 'bell.badge.fill' : 'bell')}
            accessibilityHint="Opens your notification history"
            accessibilityLabel={
              unreadCount
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
            onPress={() => router.push('/(portal)/(home)/notifications')}
          >
            <Stack.Toolbar.Label>Notifications</Stack.Toolbar.Label>
            {unreadCount ? (
              <Stack.Toolbar.Badge>{String(unreadCount)}</Stack.Toolbar.Badge>
            ) : null}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </>
    );
  }

  if (role === 'team_member') {
    return (
      <>
        <TeamDashboardNativeScreen
          currentUserId={identity.userId}
          errorMessage={live.errorMessage}
          events={live.bundle.calendar.events}
          loading={live.loading}
          onPressEvent={(event) =>
            router.push({
              pathname: '/(portal)/(calendar)/[eventId]',
              params: { eventId: event.id },
            })
          }
          onPressTask={(task) =>
            router.push({
              pathname: '/(portal)/(tasks)/task/[taskId]',
              params: { taskId: task.id },
            })
          }
          onRefresh={() => void live.retry()}
          onRetry={() => void live.retry()}
          refreshing={live.refreshing}
          tasks={live.data?.tasks}
          userName={identity.displayName}
        />
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={toolbarIcon(unreadCount ? 'bell.badge.fill' : 'bell')}
            accessibilityHint="Opens your notification history"
            accessibilityLabel={
              unreadCount
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
            onPress={() => router.push('/(portal)/(home)/notifications')}
          >
            <Stack.Toolbar.Label>Notifications</Stack.Toolbar.Label>
            {unreadCount ? (
              <Stack.Toolbar.Badge>{String(unreadCount)}</Stack.Toolbar.Badge>
            ) : null}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </>
    );
  }

  return (
    <>
      <HomeNativeScreen
        role={role}
        {...live.bundle.home}
        errorMessage={live.errorMessage}
        loading={live.loading}
        onPressPriority={(item) => {
          if (item.id.startsWith('task-')) {
            if (role === 'admin') {
              router.push({
                pathname: '/(portal)/(tasks)/task/[taskId]',
                params: { taskId: item.id.slice('task-'.length) },
              });
            } else {
              router.push('/(portal)/(tasks)');
            }
            return;
          }
          if (item.id.startsWith('review-')) {
            router.push({
              pathname: '/(portal)/(reviews)/[reviewId]',
              params: { reviewId: item.id.slice('review-'.length) },
            });
          }
        }}
        onPressScheduleItem={(item) =>
          router.push({
            pathname: '/(portal)/(calendar)/[eventId]',
            params: { eventId: item.id },
          })
        }
        onRefresh={() => void live.retry()}
        onRetry={() => void live.retry()}
        refreshing={live.refreshing}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
            icon={toolbarIcon(unreadCount ? 'bell.badge.fill' : 'bell')}
          accessibilityHint="Opens your notification history"
          accessibilityLabel={
            unreadCount
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
          onPress={() => router.push('/(portal)/(home)/notifications')}
        >
          <Stack.Toolbar.Label>Notifications</Stack.Toolbar.Label>
          {unreadCount ? (
            <Stack.Toolbar.Badge>{String(unreadCount)}</Stack.Toolbar.Badge>
          ) : null}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
