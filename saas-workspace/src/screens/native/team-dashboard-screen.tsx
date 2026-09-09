import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  NativeTaskCard,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
  useNativeWideLayout,
} from '@/components/native';
import type { TaskSummary } from '@/screens/web/types';
import { taskBoardStatus } from '@/lib/task-presentation';

import type { CalendarEventSummary } from './calendar-screen';

export interface TeamDashboardNativeScreenProps extends NativeAsyncScreenProps {
  events?: readonly CalendarEventSummary[];
  currentUserId?: string;
  tasks?: readonly TaskSummary[];
  userName: string;
  onPressEvent?: (event: CalendarEventSummary) => void;
  onPressTask?: (task: TaskSummary) => void;
}

function dateLabel(value?: string) {
  if (!value) return 'Schedule';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(date);
}

export function TeamDashboardNativeScreen({
  events = [],
  currentUserId,
  tasks = [],
  userName,
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  onPressEvent,
  onPressTask,
}: TeamDashboardNativeScreenProps) {
  const shoots = events.filter((event) => event.kind === 'shoot');
  const isWide = useNativeWideLayout();
  const nextShoot = shoots[0];
  const assignedTasks = tasks.filter(
    (task) =>
      !['done', 'cancelled'].includes(task.status) &&
      (!currentUserId || task.assigneeUserId === currentUserId),
  );
  const firstName = userName.trim().split(/\s+/)[0] || userName;

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel="Loading dashboard"
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      <View style={styles.greeting}>
        <Text selectable style={styles.greetingTitle}>
          Ready for the week, {firstName}?
        </Text>
      </View>

      <View style={[styles.columns, !isWide && styles.columnsStack]}>
        <View style={styles.column}>
          <NativeSection title="Your next shoot">
            {nextShoot ? (
              <NativeCard style={styles.nextShootCard}>
                <Text selectable style={styles.dateLabel}>
                  {dateLabel(nextShoot.dateKey)}
                </Text>
                <View style={styles.nextShootCopy}>
                  <Text selectable style={styles.nextShootTitle}>
                    {nextShoot.title}
                  </Text>
                  <Text selectable style={styles.nextShootMeta}>
                    {[nextShoot.propertyName, nextShoot.location]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text selectable style={styles.nextShootTime}>
                    {[nextShoot.startTimeLabel, nextShoot.endTimeLabel]
                      .filter(Boolean)
                      .join(' — ')}
                  </Text>
                </View>
              </NativeCard>
            ) : (
              <NativeCard>
                <NativeEmptyState
                  compact
                  message="Your next assigned production shoot will appear here."
                  symbol="camera"
                  title="No shoot assigned"
                />
              </NativeCard>
            )}
          </NativeSection>

          <NativeSection title="Upcoming shoots">
            {shoots.length ? (
              <NativeCard>
                {shoots.map((event, index) => (
                  <Fragment key={event.id}>
                    {index ? <NativeSeparator inset={60} /> : null}
                    <NativeListRow
                      detail={[event.startTimeLabel, event.endTimeLabel]
                        .filter(Boolean)
                        .join(' — ')}
                      onPress={onPressEvent ? () => onPressEvent(event) : undefined}
                      showChevron={Boolean(onPressEvent)}
                      subtitle={[event.propertyName, event.location]
                        .filter(Boolean)
                        .join(' · ')}
                      title={event.title}
                    />
                  </Fragment>
                ))}
              </NativeCard>
            ) : (
              <NativeCard>
                <NativeEmptyState
                  compact
                  message="Scheduled shoots will appear here."
                  symbol="camera"
                  title="No upcoming shoots"
                />
              </NativeCard>
            )}
          </NativeSection>
        </View>

        <View style={styles.column}>
          <NativeSection title="Assigned work">
            {assignedTasks.length ? (
              <View style={styles.taskStack}>
                {assignedTasks.map((task) => (
                  <NativeTaskCard
                    accessibilityHint={onPressTask ? 'Opens task preview' : undefined}
                    key={task.id}
                    meta={task.dueAt ? `Due ${task.dueAt.slice(0, 10)}` : 'No deadline'}
                    onPress={onPressTask ? () => onPressTask(task) : undefined}
                    propertyName={task.propertyName || task.clientName}
                    status={taskBoardStatus(task.status)}
                    title={task.title}
                    urgent={task.priority === 'urgent'}
                  />
                ))}
              </View>
            ) : (
              <NativeCard>
                <NativeEmptyState
                  message="Tasks assigned directly to you will appear here."
                  symbol="checklist"
                  title="No open tasks"
                />
              </NativeCard>
            )}
          </NativeSection>
        </View>
      </View>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  columns: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 18,
  },
  columnsStack: {
    flexDirection: 'column',
  },
  column: {
    flex: 1,
    gap: 22,
    minWidth: 0,
  },
  dateLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  greeting: {
    paddingHorizontal: 2,
  },
  greetingTitle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  nextShootCard: {
    gap: 18,
    minHeight: 230,
    padding: 20,
  },
  nextShootCopy: {
    gap: 8,
    justifyContent: 'center',
    minHeight: 135,
  },
  nextShootMeta: {
    color: nativeColors.secondaryLabel,
    fontSize: 16,
    lineHeight: 21,
  },
  nextShootTime: {
    color: nativeColors.accent,
    fontFamily: 'OutfitSemiBold',
    fontSize: 16,
    fontWeight: '600',
  },
  nextShootTitle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -1,
    lineHeight: 39,
  },
  taskStack: {
    gap: 10,
  },
});
