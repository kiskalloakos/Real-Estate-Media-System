import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import {
  Button,
  Card,
  Icon,
  IconButton,
  Modal,
  RichTextEditor,
  useToast,
} from '@/components/web';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import type {
  CompanyDocumentFolderSummary,
  CompanyDocumentKind,
  CompanyDocumentSummary,
  MoveCompanyDocumentToFolderInput,
  SalesDocumentType,
  UpsertCompanyDocumentFolderInput,
  UpsertDocumentInput,
} from './types';

export interface DocumentsScreenProps {
  documents?: CompanyDocumentSummary[];
  folders?: CompanyDocumentFolderSummary[];
  leadLists?: string[];
  members?: import('./types').AgencyMemberSummary[];
  locale?: 'en' | 'ro';
  onArchiveDocument?: (documentId: string) => Promise<void>;
  onDeleteFolder?: (folderId: string) => Promise<void>;
  onMoveDocumentToFolder?: (input: MoveCompanyDocumentToFolderInput) => Promise<void>;
  onSaveDocument?: (input: UpsertDocumentInput) => Promise<string | void>;
  onSaveFolder?: (input: UpsertCompanyDocumentFolderInput) => Promise<string | void>;
}

const documentKinds: { label: string; value: CompanyDocumentKind }[] = [
  { label: 'Other', value: 'company_file' },
  { label: 'Sales', value: 'sales' },
  { label: 'SOPs', value: 'sop' },
];

const emptyDocument: UpsertDocumentInput = {
  callerList: '',
  contentHtml: '',
  file: null,
  kind: 'company_file',
  title: '',
};

const salesDocumentTypes: { label: string; value: SalesDocumentType }[] = [
  { label: 'General sales document', value: 'general' },
  { label: 'Caller script', value: 'script' },
  { label: 'Offer / deal', value: 'offer' },
  { label: 'Objection handling', value: 'objection_handling' },
  { label: 'Sales training', value: 'training' },
  { label: 'Other', value: 'other' },
];

const emptyFolder = { name: '' };
const legacyDocumentFoldersKey = 'rm:document-folders';
const legacyDocumentFolderAssignmentsKey = 'rm:document-folder-assignments';
const legacyDocumentFoldersMigratedKey = 'rm:document-folders:supabase-migrated';

function normalizeDocumentPreview(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n[\t ]+/g, '\n')
    .replace(/[\t ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function documentPreviewText(html = '') {
  if (!html) return '';

  if (typeof document === 'undefined') {
    return normalizeDocumentPreview(
      html
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/(?:div|h[1-6]|li|p)>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'"),
    );
  }

  const root = document.createElement('div');
  root.innerHTML = html;
  const fragments: string[] = [];
  const blockElements = new Set(['DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'P']);

  const readNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      fragments.push(node.textContent ?? '');
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'BR') {
      fragments.push('\n');
      return;
    }

    const isBlock = blockElements.has(node.tagName);
    if (isBlock && fragments.length && !fragments.at(-1)?.endsWith('\n')) {
      fragments.push('\n\n');
    }
    node.childNodes.forEach(readNode);
    if (isBlock) fragments.push('\n\n');
  };

  root.childNodes.forEach(readNode);
  return normalizeDocumentPreview(fragments.join(''));
}

function documentPreviewExcerpt(html = '', limit = 180) {
  const preview = documentPreviewText(html);
  if (preview.length <= limit) return preview;

  const candidate = preview.slice(0, limit + 1);
  const wordBoundary = Math.max(
    candidate.lastIndexOf(' '),
    candidate.lastIndexOf('\n'),
  );
  const end = wordBoundary >= limit * 0.7 ? wordBoundary : limit;
  return `${candidate.slice(0, end).trimEnd()}…`;
}

function documentKindValue(kind: CompanyDocumentKind) {
  return kind === 'sales' || kind === 'sop' ? kind : 'company_file';
}

function readLegacyJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '') as T;
  } catch {
    return fallback;
  }
}

function isRootFolder(folder: CompanyDocumentFolderSummary) {
  return !folder.parentFolderId;
}

function folderPath(folder: CompanyDocumentFolderSummary, folders: CompanyDocumentFolderSummary[]) {
  const path = [folder.name];
  const seen = new Set([folder.id]);
  let parent = folder.parentFolderId
    ? folders.find((item) => item.id === folder.parentFolderId)
    : undefined;
  while (parent && !seen.has(parent.id)) {
    path.unshift(parent.name);
    seen.add(parent.id);
    parent = parent.parentFolderId
      ? folders.find((item) => item.id === parent?.parentFolderId)
      : undefined;
  }
  return path.join(' / ');
}

