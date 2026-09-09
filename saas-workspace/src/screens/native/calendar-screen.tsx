import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeScreenIntro,
  NativeSection,
  NativeSeparator,
  StatusPill,
  Text,
  nativeColors,
  type AppRole,
  type NativeAsyncScreenProps,
  type NativeEditorialStyleProps,
  type NativeStatusTone,
  useNativeWideLayout,
} from '@/components/native';

import { calendarColor, type CalendarColor } from '@/lib/calendar-colors';

export type CalendarEventKind =
  | 'shoot'
  | 'review'
  | 'deadline'
  | 'reminder'
  | 'meeting'
  | 'payment';

export interface CalendarEventSummary {
  color?: CalendarColor | null;
  id: string;
  dateKey: string;
  dateLabel: string;
  endDateKey?: string;
  endDateLabel?: string;
  weekdayLabel?: string;
  title: string;
  startTimeLabel: string;
  endTimeLabel?: string;
  propertyName?: string;
  location?: string;
  kind: CalendarEventKind;
  statusLabel?: string;
  statusTone?: NativeStatusTone;
}

export interface CalendarNativeScreenProps
  extends NativeAsyncScreenProps,
    NativeEditorialStyleProps {
  role: AppRole;
  events?: readonly CalendarEventSummary[];
  onPressEvent?: (event: CalendarEventSummary) => void;
}

const roleCopy: Record<AppRole, { eyebrow: string; title: string; summary: string; empty: string }> = {
  admin: {
    eyebrow: 'Agency calendar',
    title: 'The next moving pieces',
    summary: 'Shoots, client reviews, internal reminders, and deadlines across Realty Media.',
    empty: 'There are no scheduled production milestones yet.',
  },
  team_member: {
    eyebrow: 'Your schedule',
    title: 'Know where to be next',
    summary: 'Only assigned shoots, feedback deadlines, and team reminders are shown.',
    empty: 'You have no assigned events in this period.',
  },
  client: {
    eyebrow: 'Property timeline',
    title: 'What is happening next',
    summary: 'Upcoming shoots, review windows, and visible milestones for your properties.',
    empty: 'There are no upcoming property events yet.',
  },
};

function groupEvents(events: readonly CalendarEventSummary[]) {
  const groups: { key: string; dateLabel: string; weekdayLabel?: string; events: CalendarEventSummary[] }[] = [];

  for (const event of events) {
    const existing = groups.find((group) => group.key === event.dateKey);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.push({
        key: event.dateKey,
        dateLabel: event.dateLabel,
        weekdayLabel: event.weekdayLabel,
        events: [event],
      });
    }
  }

  return groups;
}

export function CalendarNativeScreen({
  role,
  events = [],
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  editorialTitleStyle,
  onPressEvent,
}: CalendarNativeScreenProps) {
  const copy = roleCopy[role];
  const groups = groupEvents(events);
  const isWide = useNativeWideLayout();

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel="Loading calendar"
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      <NativeScreenIntro
        eyebrow={copy.eyebrow}
        summary={copy.summary}
        title={copy.title}
        titleStyle={editorialTitleStyle}
      />

      <NativeSection
        caption={`${events.length} upcoming ${events.length === 1 ? 'item' : 'items'}`}
        title="Upcoming"
      >
        {groups.length ? (
          <View style={[styles.groups, isWide && styles.wideGroups]}>
            {groups.map((group) => (
              <View key={group.key} style={[styles.day, isWide && styles.wideDay]}>
                <View style={styles.dayHeader}>
                  <Text selectable style={styles.dayDate}>
                    {group.dateLabel}
                  </Text>
                  {group.weekdayLabel ? (
                    <Text selectable style={styles.dayWeekday}>
                      {group.weekdayLabel}
                    </Text>
                  ) : null}
                </View>

                <NativeCard>
                  {group.events.map((event, index) => (
                    <Fragment key={event.id}>
                      <NativeListRow
                        accessibilityHint="Opens this calendar item"
                        symbol="circle.fill"
                        symbolColor={calendarColor(event.color, event.kind).color}
                        detail={[
                          event.statusLabel
                            ? [event.startTimeLabel, event.endTimeLabel].filter(Boolean).join('–')
                            : null,
                          event.location,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        onPress={onPressEvent ? () => onPressEvent(event) : undefined}
                        showChevron={Boolean(onPressEvent)}
                        subtitle={event.propertyName}
                        title={event.title}
                        trailing={
                          event.statusLabel ? (
                            <StatusPill
                              label={event.statusLabel}
                              tone={event.statusTone}
                            />
                          ) : (
                            <Text selectable style={styles.time}>
                              {[event.startTimeLabel, event.endTimeLabel].filter(Boolean).join('–')}
                            </Text>
                          )
                        }
                      />
                      {index < group.events.length - 1 ? <NativeSeparator inset={60} /> : null}
                    </Fragment>
                  ))}
                </NativeCard>
              </View>
            ))}
          </View>
        ) : (
          <NativeCard>
            <NativeEmptyState
              compact
              message={copy.empty}
              symbol="calendar"
              title="Nothing scheduled"
            />
          </NativeCard>
        )}
      </NativeSection>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  groups: {
    gap: 18,
  },
  wideGroups: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  day: {
    gap: 7,
  },
  wideDay: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 320,
  },
  dayHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 2,
  },
  dayDate: {
    color: nativeColors.label,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  dayWeekday: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    lineHeight: 17,
  },
  time: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    lineHeight: 17,
  },
});
