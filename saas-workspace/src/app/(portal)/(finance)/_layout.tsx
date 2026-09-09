import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';

export default function FinanceLayout() {
  return (
    <Stack
      screenOptions={nativeStackScreenOptions}
    >
      <Stack.Screen name="index" options={{ title: 'Finance' }} />
    </Stack>
  );
}
