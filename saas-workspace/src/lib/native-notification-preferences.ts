import * as SecureStore from 'expo-secure-store';

export type NativeNotificationPreferences = {
  calendar: boolean;
  master: boolean;
  payments: boolean;
  reviews: boolean;
  tasks: boolean;
};

export const defaultNativeNotificationPreferences: NativeNotificationPreferences = {
  calendar: true,
  master: true,
  payments: true,
  reviews: true,
  tasks: true,
};

function storageKey(userId: string) {
  const safeUserId = userId.replace(/[^A-Za-z0-9._-]/g, '_');
  return `realty-media-notifications.${safeUserId || 'anonymous'}`;
}

export async function loadNativeNotificationPreferences(
  userId: string,
): Promise<NativeNotificationPreferences> {
  if (process.env.EXPO_OS === 'web') {
    return defaultNativeNotificationPreferences;
  }

  try {
    const stored = await SecureStore.getItemAsync(storageKey(userId));
    if (!stored) {
      return defaultNativeNotificationPreferences;
    }

    return {
      ...defaultNativeNotificationPreferences,
      ...(JSON.parse(stored) as Partial<NativeNotificationPreferences>),
    };
  } catch {
    return defaultNativeNotificationPreferences;
  }
}

export async function saveNativeNotificationPreferences(
  userId: string,
  preferences: NativeNotificationPreferences,
) {
  if (process.env.EXPO_OS === 'web') {
    return;
  }

  try {
    await SecureStore.setItemAsync(
      storageKey(userId),
      JSON.stringify(preferences),
    );
  } catch {
    // Notification preferences still persist in Supabase when secure local
    // storage is unavailable (for example, inside Expo Go).
  }
}
