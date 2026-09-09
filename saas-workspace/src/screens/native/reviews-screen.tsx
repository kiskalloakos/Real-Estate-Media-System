import { Fragment } from 'react';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSeparator,
  StatusPill,
  nativeColors,
  type AppRole,
  type NativeAsyncScreenProps,
  type NativeEditorialStyleProps,
  type NativeStatusTone,
} from '@/components/native';
import { nativeText, type NativeLocale } from '@/lib/native-i18n';

export type ReviewKind = 'video' | 'script' | 'file';
export type ReviewStatus =
  | 'awaiting_review'
  | 'changes_requested'
  | 'approved'
  | 'in_progress'
  | 'draft';

export interface ReviewSummary {
  id: string;
  title: string;
  propertyName: string;
  kind: ReviewKind;
  status: ReviewStatus;
  statusLabel?: string;
  statusTone?: NativeStatusTone;
  updatedLabel?: string;
  dueLabel?: string;
  durationLabel?: string;
  commentCount?: number;
  timecodedCommentCount?: number;
  submittedBy?: string;
}

export interface ReviewsNativeScreenProps
  extends NativeAsyncScreenProps,
    NativeEditorialStyleProps {
  role: AppRole;
  reviews?: readonly ReviewSummary[];
  onPressReview?: (review: ReviewSummary) => void;
  locale?: NativeLocale;
}

const kindSymbols: Record<ReviewKind, string> = {
  video: 'play.rectangle',
  script: 'doc.text',
  file: 'doc',
};

function statusDefaults(locale: NativeLocale): Record<ReviewStatus, { label: string; tone: NativeStatusTone }> {
  return {
    awaiting_review: { label: nativeText(locale, 'statusAwaitingReview'), tone: 'warning' },
    changes_requested: { label: nativeText(locale, 'statusChangesRequested'), tone: 'critical' },
    approved: { label: nativeText(locale, 'statusApproved'), tone: 'success' },
    in_progress: { label: nativeText(locale, 'statusInProgress'), tone: 'info' },
    draft: { label: nativeText(locale, 'statusDraft'), tone: 'neutral' },
  };
}

function reviewDetail(review: ReviewSummary) {
  const comments =
    review.timecodedCommentCount || review.commentCount
      ? `${review.timecodedCommentCount ?? 0} timecoded · ${review.commentCount ?? 0} comments`
      : null;

  return [review.durationLabel, comments, review.dueLabel, review.updatedLabel]
    .filter(Boolean)
    .join(' · ');
}

function ReviewRows({
  reviews,
  locale = 'en',
  onPressReview,
}: {
  reviews: readonly ReviewSummary[];
  locale?: NativeLocale;
  onPressReview?: (review: ReviewSummary) => void;
}) {
  return (
    <NativeCard>
      {reviews.map((review, index) => {
        const status = statusDefaults(locale)[review.status];

        return (
          <Fragment key={review.id}>
            <NativeListRow
              accessibilityHint="Opens this review"
              detail={reviewDetail(review)}
              onPress={onPressReview ? () => onPressReview(review) : undefined}
              showChevron={Boolean(onPressReview)}
              subtitle={[review.propertyName, review.submittedBy].filter(Boolean).join(' · ')}
              symbol={kindSymbols[review.kind]}
              symbolColor={review.kind === 'video' ? nativeColors.purple : nativeColors.accent}
              title={review.title}
              trailing={
                <StatusPill
                  label={review.statusLabel ?? status.label}
                  tone={review.statusTone ?? status.tone}
                />
              }
            />
            {index < reviews.length - 1 ? <NativeSeparator inset={60} /> : null}
          </Fragment>
        );
      })}
    </NativeCard>
  );
}

export function ReviewsNativeScreen({
  role,
  reviews = [],
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  onPressReview,
  locale = 'en',
}: ReviewsNativeScreenProps) {
  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={locale === 'ro' ? 'Se încarcă recenziile' : 'Loading reviews'}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
    >
      {reviews.length ? (
        <ReviewRows locale={locale} onPressReview={onPressReview} reviews={reviews} />
      ) : (
        <NativeCard>
          <NativeEmptyState
            compact
            message={role === 'client'
              ? nativeText(locale, 'noReviewsClientMessage')
              : nativeText(locale, 'noReviewsMessage')}
            symbol="checkmark.bubble"
            title={nativeText(locale, 'noReviews')}
          />
        </NativeCard>
      )}
    </NativeScreen>
  );
}
