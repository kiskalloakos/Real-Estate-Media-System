import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, EmptyState, Icon, Modal, PageHeader, cleanEditorHtml, useToast, type PortalRole } from '@/components/web';
import { downloadScriptPdf } from '@/lib/review-script-pdf';
import { reviewScope, reviewSelectionError, reviewVersion, reviewVersions, reviewVersionStatus } from '@/lib/review-workspace';
import { ReviewUploadDialog } from './ReviewUploadDialog';
import { ReviewConversation, type ReviewCommentDraft } from './ReviewConversation';
import { WorkStatusPill } from './shared';
import type { CreateReviewCommentInput, JobSummary, PropertySummary, ReviewDecisionInput, ReviewItem, UpdateDeliverableInput, UploadDeliverableInput, UploadReviewVersionInput } from './types';
import './ReviewsScreen.css';

export interface ReviewsScreenProps {
  initialReviewId?: string;
  initialVersionId?: string;
  projectContext?: { jobId?: string; propertyId?: string };
  currentUserId?: string;
  jobs?: JobSummary[];
  onArchive?: (reviewId: string) => void | Promise<void>;
  onComment?: (input: CreateReviewCommentInput) => Promise<void>;
  onDecision?: (input: ReviewDecisionInput) => Promise<void>;
  onResolve?: (commentId: string, resolved: boolean) => Promise<void>;
  onUploadVersion?: (input: UploadReviewVersionInput) => Promise<void>;
  onUpdate?: (input: UpdateDeliverableInput) => Promise<void>;
  onUpload?: (input: UploadDeliverableInput) => Promise<void>;
  properties?: PropertySummary[];
  reviews?: ReviewItem[];
  role: PortalRole;
}
function timestamp(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2,'0')}`;
}
function dateLabel(value: string) { return value ? new Date(value).toLocaleString() : ''; }

export function ReviewsScreen({ initialReviewId, initialVersionId, projectContext, currentUserId, jobs = [], onArchive, onComment, onDecision, onResolve, onUploadVersion, onUpdate, onUpload, properties = [], reviews = [], role }: ReviewsScreenProps) {
  const { notify } = useToast();
  const [activeId, setActiveId] = useState(initialReviewId ?? '');
  const [versionId, setVersionId] = useState('');
  const [collection, setCollection] = useState('all');
  const [selection, setSelection] = useState<Record<string,string>>({});
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchNote, setBatchNote] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editShared, setEditShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState(0);
  const [drafts, setDrafts] = useState<Record<string,ReviewCommentDraft>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = reviews.find(item => item.id === activeId);
  const versions = active ? reviewVersions(active) : [];
  const version = active ? reviewVersion(active, versionId) : undefined;
  useEffect(() => { if (initialReviewId) { setActiveId(initialReviewId); setVersionId(initialVersionId ?? ''); } }, [initialReviewId, initialVersionId]);
  useEffect(() => { if (version && !versionId) setVersionId(version.id); }, [version, versionId]);
  const visible = reviews.filter(item => collection === 'all' || reviewScope(item) === collection);
  const scopes = useMemo(() => [...new Map(reviews.map(item => [reviewScope(item), jobs.find(job => job.id === item.jobId)?.name ?? item.propertyName])).entries()], [reviews,jobs]);
  const targets = Object.entries(selection).map(([assetId, selectedVersion]) => ({ assetId, versionId: selectedVersion }));
  const selectionError = targets.length ? reviewSelectionError(reviews, targets) : '';
  const latest = versions[0];
  const isLatest = Boolean(version && latest?.id === version.id);
  const video = Boolean(version?.mimeType?.startsWith('video/'));
  const html = cleanEditorHtml(version?.contentHtml ?? '');
  const draftKey = `${role}:${currentUserId ?? 'preview'}:${version?.id ?? ''}`;
  const draft = version ? drafts[draftKey] ?? { body: '', visibility: role === 'client' || active?.clientId ? 'client' : 'internal', timestamped: true } : undefined;
  const selectReview = (review?: ReviewItem) => { setActiveId(review?.id ?? ''); setVersionId(review ? reviewVersions(review)[0]?.id ?? '' : ''); setError(''); setPosition(0); };
  const decide = async (input: ReviewDecisionInput) => {
    if (!onDecision || busy) return;
    setBusy(true); setError('');
    try { await onDecision(input); setBatchOpen(false); setSelection({}); setBatchNote(''); notify(input.decision === 'approved' ? `${input.targets.length} ${input.targets.length === 1 ? 'version approved' : 'versions approved'}.` : 'Review decision saved.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the decision.'); }
    finally { setBusy(false); }
  };
  const toggle = (review: ReviewItem, checked: boolean) => {
    const current = reviewVersions(review)[0];
    if (!current) return;
    setSelection(previous => { const next = { ...previous }; if (checked) next[review.id] = current.id; else delete next[review.id]; return next; });
    setError('');
  };
  return <div className="rm-page review-room">
    <PageHeader title="Reviews" actions={<div className="review-actions">{active && <Button variant="secondary" onClick={() => selectReview()}>All review items</Button>}{role !== 'client' && <Button icon="upload" disabled={!onUpload || busy} onClick={() => setUploadOpen(true)}>Upload files</Button>}</div>}/>
    {error && <p className="rm-feedback rm-feedback--error" role="alert">{error}</p>}
    {!active ? <>
      {!projectContext && <label className="rm-field review-collection"><span>Project / property</span><select value={collection} onChange={event => { setCollection(event.target.value); setSelection({}); }}><option value="all">All review items</option>{scopes.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
      {!!visible.length && <div className="review-batch-toolbar">
        <span>{targets.length} selected</span>
        <Button variant="secondary" disabled={busy || new Set(visible.map(reviewScope)).size !== 1 || !visible.some(item => reviewVersions(item).length)} onClick={() => setSelection(Object.fromEntries(visible.flatMap(item => { const current = reviewVersions(item)[0]; return current ? [[item.id,current.id]] : []; })))}>Select all in this collection</Button>
        {!!targets.length && <><Button disabled={busy || !onDecision || Boolean(selectionError)} onClick={() => setBatchOpen(true)}>Approve selected ({targets.length})</Button><Button variant="secondary" disabled={busy} onClick={() => setSelection({})}>Clear selection</Button></>}
      </div>}
      {selectionError && <p role="alert">{selectionError}</p>}
      {!visible.length ? <Card className="aw-reviews-empty"><EmptyState icon="play" title="No review files yet" description={role === 'client' ? 'Files shared with your account will appear here.' : role === 'team_member' ? 'Files you can work on will appear here. Ask your agency to assign a project or property.' : 'Upload a file to a project to start a review.'}/></Card> : <section className="review-directory" aria-label="Review items">{visible.map(review => {
        const current = reviewVersions(review)[0];
        const otherScope = targets.length > 0 && reviewScope(review) !== reviewScope(reviews.find(item => item.id === targets[0].assetId) ?? review);
        return <article className="review-directory-row" key={review.id}>
          <label className="review-check"><input type="checkbox" aria-label={`Select ${review.title}`} checked={Boolean(selection[review.id])} disabled={!current || otherScope || busy || !onDecision} onChange={event => toggle(review,event.target.checked)}/></label>
          <button className="review-directory-open" type="button" onClick={() => selectReview(review)}><Icon name={review.kind === 'image' ? 'image' : review.kind === 'video' ? 'play' : 'file'} size={22}/><span><strong>{review.title}</strong><small>{review.propertyName} · {current ? `v${current.number}` : 'No file version'}{review.clientVisible === false ? ' · Team only' : ''}</small></span></button>
          <WorkStatusPill status={current ? reviewVersionStatus(review,current) : 'draft'}/>
        </article>;
      })}</section>}
    </> : <>
      <header className="review-item-header"><div><h2>{active.title}</h2><p>{active.propertyName}</p></div><div className="review-actions">
        {role !== 'client' && <><Button variant="secondary" disabled={!onUploadVersion || busy} onClick={() => setRevisionOpen(true)}>Upload revision</Button><Button variant="secondary" disabled={!onUpdate || busy} onClick={() => { setEditTitle(active.title); setEditShared(active.clientVisible !== false); setEditOpen(true); }}>Edit details</Button>
        <Button variant="secondary" disabled={!onArchive || busy} onClick={async () => { if (!onArchive || !window.confirm('Archive this review? Its files and history will be retained.')) return; setBusy(true); setError(''); try { await onArchive(active.id); selectReview(); notify('Review archived.'); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not archive this review.'); } finally { setBusy(false); } }}>Archive</Button></>}
      </div></header>
      {!version ? <Card><h3>No file version yet</h3><p>Upload a file to begin reviewing this item.</p></Card> : <>
        <div className="review-version-toolbar"><label className="rm-field"><span>File version</span><select value={version.id} onChange={event => { setVersionId(event.target.value); setPosition(0); setError(''); }}>{versions.map(item => <option key={item.id} value={item.id}>v{item.number}{item.id === latest?.id ? ' · Latest' : ''}{item.filename ? ` · ${item.filename}` : ''}</option>)}</select></label><WorkStatusPill status={reviewVersionStatus(active,version)}/>
          {version.fileUrl && <Button variant="secondary" icon="download" onClick={() => window.open(version.fileUrl,'_blank','noopener,noreferrer')}>Download v{version.number}</Button>}
          {active.kind === 'script' && html && <Button variant="secondary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await downloadScriptPdf(`${active.title} v${version.number}`,html); } catch (failure) { setError(failure instanceof Error ? failure.message : 'PDF export failed.'); } finally { setBusy(false); } }}>Export script PDF</Button>}
        </div>
        {!isLatest && <p className="review-history-notice">You are viewing an earlier version. <button type="button" onClick={() => { setVersionId(latest.id); setPosition(0); }}>View latest v{latest.number}</button></p>}
        <div className="review-workspace-grid"><div>
          <Card className="review-media-stage">
            {active.kind === 'script' && html ? <div className="rm-review-script-preview" dangerouslySetInnerHTML={{__html:html}}/> : video && version.fileUrl ? <video key={version.id} ref={videoRef} controls preload="metadata" src={version.fileUrl} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}>Your browser cannot preview this video. Use Download to open the file.</video>
              : version.mimeType?.startsWith('image/') && version.fileUrl ? <img src={version.fileUrl} alt={`${active.title} v${version.number}`}/>
              : version.mimeType === 'application/pdf' && version.fileUrl ? <iframe title={`${active.title} v${version.number}`} src={version.fileUrl}/>
              : <div className="review-file-placeholder"><Icon name="file" size={40}/><p>{version.filename ?? 'File preview unavailable'}</p><p>Use Download to open the original file.</p></div>}
          </Card>
          <div className="review-decision-actions"><Button disabled={busy || !onDecision || !isLatest || reviewVersionStatus(active,version) === 'approved'} onClick={() => void decide({ targets:[{assetId:active.id,versionId:version.id}],decision:'approved' })}>Approve v{version.number}</Button>
            <Button variant="secondary" disabled={busy || !onDecision || !isLatest} onClick={() => void decide({targets:[{assetId:active.id,versionId:version.id}],decision:'changes_requested'})}>Request changes</Button>
            {role !== 'client' && reviewVersionStatus(active,version) === 'approved' && <Button variant="secondary" disabled={busy || !onDecision || !isLatest} onClick={() => void decide({targets:[{assetId:active.id,versionId:version.id}],decision:'approval_revoked'})}>Reopen review</Button>}
          </div>
          <details className="review-decision-history"><summary>Decision history · v{version.number} ({version.decisions.length})</summary>{!version.decisions.length && <p>No decisions on this version yet.</p>}{version.decisions.map(item => <article key={item.id}><strong>{item.actor} · {item.decision.replace(/_/g,' ')}</strong><small>{dateLabel(item.createdAt)}{item.batchId ? ' · Batch decision' : ''}</small>{item.note && <p>{item.note}</p>}</article>)}</details>
        </div>
        {draft && <Card><ReviewConversation key={version.id} assetId={active.id} version={version} draft={draft} onDraft={value => setDrafts(current => ({...current,[draftKey]:value}))} onComment={onComment} onResolve={onResolve} currentUserId={currentUserId} clientRole={role === 'client'} video={video} timestamp={timestamp(position)} onSeek={value => { const parts=value.split(':').map(Number); const seconds=parts.reduce((total,part) => total*60+part,0); if (videoRef.current && Number.isFinite(seconds)) { videoRef.current.currentTime=seconds; setPosition(seconds); } }}/></Card>}
        </div>
      </>}
    </>}
    {uploadOpen && <ReviewUploadDialog jobs={jobs} properties={properties} context={projectContext} onUpload={onUpload} onClose={() => setUploadOpen(false)}/>}
    {revisionOpen && active && <ReviewUploadDialog revision={active} onUploadVersion={onUploadVersion} onClose={() => setRevisionOpen(false)}/>}
    <Modal open={batchOpen} title={`Approve ${targets.length} selected versions`} onClose={() => { if (!busy) setBatchOpen(false); }}><form className="rm-action-form" onSubmit={event => { event.preventDefault(); if (!selectionError) void decide({targets,decision:'approved',note:batchNote}); }}>
      <p>Approval applies to these exact file versions.</p><ul>{targets.map(target => { const item=reviews.find(review => review.id===target.assetId); const selected=item && reviewVersions(item).find(version => version.id===target.versionId); return <li key={target.assetId}>{item?.title ?? 'Unavailable item'} · v{selected?.number ?? '?'}</li>; })}</ul>
      {(selectionError || error) && <p role="alert">{selectionError || error}</p>}
      <label className="rm-field"><span>Approval note (optional)</span><textarea disabled={busy} value={batchNote} onChange={event => setBatchNote(event.target.value)}/></label><footer className="rm-dialog-actions"><Button variant="secondary" disabled={busy} onClick={() => setBatchOpen(false)}>Cancel</Button><Button type="submit" disabled={busy || !onDecision || Boolean(selectionError)}>{busy ? 'Approving…' : `Approve ${targets.length} versions`}</Button></footer>
    </form></Modal>
    <Modal open={editOpen && Boolean(active)} title="Review details" onClose={() => { if (!busy) setEditOpen(false); }}><form className="rm-action-form" onSubmit={async event => { event.preventDefault(); if (!onUpdate || !active) return; setBusy(true); setError(''); try { await onUpdate({mediaAssetId:active.id,title:editTitle,clientVisible:editShared,propertyId:active.propertyId ?? '',status:'ready_for_review'}); setEditOpen(false); notify('Review details saved.'); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save details.'); } finally { setBusy(false); } }}>
      {error && <p role="alert">{error}</p>}<label className="rm-field"><span>Title</span><input required disabled={busy} value={editTitle} onChange={event => setEditTitle(event.target.value)}/></label>{active?.clientId && <label className="review-check"><input type="checkbox" disabled={busy} checked={editShared} onChange={event => setEditShared(event.target.checked)}/>Share with the signed-in client</label>}<footer className="rm-dialog-actions"><Button variant="secondary" disabled={busy} onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={busy || !onUpdate}>Save details</Button></footer>
    </form></Modal>
  </div>;
}
