import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';

export default function SopsLayout() {
  return (
    <Stack screenOptions={nativeStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'SOPs' }} />
    </Stack>
  );
}
