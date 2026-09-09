import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';

export default function ClientsLayout() {
  return (
    <Stack
      screenOptions={{
        ...nativeStackScreenOptions,
        headerLargeTitle: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Clients' }} />
      <Stack.Screen name="client/[clientId]" options={{ headerLargeTitle: false }} />
      <Stack.Screen name="property/[propertyId]" options={{ headerLargeTitle: false }} />
    </Stack>
  );
}
