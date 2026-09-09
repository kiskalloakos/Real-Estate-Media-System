import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { TaskPreviewNativeScreen } from '@/screens/native';
import type { NativeTaskCardStatus } from '@/components/native/task-card';
import { useNativePortalData } from '@/hooks/use-native-portal-data';
import {
  updatePreviewTask,
} from '@/lib/native-preview-store';
import { updateWorkspaceTask } from '@/lib/portal-action-service';
import { taskBoardStatus } from '@/lib/task-presentation';
import { useApp } from '@/providers/app-provider';
import type { TaskSummary, UpdateTaskInput } from '@/screens/web/types';

function taskDateParts(value?: string) {
  if (!value) return { dueDate: '', dueTime: '17:00' };
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return { dueDate: '', dueTime: '17:00' };
  return {
    dueDate: [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-'),
    dueTime: [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
    ].join(':'),
  };
}

function statusUpdateInput(
  task: TaskSummary,
  status: NativeTaskCardStatus,
): UpdateTaskInput {
  const due = taskDateParts(task.dueAt);
  return {
    assigneeUserId: task.assigneeUserId,
    clientId: task.clientId,
    description: task.description,
    dueDate: due.dueDate,
    dueTime: due.dueTime,
    priority: task.priority,
    propertyId: task.propertyId,
    status,
    taskId: task.id,
    title: task.title,
    visibility: task.visibility,
  };
}

export default function TaskPreviewRoute() {
  const toolbarIcon = useToolbarIcons();
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const task = live.data?.tasks?.find((item) => item.id === taskId);
  const [statusOverride, setStatusOverride] = React.useState<{
    taskStatus: TaskSummary['status'];
    status: NativeTaskCardStatus;
  } | null>(null);
  const [statusSaving, setStatusSaving] = React.useState(false);
  const [statusError, setStatusError] = React.useState('');
  const status =
    task && statusOverride?.taskStatus === task.status
      ? statusOverride.status
      : task
        ? taskBoardStatus(task.status)
        : 'todo';

  const changeStatus = async (nextStatus: NativeTaskCardStatus) => {
    if (!task || nextStatus === status || statusSaving) return;
    setStatusSaving(true);
    setStatusError('');
    setStatusOverride({ status: nextStatus, taskStatus: task.status });
    try {
      const input = statusUpdateInput(task, nextStatus);
      if (isPreview) {
        updatePreviewTask(input);
      } else {
        await updateWorkspaceTask(input);
        await live.retry();
      }
    } catch (caught) {
      setStatusOverride(null);
      setStatusError(
        caught instanceof Error ? caught.message : 'Could not update the task status.',
      );
    } finally {
      setStatusSaving(false);
    }
  };

  if (!identity) return null;

  return (
    <>
      <TaskPreviewNativeScreen
        errorMessage={statusError || live.errorMessage}
        loading={!isPreview && live.loading}
        onChangeStatus={(nextStatus) => void changeStatus(nextStatus)}
        onEdit={
          taskId
            ? () =>
                router.push({
                  pathname: '/(portal)/(more)/task/new',
                  params: { taskId },
                })
            : undefined
        }
        onRefresh={() => void live.retry()}
        onRetry={() => void live.retry()}
        refreshing={!isPreview && live.refreshing}
        status={status}
        statusSaving={statusSaving}
        task={task}
      />
      <Stack.Title>Task</Stack.Title>
      {task ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Edit task"
            disabled={statusSaving}
            icon={toolbarIcon('pencil')}
            onPress={() =>
              router.push({
                pathname: '/(portal)/(more)/task/new',
                params: { taskId: task.id },
              })
            }
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