export function DocumentsScreen({
  documents = [],
  folders: allFolders = [],
  leadLists = [],
  members = [],
  locale = 'en',
  onArchiveDocument,
  onDeleteFolder,
  onMoveDocumentToFolder,
  onSaveDocument,
  onSaveFolder,
}: DocumentsScreenProps) {
  const isRo = locale === 'ro';
  const { notify } = useToast();
  const [previewDocument, setPreviewDocument] = useState<CompanyDocumentSummary | null>(null);
  const [documentForm, setDocumentForm] = useState<UpsertDocumentInput | null>(null);
  const [folderForm, setFolderForm] = useState<(Partial<CompanyDocumentFolderSummary> & { name: string }) | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    kind: 'document';
    label: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sopAssigneeDraft, setSopAssigneeDraft] = useState<string[]>([]);
  const [documentFolderDraft, setDocumentFolderDraft] = useState('');
  const legacyFolderMigrationStarted = useRef(false);
  const folders = allFolders.filter((folder) => folder.scope === 'documents');
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);
  const selectedParentFolder = selectedFolder?.parentFolderId
    ? folders.find((folder) => folder.id === selectedFolder.parentFolderId)
    : undefined;
  const visibleFolders = folders.filter((folder) =>
    selectedFolder
      ? folder.parentFolderId === selectedFolder.id
      : isRootFolder(folder));
  const folderIds = new Set(folders.map((folder) => folder.id));
  const visibleDocuments = selectedFolder
    ? documents.filter((document) => document.folderId === selectedFolder.id)
    : documents.filter((document) => !document.folderId || !folderIds.has(document.folderId));
  const folderDocumentCounts = folders.reduce<Record<string, number>>((counts, folder) => {
    counts[folder.id] = documents.filter((document) => document.folderId === folder.id).length;
    return counts;
  }, {});
  const folderChildCounts = folders.reduce<Record<string, number>>((counts, folder) => {
    counts[folder.id] = folders.filter((child) => child.parentFolderId === folder.id).length;
    return counts;
  }, {});

  useEffect(() => {
    if (
      legacyFolderMigrationStarted.current ||
      !onSaveFolder ||
      typeof window === 'undefined' ||
      window.localStorage.getItem(legacyDocumentFoldersMigratedKey)
    ) {
      return;
    }

    const legacyFolders = readLegacyJson<{ id: string; name: string }[]>(legacyDocumentFoldersKey, [])
      .filter((folder) => folder.id && folder.name?.trim());
    if (!legacyFolders.length) return;

    legacyFolderMigrationStarted.current = true;
    const legacyAssignments = readLegacyJson<Record<string, string>>(legacyDocumentFolderAssignmentsKey, {});
    const documentIds = new Set(documents.map((document) => document.id));

    void (async () => {
      try {
        const existingFoldersByName = new Map(
          folders.map((folder) => [folder.name.trim().toLowerCase(), folder.id]),
        );
        const folderIdMap = new Map<string, string>();
        for (const legacyFolder of legacyFolders) {
          const folderId = existingFoldersByName.get(legacyFolder.name.trim().toLowerCase())
            ?? await onSaveFolder({
              name: legacyFolder.name,
              scope: 'documents',
            });
          if (folderId) folderIdMap.set(legacyFolder.id, folderId);
        }

        if (onMoveDocumentToFolder) {
          for (const [documentId, legacyFolderId] of Object.entries(legacyAssignments)) {
            const folderId = folderIdMap.get(legacyFolderId);
            if (folderId && documentIds.has(documentId)) {
              await onMoveDocumentToFolder({ documentId, folderId });
            }
          }
        }

        window.localStorage.setItem(legacyDocumentFoldersMigratedKey, new Date().toISOString());
        notify('Existing document folders were synced.');
      } catch (error) {
        legacyFolderMigrationStarted.current = false;
        console.warn('Could not migrate local document folders to Supabase.', error);
      }
    })();
  }, [documents, folders, notify, onMoveDocumentToFolder, onSaveFolder]);

  const closeDocumentForm = () => {
    setDocumentForm(null);
    setSopAssigneeDraft([]);
    setDocumentFolderDraft('');
  };
  const openNewDocument = () => {
    setSopAssigneeDraft([]);
    setDocumentFolderDraft(selectedFolder?.id ?? '');
    setDocumentForm({
      ...emptyDocument,
      kind: 'company_file',
    });
  };
  const openNewFolder = () => {
    setFolderForm({ ...emptyFolder, parentFolderId: selectedFolder?.id });
  };
  const openDocument = (document: CompanyDocumentSummary) => setDocumentForm({
    callerList: document.callerList ?? '',
    contentHtml: document.contentHtml ?? '',
    documentId: document.id,
    file: null,
    kind: document.kind,
    removeFile: false,
    salesDocumentType: document.salesDocumentType ?? (document.kind === 'sales' ? 'general' : undefined),
    title: document.title,
  });
  const openDocumentWithAssignment = (document: CompanyDocumentSummary) => {
    setSopAssigneeDraft(document.assigneeUserIds ?? []);
    setDocumentFolderDraft(document.folderId ?? '');
    openDocument(document);
  };
  const handleDocumentCardKeyDown = (event: KeyboardEvent<HTMLElement>, document: CompanyDocumentSummary) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setPreviewDocument(document);
  };

  const saveDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!documentForm || !onSaveDocument) return;
    setSaving(true);
    try {
      await onSaveDocument({
        ...documentForm,
        assigneeUserIds: documentForm.kind === 'sop' ? sopAssigneeDraft : [],
        callerList: documentForm.kind === 'sales' ? documentForm.callerList : '',
        folderId: documentFolderDraft || null,
        salesDocumentType: documentForm.kind === 'sales' ? documentForm.salesDocumentType : undefined,
      });
      notify(documentForm.documentId ? 'Document updated.' : 'Document created.');
      closeDocumentForm();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the document.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!folderForm?.name.trim() || !onSaveFolder) return;
    setSaving(true);
    try {
      const folderId = await onSaveFolder({
        folderId: folderForm.id,
        name: folderForm.name,
        parentFolderId: folderForm.parentFolderId ?? null,
        scope: 'documents',
      });
      if (!folderForm.id && folderId) setSelectedFolderId(folderId);
      notify(folderForm.id ? 'Folder updated.' : 'Folder created.');
      setFolderForm(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the folder.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteFolder = async () => {
    if (!folderForm?.id || !onDeleteFolder) return;
    if (!window.confirm(`Delete "${folderForm.name}"? Documents inside it will stay saved and move back to All documents.`)) return;
    setSaving(true);
    try {
      await onDeleteFolder(folderForm.id);
      if (selectedFolderId === folderForm.id) setSelectedFolderId(null);
      notify('Folder deleted.');
      setFolderForm(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete the folder.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const moveDocumentToFolder = async (input: MoveCompanyDocumentToFolderInput) => {
    if (!onMoveDocumentToFolder) return;
    try {
      await onMoveDocumentToFolder(input);
      notify('Document moved.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not move the document.', 'error');
    }
  };

  const archiveRecord = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      if (!onArchiveDocument) return;
      await onArchiveDocument(archiveTarget.id);
      notify(`${archiveTarget.label} deleted.`);
      setArchiveTarget(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete the record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rm-page rm-documents">
      {!selectedFolder ? (
        <div className="rm-documents-actions">
          <div className="rm-hub-toolbar__actions">
            <Button icon="folder" onClick={openNewFolder} variant="secondary">
              {isRo ? 'Folder nou' : 'New folder'}
            </Button>
            <Button
              icon="plus"
              onClick={openNewDocument}
            >
              {isRo ? 'Document nou' : 'New document'}
            </Button>
          </div>
        </div>
      ) : null}
      {selectedFolder ? (
        <div className="rm-folder-viewbar">
          <Button icon="chevron-left" onClick={() => setSelectedFolderId(selectedParentFolder?.id ?? null)} variant="secondary">
            {selectedParentFolder?.name ?? (isRo ? 'Toate documentele' : 'All documents')}
          </Button>
          <strong>{folderPath(selectedFolder, folders)}</strong>
          <div>
            <Button icon="dots" onClick={() => setFolderForm(selectedFolder)} variant="secondary">
              {isRo ? 'Editează folderul' : 'Edit folder'}
            </Button>
            <Button icon="folder" onClick={openNewFolder} variant="secondary">
              {isRo ? 'Folder nou' : 'New folder'}
            </Button>
            <Button icon="plus" onClick={openNewDocument}>
              {isRo ? 'Document nou' : 'New document'}
            </Button>
          </div>
        </div>
      ) : visibleFolders.length ? (
        <section className="rm-folder-grid" aria-label="Document folders">
          {visibleFolders.map((folder) => (
            <Card
              aria-label={`Open ${folder.name}`}
              className={`rm-folder-card${draggedDocumentId ? ' is-drop-ready' : ''}`}
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              onDragOver={(event) => {
                if (!draggedDocumentId) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggedDocumentId) return;
                void moveDocumentToFolder({ documentId: draggedDocumentId, folderId: folder.id });
                setDraggedDocumentId(null);
              }}
              role="button"
              tabIndex={0}
              tone="bright"
            >
              <span><Icon name="folder" size={18} /></span>
              <strong>{folder.name}</strong>
              <small>
                {folderDocumentCounts[folder.id] ?? 0} documents
                {folderChildCounts[folder.id] ? ` · ${folderChildCounts[folder.id]} folders` : ''}
              </small>
            </Card>
          ))}
        </section>
      ) : null}
      {selectedFolder && visibleFolders.length ? (
        <section className="rm-folder-grid" aria-label="Nested document folders">
          {visibleFolders.map((folder) => (
            <Card
              aria-label={`Open ${folder.name}`}
              className={`rm-folder-card${draggedDocumentId ? ' is-drop-ready' : ''}`}
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              onDragOver={(event) => {
                if (!draggedDocumentId) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggedDocumentId) return;
                void moveDocumentToFolder({ documentId: draggedDocumentId, folderId: folder.id });
                setDraggedDocumentId(null);
              }}
              role="button"
              tabIndex={0}
              tone="bright"
            >
              <span><Icon name="folder" size={18} /></span>
              <strong>{folder.name}</strong>
              <small>
                {folderDocumentCounts[folder.id] ?? 0} documents
                {folderChildCounts[folder.id] ? ` · ${folderChildCounts[folder.id]} folders` : ''}
              </small>
            </Card>
          ))}
        </section>
      ) : null}
      <section className="rm-document-grid" aria-label="Company documents">
        {visibleDocuments.map((document) => (
          <Card
            aria-grabbed={draggedDocumentId === document.id}
            className={`rm-document-card rm-document-card--editable${draggedDocumentId === document.id ? ' is-dragging' : ''}`}
            draggable
            key={document.id}
            aria-label={`Preview ${document.title}`}
            onDragEnd={() => setDraggedDocumentId(null)}
            onDragStart={(event) => {
              setDraggedDocumentId(document.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', document.id);
            }}
            onClick={() => setPreviewDocument(document)}
            onKeyDown={(event) => handleDocumentCardKeyDown(event, document)}
            role="button"
            tabIndex={0}
            tone="bright"
          >
            <div className="rm-document-card__top">
              <span><Icon name={document.fileUrl ? 'paperclip' : 'file'} size={19} /></span>
            </div>
            <div className="rm-document-card__body">
              <h3>{document.title}</h3>
              <p className="rm-document-card__preview">
                {documentPreviewExcerpt(document.contentHtml)
                  || document.fileName
                  || 'Attached company file'}
              </p>
              {document.kind === 'sales' ? (
                <small className="rm-document-card__meta">
                  {salesDocumentTypes.find((type) => type.value === (document.salesDocumentType ?? 'general'))?.label}
                  {document.salesDocumentType === 'script' && document.callerList
                    ? ` · ${document.callerList === 'all' ? 'All leads' : document.callerList}`
                    : ''}
                </small>
              ) : null}
            </div>
            <footer>
              <small>Updated {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(document.updatedAt))}</small>
            </footer>
          </Card>
        ))}
      </section>
      {!visibleDocuments.length ? (
        <Card className="rm-document-empty" tone="transparent">
          <Icon name="file" size={26} />
          <h2>No documents yet</h2>
          <p>Create an editable note or upload any company file.</p>
          <Button icon="plus" onClick={openNewDocument}>Create document</Button>
        </Card>
      ) : null}

      <Modal onClose={() => setPreviewDocument(null)} open={Boolean(previewDocument)} title={previewDocument?.title ?? 'Document preview'} wide>
        {previewDocument ? (
          <div className="rm-document-preview">
            <p>Updated {new Date(previewDocument.updatedAt).toLocaleDateString()} · {documentKinds.find((kind) => kind.value === previewDocument.kind)?.label ?? previewDocument.kind}</p>
            {previewDocument.contentHtml ? (
              <iframe
                title={`${previewDocument.title} content`}
                sandbox=""
                srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'"><style>body{font:16px/1.6 system-ui;color:#191b22;padding:16px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style>${previewDocument.contentHtml}`}
              />
            ) : !previewDocument.fileUrl ? <p>No content has been added.</p> : null}
            {previewDocument.fileUrl ? (
              <div className="rm-task-attachment-preview">
                {previewDocument.mimeType?.startsWith('image/') ? <img alt={previewDocument.fileName ?? previewDocument.title} src={previewDocument.fileUrl} />
                  : previewDocument.mimeType === 'application/pdf' ? <iframe title={previewDocument.fileName ?? previewDocument.title} src={previewDocument.fileUrl} />
                    : <p>This file type opens in its own viewer.</p>}
                <a href={previewDocument.fileUrl} target="_blank" rel="noreferrer">Open {previewDocument.fileName ?? 'attached file'}</a>
              </div>
            ) : null}
            <footer className="rm-dialog-actions">
              <Button variant="secondary" onClick={() => setPreviewDocument(null)}>Close</Button>
              {onSaveDocument ? <Button onClick={() => { openDocumentWithAssignment(previewDocument); setPreviewDocument(null); }}>Edit document</Button> : null}
            </footer>
          </div>
        ) : null}
      </Modal>

      <Modal
        onClose={closeDocumentForm}
        open={Boolean(documentForm)}
        title={documentForm?.documentId ? 'Edit document' : 'New document'}
        wide
      >
        {documentForm ? (
          <form className="rm-document-form" onSubmit={saveDocument}>
            <label className="rm-field">
              <span>Document type</span>
              <select
                onChange={(event) => {
                  const kind = event.target.value as CompanyDocumentKind;
                  setDocumentForm((current) => current ? {
                    ...current,
                    callerList: kind === 'sales' ? current.callerList : '',
                    kind,
                    salesDocumentType: kind === 'sales' ? current.salesDocumentType ?? 'general' : undefined,
                  } : current);
                  if (kind !== 'sop') setSopAssigneeDraft([]);
                }}
                value={documentKindValue(documentForm.kind)}
              >
                {documentKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
              </select>
            </label>
            <label className="rm-field">
              <span>Folder</span>
              <select onChange={(event) => setDocumentFolderDraft(event.target.value)} value={documentFolderDraft}>
                <option value="">No folder</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder, folders)}</option>)}
              </select>
            </label>
            {documentForm.kind === 'sales' ? (
              <>
                <label className="rm-field">
                  <span>Sales document type</span>
                  <select
                    onChange={(event) => setDocumentForm((current) => current ? {
                      ...current,
                      callerList: event.target.value === 'script' ? current.callerList : '',
                      salesDocumentType: event.target.value as SalesDocumentType,
                    } : current)}
                    value={documentForm.salesDocumentType ?? 'general'}
                  >
                    {salesDocumentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                {documentForm.salesDocumentType === 'script' ? (
                  <label className="rm-field">
                    <span>Show this script in Caller for</span>
                    <select onChange={(event) => setDocumentForm((current) => current ? { ...current, callerList: event.target.value } : current)} required value={documentForm.callerList ?? ''}>
                      <option value="">Choose a lead list</option>
                      <option value="all">All leads</option>
                      {leadLists.map((list) => <option key={list} value={list}>{list}</option>)}
                    </select>
                    {!leadLists.length ? <small>Import a named lead list to assign a list-specific script.</small> : null}
                  </label>
                ) : null}
              </>
            ) : null}
            {documentForm.kind === 'sop' ? (
              <div className="rm-field">
                <span>Assigned to</span>
                <div className="rm-event-assignee-picker">
                  {members.filter((member) => member.role === 'team_member' && member.status === 'active').map((member) => {
                    const checked = sopAssigneeDraft.includes(member.userId);
                    return (
                      <label className="rm-event-assignee-option" key={member.userId}>
                        <input
                          checked={checked}
                          onChange={() => setSopAssigneeDraft((current) => checked
                            ? current.filter((userId) => userId !== member.userId)
                            : [...current, member.userId])}
                          type="checkbox"
                        />
                        <span>{member.name}</span>
                      </label>
                    );
                  })}
                </div>
                {!members.some((member) => member.role === 'team_member' && member.status === 'active')
                  ? <small>Add an active team member before assigning this SOP.</small>
                  : null}
              </div>
            ) : null}
            <label className="rm-field">
              <span>Title</span>
              <input
                autoFocus
                onChange={(event) => setDocumentForm((current) => current ? { ...current, title: event.target.value } : current)}
                required
                value={documentForm.title}
              />
            </label>
            <RichTextEditor
              label="Document text"
              onChange={(contentHtml) =>
                setDocumentForm((current) =>
                  current ? { ...current, contentHtml } : current)}
              placeholder={documentForm.salesDocumentType === 'script' ? 'Write the caller script here. Paragraphs and line breaks are kept in Caller…' : 'Write the document here…'}
              resetKey={documentForm.documentId ?? 'new'}
              value={documentForm.contentHtml}
            />
            <label className="rm-upload-document-button">
              <input
                onChange={(event) => setDocumentForm((current) => current ? {
                  ...current,
                  file: event.target.files?.[0] ?? null,
                  removeFile: false,
                } : current)}
                type="file"
              />
              <Icon name="paperclip" size={18} />
              <span>{documentForm.file ? 'Replace attached file' : 'Upload document'}</span>
            </label>
            {(() => {
              const existingFile = documentForm.documentId && !documentForm.file && !documentForm.removeFile
                ? documents.find((document) => document.id === documentForm.documentId)
                : undefined;
              const attachmentName = documentForm.file?.name ?? existingFile?.fileName;
              const attachmentUrl = documentForm.file ? undefined : existingFile?.fileUrl;
              if (!attachmentName) return null;
              return (
                <div className="rm-document-form__attachment">
                  <span>
                    <Icon name="paperclip" size={18} />
                    <span><small>Attached file</small><strong>{attachmentName}</strong></span>
                  </span>
                  <div>
                    {attachmentUrl ? <a href={attachmentUrl} rel="noreferrer" target="_blank">Open</a> : null}
                    <IconButton
                      icon="x"
                      label={`Remove ${attachmentName}`}
                      onClick={() => setDocumentForm((current) => current ? {
                        ...current,
                        file: null,
                        removeFile: Boolean(current.documentId && !current.file),
                      } : current)}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })()}
            <footer className="rm-dialog-actions">
              {documentForm.documentId && onArchiveDocument ? <Button disabled={saving} onClick={() => { setDocumentForm(null); setArchiveTarget({ id: documentForm.documentId!, kind: 'document', label: documentForm.title }); }} variant="secondary">Delete</Button> : null}
              <Button disabled={saving} onClick={closeDocumentForm} variant="secondary">Cancel</Button>
              <Button disabled={saving || !documentForm.title.trim() || (documentForm.kind === 'sales' && documentForm.salesDocumentType === 'script' && !documentForm.callerList)} type="submit">{saving ? 'Saving…' : 'Save document'}</Button>
            </footer>
          </form>
        ) : null}
      </Modal>

      <Modal
        onClose={() => setFolderForm(null)}
        open={Boolean(folderForm)}
        title={folderForm?.id ? (isRo ? 'Editează folderul' : 'Edit folder') : (isRo ? 'Folder nou' : 'New folder')}
      >
        {folderForm ? (
          <form className="rm-profile-form" onSubmit={saveFolder}>
            <label className="rm-field">
              <span>{isRo ? 'Nume folder' : 'Folder name'}</span>
              <input
                autoFocus
                onChange={(event) => setFolderForm((current) => current ? { ...current, name: event.target.value } : current)}
                required
                value={folderForm.name}
              />
            </label>
            <footer className="rm-dialog-actions">
              {folderForm.id && onDeleteFolder ? (
                <Button disabled={saving} onClick={() => void deleteFolder()} variant="secondary">
                  {isRo ? 'Șterge folderul' : 'Delete folder'}
                </Button>
              ) : null}
              <Button disabled={saving} onClick={() => setFolderForm(null)} variant="secondary">Cancel</Button>
              <Button disabled={saving || !folderForm.name.trim()} type="submit">Save folder</Button>
            </footer>
          </form>
        ) : null}
      </Modal>

      <ArchiveConfirmModal
        busy={saving}
        label={archiveTarget?.kind ?? 'record'}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void archiveRecord()}
        open={Boolean(archiveTarget)}
      />
    </div>
  );
}
