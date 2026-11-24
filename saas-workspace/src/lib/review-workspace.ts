import type { ReviewItem, ReviewVersion, ReviewDecisionInput } from '../screens/web/types';

export function reviewVersions(review: ReviewItem): ReviewVersion[] {
  if (review.versions) return [...review.versions].sort((a, b) => b.number - a.number);
  return [{ id: review.currentVersionId ?? `sample:${review.id}:${review.version}`, number: Number(review.version.replace(/\D/g, '')) || 1,
    fileUrl: review.fileUrl, mimeType: review.mimeType, contentHtml: review.contentHtml,
    durationSeconds: review.durationSeconds, createdAt: '', comments: review.comments, decisions: [] }];
}
export function reviewVersion(review: ReviewItem, versionId?: string) {
  const versions = reviewVersions(review);
  return versions.find(version => version.id === versionId) ?? versions[0];
}
export function reviewVersionStatus(review: ReviewItem, version: ReviewVersion): ReviewItem['status'] {
  const decision = [...version.decisions].sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0]?.decision;
  if (decision === 'approved') return 'approved';
  if (decision === 'changes_requested') return 'needs_changes';
  if (decision) return 'in_review';
  return version.id === reviewVersions(review)[0]?.id ? review.status : 'in_review';
}
export function reviewScope(review: ReviewItem) {
  return review.jobId ? `project:${review.jobId}` : `property:${review.propertyId ?? review.id}`;
}
export function reviewSelectionError(reviews: ReviewItem[], targets: ReviewDecisionInput['targets']) {
  if (!targets.length) return 'Select at least one review item.';
  const selected = targets.map(target => reviews.find(review => review.id === target.assetId));
  if (selected.some((review,index) => !review || reviewVersions(review)[0]?.id !== targets[index].versionId)) return 'A selected item changed. Clear the selection and review its latest version.';
  if (new Set(selected.map(review => reviewScope(review!))).size !== 1) return 'Choose items from one project or property at a time.';
  return '';
}
