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
  StatusPill,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import type { ReviewItem } from '@/screens/web/types';
import { nativeText, type NativeLocale } from '@/lib/native-i18n';

import type { ReviewSummary } from './reviews-screen';

export interface ReviewDetailNativeScreenProps extends NativeAsyncScreenProps {
  review?: ReviewItem;
  summary: ReviewSummary;
  locale?: NativeLocale;
}

function statusPresentation(locale: NativeLocale): Record<ReviewSummary['status'], { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'critical' }> {
  return {
    approved: { label: nativeText(locale, 'statusApproved'), tone: 'success' },
    awaiting_review: { label: nativeText(locale, 'statusAwaitingReview'), tone: 'warning' },
    changes_requested: { label: nativeText(locale, 'statusChangesRequested'), tone: 'critical' },
    draft: { label: nativeText(locale, 'statusDraft'), tone: 'neutral' },
    in_progress: { label: nativeText(locale, 'statusInProgress'), tone: 'info' },
  };
}

export function ReviewDetailNativeScreen({
  review,
  summary,
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  locale = 'en',
}: ReviewDetailNativeScreenProps) {
  const status = statusPresentation(locale)[summary.status];
  const comments = review?.comments ?? [];

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={locale === 'ro' ? 'Se încarcă recenzia' : 'Loading review'}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
    >
      <NativeCard style={styles.previewCard}>
        {review?.thumbnailUrl ? (
          <View>
            <Image
              accessibilityLabel={`${summary.title} preview`}
              accessible
              contentFit="cover"
              source={review.thumbnailUrl}
              style={styles.preview}
            />
            <View
              accessibilityElementsHidden
              style={styles.previewSymbol}
            >
              <NativeSymbol
                color={nativeColors.label}
                name={
                  summary.kind === 'video'
                    ? 'play.fill'
                    : summary.kind === 'script'
                      ? 'doc.text.fill'
                      : 'doc.fill'
                }
                size={28}
              />
            </View>
          </View>
        ) : (
          <View style={styles.previewPlaceholder}>
            <NativeSymbol
              color={nativeColors.secondaryLabel}
              name={
                summary.kind === 'video'
                  ? 'play.rectangle'
                  : summary.kind === 'script'
                    ? 'doc.text'
                    : 'doc'
              }
              size={42}
            />
          </View>
        )}
        <View style={styles.previewMeta}>
          <View style={styles.previewCopy}>
            <Text selectable style={styles.propertyName}>
              {summary.propertyName}
            </Text>
            <Text selectable style={styles.version}>
              {review?.version ?? summary.updatedLabel ?? 'Current version'}
            </Text>
          </View>
          <StatusPill
            label={summary.statusLabel ?? status.label}
            tone={summary.statusTone ?? status.tone}
          />
        </View>
      </NativeCard>

      <NativeSection title={nativeText(locale, 'reviewContext')}>
        <NativeCard>
          <NativeListRow
            detail={summary.submittedBy}
            showChevron={false}
            symbol="person"
            title={nativeText(locale, 'submittedBy')}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={summary.dueLabel ?? review?.dueLabel ?? 'No deadline'}
            showChevron={false}
            symbol="calendar"
            title={nativeText(locale, 'reviewWindow')}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={[
              summary.durationLabel,
              `${summary.timecodedCommentCount ?? 0} timecoded`,
              `${summary.commentCount ?? comments.length} comments`,
            ]
              .filter(Boolean)
              .join(' · ')}
            showChevron={false}
            symbol="text.bubble"
            title={nativeText(locale, 'conversation')}
          />
        </NativeCard>
      </NativeSection>

      <NativeSection
        caption={`${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`}
        title={nativeText(locale, 'feedback')}
      >
        {comments.length ? (
          <NativeCard>
            {comments.map((comment, index) => (
              <Fragment key={comment.id}>
                {index ? <NativeSeparator inset={16} /> : null}
                <View style={styles.comment}>
                  <View style={styles.commentHeader}>
                    <Text selectable style={styles.commentAuthor}>
                      {comment.author}
                    </Text>
                    <Text selectable style={styles.commentTime}>
                      {comment.timestamp}
                    </Text>
                  </View>
                  <Text selectable style={styles.commentBody}>
                    {comment.body}
                  </Text>
                </View>
              </Fragment>
            ))}
          </NativeCard>
        ) : (
          <NativeCard>
            <NativeEmptyState
              compact
              message={nativeText(locale, 'feedbackMessage')}
              symbol="text.bubble"
              title={nativeText(locale, 'noFeedback')}
            />
          </NativeCard>
        )}
      </NativeSection>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    overflow: 'hidden',
  },
  preview: {
    backgroundColor: nativeColors.fill,
    height: 220,
    width: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    height: 190,
    justifyContent: 'center',
  },
  previewSymbol: {
    alignItems: 'center',
    backgroundColor: nativeColors.strongerFill,
    borderCurve: 'continuous',
    borderRadius: 32,
    height: 56,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -28,
    marginTop: -28,
    position: 'absolute',
    top: '50%',
    width: 56,
  },
  previewMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  propertyName: {
    color: nativeColors.label,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  version: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    lineHeight: 18,
  },
  comment: {
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  commentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  commentAuthor: {
    color: nativeColors.label,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  commentTime: {
    color: nativeColors.accent,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  commentBody: {
    color: nativeColors.secondaryLabel,
    fontSize: 15,
    lineHeight: 21,
  },
});
