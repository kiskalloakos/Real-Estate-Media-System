import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';
import { nativeColors } from '@/components/native';
import { nativeText } from '@/lib/native-i18n';
import { useApp } from '@/providers/app-provider';

export default function ReviewsLayout() {
  const { identity } = useApp();
  return (
    <Stack
      screenOptions={nativeStackScreenOptions}
    >
      <Stack.Screen name="index" options={{ title: nativeText(identity?.locale, 'reviews') }} />
      <Stack.Screen
        name="comment/[reviewId]"
        options={{
          contentStyle: { backgroundColor: nativeColors.background },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.58, 0.9],
          sheetGrabberVisible: true,
          title: 'Add Comment',
        }}
      />
    </Stack>
  );
}
