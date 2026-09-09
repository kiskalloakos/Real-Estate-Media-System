import { type Href, Stack, useRouter } from 'expo-router';

import { useManualRefresh } from '@/hooks/use-manual-refresh';
import {
  type AppNotification,
  useNotifications,
} from '@/hooks/use-notifications';
import { useApp } from '@/providers/app-provider';
import { usePushNotifications } from '@/providers/push-notifications-context';
import { nativeText } from '@/lib/native-i18n';
import { NotificationCenterNativeScreen } from '@/screens/native';

export function NotificationCenterRoute() {
  const router = useRouter();
  const {
    identity,
    isPreview,
    notificationPreferences,
    setNotificationPreferences,
  } = useApp();
  const notificationsQuery = useNotifications({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
    subscribeToChanges: false,
    userId: identity?.userId ?? 'anonymous',
  });
  const notificationsRefresh = useManualRefresh(notificationsQuery.refetch);
  const pushNotifications = usePushNotifications();

  if (!identity) {
    return null;
  }

  const openNotification = async (notification: AppNotification) => {
    if (!notification.readAt) {
      await notificationsQuery.markRead(notification.id);
    }

    if (notification.kind === 'task') {
      if (identity.role === 'admin' && !isPreview && notification.entityId) {
        router.push({
          pathname: '/(portal)/(tasks)/task/[taskId]',
          params: { taskId: notification.entityId },
        });
      } else {
        router.push('/(portal)/(tasks)');
      }
      return;
    }

    if (notification.kind === 'review' && notification.entityId) {
      router.push({
        pathname: '/(portal)/(reviews)/[reviewId]',
        params: { reviewId: notification.entityId },
      });
      return;
    }

    if (notification.kind === 'calendar' && notification.entityId) {
      router.push({
        pathname: '/(portal)/(calendar)/[eventId]',
        params: { eventId: notification.entityId },
      });
      return;
    }

    if (notification.nativeRoute === '/(portal)/(more)/finance') {
      router.push('/(portal)/(finance)');
      return;
    }

    if (notification.nativeRoute) {
      router.push(notification.nativeRoute as Href);
    }
  };

  return (
    <>
      <NotificationCenterNativeScreen
        errorMessage={notificationsQuery.error?.message}
        loading={!isPreview && notificationsQuery.isLoading}
        notifications={notificationsQuery.data ?? []}
        onDisablePush={pushNotifications.disablePush}
        onEnablePush={pushNotifications.enablePush}
        onMarkAllRead={notificationsQuery.markAllRead}
        onPressNotification={openNotification}
        onRefresh={() => void notificationsRefresh.refresh()}
        onRetry={() => void notificationsRefresh.refresh()}
        onUpdate={setNotificationPreferences}
        preferences={notificationPreferences}
        pushAvailable={pushNotifications.available}
        pushEnabled={pushNotifications.pushEnabled}
        pushErrorMessage={pushNotifications.errorMessage}
        pushPermissionState={pushNotifications.permissionState}
        refreshing={!isPreview && notificationsRefresh.refreshing}
        locale={identity.locale}
      />
      <Stack.Title>{nativeText(identity.locale, 'notifications')}</Stack.Title>
    </>
  );
}
