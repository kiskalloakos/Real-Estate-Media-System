import { StyleSheet, View } from 'react-native';

import {
  NativeCard,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  StatusPill,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import { calendarColor } from '@/lib/calendar-colors';
import type { CalendarEvent } from '@/screens/web/types';
import { nativeText, type NativeLocale } from '@/lib/native-i18n';

import type { CalendarEventSummary } from './calendar-screen';

export interface CalendarEventDetailNativeScreenProps
  extends NativeAsyncScreenProps {
  event?: CalendarEvent;
  onPressProperty?: (propertyId: string) => void;
  summary: CalendarEventSummary;
  locale?: NativeLocale;
}

const eventLabels: Record<CalendarEventSummary['kind'], string> = {
  deadline: 'Deadline',
  meeting: 'Meeting',
  payment: 'Payment',
  reminder: 'Reminder',
  review: 'Review',
  shoot: 'Production shoot',
};

function eventLabel(kind: CalendarEventSummary['kind'], locale: NativeLocale) {
  return kind === 'shoot' ? nativeText(locale, 'productionShoot') : eventLabels[kind];
}

function visibilityLabel(value: CalendarEvent['visibility'] | undefined, locale: NativeLocale) {
  if (value === 'admin_only') return nativeText(locale, 'ownersOnly');
  if (value === 'team') return nativeText(locale, 'realtyTeam');
  if (value === 'client') return nativeText(locale, 'clientVisible');
  return nativeText(locale, 'workspaceEvent');
}

export function CalendarEventDetailNativeScreen({
  event,
  summary,
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  onPressProperty,
  locale = 'en',
}: CalendarEventDetailNativeScreenProps) {
  const color = calendarColor(event?.color ?? summary.color, event?.type ?? summary.kind);
  const times = [summary.startTimeLabel, summary.endTimeLabel]
    .filter(Boolean)
    .join('–');
  const dates = [summary.dateLabel, summary.endDateLabel]
    .filter((value, index, values) => value && (index === 0 || value !== values[0]))
    .join(' – ');

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={locale === 'ro' ? 'Se încarcă evenimentul' : 'Loading calendar event'}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
    >
      <NativeCard style={[styles.dateCard, { borderLeftWidth: 4, borderLeftColor: color.color }]}>
        <View style={styles.dateCopy}>
          <Text selectable style={styles.dateLabel}>
            {dates}
          </Text>
          <Text selectable style={styles.weekday}>
            {[summary.weekdayLabel, times].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <StatusPill
          label={summary.statusLabel ?? eventLabel(summary.kind, locale)}
          tone={
            summary.statusTone ??
            (summary.kind === 'shoot' ? 'info' : 'neutral')
          }
        />
      </NativeCard>

      <NativeSection title={nativeText(locale, 'eventDetails')}>
        <NativeCard>
          <NativeListRow title={locale === 'ro' ? 'Culoare' : 'Event color'} detail={color.label} symbol="circle.fill" symbolColor={color.color} showChevron={false} />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={times}
            showChevron={false}
            title={nativeText(locale, 'time')}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={summary.location ?? event?.location ?? nativeText(locale, 'noLocation')}
            showChevron={false}
            title={nativeText(locale, 'location')}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            accessibilityHint={
              event?.propertyId ? 'Opens the related property' : undefined
            }
            detail={summary.propertyName ?? 'Realty Media'}
            onPress={
              event?.propertyId && onPressProperty
                ? () => onPressProperty(event.propertyId!)
                : undefined
            }
            showChevron={Boolean(event?.propertyId && onPressProperty)}
            title={nativeText(locale, 'property')}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={event?.assignee ?? 'Realty Media'}
            showChevron={false}
            title={nativeText(locale, 'coordinator')}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={visibilityLabel(event?.visibility, locale)}
            showChevron={false}
            title={nativeText(locale, 'visibility')}
          />
        </NativeCard>
      </NativeSection>

      {event?.description ? (
        <NativeSection title={nativeText(locale, 'notes')}>
          <NativeCard style={styles.notesCard}>
            <Text selectable style={styles.notes}>
              {event.description}
            </Text>
          </NativeCard>
        </NativeSection>
      ) : null}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  dateCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  dateCopy: {
    flex: 1,
    gap: 2,
  },
  dateLabel: {
    color: nativeColors.label,
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 24,
  },
  weekday: {
    color: nativeColors.secondaryLabel,
    fontSize: 14,
    lineHeight: 19,
  },
  notesCard: {
    padding: 17,
  },
  notes: {
    color: nativeColors.secondaryLabel,
    fontSize: 16,
    lineHeight: 23,
  },
});
