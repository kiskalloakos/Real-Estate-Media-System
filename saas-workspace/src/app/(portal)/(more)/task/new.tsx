import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import { useNativeChoice } from '@/components/native/native-choice';
import DateTimePicker from '@/components/native/native-date-time-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  Text,
  nativeColors,
} from '@/components/native';
import { useNativePortalData } from '@/hooks/use-native-portal-data';
import {
  archiveWorkspaceTask,
  createWorkspaceTask,
  updateWorkspaceTask,
} from '@/lib/portal-action-service';
import {
  archivePreviewTask,
  createPreviewTask,
  updatePreviewTask,
} from '@/lib/native-preview-store';
import {
  clearNativeEditorDraft,
  loadNativeEditorDraft,
  saveNativeEditorDraft,
} from '@/lib/native-editor-drafts';
import { useApp, type AppIdentity } from '@/providers/app-provider';
import type {
  AgencyMemberSummary,
  CreateTaskInput,
  TaskSummary,
  UpdateTaskInput,
} from '@/screens/web/types';

type Choice<Value extends string | undefined> = {
  label: string;
  value: Value;
};

const priorityChoices: Choice<TaskSummary['priority']>[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Urgent', value: 'urgent' },
];

const visibilityChoices: Choice<TaskSummary['visibility']>[] = [
  { label: 'Owners only', value: 'admin_only' },
  { label: 'Realty Media team', value: 'team' },
  { label: 'Client visible', value: 'client' },
];

