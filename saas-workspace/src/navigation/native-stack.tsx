import { Stack } from 'expo-router';

import { nativeColors } from '@/components/native';

export const nativeStackScreenOptions = {
  contentStyle: { backgroundColor: nativeColors.background },
  headerBackButtonDisplayMode: 'minimal',
  headerLargeTitleEnabled: false,
  headerLargeStyle: { backgroundColor: nativeColors.card },
  headerLargeTitleStyle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontWeight: '600',
  },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: nativeColors.card },
  headerTintColor: nativeColors.label,
  headerTitleStyle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontWeight: '600',
  },
} as const;

export function NativeStack({ title }: { title: string }) {
  return (
    <Stack
      screenOptions={nativeStackScreenOptions}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
