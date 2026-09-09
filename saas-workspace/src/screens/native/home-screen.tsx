import { Fragment } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import {
  MetricTile,
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeScreenIntro,
  NativeSection,
  NativeSeparator,
  NativeTaskCard,
  StatusPill,
  type AppRole,
  type NativeAsyncScreenProps,
  type NativeEditorialStyleProps,
  type NativeStatusTone,
  useNativeWideLayout,
} from '@/components/native';
import type { TaskBoardStatus } from '@/lib/task-presentation';

export interface HomeMetric {
  id: string;
  label: string;
  value: string | number;
  detail?: string;
  symbol?: string;
  symbolColor?: ColorValue;
}

export interface HomePriorityItem {
  id: string;
  urgent?: boolean;
  title: string;
  subtitle?: string;
  detail?: string;
  symbol?: string;
  statusLabel: string;
  statusTone?: NativeStatusTone;
  taskStatus?: TaskBoardStatus;
}

export interface HomeScheduleItem {
  id: string;
  title: string;
  subtitle?: string;
  timeLabel: string;
  symbol?: string;
}

export interface HomeNativeScreenProps
  extends NativeAsyncScreenProps,
    NativeEditorialStyleProps {
  role: AppRole;
  userName: string;
  metrics?: readonly HomeMetric[];
  priorities?: readonly HomePriorityItem[];
  upcoming?: readonly HomeScheduleItem[];
  onPressPriority?: (item: HomePriorityItem) => void;
  onPressScheduleItem?: (item: HomeScheduleItem) => void;
  onPressAllPriorities?: () => void;
}

const roleCopy: Record<
  AppRole,
  { eyebrow: string; summary: string; priorityTitle: string; priorityEmpty: string }
> = {
  admin: {
    eyebrow: 'Agency overview',
    summary: 'A calm view of approvals, production, and the work that needs a decision.',
    priorityTitle: 'Tasks',
    priorityEmpty: 'Your active production tasks will appear here.',
  },
  team_member: {
    eyebrow: 'Your work today',
    summary: 'Assigned properties, feedback, and the next production handoff in one place.',
    priorityTitle: 'Your queue',
    priorityEmpty: 'You are caught up. New assignments and feedback will appear here.',
  },
  client: {
    eyebrow: 'Your Realty Media workspace',
    summary: 'See what is moving, review new work, and keep up with every property.',
    priorityTitle: 'Ready for you',
    priorityEmpty: 'Nothing needs your approval right now. We will notify you when it does.',
  },
};

export function HomeNativeScreen({
  role,
  userName,
  metrics = [],
  priorities = [],
  upcoming = [],
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  editorialTitleStyle,
  onPressPriority,
  onPressScheduleItem,
  onPressAllPriorities,
}: HomeNativeScreenProps) {
  const copy = roleCopy[role];
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const isWide = useNativeWideLayout();

  const prioritySection = (
    <NativeSection
      actionLabel={priorities.length && onPressAllPriorities ? 'See All' : undefined}
      onPressAction={onPressAllPriorities}
      title={copy.priorityTitle}
    >
      {priorities.length ? (
        <View style={styles.priorityStack}>
          {priorities.map((item) => (
            item.taskStatus ? (
              <NativeTaskCard
                accessibilityHint="Opens task preview"
                key={item.id}
                meta={item.detail}
                onPress={onPressPriority ? () => onPressPriority(item) : undefined}
                propertyName={item.subtitle}
                status={item.taskStatus}
                statusLabel={item.statusLabel}
                title={item.title}
                urgent={item.urgent}
              />
            ) : (
              <NativeCard key={item.id}>
                <NativeListRow
                  accessibilityHint="Opens this item"
                  detail={item.detail}
                  onPress={onPressPriority ? () => onPressPriority(item) : undefined}
                  showChevron={Boolean(onPressPriority)}
                  subtitle={item.subtitle}
                  symbol={item.symbol ?? 'exclamationmark.circle'}
                  title={item.title}
                  trailing={<StatusPill label={item.statusLabel} tone={item.statusTone} />}
                />
              </NativeCard>
            )
          ))}
        </View>
      ) : (
        <NativeCard>
          <NativeEmptyState
            compact
            message={copy.priorityEmpty}
            symbol="checkmark.circle"
            title="All clear"
          />
        </NativeCard>
      )}
    </NativeSection>
  );

  const upcomingSection = (
    <NativeSection
      caption={role === 'client' ? 'Visible milestones for your properties' : undefined}
      title="Coming up"
    >
      {upcoming.length ? (
        <NativeCard>
          {upcoming.map((item, index) => (
            <Fragment key={item.id}>
              <NativeListRow
                accessibilityHint="Opens the scheduled item"
                detail={item.timeLabel}
                onPress={onPressScheduleItem ? () => onPressScheduleItem(item) : undefined}
                showChevron={Boolean(onPressScheduleItem)}
                subtitle={item.subtitle}
                title={item.title}
              />
              {index < upcoming.length - 1 ? <NativeSeparator inset={60} /> : null}
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <NativeCard>
          <NativeEmptyState
            compact
            message="Scheduled shoots, reviews, and reminders will appear here."
            symbol="calendar"
            title="No upcoming items"
          />
        </NativeCard>
      )}
    </NativeSection>
  );

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel="Loading your overview"
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      <NativeScreenIntro
        eyebrow={copy.eyebrow}
        summary={copy.summary}
        title={`Welcome back, ${firstName}`}
        titleStyle={editorialTitleStyle}
      />

      {role !== 'admin' && metrics.length ? (
        <View accessibilityLabel="Key metrics" style={styles.metrics}>
          {metrics.map((metric) => (
            <MetricTile
              detail={metric.detail}
              key={metric.id}
              label={metric.label}
              symbol={metric.symbol}
              symbolColor={metric.symbolColor}
              style={isWide && styles.wideMetric}
              variant="default"
              value={metric.value}
            />
          ))}
        </View>
      ) : null}

      {isWide ? (
        <View style={styles.wideDashboard}>
          <View style={styles.wideColumn}>{upcomingSection}</View>
          <View style={styles.wideColumn}>{prioritySection}</View>
        </View>
      ) : (
        <>
          {upcomingSection}
          {prioritySection}
        </>
      )}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priorityStack: {
    gap: 10,
  },
  wideColumn: {
    flex: 1,
    minWidth: 0,
  },
  wideMetric: {
    flexBasis: '30%',
  },
  wideDashboard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 20,
  },
  taskBadge: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    minHeight: 26,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  taskBadgeDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  taskBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
