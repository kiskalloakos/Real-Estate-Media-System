import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import {
  Button,
  Card,
  Icon,
  Modal,
  RichTextEditor,
  useToast,
} from '@/components/web';

import type {
  CompanyDocumentFolderSummary,
  CompanyDocumentSummary,
  MoveCompanyDocumentToFolderInput,
  UpsertCompanyDocumentFolderInput,
  UpsertDocumentInput,
} from './types';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import { clearLocalDraft, readLocalDraft, useLocalDraft } from '@/hooks/use-local-draft';

export interface DashboardNotesScreenProps {
  folders?: CompanyDocumentFolderSummary[];
  locale?: 'en' | 'ro';
  notes?: CompanyDocumentSummary[];
  onArchiveNote?: (noteId: string) => Promise<void>;
  onDeleteFolder?: (folderId: string) => Promise<void>;
  onMoveNoteToFolder?: (input: MoveCompanyDocumentToFolderInput) => Promise<void>;
  onSaveFolder?: (input: UpsertCompanyDocumentFolderInput) => Promise<string | void>;
  onSaveNote?: (input: UpsertDocumentInput) => Promise<string | void>;
  variant?: 'notes' | 'offers';
}

const emptyDocument = (kind: 'note' | 'sales'): UpsertDocumentInput => ({
  contentHtml: '',
  file: null,
  kind,
  title: '',
});

const emptyFolder = { name: '' };
const legacyNoteFoldersKey = 'rm:note-folders';
const legacyNoteFolderAssignmentsKey = 'rm:note-folder-assignments';
const legacyNoteFoldersMigratedKey = 'rm:note-folders:supabase-migrated';

