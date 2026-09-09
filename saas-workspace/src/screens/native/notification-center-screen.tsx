import { Fragment } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  StatusPill,
  Text,
  nativeColors,
  useNativeWideLayout,
} from '@/components/native';
import type { AppNotification } from '@/hooks/use-notifications';
import type { NativeNotificationPreferences } from '@/lib/native-notification-preferences';
import type { PushPermissionState } from '@/providers/push-notifications-context';
import { nativeText, type NativeLocale } from '@/lib/native-i18n';

export interface NotificationCenterNativeScreenProps {
  errorMessage?: string | null;
  loading?: boolean;
  notifications: AppNotification[];
  onDisablePush: () => Promise<void>;
  onEnablePush: () => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onPressNotification: (notification: AppNotification) => Promise<void>;
  onRefresh?: () => void;
  onRetry?: () => void;
  onUpdate: (patch: Partial<NativeNotificationPreferences>) => Promise<void>;
  preferences: NativeNotificationPreferences;
  pushAvailable: boolean;
  pushEnabled: boolean;
  pushErrorMessage?: string | null;
  pushPermissionState: PushPermissionState;
  refreshing?: boolean;
  locale?: NativeLocale;
}

const preferenceRows = [
  {
    detail: 'Review requests, comments, approvals, and requested changes',
    key: 'reviews' as const,
    symbol: 'checkmark.bubble',
    title: 'Reviews',
  },
  {
    detail: 'Assignments, status changes, and due dates',
    key: 'tasks' as const,
    symbol: 'checklist',
    title: 'Tasks',
  },
  {
    detail: 'Shoots, deadlines, and schedule changes',
    key: 'calendar' as const,
    symbol: 'calendar',
    title: 'Calendar',
  },
  {
    detail: 'Upcoming and updated manual payments',
    key: 'payments' as const,
    symbol: 'creditcard',
    title: 'Payments',
  },
];

const symbols = {
  calendar: 'calendar',
  payment: 'creditcard',
  review: 'checkmark.bubble',
  system: 'bell.badge',
  task: 'checklist',
} as const;

const kindLabels = {
  calendar: 'Calendar',
  payment: 'Payment',
  review: 'Review',
  system: 'System',
  task: 'Task',
} as const;

