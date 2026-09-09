import { Pressable, StyleSheet, View } from 'react-native';

import {
  NativeButton,
  NativeCard,
  NativeEmptyState,
  NativeScreen,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import {
  nativeTaskCardStatusVisuals,
  type NativeTaskCardStatus,
} from '@/components/native/task-card';
import type { TaskSummary } from '@/screens/web/types';

const statusOptions: NativeTaskCardStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
];

export interface TaskPreviewNativeScreenProps extends NativeAsyncScreenProps {
  task?: TaskSummary;
  status: NativeTaskCardStatus;
  statusSaving?: boolean;
  onChangeStatus?: (status: NativeTaskCardStatus) => void;
  onEdit?: () => void;
}

function dueLabel(value?: string) {
  if (!value) return 'No deadline';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function TaskPreviewNativeScreen({
  errorMessage,
  loading,
  onChangeStatus,
  onEdit,
  onRefresh,
  onRetry,
  refreshing,
  status,
  statusSaving = false,
  task,
}: TaskPreviewNativeScreenProps) {
  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel="Loading task"
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
    >
      {task ? (
        <View style={styles.content}>
          <NativeCard style={styles.previewCard}>
            <Text selectable style={styles.title}>{task.title}</Text>
            <Text selectable style={styles.property}>{task.propertyName}</Text>
            <Text selectable style={styles.meta}>
              {task.assigneeName || 'Unassigned'} · {dueLabel(task.dueAt)}
            </Text>
            <View style={styles.badges}>
              {task.priority === 'urgent' ? (
                <View style={styles.urgentBadge}>
                  <Text selectable style={styles.urgentLabel}>Urgent</Text>
                </View>
              ) : null}
              <Text selectable style={styles.visibility}>{task.visibility.replace('_', ' ')}</Text>
            </View>
            {task.description ? (
              <Text selectable style={styles.description}>{task.description}</Text>
            ) : null}
          </NativeCard>

          <View accessibilityLabel="Task status" style={styles.statusOptions}>
            {statusOptions.map((option) => {
              const visual = nativeTaskCardStatusVisuals[option];
              const selected = option === status;
              return (
                <Pressable
                  accessibilityLabel={'Set status to ' + visual.label}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: statusSaving, selected }}
                  disabled={statusSaving}
                  key={option}
                  onPress={() => onChangeStatus?.(option)}
                  style={[
                    styles.statusOption,
                    selected && {
                      backgroundColor: visual.backgroundColor,
                      borderColor: visual.color,
                    },
                  ]}
                >
                  <Text
                    selectable
                    style={[
                      styles.statusOptionLabel,
                      selected && { color: visual.color },
                    ]}
                  >
                    {visual.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {onEdit ? (
            <NativeButton
              disabled={statusSaving}
              label="Edit task"
              onPress={onEdit}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : (
        <NativeEmptyState
          message="This task may have been deleted or is no longer available."
          symbol="checklist.unchecked"
          title="Task unavailable"
        />
      )}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
  },
  previewCard: {
    gap: 5,
    padding: 16,
  },
  title: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 21,
    fontWeight: '600',
    lineHeight: 26,
  },
  property: {
    color: nativeColors.secondaryLabel,
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    color: nativeColors.tertiaryLabel,
    fontSize: 13,
    lineHeight: 18,
  },
  badges: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  urgentBadge: {
    backgroundColor: nativeColors.accent,
    borderCurve: 'continuous',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  urgentLabel: {
    color: nativeColors.card,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  visibility: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    lineHeight: 18,
    textTransform: 'capitalize',
  },
  description: {
    borderTopColor: nativeColors.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    color: nativeColors.label,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    paddingTop: 12,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  statusOption: {
    alignItems: 'center',
    backgroundColor: nativeColors.card,
    borderCurve: 'continuous',
    borderColor: nativeColors.separator,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  statusOptionLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
});
