import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { Button, IconButton, Modal, RichTextEditor, cleanEditorHtml } from '@/components/web';
import { isPageFolder, pageDescendants, pageDraft, pagePath, pageText, type PageBlock, type PageDraft, type PageRevision, type ProjectPage } from '@/lib/project-pages';
import { projectPageHtml, richPageBlock } from '@/lib/project-page-content';

export interface PageEditorHandle { flush: () => Promise<void> }

export function PageContent({ blocks }: { blocks: PageBlock[] }) {
  return <div className="pp-reading" dangerouslySetInnerHTML={{ __html: cleanEditorHtml(projectPageHtml(blocks)) }}/>;
}

function downloadDraft(draft: PageDraft) {
  const url = URL.createObjectURL(new Blob([pageText(draft)], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${draft.title.replace(/[^a-z0-9-]/gi, '-') || 'page'}.txt`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProjectPageEditor({ page, pages, userKey, canShare, save, history, reload, ref }: {
  page: ProjectPage;
  pages: ProjectPage[];
  userKey: string;
  canShare: boolean;
  save: (page: ProjectPage, draft: PageDraft) => Promise<ProjectPage>;
  history: (id: string) => Promise<PageRevision[]>;
  reload: () => Promise<ProjectPage[]>;
  ref: Ref<PageEditorHandle>;
}) {
  const storageKey = `rm:page-draft:${userKey}:${page.id}`;
  const [initial] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
      if (stored?.draft && Array.isArray(stored.draft.blocks) && typeof stored.revision === 'number') {
        return stored as { draft: PageDraft; revision: number };
      }
    } catch { /* The saved page is available if browser storage is unavailable. */ }
    return { draft: pageDraft(page), revision: page.revision };
  });
  const [draft, setDraft] = useState(initial.draft);
  const latest = useRef(initial.draft);
  const base = useRef({ ...page, revision: initial.revision });
  const savedSignature = useRef(JSON.stringify(pageDraft(page)));
  const [status, setStatus] = useState(() => JSON.stringify(initial.draft) === JSON.stringify(pageDraft(page)) ? 'Saved' : 'Recovered draft');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef<Promise<void> | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<PageRevision[]>();
  const [selectedRevision, setSelectedRevision] = useState<PageRevision>();
  const [historyError, setHistoryError] = useState('');

  const change = (next: PageDraft) => {
    latest.current = next;
    setDraft(next);
    const unchanged = !pending.current && JSON.stringify(next) === savedSignature.current;
    setStatus(unchanged ? 'Saved' : 'Unsaved changes');
    if (unchanged) setError('');
    try {
      if (unchanged) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, JSON.stringify({ revision: base.current.revision, draft: next }));
    } catch {
      setError('Browser draft recovery is unavailable. Keep this page open until saved.');
    }
  };

  const flush = async (): Promise<void> => {
    if (pending.current) {
      await pending.current;
      return flush();
    }
    const snapshot = latest.current;
    const signature = JSON.stringify(snapshot);
    if (signature === savedSignature.current) return;
    const operation = Promise.resolve().then(async () => {
      setSaving(true);
      setStatus('Saving…');
      setError('');
      try {
        const saved = await save(base.current, snapshot);
        base.current = saved;
        savedSignature.current = signature;
        const upToDate = JSON.stringify(latest.current) === signature;
        try {
          if (upToDate) window.localStorage.removeItem(storageKey);
          else window.localStorage.setItem(storageKey, JSON.stringify({ revision: saved.revision, draft: latest.current }));
        } catch {
          setError('Page saved. Browser draft recovery could not be updated.');
        }
        setStatus(upToDate ? 'Saved' : 'Unsaved changes');
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not save the page.');
        setStatus('Draft kept');
        throw failure;
      } finally {
        setSaving(false);
        pending.current = null;
      }
    });
    pending.current = operation;
    await operation;
    if (JSON.stringify(latest.current) !== savedSignature.current) await flush();
  };

  useImperativeHandle(ref, () => ({ flush }));
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; });

  useEffect(() => {
    const timer = window.setTimeout(() => { void flushRef.current().catch(() => {}); }, 900);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedSignature.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      void flushRef.current().catch(() => {});
    };
  }, []);

  const restoreSavedPage = async () => {
    if (!window.confirm('Replace this browser draft with the last saved version?')) return;
    try {
      const saved = (await reload()).find(item => item.id === page.id);
      if (!saved) throw new Error('Page is unavailable. Your draft has been kept.');
      const restored = pageDraft(saved);
      base.current = saved;
      latest.current = restored;
      savedSignature.current = JSON.stringify(restored);
      setDraft(restored);
      setEditorVersion(version => version + 1);
      window.localStorage.removeItem(storageKey);
      setError('');
      setStatus('Saved');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load the saved page.');
    }
  };

  const openHistory = async () => {
    setOptionsOpen(false);
    setHistoryOpen(true);
    setHistoryError('');
    setRevisions(undefined);
    setSelectedRevision(undefined);
    try {
      await flush();
      setRevisions(await history(page.id));
    } catch (failure) {
      setHistoryError(failure instanceof Error ? failure.message : 'History unavailable.');
    }
  };

  const descendants = pageDescendants(pages, page.id);
  const folders = pages.filter(item => item.jobId === page.jobId && !descendants.has(item.id) && (isPageFolder(item) || item.id === draft.parentId));
  const initialHtml = projectPageHtml(draft.blocks);

  return (
    <>
      {error && <div className="pp-error" role="alert">
        <p>{error}</p>
        <Button variant="secondary" onClick={() => { void flush().catch(() => {}); }} disabled={saving}>Retry</Button>
        <Button variant="secondary" onClick={() => downloadDraft(draft)}>Download draft</Button>
        <Button variant="secondary" onClick={() => { void restoreSavedPage(); }} disabled={saving}>Use saved version</Button>
      </div>}
      <div className="pp-title-row">
        <input className="pp-title" aria-label="Page title" placeholder="Untitled page" value={draft.title} maxLength={300}
          onChange={event => change({ ...latest.current, title: event.target.value })}/>
        <IconButton label="Page options" icon="dots" onClick={() => setOptionsOpen(true)}/>
      </div>
      <RichTextEditor
        page
        label="Page content"
        resetKey={`${page.id}:${editorVersion}`}
        value={initialHtml}
        onChange={(html, text) => change({ ...latest.current, blocks: [richPageBlock(html, text)] })}
      />
      <small className="pp-save-status" role="status">{status}</small>

      <Modal open={optionsOpen} title="Page options" onClose={() => setOptionsOpen(false)}>
        <div className="pp-options">
          <label className="rm-field">
            <span>Folder</span>
            <select value={draft.parentId ?? ''} onChange={event => change({ ...latest.current, parentId: event.target.value || null })}>
              <option value="">Project root</option>
              {folders.map(folder => <option key={folder.id} value={folder.id}>{pagePath(pages, folder).map(item => item.title).join(' / ')}</option>)}
            </select>
          </label>
          {canShare && <label className="pp-share">
            <input type="checkbox" checked={draft.clientVisible} onChange={event => change({ ...latest.current, clientVisible: event.target.checked })}/>
            Share with client
          </label>}
          <Button variant="secondary" onClick={() => void openHistory()}>Version history</Button>
        </div>
      </Modal>
      <Modal open={historyOpen} title="Version history" onClose={() => setHistoryOpen(false)}>
        {historyError ? <p role="alert">{historyError}</p> : !revisions ? <p role="status">Loading history…</p> :
          <div className="pp-history">
            <div>{revisions.map(revision => (
              <Button key={revision.id} variant="secondary" aria-pressed={selectedRevision?.id === revision.id} onClick={() => setSelectedRevision(revision)}>
                Version {revision.revision} · {new Date(revision.createdAt).toLocaleDateString()}
              </Button>
            ))}</div>
            {selectedRevision && <section>
              <h3>{selectedRevision.title}</h3>
              <PageContent blocks={selectedRevision.blocks}/>
              <Button disabled={saving} onClick={async () => {
                change({ ...latest.current, title: selectedRevision.title, blocks: selectedRevision.blocks });
                setEditorVersion(version => version + 1);
                try { await flush(); setHistoryOpen(false); } catch { /* The restored draft stays visible. */ }
              }}>Restore version</Button>
            </section>}
          </div>}
      </Modal>
    </>
  );
}
