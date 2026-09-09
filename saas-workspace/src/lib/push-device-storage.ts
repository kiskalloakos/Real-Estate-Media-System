import * as SecureStore from 'expo-secure-store';

function storageKey(userId: string) {
  const safeUserId = userId.replace(/[^A-Za-z0-9._-]/g, '_');
  return `agency-workspace-push-token.${safeUserId || 'anonymous'}`;
}

export async function loadStoredPushToken(userId: string) {
  if (process.env.EXPO_OS === 'web') {
    return null;
  }

  return SecureStore.getItemAsync(storageKey(userId));
}

export async function saveStoredPushToken(userId: string, token: string) {
  if (process.env.EXPO_OS === 'web') {
    return;
  }

  await SecureStore.setItemAsync(storageKey(userId), token);
}

export async function clearStoredPushToken(userId: string) {
  if (process.env.EXPO_OS === 'web') {
    return;
  }

  await SecureStore.deleteItemAsync(storageKey(userId));
}
