import * as Notifications from 'expo-notifications';

export async function setAppBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}
