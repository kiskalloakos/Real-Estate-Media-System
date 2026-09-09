import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';
import { nativeText } from '@/lib/native-i18n';
import { useApp } from '@/providers/app-provider';

export default function BillingLayout() {
  const { identity } = useApp();
  return (
    <Stack screenOptions={nativeStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: nativeText(identity?.locale, 'deal') }} />
    </Stack>
  );
}
