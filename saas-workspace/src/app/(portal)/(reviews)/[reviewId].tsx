import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import {
  Alert,
  Linking,
} from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import {
  NativeEmptyState,
  NativeScreen,
} from '@/components/native';
import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useNativeReviewActions } from '@/hooks/use-native-review-actions';
import { useApp } from '@/providers/app-provider';
import { ReviewDetailNativeScreen } from '@/screens/native';

export default function ReviewDetailRoute() {
  const toolbarIcon = useToolbarIcons();
  const params = useLocalSearchParams<{ reviewId: string | string[] }>();
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  const actions = useNativeReviewActions({ identity, isPreview });
  const reviewId = Array.isArray(params.reviewId)
    ? params.reviewId[0]
    : params.reviewId;
  const summary = live.bundle.reviews.reviews.find(
    (item) => item.id === reviewId,
  );
  const review = live.data?.reviews?.find((item) => item.id === reviewId);

  if (!identity) {
    return null;
  }

  if (!summary) {
    return (
      <>
        <NativeScreen
          errorMessage={live.errorMessage}
          loading={live.loading}
          loadingLabel="Loading review"
          onRefresh={() => void live.retry()}
          onRetry={() => void live.retry()}
          refreshing={live.refreshing}
        >
          <NativeEmptyState
            message="This review is no longer available to your account."
            symbol="checkmark.bubble"
            title="Review unavailable"
          />
        </NativeScreen>
        <Stack.Title>Review</Stack.Title>
      </>
    );
  }

  const decide = (
    decision: 'approved' | 'changes_requested',
  ) => {
    const approving = decision === 'approved';
    Alert.alert(
      approving ? 'Approve this version?' : 'Request changes?',
      approving
        ? 'Realty Media will treat this delivery as approved.'
        : 'The production team will see that another revision is required.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void actions
              .decide(summary.id, decision)
              .then(() => {
                Alert.alert(
                  approving ? 'Version approved' : 'Changes requested',
                  approving
                    ? 'The approval is now visible across the shared workspace.'
                    : 'The production team can now act on your feedback.',
                );
              })
              .catch((caught) => {
                Alert.alert(
                  'Couldn’t update the review',
                  caught instanceof Error
                    ? caught.message
                    : 'Please try again.',
                );
              });
          },
          text: approving ? 'Approve' : 'Request Changes',
        },
      ],
    );
  };

  return (
    <>
      <ReviewDetailNativeScreen
        errorMessage={live.errorMessage}
        loading={live.loading}
        onRefresh={() => void live.retry()}
        onRetry={() => void live.retry()}
        refreshing={live.refreshing}
        review={review}
        summary={summary}
        locale={identity.locale}
      />
      <Stack.Title>{summary.title}</Stack.Title>
      {!isPreview || review?.fileUrl ? (
        <Stack.Toolbar placement="bottom">
          {!isPreview ? (
            <Stack.Toolbar.Button
              disabled={actions.busy}
              icon={toolbarIcon('text.bubble')}
              onPress={() =>
                router.push({
                  pathname: '/(portal)/(reviews)/comment/[reviewId]',
                  params: { reviewId: summary.id },
                })
              }
            >
              Comment
            </Stack.Toolbar.Button>
          ) : null}
          {review?.fileUrl ? (
            <Stack.Toolbar.Button
              accessibilityLabel="Open deliverable"
              icon={toolbarIcon(summary.kind === 'video' ? 'play.rectangle' : 'doc')}
              onPress={() => void Linking.openURL(review.fileUrl!)}
            >Open</Stack.Toolbar.Button>
          ) : null}
          <Stack.Toolbar.Spacer />
          {!isPreview &&
          (identity.role === 'admin' || identity.role === 'client') ? (
            <Stack.Toolbar.Menu
              disabled={actions.busy}
              icon={toolbarIcon('checkmark.circle')}
              separateBackground
            >
              <Stack.Toolbar.Label>Review decision</Stack.Toolbar.Label>
              <Stack.Toolbar.MenuAction
                disabled={summary.status === 'approved'}
                icon={toolbarIcon('checkmark.circle')}
                onPress={() => decide('approved')}
              >
                Approve Version
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                disabled={summary.status === 'changes_requested'}
                icon={toolbarIcon('arrow.uturn.backward.circle')}
                onPress={() => decide('changes_requested')}
              >
                Request Changes
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          ) : null}
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
