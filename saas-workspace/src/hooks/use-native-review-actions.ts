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
      versionId?: string;
    }
  | {
      decision: 'approved' | 'changes_requested';
      kind: 'decision';
      reviewId: string;
      versionId?: string;
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
      if (!action.versionId) throw new Error('Reopen this review to load its file version before saving feedback.');

      if (action.kind === 'comment') {
        await addReviewComment({ mediaAssetId: action.reviewId, versionId: action.versionId, body: action.body, timestamp: action.timestamp, visibility: 'client' }, context);
      } else {
        await recordReviewDecision({ targets: [{ assetId: action.reviewId, versionId: action.versionId }], decision: action.decision }, context);
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
      versionId?: string,
    ) =>
      mutation.mutateAsync({
        body,
        kind: 'comment',
        reviewId,
        timestamp,
        versionId,
      }),
    busy: mutation.isPending,
    decide: (
      reviewId: string,
      decision: 'approved' | 'changes_requested',
      versionId?: string,
    ) =>
      mutation.mutateAsync({
        decision,
        kind: 'decision',
        reviewId,
        versionId,
      }),
    errorMessage:
      mutation.error instanceof Error ? mutation.error.message : null,
    reset: mutation.reset,
  };
}
