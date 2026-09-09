import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  addReviewComment,
  recordReviewDecision,
} from '@/lib/portal-action-service';
import type { AppIdentity } from '@/providers/app-provider';

type ReviewAction =
  | {
      body: string;
      kind: 'comment';
      reviewId: string;
      timestamp: string;
    }
  | {
      decision: 'approved' | 'changes_requested';
      kind: 'decision';
      reviewId: string;
    };

export function useNativeReviewActions({
  identity,
  isPreview,
}: {
  identity: AppIdentity | null;
  isPreview: boolean;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (action: ReviewAction) => {
      if (isPreview) {
        throw new Error('Preview mode is read-only. Sign in to save feedback.');
      }
      if (!identity?.agencyId) {
        throw new Error('Your Realty Media workspace is not ready yet.');
      }

      const context = {
        agencyId: identity.agencyId,
        userId: identity.userId,
      };

      if (action.kind === 'comment') {
        await addReviewComment(
          action.reviewId,
          action.body,
          action.timestamp,
          context,
        );
      } else {
        await recordReviewDecision(
          action.reviewId,
          action.decision,
          context,
        );
      }
    },
    onSuccess: async () => {
      if (!identity) return;
      await queryClient.invalidateQueries({
        queryKey: ['portal-data', identity.agencyId],
      });
    },
  });

  return {
    addComment: (
      reviewId: string,
      body: string,
      timestamp: string,
    ) =>
      mutation.mutateAsync({
        body,
        kind: 'comment',
        reviewId,
        timestamp,
      }),
    busy: mutation.isPending,
    decide: (
      reviewId: string,
      decision: 'approved' | 'changes_requested',
    ) =>
      mutation.mutateAsync({
        decision,
        kind: 'decision',
        reviewId,
      }),
    errorMessage:
      mutation.error instanceof Error ? mutation.error.message : null,
    reset: mutation.reset,
  };
}
