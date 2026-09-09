import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  NativeSymbol,
  StatusPill,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';

import { calendarColor } from '@/lib/calendar-colors';

import type { CalendarEventSummary } from './calendar-screen';

export interface TeamCalendarNativeScreenProps extends NativeAsyncScreenProps {
  events?: readonly CalendarEventSummary[];
  onPressEvent?: (event: CalendarEventSummary) => void;
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function dateKey(value: Date) {
  return `${monthKey(value)}-${String(value.getDate()).padStart(2, '0')}`;
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function dayStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
}

function dayLabel(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(value);
}

function shortDayLabel(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(value);
}

function shiftDay(value: Date, amount: number) {
  const next = dayStart(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function shiftMonth(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function monthDays(value: Date) {
  const start = monthStart(value);
  const leading = (start.getDay() + 6) % 7;
  const first = shiftDay(start, -leading);
  return Array.from({ length: 42 }, (_, index) => shiftDay(first, index));
}

function weekStart(value: Date) {
  const start = dayStart(value);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function weekDays(value: Date) {
  const first = weekStart(value);
  return Array.from({ length: 7 }, (_, index) => shiftDay(first, index));
}

function dateTimeLabel(event: CalendarEventSummary) {
  const times = [event.startTimeLabel, event.endTimeLabel].filter(Boolean).join('–');
  if (event.endDateKey && event.endDateKey !== event.dateKey) {
    return [event.dateLabel, event.endDateLabel, times].filter(Boolean).join(' · ');
  }
  return times;
}

function eventDateKeys(event: CalendarEventSummary) {
  const start = parseDateKey(event.dateKey);
  const end = parseDateKey(event.endDateKey ?? event.dateKey);
  const keys: string[] = [];
  const cursor = dayStart(start);
  const endDay = dayStart(end);

  while (cursor <= endDay) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function TeamCalendarNativeScreen({
  events = [],
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  onPressEvent,
}: TeamCalendarNativeScreenProps) {
  const initialDate = events[0]?.dateKey ? parseDateKey(events[0].dateKey) : new Date();
  const [anchorDate, setAnchorDate] = useState(() => dayStart(initialDate));
  const [selectedDateKey, setSelectedDateKey] = useState(() => (
    events[0]?.dateKey ?? dateKey(dayStart(new Date()))
  ));
  const [view, setView] = useState<'month' | 'week'>('month');
  const [kindFilter, setKindFilter] = useState<'all' | CalendarEventSummary['kind']>('all');
  const visibleEvents = events.filter((event) => kindFilter === 'all' || event.kind === kindFilter);
  const eventsByDate = new Map<string, CalendarEventSummary[]>();
  visibleEvents.forEach((event) => {
    eventDateKeys(event).forEach((key) => {
      const current = eventsByDate.get(key) ?? [];
      current.push(event);
      eventsByDate.set(key, current);
    });
  });
  const days = monthDays(anchorDate);
  const week = weekDays(anchorDate);
  const selectedDate = parseDateKey(selectedDateKey);
  const selectedEvents = eventsByDate.get(selectedDateKey) ?? [];
  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(anchorDate);
  const weekLabel = `${shortDayLabel(week[0])} – ${shortDayLabel(week[6])}`;
  const todayKey = dateKey(dayStart(new Date()));

  const selectDate = (value: Date) => {
    const next = dayStart(value);
    setAnchorDate(next);
    setSelectedDateKey(dateKey(next));
  };

  const moveCalendar = (direction: number) => {
    const next = view === 'month'
      ? shiftMonth(anchorDate, direction)
      : shiftDay(anchorDate, direction * 7);
    setAnchorDate(next);
    setSelectedDateKey(dateKey(view === 'month' ? next : weekStart(next)));
  };

  const goToToday = () => selectDate(new Date());

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
      <NativeCard style={styles.calendarCard}>
        <View style={styles.calendarToolbar}>
          <Pressable
            accessibilityLabel={view === 'month' ? 'Previous month' : 'Previous week'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => moveCalendar(-1)}
            style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
          >
            <NativeSymbol color={nativeColors.label} name="chevron.left" size={18} />
          </Pressable>
          <View style={styles.titleGroup}>
            <Text selectable style={styles.monthTitle}>{view === 'month' ? monthLabel : weekLabel}</Text>
            <Text style={styles.viewLabel}>{view === 'month' ? 'Month view' : 'Week view'}</Text>
          </View>
          <Pressable
            accessibilityLabel={view === 'month' ? 'Next month' : 'Next week'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => moveCalendar(1)}
            style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
          >
            <NativeSymbol color={nativeColors.label} name="chevron.right" size={18} />
          </Pressable>
        </View>
        <View style={styles.toolbarActions}>
          <Pressable
            accessibilityLabel="Go to today"
            accessibilityRole="button"
            onPress={goToToday}
            style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
          >
            <Text style={styles.todayLabel}>Today</Text>
          </Pressable>
          <View accessibilityLabel="Calendar view" style={styles.viewToggle}>
            {(['month', 'week'] as const).map((option) => (
              <Pressable
                accessibilityLabel={`${option === 'month' ? 'Month' : 'Week'} view`}
                accessibilityRole="button"
                accessibilityState={{ selected: view === option }}
                key={option}
                onPress={() => setView(option)}
                style={[styles.viewOption, view === option && styles.viewOptionSelected]}
              >
                <Text style={[styles.viewOptionLabel, view === option && styles.viewOptionLabelSelected]}>
                  {option === 'month' ? 'Month' : 'Week'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View accessibilityLabel="Calendar filters" style={styles.filterRow}>
          {([
            ['all', 'All'],
            ['shoot', 'Shoots'],
            ['review', 'Reviews'],
            ['meeting', 'Other'],
          ] as const).map(([value, label]) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: kindFilter === value }}
              key={value}
              onPress={() => setKindFilter(value)}
              style={[styles.filter, kindFilter === value && styles.filterSelected]}
            >
              <Text style={[styles.filterLabel, kindFilter === value && styles.filterLabelSelected]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {view === 'month' ? (
          <>
            <View style={styles.weekRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {days.map((day) => {
                const key = dateKey(day);
                const dayEvents = eventsByDate.get(key) ?? [];
                const isSelected = key === selectedDateKey;
                const isToday = key === todayKey;
                const isOutsideMonth = day.getMonth() !== anchorDate.getMonth();
                return (
                  <View key={key} style={[styles.dayCell, isOutsideMonth && styles.dayCellOutside]}>
                    <Pressable
                      accessibilityLabel={dayLabel(day)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => selectDate(day)}
                      style={[
                        styles.dayButton,
                        isToday && styles.dayButtonToday,
                        isSelected && styles.dayButtonSelected,
                      ]}
                    >
                      <Text style={[
                        styles.dayNumber,
                        isOutsideMonth && styles.dayNumberOutside,
                        isSelected && styles.dayNumberSelected,
                      ]}
                      >
                        {day.getDate()}
                      </Text>
                    </Pressable>
                    <View style={styles.dayEvents}>
                      {dayEvents.slice(0, 2).map((event) => {
                        const visual = calendarColor(event.color, event.kind);
                        return (
                          <Pressable
                            accessibilityLabel={`Open ${event.title}, ${visual.label}`}
                            key={event.id}
                            onPress={onPressEvent ? () => onPressEvent(event) : undefined}
                            style={({ pressed }) => [
                              styles.eventPill,
                              { backgroundColor: visual.background },
                              pressed && styles.eventPressed,
                            ]}
                          >
                            <Text numberOfLines={1} style={[styles.eventText, { color: visual.color }]}>
                              {event.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                      {dayEvents.length > 2 ? (
                        <Text style={styles.moreEvents}>+{dayEvents.length - 2} more</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.weekStrip}>
            {week.map((day) => {
              const key = dateKey(day);
              const isSelected = key === selectedDateKey;
              const isToday = key === todayKey;
              return (
                <Pressable
                  accessibilityLabel={dayLabel(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={key}
                  onPress={() => selectDate(day)}
                  style={[
                    styles.weekDayButton,
                    isToday && styles.weekDayToday,
                    isSelected && styles.weekDaySelected,
                  ]}
                >
                  <Text style={[styles.weekDayLabel, isSelected && styles.weekDayLabelSelected]}>
                    {new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(day).slice(0, 2)}
                  </Text>
                  <Text style={[styles.weekDayNumber, isSelected && styles.weekDayNumberSelected]}>
                    {day.getDate()}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {(eventsByDate.get(key) ?? []).slice(0, 3).map((event) => (
                      <View key={event.id} style={[styles.eventDot, {
                        backgroundColor: calendarColor(event.color, event.kind).color,
                        borderColor: nativeColors.background, borderWidth: 1, width: 7, height: 7,
                      }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </NativeCard>

      <NativeSection
        caption={`${selectedEvents.length} ${selectedEvents.length === 1 ? 'event' : 'events'}`}
        title={dayLabel(selectedDate)}
      >
      {selectedEvents.length ? (
        <NativeCard>
          {selectedEvents.map((event, index) => (
            <Fragment key={event.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                symbol="circle.fill"
                symbolColor={calendarColor(event.color, event.kind).color}
                detail={[dateTimeLabel(event), event.location].filter(Boolean).join(' · ')}
                onPress={onPressEvent ? () => onPressEvent(event) : undefined}
                showChevron={Boolean(onPressEvent)}
                subtitle={event.propertyName}
                title={event.title}
                trailing={event.statusLabel ? <StatusPill label={event.statusLabel} tone={event.statusTone} /> : null}
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <NativeCard>
          <NativeEmptyState compact message="Select another day or change the filter." symbol="calendar" title="Nothing scheduled" />
        </NativeCard>
      )}
      </NativeSection>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  calendarCard: {
    gap: 14,
    padding: 12,
  },
  calendarToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navigationButton: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  titleGroup: {
    alignItems: 'center',
    gap: 1,
  },
  viewLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 12,
    fontWeight: '500',
  },
  toolbarActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayButton: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  todayLabel: {
    color: nativeColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  viewToggle: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 14,
    flexDirection: 'row',
    padding: 3,
  },
  viewOption: {
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  viewOptionSelected: {
    backgroundColor: nativeColors.background,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  viewOptionLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 12,
    fontWeight: '600',
  },
  viewOptionLabelSelected: {
    color: nativeColors.label,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-start',
  },
  filter: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterSelected: {
    backgroundColor: nativeColors.accent,
  },
  filterLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    fontWeight: '600',
  },
  filterLabelSelected: {
    color: nativeColors.background,
  },
  dayCell: {
    borderColor: nativeColors.separator,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexBasis: '14.2857%',
    minHeight: 78,
    padding: 4,
  },
  dayCellOutside: {
    backgroundColor: '#FAFAFC',
  },
  dayButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 25,
    justifyContent: 'center',
    width: 25,
  },
  dayButtonToday: {
    borderColor: nativeColors.accent,
    borderWidth: 1,
  },
  dayButtonSelected: {
    backgroundColor: nativeColors.accent,
    borderWidth: 0,
  },
  dayNumber: {
    color: nativeColors.label,
    fontSize: 12,
    fontWeight: '600',
  },
  dayNumberOutside: {
    color: nativeColors.tertiaryLabel,
  },
  dayNumberSelected: {
    color: nativeColors.background,
  },
  dayEvents: {
    gap: 3,
    marginTop: 4,
  },
  eventPill: {
    borderCurve: 'continuous',
    borderRadius: 5,
    minHeight: 17,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  eventText: {
    fontSize: 9,
    fontWeight: '600',
  },
  eventPressed: {
    opacity: 0.55,
  },
  moreEvents: {
    color: nativeColors.secondaryLabel,
    fontSize: 9,
    fontWeight: '600',
    paddingHorizontal: 3,
  },
  grid: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: nativeColors.separator,
    borderLeftWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthTitle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 19,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    color: nativeColors.secondaryLabel,
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  weekStrip: {
    borderColor: nativeColors.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  weekDayButton: {
    alignItems: 'center',
    borderRadius: 16,
    gap: 5,
    minHeight: 76,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  weekDayToday: {
    borderColor: nativeColors.accent,
    borderWidth: 1,
  },
  weekDaySelected: {
    backgroundColor: nativeColors.accent,
  },
  weekDayLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  weekDayLabelSelected: {
    color: nativeColors.background,
  },
  weekDayNumber: {
    color: nativeColors.label,
    fontSize: 20,
    fontWeight: '700',
  },
  weekDayNumberSelected: {
    color: nativeColors.background,
  },
  eventDot: {
    backgroundColor: nativeColors.accent,
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  pressed: {
    opacity: 0.55,
  },
});
