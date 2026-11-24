import { useState, type FormEvent } from 'react';
import { Button } from '@/components/web';
import type { CreateReviewCommentInput, ReviewComment, ReviewVersion } from './types';

export type ReviewCommentDraft = { body: string; visibility: 'client' | 'internal'; parentId?: string; timestamped: boolean };
export function ReviewConversation({ assetId, version, draft, onDraft, onComment, onResolve, currentUserId, clientRole, video, timestamp, onSeek }: {
  assetId: string; version: ReviewVersion; draft: ReviewCommentDraft; onDraft: (value: ReviewCommentDraft) => void;
  onComment?: (input: CreateReviewCommentInput) => Promise<void>;
  onResolve?: (id: string, resolved: boolean) => Promise<void>;
  currentUserId?: string; clientRole: boolean; video: boolean; timestamp: string; onSeek: (timestamp: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const comments = version.comments.filter(comment => !clientRole || comment.visibility !== 'internal');
  const parent = comments.find(comment => comment.id === draft.parentId);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!onComment || !draft.body.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await onComment({ mediaAssetId: assetId, versionId: version.id, body: draft.body.trim(),
        parentId: parent?.id, timestamp: parent?.timestamp ?? (video && draft.timestamped ? timestamp : 'General'),
        visibility: parent?.visibility ?? (clientRole ? 'client' : draft.visibility) });
      onDraft({ ...draft, body: '', parentId: undefined });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save feedback.'); }
    finally { setBusy(false); }
  };
  const roots = comments.filter(comment => !comment.parentId || !comments.some(item => item.id === comment.parentId));
  const ordered: ReviewComment[] = [];
  const append = (comment: ReviewComment) => { ordered.push(comment); comments.filter(child => child.parentId === comment.id).forEach(append); };
  roots.forEach(append);
  return <section className="review-conversation">
    <h3>Feedback · v{version.number}</h3>
    {!comments.length && <p>No feedback on this version yet.</p>}
    <div className="review-comment-list">{ordered.map(comment => <article key={comment.id} className={`${comment.parentId ? 'is-reply' : ''} ${comment.resolved ? 'is-resolved' : ''}`}>
      <header><strong>{comment.author}</strong>{comment.visibility === 'internal' && <span>Team only</span>}{comment.resolved && <span>Resolved</span>}{comment.timestamp !== 'General' && video && <button type="button" onClick={() => onSeek(comment.timestamp)}>{comment.timestamp}</button>}</header>
      <p>{comment.body}</p>
      <footer><button type="button" disabled={busy || !onComment} onClick={() => onDraft({ ...draft, parentId: comment.parentId ?? comment.id, visibility: comment.visibility ?? 'client' })}>Reply</button>
        {onResolve && (!clientRole || comment.authorId === currentUserId) && <button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onResolve(comment.id, !comment.resolved); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not resolve the comment.'); } finally { setBusy(false); } }}>{comment.resolved ? 'Reopen' : 'Resolve'}</button>}
      </footer>
    </article>)}</div>
    <form className="rm-action-form" onSubmit={submit}>
      {error && <p className="rm-feedback rm-feedback--error" role="alert">{error}</p>}
      {parent && <p>Replying to {parent.author} <button type="button" disabled={busy} onClick={() => onDraft({ ...draft, parentId: undefined })}>Cancel reply</button></p>}
      {!clientRole && !parent && <label className="rm-field"><span>Comment visibility</span><select disabled={busy} value={draft.visibility} onChange={event => onDraft({ ...draft, visibility: event.target.value as typeof draft.visibility })}><option value="client">Client-visible</option><option value="internal">Team only</option></select></label>}
      {video && <label className="review-check"><input disabled={busy} type="checkbox" checked={draft.timestamped} onChange={event => onDraft({ ...draft, timestamped: event.target.checked })}/>Attach current timestamp {timestamp}</label>}
      <label className="rm-field"><span>{parent ? 'Reply' : 'Add feedback'}</span><textarea disabled={busy} value={draft.body} rows={3} onChange={event => onDraft({ ...draft, body: event.target.value })}/></label>
      <Button type="submit" disabled={busy || !onComment || !draft.body.trim()}>{busy ? 'Saving…' : parent ? 'Send reply' : 'Post feedback'}</Button>
    </form>
  </section>;
}