function plainText(html = '') {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const element = document.createElement('div');
  element.innerHTML = html;
  return element.textContent?.trim() ?? '';
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
export function DashboardNotesScreen({
  folders: allFolders = [],
  locale = 'en',
  notes = [],
  onArchiveNote,
  onDeleteFolder,
  onMoveNoteToFolder,
  onSaveFolder,
  onSaveNote,
  variant = 'notes',
}: DashboardNotesScreenProps) {
  const isOffers = variant === 'offers';
  const isRo = locale === 'ro';
  const documentKind = isOffers ? 'sales' : 'note';
  const copy = isOffers ? {
    archiveLabel: 'offer',
    contentLabel: 'Offer content',
    create: 'Create offer',
    created: 'Offer created.',
    deleted: 'Offer deleted.',
    edit: 'Edit offer',
    emptyBody: 'Write an offer or attach a file.',
    emptyTitle: 'No offers yet',
    internalFallback: 'Internal offer',
    listLabel: 'Our offers',
    new: 'New offer',
    save: 'Save offer',
    updated: 'Offer updated.',
  } : {
    archiveLabel: 'note',
    contentLabel: isRo ? 'Conținutul notei' : 'Note content',
    create: isRo ? 'Creează o notă' : 'Create note',
    created: isRo ? 'Nota a fost creată.' : 'Note created.',
    deleted: isRo ? 'Nota a fost ștearsă.' : 'Note deleted.',
    edit: isRo ? 'Editează nota' : 'Edit note',
    emptyBody: isRo ? 'Scrie o notă internă sau atașează un fișier.' : 'Write an internal note or attach a file.',
    emptyTitle: isRo ? 'Nu există note încă' : 'No notes yet',
    internalFallback: isRo ? 'Notă internă' : 'Internal note',
    listLabel: isRo ? 'Note interne' : 'Internal notes',
    new: isRo ? 'Notă nouă' : 'New note',
    save: isRo ? 'Salvează nota' : 'Save note',
    updated: isRo ? 'Nota a fost actualizată.' : 'Note updated.',
  };
  const { notify } = useToast();
  const [noteForm, setNoteForm] = useState<UpsertDocumentInput | null>(null);
  const [folderForm, setFolderForm] = useState<(Partial<CompanyDocumentFolderSummary> & { name: string }) | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CompanyDocumentSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [noteFolderDraft, setNoteFolderDraft] = useState('');
  const legacyFolderMigrationStarted = useRef(false);
  const draftKey = isOffers ? 'rm:draft:offer' : 'rm:draft:note';
  const noteEditorKey = noteForm ? noteForm.documentId ?? 'new' : 'closed';
  const noteEditorHtml = noteForm?.contentHtml ?? '';
  useLocalDraft(draftKey, noteForm, Boolean(noteForm && !noteForm.documentId), (draft) => Boolean(draft?.title.trim() || plainText(draft?.contentHtml)));

  const folders = allFolders.filter((folder) => folder.scope === 'notes');
  const selectedFolder = !isOffers
    ? folders.find((folder) => folder.id === selectedFolderId)
    : undefined;
  const selectedParentFolder = selectedFolder?.parentFolderId
    ? folders.find((folder) => folder.id === selectedFolder.parentFolderId)
    : undefined;
  const visibleFolders = folders.filter((folder) =>
    selectedFolder
      ? folder.parentFolderId === selectedFolder.id
      : isRootFolder(folder));
  const folderIds = new Set(folders.map((folder) => folder.id));
  const visibleNotes = isOffers
    ? notes
    : selectedFolder
      ? notes.filter((note) => note.folderId === selectedFolder.id)
      : notes.filter((note) => !note.folderId || !folderIds.has(note.folderId));
  const folderNoteCounts = folders.reduce<Record<string, number>>((counts, folder) => {
    counts[folder.id] = notes.filter((note) => note.folderId === folder.id).length;
    return counts;
  }, {});
  const folderChildCounts = folders.reduce<Record<string, number>>((counts, folder) => {
    counts[folder.id] = folders.filter((child) => child.parentFolderId === folder.id).length;
    return counts;
  }, {});

  useEffect(() => {
    if (
      isOffers ||
      legacyFolderMigrationStarted.current ||
      !onSaveFolder ||
      typeof window === 'undefined' ||
      window.localStorage.getItem(legacyNoteFoldersMigratedKey)
    ) {
      return;
    }

    const legacyFolders = readLegacyJson<{ id: string; name: string }[]>(legacyNoteFoldersKey, [])
      .filter((folder) => folder.id && folder.name?.trim());
    if (!legacyFolders.length) return;

    legacyFolderMigrationStarted.current = true;
    const legacyAssignments = readLegacyJson<Record<string, string>>(legacyNoteFolderAssignmentsKey, {});
    const noteIds = new Set(notes.map((note) => note.id));

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
              scope: 'notes',
            });
          if (folderId) folderIdMap.set(legacyFolder.id, folderId);
        }

        if (onMoveNoteToFolder) {
          for (const [noteId, legacyFolderId] of Object.entries(legacyAssignments)) {
            const folderId = folderIdMap.get(legacyFolderId);
            if (folderId && noteIds.has(noteId)) {
              await onMoveNoteToFolder({ documentId: noteId, folderId });
            }
          }
        }

        window.localStorage.setItem(legacyNoteFoldersMigratedKey, new Date().toISOString());
        notify('Existing note folders were synced.');
      } catch (error) {
        legacyFolderMigrationStarted.current = false;
        console.warn('Could not migrate local note folders to Supabase.', error);
      }
    })();
  }, [folders, isOffers, notes, notify, onMoveNoteToFolder, onSaveFolder]);

  const openNewNote = () => {
    setNoteFolderDraft(selectedFolder?.id ?? '');
    setNoteForm(
      readLocalDraft<UpsertDocumentInput>(draftKey) ?? emptyDocument(documentKind),
    );
  };
  const openNewFolder = () => {
    setFolderForm({ ...emptyFolder, parentFolderId: selectedFolder?.id });
  };
  const closeNote = () => {
    if (saving) return;
    if (noteForm && (noteForm.title.trim() || plainText(noteForm.contentHtml)) && !window.confirm(`Close this ${copy.archiveLabel}? Your draft will remain saved.`)) return;
    setNoteForm(null);
    setNoteFolderDraft('');
  };

  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteForm || !onSaveNote) return;
    setSaving(true);
    try {
      await onSaveNote({
        ...noteForm,
        folderId: noteFolderDraft || null,
        kind: documentKind,
      });
      notify(noteForm.documentId ? copy.updated : copy.created);
      clearLocalDraft(draftKey);
      setNoteForm(null);
      setNoteFolderDraft('');
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : `Could not save the ${copy.archiveLabel}.`,
        'error',
      );
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
        scope: 'notes',
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
    if (!window.confirm(`Delete "${folderForm.name}"? Notes inside it will stay saved and move back to All notes.`)) return;
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

  const moveNoteToFolder = async (input: MoveCompanyDocumentToFolderInput) => {
    if (!onMoveNoteToFolder) return;
    try {
      await onMoveNoteToFolder(input);
      notify('Note moved.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not move the note.', 'error');
    }
  };

  const archiveNote = async () => {
    if (!archiveTarget || !onArchiveNote) return;
    setSaving(true);
    try {
      await onArchiveNote(archiveTarget.id);
      notify(copy.deleted);
      setArchiveTarget(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : `Could not delete the ${copy.archiveLabel}.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openNote = (note: CompanyDocumentSummary) => setNoteForm({
    contentHtml: note.contentHtml ?? '',
    documentId: note.id,
    file: null,
    kind: documentKind,
    title: note.title,
  });
  const openNoteWithFolder = (note: CompanyDocumentSummary) => {
    setNoteFolderDraft(note.folderId ?? '');
    openNote(note);
  };
  const handleNoteCardKeyDown = (event: KeyboardEvent<HTMLElement>, note: CompanyDocumentSummary) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openNoteWithFolder(note);
  };

  return (
    <div className="rm-page rm-dashboard-notes">
      {isOffers || !selectedFolder ? (
        <div className="rm-dashboard-notes__actions">
          {!isOffers ? (
            <Button icon="folder" onClick={openNewFolder} variant="secondary">
              {isRo ? 'Folder nou' : 'New folder'}
            </Button>
          ) : null}
          <Button icon="plus" onClick={openNewNote}>
            {copy.new}
          </Button>
        </div>
      ) : null}

      {!isOffers && selectedFolder ? (
        <div className="rm-folder-viewbar">
          <Button icon="chevron-left" onClick={() => setSelectedFolderId(selectedParentFolder?.id ?? null)} variant="secondary">
            {selectedParentFolder?.name ?? (isRo ? 'Toate notele' : 'All notes')}
          </Button>
          <strong>{folderPath(selectedFolder, folders)}</strong>
          <div>
            <Button icon="dots" onClick={() => setFolderForm(selectedFolder)} variant="secondary">
              {isRo ? 'Editează folderul' : 'Edit folder'}
            </Button>
            <Button icon="folder" onClick={openNewFolder} variant="secondary">
              {isRo ? 'Folder nou' : 'New folder'}
            </Button>
            <Button icon="plus" onClick={openNewNote}>
              {copy.new}
            </Button>
          </div>
        </div>
      ) : !isOffers && visibleFolders.length ? (
        <section className="rm-folder-grid" aria-label={isRo ? 'Foldere note' : 'Note folders'}>
          {visibleFolders.map((folder) => (
            <Card
              aria-label={`Open ${folder.name}`}
              className={`rm-folder-card${draggedNoteId ? ' is-drop-ready' : ''}`}
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              onDragOver={(event) => {
                if (!draggedNoteId) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggedNoteId) return;
                void moveNoteToFolder({ documentId: draggedNoteId, folderId: folder.id });
                setDraggedNoteId(null);
              }}
              role="button"
              tabIndex={0}
              tone="bright"
            >
              <span><Icon name="folder" size={18} /></span>
              <strong>{folder.name}</strong>
              <small>
                {folderNoteCounts[folder.id] ?? 0} notes
                {folderChildCounts[folder.id] ? ` · ${folderChildCounts[folder.id]} folders` : ''}
              </small>
            </Card>
          ))}
        </section>
      ) : null}

      {!isOffers && selectedFolder && visibleFolders.length ? (
        <section className="rm-folder-grid" aria-label={isRo ? 'Subfoldere note' : 'Nested note folders'}>
          {visibleFolders.map((folder) => (
            <Card
              aria-label={`Open ${folder.name}`}
              className={`rm-folder-card${draggedNoteId ? ' is-drop-ready' : ''}`}
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              onDragOver={(event) => {
                if (!draggedNoteId) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggedNoteId) return;
                void moveNoteToFolder({ documentId: draggedNoteId, folderId: folder.id });
                setDraggedNoteId(null);
              }}
              role="button"
              tabIndex={0}
              tone="bright"
            >
              <span><Icon name="folder" size={18} /></span>
              <strong>{folder.name}</strong>
              <small>
                {folderNoteCounts[folder.id] ?? 0} notes
                {folderChildCounts[folder.id] ? ` · ${folderChildCounts[folder.id]} folders` : ''}
              </small>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="rm-document-grid" aria-label={copy.listLabel}>
        {visibleNotes.map((note) => (
          <Card
            aria-grabbed={!isOffers && draggedNoteId === note.id}
            aria-label={`${isRo ? 'Editează' : 'Edit'} ${note.title}`}
            className={`rm-document-card rm-document-card--editable${!isOffers && draggedNoteId === note.id ? ' is-dragging' : ''}`}
            draggable={!isOffers}
            key={note.id}
            onClick={() => openNoteWithFolder(note)}
            onDragEnd={() => setDraggedNoteId(null)}
            onDragStart={(event) => {
              if (isOffers) return;
              setDraggedNoteId(note.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', note.id);
            }}
            onKeyDown={(event) => handleNoteCardKeyDown(event, note)}
            role="button"
            tabIndex={0}
            tone="bright"
          >
            <div className="rm-document-card__top">
              <span><Icon name={note.fileUrl ? 'paperclip' : 'message'} size={19} /></span>
            </div>
            <div>
              <h3>{note.title}</h3>
              <p>
                {plainText(note.contentHtml).slice(0, 180)
                  || note.fileName
                  || copy.internalFallback}
              </p>
            </div>
            <footer>
              <small>
                {isRo ? 'Actualizată' : 'Updated'}{' '}
                {new Intl.DateTimeFormat(isRo ? 'ro-RO' : 'en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(note.updatedAt))}
              </small>
            </footer>
          </Card>
        ))}
      </section>

      {!visibleNotes.length ? (
        <Card className="rm-document-empty" tone="transparent">
          <Icon name="message" size={26} />
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
          <Button icon="plus" onClick={openNewNote}>
            {copy.create}
          </Button>
        </Card>
      ) : null}

      <Modal
        onClose={closeNote}
        open={Boolean(noteForm)}
        title={noteForm?.documentId
          ? copy.edit
          : copy.new}
        wide
      >
        {noteForm ? (
          <form className="rm-document-form" onSubmit={saveNote}>
            <label className="rm-field">
              <span>{isRo ? 'Titlu' : 'Title'}</span>
              <input
                autoFocus
                onChange={(event) => {
                  const title = event.currentTarget.value;
                  setNoteForm((current) =>
                    current ? { ...current, title } : current);
                }}
                required
                value={noteForm.title}
              />
            </label>
            {!isOffers ? (
              <label className="rm-field">
                <span>{isRo ? 'Folder' : 'Folder'}</span>
                <select onChange={(event) => setNoteFolderDraft(event.target.value)} value={noteFolderDraft}>
                  <option value="">{isRo ? 'Fără folder' : 'No folder'}</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder, folders)}</option>)}
                </select>
              </label>
            ) : null}
            <RichTextEditor
              label={copy.contentLabel}
              onChange={(contentHtml) =>
                setNoteForm((current) =>
                  current ? { ...current, contentHtml } : current)}
              placeholder={isRo ? 'Începe să scrii…' : 'Start writing…'}
              resetKey={noteEditorKey}
              value={noteEditorHtml}
            />
            <label className="rm-upload-tile">
              <input
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  setNoteForm((current) =>
                    current ? { ...current, file } : current);
                }}
                type="file"
              />
              <span className="rm-upload-tile__icon"><Icon name="paperclip" size={21} /></span>
              <strong>
                {noteForm.file?.name ?? (isRo ? 'Alege un fișier' : 'Choose a file')}
              </strong>
            </label>
            <footer className="rm-dialog-actions">
              {noteForm.documentId && onArchiveNote ? <Button disabled={saving} onClick={() => { const note = visibleNotes.find((item) => item.id === noteForm.documentId); if (note) { setNoteForm(null); setArchiveTarget(note); } }} variant="secondary">{isRo ? 'Șterge' : 'Delete'}</Button> : null}
              <Button
                disabled={saving}
                onClick={closeNote}
                variant="secondary"
              >
                {isRo ? 'Anulează' : 'Cancel'}
              </Button>
              <Button disabled={saving || !noteForm.title.trim()} type="submit">
                {saving
                  ? (isRo ? 'Se salvează…' : 'Saving…')
                  : copy.save}
              </Button>
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
              <Button disabled={saving} onClick={() => setFolderForm(null)} variant="secondary">
                {isRo ? 'Anulează' : 'Cancel'}
              </Button>
              <Button disabled={saving || !folderForm.name.trim()} type="submit">
                {isRo ? 'Salvează folderul' : 'Save folder'}
              </Button>
            </footer>
          </form>
        ) : null}
      </Modal>

      <ArchiveConfirmModal
        busy={saving}
        label={copy.archiveLabel}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void archiveNote()}
        open={Boolean(archiveTarget)}
      />
    </div>
  );
}