function timeLabel(value: string) {
  const date = new Date(value);
  const difference = Date.now() - date.valueOf();
  const minutes = Math.max(0, Math.floor(difference / 60_000));

  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))}d ago`;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function pushStatusLabel(state: PushPermissionState, enabled: boolean) {
  if (state === 'registering' || state === 'checking') return 'Connecting';
  if (state === 'denied') return 'Settings';
  if (enabled) return 'Enabled';
  return 'Off';
}

export function NotificationCenterNativeScreen({
  errorMessage,
  loading,
  notifications,
  onDisablePush,
  onEnablePush,
  onMarkAllRead,
  onPressNotification,
  onRefresh,
  onRetry,
  onUpdate,
  preferences,
  pushAvailable,
  pushEnabled,
  pushErrorMessage,
  pushPermissionState,
  refreshing,
  locale = 'en',
}: NotificationCenterNativeScreenProps) {
  const visibleNotifications = notifications;
  const unreadCount = visibleNotifications.filter(
    (notification) => !notification.readAt,
  ).length;
  const isWide = useNativeWideLayout();

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={locale === 'ro' ? 'Se încarcă notificările' : 'Loading notifications'}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      <View style={[styles.notificationLayout, isWide && styles.wideNotificationLayout]}>
        <View style={styles.notificationColumn}>
          <NativeSection
            caption={`${unreadCount} unread · ${visibleNotifications.length} recent`}
            title={nativeText(locale, 'notificationCenter')}
          >
            <NativeCard>
              {visibleNotifications.length === 0 ? (
                <NativeEmptyState
                  compact
                  symbol="bell.slash"
                  title={nativeText(locale, 'noNotifications')}
                />
              ) : (
                <>
                  {unreadCount ? (
                    <>
                      <NativeListRow
                        accessibilityHint="Marks every notification in this inbox as read"
                        detail={`${unreadCount} ${locale === 'ro' ? 'notificare necitită' : 'unread notification'}${unreadCount === 1 ? '' : locale === 'ro' ? 'ri' : 's'}`}
                        onPress={() => void onMarkAllRead().catch(() => undefined)}
                        showChevron={false}
                        symbol="checkmark.circle"
                        title={nativeText(locale, 'markAllRead')}
                      />
                      <NativeSeparator inset={60} />
                    </>
                  ) : null}
                  {visibleNotifications.map((notification, index) => (
                    <Fragment key={notification.id}>
                      {index ? <NativeSeparator inset={60} /> : null}
                      <NativeListRow
                        accessibilityHint="Opens the related workspace item"
                        detail={`${kindLabels[notification.kind]} · ${timeLabel(notification.createdAt)}`}
                        onPress={() =>
                          void onPressNotification(notification).catch(
                            () => undefined,
                          )
                        }
                        subtitle={notification.body}
                        symbol={symbols[notification.kind]}
                        title={notification.title}
                        trailing={
                          notification.readAt ? null : (
                            <StatusPill label={locale === 'ro' ? 'Nouă' : 'New'} tone="critical" />
                          )
                        }
                      />
                    </Fragment>
                  ))}
                </>
              )}
            </NativeCard>
          </NativeSection>
        </View>

        <View style={styles.settingsColumn}>
          <NativeSection
            caption="Delivered securely to this signed-in device"
            title={nativeText(locale, 'pushDelivery')}
          >
            <NativeCard>
              <NativeListRow
                accessibilityHint={
                  pushEnabled
                    ? 'Turns off remote notifications on this device'
                    : 'Requests iOS notification permission and connects this device'
                }
                detail={
                  pushPermissionState === 'denied'
                    ? 'Permission is off in iOS Settings'
                    : pushEnabled
                      ? 'Real-time alerts can arrive when the app is closed'
                      : 'Enable native alerts for this device'
                }
                disabled={
                  !pushAvailable ||
                  pushPermissionState === 'checking' ||
                  pushPermissionState === 'registering'
                }
                onPress={() =>
                  void (pushEnabled ? onDisablePush() : onEnablePush()).catch(
                    () => undefined,
                  )
                }
                showChevron={false}
                symbol={pushEnabled ? 'bell.badge.fill' : 'bell.badge'}
                title={nativeText(locale, 'pushNotifications')}
                trailing={
                  <StatusPill
                    label={pushStatusLabel(pushPermissionState, pushEnabled)}
                    tone={pushEnabled ? 'success' : 'neutral'}
                  />
                }
              />
            </NativeCard>
            {pushErrorMessage ? (
              <Text selectable style={styles.errorNote}>
                {pushErrorMessage}
              </Text>
            ) : null}
          </NativeSection>

          <NativeSection
            caption="Synced with your Realty Media account"
            title={nativeText(locale, 'alertPreferences')}
          >
            <NativeCard>
              <NativeListRow
                detail="Show alerts and badges inside the Realty Media app"
                showChevron={false}
                symbol="bell"
                title={nativeText(locale, 'allowAppAlerts')}
                trailing={
                  <Switch
                    accessibilityLabel="Allow app alerts"
                    onValueChange={(master) => void onUpdate({ master })}
                    value={preferences.master}
                  />
                }
              />
              {preferenceRows.map((item) => (
                <Fragment key={item.key}>
                  <NativeSeparator inset={60} />
                  <NativeListRow
                    detail={item.detail}
                    showChevron={false}
                    symbol={item.symbol}
                        title={item.key === 'reviews' ? nativeText(locale, 'reviewsLabel') : item.key === 'tasks' ? nativeText(locale, 'tasksLabel') : item.key === 'calendar' ? nativeText(locale, 'calendar') : nativeText(locale, 'payments')}
                    trailing={
                      <Switch
                        accessibilityLabel={`${item.title} notifications`}
                        disabled={!preferences.master}
                        onValueChange={(value) =>
                          void onUpdate({ [item.key]: value })
                        }
                        value={preferences[item.key]}
                      />
                    }
                  />
                </Fragment>
              ))}
            </NativeCard>
          </NativeSection>

          <Text selectable style={styles.note}>
            Notification history remains available even when alerts are paused.
            iOS controls whether remote alerts may appear on this device.
          </Text>
        </View>
      </View>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  errorNote: {
    color: nativeColors.critical,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 2,
  },
  note: {
    color: nativeColors.tertiaryLabel,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  notificationColumn: {
    flex: 1.2,
    minWidth: 0,
  },
  notificationLayout: {
    gap: 24,
    width: '100%',
  },
  settingsColumn: {
    flex: 1,
    gap: 24,
    minWidth: 0,
  },
  wideNotificationLayout: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 20,
  },
});
