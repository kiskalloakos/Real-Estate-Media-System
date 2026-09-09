import * as SecureStore from 'expo-secure-store';

function keyFor(scope: string) {
  return `realty-media:draft:${scope.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export async function loadNativeEditorDraft<T>(scope: string): Promise<T | null> {
  if (process.env.EXPO_OS === 'web') return null;
  try {
    const value = await SecureStore.getItemAsync(keyFor(scope));
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function saveNativeEditorDraft(scope: string, value: unknown) {
  if (process.env.EXPO_OS === 'web') return;
  try {
    await SecureStore.setItemAsync(keyFor(scope), JSON.stringify(value));
  } catch {
    // Draft recovery is best-effort. The editor remains fully usable when a
    // device does not provide secure local storage.
  }
}

export async function clearNativeEditorDraft(scope: string) {
  if (process.env.EXPO_OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(keyFor(scope));
  } catch {
    // Nothing to recover if secure storage cannot be reached.
  }
}
