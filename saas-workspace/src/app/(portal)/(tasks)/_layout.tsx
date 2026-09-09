import { Stack } from 'expo-router';

import { nativeStackScreenOptions } from '@/navigation/native-stack';
import { nativeColors } from '@/components/native';

export default function TasksLayout() {
  return (
    <Stack
      screenOptions={nativeStackScreenOptions}
    >
      <Stack.Screen name="index" options={{ title: 'Tasks' }} />
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
      <Stack.Screen name="task/[taskId]" options={{ title: 'Task' }} />
    </Stack>
  );
}