const statusChoices: Choice<TaskSummary['status']>[] = [
  { label: 'New tasks', value: 'todo' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed', value: 'done' },
];

function editorPriority(value?: TaskSummary['priority']): TaskSummary['priority'] {
  return value === 'urgent' || value === 'high' ? 'urgent' : 'normal';
}

function editorStatus(value?: TaskSummary['status']): TaskSummary['status'] {
  if (value === 'in_progress') return 'in_progress';
  if (value === 'done' || value === 'cancelled') return 'done';
  return 'todo';
}


function localDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTimeString(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(
    value.getMinutes(),
  ).padStart(2, '0')}`;
}

function nextDeadline() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(17, 0, 0, 0);
  return value;
}

function memberLabel(
  member: AgencyMemberSummary | undefined,
  currentUserId: string,
) {
  if (!member) return 'Unassigned';
  return member.userId === currentUserId ? `${member.name} · You` : member.name;
}

export default function NewTaskRoute() {
  const params = useLocalSearchParams<{ taskId?: string | string[] }>();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const existingTask = live.data?.tasks?.find((task) => task.id === taskId);

  if (!identity) return null;

  if (taskId && live.loading && !existingTask) {
    return (
      <>
        <NativeScreen loading loadingLabel="Loading task">
          <></>
        </NativeScreen>
        <Stack.Title>Task</Stack.Title>
      </>
    );
  }

  return (
    <TaskEditorContent
      existingTask={existingTask}
      identity={identity}
      isPreview={isPreview}
      key={taskId ?? 'new-task'}
      live={live}
      taskId={taskId}
    />
  );
}

interface TaskEditorContentProps {
  existingTask?: TaskSummary;
  identity: AppIdentity;
  isPreview: boolean;
  live: ReturnType<typeof useNativePortalData>;
  taskId?: string;
}

function initialDeadline(task?: TaskSummary) {
  if (!task?.dueAt) return nextDeadline();
  const due = new Date(task.dueAt);
  return Number.isNaN(due.valueOf()) ? nextDeadline() : due;
}

function TaskEditorContent({
  existingTask,
  identity,
  isPreview,
  live,
  taskId,
}: TaskEditorContentProps) {
  const toolbarIcon = useToolbarIcons();
  const choose = useNativeChoice();
  const router = useRouter();
  const editing = Boolean(taskId);
  const [title, setTitle] = React.useState(existingTask?.title ?? '');
  const [description, setDescription] = React.useState(
    existingTask?.description ?? '',
  );
  const [assigneeUserId, setAssigneeUserId] = React.useState<
    string | undefined
  >(existingTask?.assigneeUserId ?? identity.userId);
  const [clientId, setClientId] = React.useState<string | undefined>(
    existingTask?.clientId,
  );
  const [propertyId, setPropertyId] = React.useState<string | undefined>(
    existingTask?.propertyId,
  );
  const [priority, setPriority] =
    React.useState<TaskSummary['priority']>(editorPriority(existingTask?.priority));
  const [status, setStatus] = React.useState<TaskSummary['status']>(
    editorStatus(existingTask?.status),
  );
  const [visibility, setVisibility] =
    React.useState<TaskSummary['visibility']>(existingTask?.visibility ?? 'team');
  const [deadlineEnabled, setDeadlineEnabled] = React.useState(
    Boolean(existingTask?.dueAt),
  );
  const [deadline, setDeadline] = React.useState(() =>
    initialDeadline(existingTask),
  );
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [draftReady, setDraftReady] = React.useState(editing);
  const draftScope = `task:${identity.userId}:${identity.agencyId ?? 'none'}:${taskId ?? 'new'}`;

  React.useEffect(() => {
    if (editing) return;
    let active = true;
    void loadNativeEditorDraft<{
      description?: string;
      title?: string;
    }>(draftScope).then((draft) => {
      if (active && draft) {
        setTitle(draft.title ?? '');
        setDescription(draft.description ?? '');
      }
      if (active) setDraftReady(true);
    });
    return () => { active = false; };
  }, [draftScope, editing]);

  React.useEffect(() => {
    if (editing || !draftReady || saving) return;
    if (!title.trim() && !description.trim()) return;
    void saveNativeEditorDraft(draftScope, { description, title });
  }, [description, draftReady, draftScope, editing, saving, title]);

  const members = React.useMemo(() => {
    const available = (live.data?.agencyMembers ?? []).filter(
      (member) => member.status === 'active',
    );
    if (!available.some((member) => member.userId === identity.userId)) {
      available.push({
        email: identity.email,
        id: `current-${identity.userId}`,
        name: identity.displayName,
        role: identity.role === 'admin' ? 'admin' : 'team_member',
        status: 'active',
        userId: identity.userId,
      });
    }
    return available.sort((left, right) => left.name.localeCompare(right.name));
  }, [identity, live.data?.agencyMembers]);
  const clients = React.useMemo(
    () =>
      [...(live.data?.clients ?? [])].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [live.data?.clients],
  );
  const properties = React.useMemo(
    () =>
      (live.data?.properties ?? [])
        .filter((property) => !clientId || property.clientId === clientId)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [clientId, live.data?.properties],
  );
  const selectedMember = members.find(
    (member) => member.userId === assigneeUserId,
  );
  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedProperty = properties.find(
    (property) => property.id === propertyId,
  );

  const selectMember = () => {
    choose(
      'Assign task',
      [
        { label: 'Unassigned', value: undefined },
        ...members.map((member) => ({
          label: memberLabel(member, identity?.userId ?? ''),
          value: member.userId,
        })),
      ],
      setAssigneeUserId,
    );
  };

  const selectClient = () => {
    choose(
      'Client scope',
      [
        { label: 'Internal Realty Media task', value: undefined },
        ...clients.map((client) => ({
          label: client.name,
          value: client.id,
        })),
      ],
      (nextClientId) => {
        setClientId(nextClientId);
        setPropertyId(undefined);
        setVisibility(nextClientId ? 'client' : 'team');
      },
    );
  };

  const selectProperty = () => {
    const choices = [
      { label: 'No specific property', value: undefined },
      ...properties.map((property) => ({
        label: property.name,
        value: property.id,
      })),
    ];
    choose('Property', choices, (nextPropertyId) => {
      setPropertyId(nextPropertyId);
      const property = properties.find((item) => item.id === nextPropertyId);
      if (property) setClientId(property.clientId);
    });
  };

  const submit = async () => {
    if (!identity || (identity.role !== 'admin' && identity.role !== 'team_member')) return;
    if (!title.trim()) {
      setErrorMessage('Add a clear task title before saving.');
      return;
    }
    if (visibility === 'client' && !clientId) {
      setErrorMessage('Choose a client before making this task client visible.');
      return;
    }
    if (!isPreview && !identity.agencyId) {
      setErrorMessage('Your administrator account is missing an agency.');
      return;
    }

    const input: CreateTaskInput = {
      assigneeUserId,
      clientId,
      description,
      dueDate: deadlineEnabled ? localDateString(deadline) : '',
      dueTime: deadlineEnabled ? localTimeString(deadline) : '17:00',
      priority,
      propertyId,
      title,
      visibility,
    };

    setSaving(true);
    setErrorMessage('');
    try {
      if (isPreview && taskId) {
        updatePreviewTask({ ...input, status, taskId });
      } else if (isPreview) {
        createPreviewTask(input, identity.displayName);
      } else if (taskId) {
        const updateInput: UpdateTaskInput = {
          ...input,
          status,
          taskId,
        };
        await updateWorkspaceTask(updateInput);
      } else {
        await createWorkspaceTask(input, {
          agencyId: identity.agencyId!,
          userId: identity.userId,
        });
      }
      if (!isPreview) await live.retry();
      await clearNativeEditorDraft(draftScope);
      router.back();
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : `Could not ${editing ? 'update' : 'create'} the task.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!taskId || saving) return;
    Alert.alert(
      'Delete task?',
      'This removes the task from the shared workspace for everyone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            setSaving(true);
            setErrorMessage('');
            const archive = isPreview
              ? Promise.resolve(archivePreviewTask(taskId))
              : archiveWorkspaceTask(taskId);
            void archive
              .then(async () => {
                if (!isPreview) await live.retry();
                router.back();
              })
              .catch((caught) => {
                setErrorMessage(
                  caught instanceof Error
                    ? caught.message
                    : 'Could not delete the task.',
                );
                setSaving(false);
              });
          },
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  };

  if (identity.role !== 'admin' && identity.role !== 'team_member') {
    return (
      <>
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={styles.unavailable}
          contentInsetAdjustmentBehavior="automatic"
          style={styles.screen}
        >
          <NativeEmptyState
            message="Only Realty Media team members can create and manage tasks."
            symbol="lock"
            title="Administrator access required"
          />
        </ScrollView>
        <Stack.Title>New Task</Stack.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={() => router.back()}>
            Close
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </>
    );
  }

  if (editing && !existingTask && !live.loading) {
    return (
      <>
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={styles.unavailable}
          contentInsetAdjustmentBehavior="automatic"
          style={styles.screen}
        >
          <NativeEmptyState
            message="This task may have been deleted or is no longer available."
            symbol="checklist.unchecked"
            title="Task unavailable"
          />
        </ScrollView>
        <Stack.Title>Task</Stack.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={() => router.back()}>
            Close
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </>
    );
  }

  return (
    <>
      <ScrollView
        alwaysBounceVertical={false}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
      >
        {errorMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            selectable
            style={styles.error}
          >
            {errorMessage}
          </Text>
        ) : null}

        <NativeSection title="Task">
          <NativeCard style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                accessibilityLabel="Task title"
                autoCapitalize="sentences"
                autoFocus
                editable={!saving}
                onChangeText={setTitle}
                placeholder="e.g. Prepare the first video cut"
                placeholderTextColor={nativeColors.tertiaryLabel}
                returnKeyType="next"
                style={styles.input}
                value={title}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                accessibilityLabel="Task description"
                editable={!saving}
                multiline
                onChangeText={setDescription}
                placeholder="Optional context, links, or acceptance notes"
                placeholderTextColor={nativeColors.tertiaryLabel}
                style={[styles.input, styles.descriptionInput]}
                textAlignVertical="top"
                value={description}
              />
            </View>
          </NativeCard>
        </NativeSection>

        <NativeSection title="Assignment">
          <NativeCard>
            <NativeListRow
              detail={memberLabel(selectedMember, identity.userId)}
              disabled={saving || live.loading}
              onPress={selectMember}
              symbol="person.crop.circle"
              title="Assignee"
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail={selectedClient?.name ?? 'Internal Realty Media task'}
              disabled={saving || live.loading}
              onPress={selectClient}
              symbol="person.2"
              title="Client"
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail={selectedProperty?.name ?? 'No specific property'}
              disabled={saving || live.loading}
              onPress={selectProperty}
              symbol="building.2"
              title="Property"
            />
          </NativeCard>
        </NativeSection>

        <NativeSection title="Delivery">
          <NativeCard>
            <NativeListRow
              detail={
                visibilityChoices.find((choice) => choice.value === visibility)
                  ?.label
              }
              disabled={saving}
              onPress={() =>
                choose('Visibility', visibilityChoices, setVisibility)
              }
              symbol="eye"
              title="Visibility"
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail={
                priorityChoices.find((choice) => choice.value === priority)
                  ?.label
              }
              disabled={saving}
              onPress={() => choose('Priority', priorityChoices, setPriority)}
              symbol="flag"
              symbolColor={
                priority === 'urgent' ? nativeColors.critical : nativeColors.accent
              }
              title="Priority"
            />
      {editing ? (
              <>
                <NativeSeparator inset={60} />
                <NativeListRow
                  detail={
                    statusChoices.find((choice) => choice.value === status)
                      ?.label
                  }
                  disabled={saving}
                  onPress={() => choose('Status', statusChoices, setStatus)}
                  symbol={
                    status === 'done'
                      ? 'checkmark.circle.fill'
                      : status === 'in_progress'
                        ? 'clock.arrow.circlepath'
                        : 'circle.dotted'
                  }
                  symbolColor={
                    status === 'done'
                      ? nativeColors.success
                      : status === 'in_progress'
                        ? nativeColors.accent
                        : nativeColors.accent
                  }
                  title="Status"
                />
              </>
            ) : null}
            <NativeSeparator inset={60} />
            <NativeListRow
              detail="Add a specific date and time"
              showChevron={false}
              symbol="calendar"
              title="Deadline"
              trailing={
                <Switch
                  accessibilityLabel="Deadline"
                  disabled={saving}
                  onValueChange={setDeadlineEnabled}
                  value={deadlineEnabled}
                />
              }
            />
            {deadlineEnabled ? (
              <>
                <NativeSeparator inset={60} />
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>Due date</Text>
                  <DateTimePicker
                    disabled={saving}
                    display="compact"
                    minimumDate={new Date()}
                    mode="date"
                    onChange={(_event, value) => {
                      if (!value) return;
                      const next = new Date(deadline);
                      next.setFullYear(
                        value.getFullYear(),
                        value.getMonth(),
                        value.getDate(),
                      );
                      setDeadline(next);
                    }}
                    value={deadline}
                  />
                </View>
                <NativeSeparator inset={60} />
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>Due time</Text>
                  <DateTimePicker
                    disabled={saving}
                    display="compact"
                    mode="time"
                    onChange={(_event, value) => {
                      if (!value) return;
                      const next = new Date(deadline);
                      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
                      setDeadline(next);
                    }}
                    value={deadline}
                  />
                </View>
              </>
            ) : null}
          </NativeCard>
        </NativeSection>
      </ScrollView>

      <Stack.Title>{editing ? 'Edit Task' : 'New Task'}</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          disabled={saving}
          onPress={() => router.back()}
        >
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {editing ? (
          <Stack.Toolbar.Button
            accessibilityLabel="Delete task"
            disabled={saving}
            icon={toolbarIcon('trash')}
            onPress={confirmDelete}
          />
        ) : null}
        <Stack.Toolbar.Button
          disabled={
            saving ||
            !title.trim() ||
            live.loading ||
            (editing && !existingTask)
          }
          onPress={() => void submit()}
          variant="done"
        >
          {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: nativeColors.background,
    flex: 1,
  },
  content: {
    gap: 22,
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  unavailable: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  error: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    color: nativeColors.critical,
    fontSize: 14,
    lineHeight: 19,
    padding: 12,
  },
  form: {
    gap: 18,
    padding: 16,
  },
  field: {
    gap: 7,
  },
  label: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    color: nativeColors.label,
    fontFamily: 'OutfitRegular',
    fontSize: 17,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  descriptionInput: {
    minHeight: 96,
  },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  dateLabel: {
    color: nativeColors.label,
    fontSize: 16,
    fontWeight: '600',
  },
});
