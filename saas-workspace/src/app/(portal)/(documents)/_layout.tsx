import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';

export default function DocumentsLayout() {
  return (
    <Stack screenOptions={nativeStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Documents' }} />
    </Stack>
  );
}
