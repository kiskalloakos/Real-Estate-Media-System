import { Image } from 'expo-image';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  NativeSymbol,
  NativeTaskCard,
  StatusPill,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import { nativeStatusLabel, nativeText, type NativeLocale } from '@/lib/native-i18n';
import { taskBoardStatus } from '@/lib/task-presentation';
import type {
  PropertySummary as PortalPropertySummary,
  TaskSummary,
} from '@/screens/web/types';

import type { CalendarEventSummary } from './calendar-screen';
import type { PropertySummary } from './properties-screen';
import type { ReviewSummary } from './reviews-screen';

export interface PropertyDetailNativeScreenProps
  extends NativeAsyncScreenProps {
  events?: readonly CalendarEventSummary[];
  onPressEvent?: (eventId: string) => void;
  onPressReview?: (reviewId: string) => void;
  portalProperty?: PortalPropertySummary;
  property: PropertySummary;
  reviews?: readonly ReviewSummary[];
  tasks?: readonly TaskSummary[];
  locale?: NativeLocale;
}

function statusLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reviewTone(status: ReviewSummary['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'changes_requested') return 'critical' as const;
  if (status === 'awaiting_review') return 'warning' as const;
  if (status === 'in_progress') return 'info' as const;
  return 'neutral' as const;
}

export function PropertyDetailNativeScreen({
  events = [],
  portalProperty,
  property,
  reviews = [],
  tasks = [],
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  onPressEvent,
  onPressReview,
  locale = 'en',
}: PropertyDetailNativeScreenProps) {
  const openTasks = tasks.filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled',
  );
  const activeReviews = reviews.filter((review) => review.status !== 'approved');

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel="Loading property"
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
    >
      <NativeCard style={styles.coverCard}>
        {property.coverImageUrl ? (
          <Image
            accessibilityLabel={`${property.name} cover image`}
            accessible
            contentFit="cover"
            source={property.coverImageUrl}
            style={styles.cover}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <NativeSymbol
              color={nativeColors.secondaryLabel}
              name="building.2"
              size={42}
            />
          </View>
        )}
        <View style={styles.coverMeta}>
          <View style={styles.coverCopy}>
            <Text selectable style={styles.coverEyebrow}>
              {property.clientName || 'Realty Media property'}
            </Text>
            <Text selectable style={styles.coverDetail}>
              {property.location || 'Location not added'}
            </Text>
          </View>
          <StatusPill
            label={property.statusLabel}
            tone={property.statusTone}
          />
        </View>
      </NativeCard>

      <NativeSection title={nativeText(locale, 'productionOverview')}>
        <NativeCard>
          <NativeListRow
            detail={portalProperty?.description}
            showChevron={false}
            symbol="flag"
            title={nativeText(locale, 'nextMilestone')}
            trailing={
              <Text selectable style={styles.trailingValue}>
                {property.nextMilestone || 'Not scheduled'}
              </Text>
            }
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={
              property.assignedTeamNames?.length
                ? property.assignedTeamNames.join(', ')
                : nativeText(locale, 'noTeamMember')
            }
            showChevron={false}
            symbol="person.2"
            title={nativeText(locale, 'assignedTeam')}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={`${activeReviews.length || property.awaitingReviewCount || 0} ${nativeText(locale, 'reviewItems')}`}
            showChevron={false}
            symbol="checkmark.bubble"
            title={nativeText(locale, 'openWork')}
            trailing={
              <Text selectable style={styles.countValue}>
                {openTasks.length || property.openTaskCount || 0}
                {` ${nativeText(locale, 'tasksWord')}`}
              </Text>
            }
          />
          {portalProperty ? (
            <>
              <NativeSeparator inset={60} />
              <NativeListRow
                detail={portalProperty.nextMilestone}
                showChevron={false}
                symbol="chart.bar.fill"
                title={nativeText(locale, 'productionCompletion')}
                trailing={
                  <Text selectable style={styles.countValue}>
                    {portalProperty.completion}%
                  </Text>
                }
              />
            </>
          ) : null}
        </NativeCard>
      </NativeSection>

      <NativeSection title={nativeText(locale, 'socialPerformance')}>
        <NativeCard>
          {portalProperty ? (
            <View style={styles.metricGrid}>
              {[
                ['Views', portalProperty.analytics.views],
                ['Followers', portalProperty.analytics.followers],
                ['Engagement', portalProperty.analytics.engagement],
              ].map(([label, value]) => (
                <View key={label} style={styles.metric}>
                  <Text selectable style={styles.metricValue}>
                    {value}
                  </Text>
                  <Text selectable style={styles.metricLabel}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <NativeListRow
              detail="Visible social performance"
              showChevron={false}
              symbol="chart.line.uptrend.xyaxis"
              title={property.socialSummary || (locale === 'ro' ? 'Analiza nu este conectată' : 'Analytics connection pending')}
            />
          )}
        </NativeCard>
      </NativeSection>

      {openTasks.length ? (
        <NativeSection title={nativeText(locale, 'openTasks')}>
          <View style={styles.taskStack}>
            {openTasks.map((task) => (
              <NativeTaskCard
                key={task.id}
                meta={task.assigneeName}
                propertyName={task.dueAt ? new Date(task.dueAt).toLocaleString('en-GB') : 'No deadline'}
                status={taskBoardStatus(task.status)}
                title={task.title}
                urgent={task.priority === 'urgent'}
              />
            ))}
          </View>
        </NativeSection>
      ) : null}

      {reviews.length ? (
        <NativeSection title={nativeText(locale, 'reviews')}>
          <NativeCard>
            {reviews.map((review, index) => (
              <Fragment key={review.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  accessibilityHint="Opens this review"
                  detail={`${review.commentCount ?? 0} comments · ${review.updatedLabel ?? 'Current version'}`}
                  onPress={
                    onPressReview
                      ? () => onPressReview(review.id)
                      : undefined
                  }
                  subtitle={review.dueLabel}
                  symbol="play.rectangle"
                  title={review.title}
                  trailing={
                    <StatusPill
                      label={nativeStatusLabel(locale, statusLabel(review.status))}
                      tone={reviewTone(review.status)}
                    />
                  }
                />
              </Fragment>
            ))}
          </NativeCard>
        </NativeSection>
      ) : null}

      {events.length ? (
        <NativeSection title={nativeText(locale, 'schedule')}>
          <NativeCard>
            {events.map((event, index) => (
              <Fragment key={event.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  accessibilityHint="Opens this calendar item"
                  detail={`${event.dateLabel} · ${event.startTimeLabel}`}
                  onPress={
                    onPressEvent ? () => onPressEvent(event.id) : undefined
                  }
                  subtitle={event.location}
                  title={event.title}
                />
              </Fragment>
            ))}
          </NativeCard>
        </NativeSection>
      ) : null}

      {!openTasks.length && !reviews.length && !events.length ? (
        <NativeCard>
          <NativeEmptyState
            compact
            message="Tasks, review files, and scheduled events will collect here."
            symbol="square.stack.3d.up"
            title="Workspace is clear"
          />
        </NativeCard>
      ) : null}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  coverCard: {
    overflow: 'hidden',
  },
  cover: {
    backgroundColor: nativeColors.fill,
    height: 210,
    width: '100%',
  },
  coverPlaceholder: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    height: 210,
    justifyContent: 'center',
  },
  coverMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  coverCopy: {
    flex: 1,
    gap: 2,
  },
  coverEyebrow: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  coverDetail: {
    color: nativeColors.secondaryLabel,
    fontSize: 14,
    lineHeight: 19,
  },
  trailingValue: {
    color: nativeColors.secondaryLabel,
    flexShrink: 1,
    fontSize: 13,
    maxWidth: 145,
    textAlign: 'right',
  },
  countValue: {
    color: nativeColors.label,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  taskStack: {
    gap: 10,
  },
  metricGrid: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 18,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  metricValue: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 21,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  metricLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 12,
  },
});
