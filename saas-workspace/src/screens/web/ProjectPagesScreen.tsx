import { useRef, useState, type FormEvent } from 'react';

import { Button, IconButton, Modal } from '@/components/web';
import { Icon } from '@/components/web/Icon';
import { useProjectPages } from '@/hooks/use-project-pages';
import { isPageFolder, newPageFolder, newPageId, pageDraft, pagePath, type ProjectPage } from '@/lib/project-pages';
import { PageContent, ProjectPageEditor, type PageEditorHandle } from './ProjectPageEditor';
import type { JobSummary } from './types';
import './ProjectPagesScreen.css';

interface Props {
  agencyId?: string;
  userId?: string;
  projectId?: string;
  jobs: JobSummary[];
  role: 'admin' | 'team_member' | 'client';
  clientId?: string;
  readOnly?: boolean;
  onOpenProjects?: () => void;
  pageId?: string;
  onSelectPage?: (id: string | undefined) => void;
}

interface EntryForm {
  title: string;
  jobId: string;
  parentId: string;
  folder: boolean;
  existing?: ProjectPage;
}

export function ProjectPagesScreen({
  agencyId, userId, projectId, jobs, role, clientId, pageId, onSelectPage, readOnly, onOpenProjects,
}: Props) {
  const writable = role !== 'client' && !readOnly;
  const store = useProjectPages(agencyId, jobs, writable);
  const [localSelection, setLocalSelection] = useState<string>();
  const [folderId, setFolderId] = useState<string>();
  const [query, setQuery] = useState('');
  const [jobFilter, setJobFilter] = useState(projectId ?? '');
  const [entryForm, setEntryForm] = useState<EntryForm>();
  const [saving, setSaving] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [actionError, setActionError] = useState('');
  const editor = useRef<PageEditorHandle>(null);
  const permittedJobs = role === 'client' ? jobs.filter(job => job.clientId === clientId) : jobs;
  const permittedIds = new Set(permittedJobs.map(job => job.id));
  const allPages = (store.pages ?? []).filter(page =>
    (!projectId || page.jobId === projectId)
    && (role !== 'client' || (page.clientVisible && permittedIds.has(page.jobId))),
  );
  const pages = allPages.filter(page => !jobFilter || page.jobId === jobFilter);
  const visibleIds = new Set(pages.map(item => item.id));
  const selectedId = onSelectPage ? pageId : localSelection;
  const page = allPages.find(item => item.id === selectedId && !isPageFolder(item));
  const folder = pages.find(item => item.id === (folderId ?? page?.parentId));
  const matchingQuery = query.trim().toLowerCase();
  const entries = pages.filter(item => {
    if (matchingQuery) return item.title.toLowerCase().includes(matchingQuery);
    if (folder) return item.parentId === folder.id;
    return !item.parentId || !visibleIds.has(item.parentId);
  }).sort((left, right) => Number(isPageFolder(right)) - Number(isPageFolder(left)) || left.title.localeCompare(right.title));

  const select = (id: string | undefined) => {
    if (onSelectPage) onSelectPage(id);
    else setLocalSelection(id);
  };

  const flush = async () => {
    setActionError('');
    try {
      await editor.current?.flush();
      return true;
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Save the current page before leaving.');
      return false;
    }
  };

  const browse = async (id?: string) => {
    if (!await flush()) return;
    select(undefined);
    setFolderId(id);
    setQuery('');
  };

  const openPage = async (entry: ProjectPage) => {
    if (!await flush()) return;
    setFolderId(entry.parentId ?? undefined);
    select(entry.id);
  };

  const showEntryForm = async (isFolder: boolean, existing?: ProjectPage) => {
    if (!await flush()) return;
    setEntryError('');
    setEntryForm({
      title: existing?.title ?? '',
      jobId: existing?.jobId ?? folder?.jobId ?? projectId ?? (jobFilter || page?.jobId || permittedJobs[0]?.id || ''),
      parentId: existing ? existing.parentId ?? '' : folder && isPageFolder(folder) ? folder.id : '',
      folder: isFolder,
      existing,
    });
  };

  const submitEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!entryForm?.title.trim() || !entryForm.jobId || saving) return;
    setSaving(true);
    setEntryError('');
    try {
      const { existing } = entryForm;
      const saved = await store.save(existing ?? { id: newPageId(), jobId: entryForm.jobId, revision: 0 }, {
        ...(existing ? pageDraft(existing) : { kind: 'document', clientVisible: false, blocks: entryForm.folder ? [newPageFolder()] : [] }),
        title: entryForm.title.trim(),
        parentId: entryForm.parentId || null,
      });
      setQuery('');
      if (!projectId && jobFilter) setJobFilter(saved.jobId);
      setFolderId(entryForm.folder ? saved.id : saved.parentId ?? undefined);
      select(entryForm.folder ? undefined : saved.id);
      setEntryForm(undefined);
    } catch (failure) {
      setEntryError(failure instanceof Error ? failure.message : 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  };

  const canCreate = writable && Boolean((projectId || permittedJobs.length) && store.pages);
  const pageProject = permittedJobs.find(job => job.id === page?.jobId);
  const foldersForForm = allPages.filter(item => item.jobId === entryForm?.jobId && isPageFolder(item));

  return (
    <section className="pp-workspace" aria-label="Project pages" data-page-open={Boolean(page)}>
      {store.error && <div className="pp-error" role="alert">
        <p>{store.error}</p>
        <Button variant="secondary" onClick={() => { void store.refresh().catch(() => {}); }}>Retry</Button>
      </div>}
      {actionError && <p className="pp-error" role="alert">{actionError}</p>}
      <div className="pp-layout">
        <aside className="pp-sidebar" aria-label="Page browser">
          <div className="pp-browser-header">
            <h2 className="rm-visually-hidden">Pages</h2>
            {canCreate && <div className="pp-create-actions">
              <Button icon="folder" variant="secondary" onClick={() => void showEntryForm(true)}>New folder</Button>
              <Button icon="plus" onClick={() => void showEntryForm(false)}>New page</Button>
            </div>}
          </div>
          {!projectId && permittedJobs.length > 1 && <select
            aria-label="Filter pages by project" value={jobFilter}
            onChange={async event => {
              const next = event.target.value;
              if (!await flush()) return;
              setJobFilter(next);
              setFolderId(undefined);
              setQuery('');
              select(undefined);
            }}>
            <option value="">All projects</option>
            {permittedJobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
          </select>}
          <input type="search" aria-label="Find a page" placeholder="Find a page…" value={query} onChange={event => setQuery(event.target.value)}/>
          {folder && <div className="pp-folder-path">
            <IconButton icon="chevron-left" label="Parent folder" onClick={() => void browse(folder.parentId ?? undefined)}/>
            <strong>{folder.title}</strong>
            {writable && isPageFolder(folder) && <IconButton icon="dots" label="Rename folder" onClick={() => void showEntryForm(true, folder)}/>}
          </div>}
          {entries.length ? <nav aria-label={folder ? folder.title : 'Pages and folders'}>
            {entries.map(entry => {
              const isFolder = isPageFolder(entry);
              const hasChildren = !isFolder && pages.some(item => item.parentId === entry.id);
              return <div className="pp-entry" key={entry.id}>
                <button className="pp-tree-page" type="button" aria-current={page?.id === entry.id ? 'page' : undefined}
                  onClick={() => { void (isFolder ? browse(entry.id) : openPage(entry)); }}>
                  <Icon name={isFolder ? 'folder' : 'file'} size={18}/>
                  <span>{entry.title}</span>
                  {isFolder && <Icon name="chevron-right" size={14}/>}
                </button>
                {hasChildren && <IconButton icon="chevron-right" label={`Open pages inside ${entry.title}`} onClick={() => void browse(entry.id)}/>}
              </div>;
            })}
          </nav> : <p className="pp-muted" role={store.pages ? undefined : 'status'}>
            {!store.pages ? (store.error ? 'Pages unavailable' : 'Loading pages…') : matchingQuery ? 'No matches' : folder ? 'Empty folder' : 'No pages yet'}
          </p>}
          {writable && !permittedJobs.length && onOpenProjects && <Button variant="secondary" onClick={onOpenProjects}>Open projects</Button>}
        </aside>

        <article className="pp-paper">
          {page ? <>
            <button className="pp-back" type="button" onClick={() => void browse(folder?.id)}>
              <Icon name="chevron-left" size={16}/>Pages
            </button>
            {!projectId && pageProject && <div className="pp-page-context">{pageProject.name}</div>}
            {writable ? <ProjectPageEditor
              key={page.id} ref={editor} page={page} pages={allPages} canShare={Boolean(pageProject?.clientId)}
              userKey={`${agencyId ?? 'sample'}:${userId ?? 'preview'}`} save={store.save} history={store.history} reload={store.refresh}
            /> : <>
              <h1 className="pp-title">{page.title}</h1>
              <PageContent blocks={page.blocks}/>
            </>}
          </> : <div className="pp-empty">
            <Icon name="file" size={24}/>
            <p>{entries.length ? 'Select a page to open it.' : canCreate ? 'Create a page to start writing.' : 'No pages to open.'}</p>
          </div>}
        </article>
      </div>

      <Modal open={Boolean(entryForm)} title={entryForm?.existing ? 'Rename folder' : entryForm?.folder ? 'New folder' : 'New page'} onClose={() => { if (!saving) setEntryForm(undefined); }}>
        {entryForm && <form className="rm-action-form" onSubmit={submitEntry}>
          {entryError && <p className="pp-error" role="alert">{entryError}</p>}
          <label className="rm-field">
            <span>{entryForm.folder ? 'Folder name' : 'Page title'}</span>
            <input autoFocus data-modal-autofocus required maxLength={300} value={entryForm.title} disabled={saving}
              onChange={event => setEntryForm({ ...entryForm, title: event.target.value })}/>
          </label>
          {!entryForm.existing && !projectId && permittedJobs.length > 1 && <label className="rm-field">
            <span>Project</span>
            <select value={entryForm.jobId} disabled={saving} onChange={event => setEntryForm({ ...entryForm, jobId: event.target.value, parentId: '' })}>
              {permittedJobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
            </select>
          </label>}
          {!entryForm.existing && foldersForForm.length > 0 && <label className="rm-field">
            <span>Folder</span>
            <select value={entryForm.parentId} disabled={saving} onChange={event => setEntryForm({ ...entryForm, parentId: event.target.value })}>
              <option value="">Project root</option>
              {foldersForForm.map(item => <option key={item.id} value={item.id}>{pagePath(allPages, item).map(parent => parent.title).join(' / ')}</option>)}
            </select>
          </label>}
          <footer className="rm-dialog-actions">
            <Button variant="secondary" disabled={saving} onClick={() => setEntryForm(undefined)}>Cancel</Button>
            <Button type="submit" disabled={saving || !entryForm.title.trim() || !entryForm.jobId}>
              {saving ? 'Saving…' : entryForm.existing ? 'Save name' : entryForm.folder ? 'Create folder' : 'Create page'}
            </Button>
          </footer>
        </form>}
      </Modal>
    </section>
  );
}
