import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';
import { nativeColors } from '@/components/native';

export default function CalendarLayout() {
  return (
    <Stack
      screenOptions={nativeStackScreenOptions}
    >
      <Stack.Screen name="index" options={{ title: 'Calendar' }} />
      <Stack.Screen name="[eventId]" />
      <Stack.Screen
        name="event/edit"
        options={{
          contentStyle: { backgroundColor: nativeColors.background },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
          title: 'Calendar Event',
        }}
      />
    </Stack>
  );
}
