import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';
import { nativeColors } from '@/components/native';
import { nativeText } from '@/lib/native-i18n';
import { useApp } from '@/providers/app-provider';

export default function MoreLayout() {
  const { identity } = useApp();
  return (
    <Stack
      screenOptions={nativeStackScreenOptions}
    >
      <Stack.Screen name="index" options={{ title: nativeText(identity?.locale, 'more') }} />
      <Stack.Screen
        name="document/[documentId]"
        options={{ title: 'Document' }}
      />
      <Stack.Screen
        name="task/new"
        options={{
          contentStyle: { backgroundColor: nativeColors.background },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9, 1],
          sheetGrabberVisible: true,
          title: 'New Task',
        }}
      />
      <Stack.Screen
        name="task/[taskId]"
        options={{
          contentStyle: { backgroundColor: nativeColors.background },
          title: 'Task',
        }}
      />
      <Stack.Screen
        name="gear/edit"
        options={{
          contentStyle: { backgroundColor: nativeColors.background },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.78, 1],
          sheetGrabberVisible: true,
          title: 'Move Gear',
        }}
      />
    </Stack>
  );
}
