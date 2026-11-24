import { useState, type FormEvent } from 'react';
import { Button, Modal } from '@/components/web';
import type { JobSummary, PropertySummary, ReviewItem, UploadDeliverableInput, UploadReviewVersionInput } from './types';

export function ReviewUploadDialog({ revision, jobs = [], properties = [], context, onUpload, onUploadVersion, onClose }: {
  revision?: ReviewItem; jobs?: JobSummary[]; properties?: PropertySummary[];
  context?: { jobId?: string; propertyId?: string };
  onUpload?: (input: UploadDeliverableInput) => Promise<void>;
  onUploadVersion?: (input: UploadReviewVersionInput) => Promise<void>;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState(context?.jobId ?? '');
  const [propertyId, setPropertyId] = useState(context?.propertyId ?? '');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<UploadDeliverableInput['kind']>(revision?.kind ?? 'video');
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const job = jobs.find(item => item.id === jobId);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!files.length || busy) return;
    setBusy(true); setError('');
    const remaining = [...files];
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        if (revision) {
          if (!onUploadVersion) throw new Error('Revision uploads are unavailable.');
          await onUploadVersion({ mediaAssetId: revision.id, file });
        } else {
          if (!onUpload) throw new Error('Uploads are unavailable.');
          await onUpload({ file, jobId: jobId || undefined, propertyId: propertyId || undefined,
            title: files.length === 1 && title.trim() ? title.trim() : file.name.replace(/\.[^.]+$/, ''),
            kind, clientVisible: job && !job.clientId ? false : shared });
        }
        remaining.shift(); setFiles([...remaining]);
      }
      onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Upload failed. Your remaining files are ready to retry.'); }
    finally { setBusy(false); setProgress(''); }
  };
  return <Modal open title={revision ? `Upload revision · ${revision.title}` : 'Upload review files'} onClose={() => { if (!busy) onClose(); }}>
    <form className="rm-action-form" onSubmit={submit}>
      {error && <p className="rm-feedback rm-feedback--error" role="alert">{error}</p>}
      <fieldset disabled={busy} className="review-upload-fields">
        {!revision && <>
          <label className="rm-field"><span>Project</span><select disabled={Boolean(context?.jobId)} value={jobId} onChange={event => { setJobId(event.target.value); setPropertyId(''); }}><option value="">Property work — no engagement</option>{jobs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="rm-field"><span>{jobId ? 'Property / location (optional)' : 'Property'}</span><select disabled={Boolean(context?.propertyId)} required={!jobId} value={propertyId} onChange={event => setPropertyId(event.target.value)}><option value="">{jobId ? 'No property' : 'Choose a property'}</option>{properties.filter(item => !job || item.clientId === job.clientId).map(item => <option key={item.id} value={item.id}>{item.name} · {item.clientName}</option>)}</select></label>
          <label className="rm-field"><span>Title (optional for a single file)</span><input value={title} onChange={event => setTitle(event.target.value)}/></label>
          <label className="rm-field"><span>File type</span><select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="video">Video</option><option value="image">Photo / image</option><option value="document">Document</option><option value="script">Script</option><option value="other">Other</option></select></label>
          {(!job || job.clientId) && <label className="review-check"><input type="checkbox" checked={shared} onChange={event => setShared(event.target.checked)}/>Share with the signed-in client</label>}
        </>}
        {revision && <p>The new version starts a fresh review. Existing files, comments and decisions stay in version history.</p>}
        <label className="rm-field"><span>{revision ? 'Revision file' : 'Files'}</span><input type="file" multiple={!revision} accept={kind === 'video' ? 'video/*' : kind === 'image' ? 'image/*' : undefined} onChange={event => setFiles(Array.from(event.target.files ?? []))}/></label>
        {!!files.length && <ul>{files.map((file,index) => <li key={`${file.name}:${index}`}>{file.name}</li>)}</ul>}
      </fieldset>
      <p role="status">{progress}</p>
      <footer className="rm-dialog-actions"><Button disabled={busy} variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !files.length || (!revision && !jobId && !propertyId)}>{busy ? 'Uploading…' : revision ? 'Upload new version' : `Upload ${files.length || ''} ${files.length === 1 ? 'file' : 'files'}`}</Button></footer>
    </form>
  </Modal>;
}
