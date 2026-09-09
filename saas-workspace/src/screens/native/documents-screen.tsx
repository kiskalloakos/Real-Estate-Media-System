import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import { useNativeChoice } from '@/components/native/native-choice';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { Stack } from 'expo-router';
import {
  Alert,
  Linking,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useReducedMotion,
} from 'react-native-reanimated';
import React, { Fragment, useState } from 'react';

import {
  NativeButton,
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import type {
  CompanyDocumentFolderSummary,
  CompanyDocumentKind,
  CompanyDocumentSummary,
  PortalData,
  UpsertCompanyDocumentFolderInput,
  UpsertDocumentInput,
} from '@/screens/web/types';

import { DocumentContent } from './document-content';
import { plainDocumentText } from './document-utils';

type DocumentForm = UpsertDocumentInput & {
  existingFileName?: string;
  existingFileUrl?: string;
};

const documentKinds: { label: string; value: CompanyDocumentKind }[] = [
  { label: 'Company file', value: 'company_file' },
  { label: 'SOP', value: 'sop' },
  { label: 'Sales document', value: 'sales' },
];

function kindLabel(kind: CompanyDocumentKind) {
  return documentKinds.find((item) => item.value === kind)?.label ?? 'Document';
}

function documentDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}


export interface DocumentsNativeScreenProps extends NativeAsyncScreenProps {
  data?: PortalData;
  onArchiveDocument?: (documentId: string) => Promise<void>;
  onDeleteFolder?: (folderId: string) => Promise<void>;
  onSaveDocument?: (input: UpsertDocumentInput) => Promise<string | void>;
  onSaveFolder?: (input: UpsertCompanyDocumentFolderInput) => Promise<string | void>;
}

export function DocumentsNativeScreen({
  data,
  errorMessage,
  loading,
  onArchiveDocument,
  onDeleteFolder,
  onRefresh,
  onRetry,
  onSaveDocument,
  onSaveFolder,
  refreshing,
}: DocumentsNativeScreenProps) {
  const toolbarIcon = useToolbarIcons();
  const choose = useNativeChoice();
  const folders = (data?.companyDocumentFolders ?? []).filter(
    (folder) => folder.scope === 'documents',
  );
  const documents = (data?.companyDocuments ?? []).filter(
    (document) => document.kind !== 'note',
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentForm | null>(null);
  const [folderName, setFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<CompanyDocumentFolderSummary | null>(null);
  const [folderEditorOpen, setFolderEditorOpen] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedFileName, setPickedFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [navigationDirection, setNavigationDirection] = useState<'back' | 'forward'>('forward');
  const reducedMotion = useReducedMotion();

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId);
  const visibleDocuments = selectedFolderId
    ? documents.filter((document) => document.folderId === selectedFolderId)
    : documents.filter((document) => !document.folderId);

  const openFolder = (folderId: string) => {
    setError('');
    setNavigationDirection('forward');
    setSelectedFolderId(folderId);
    setSelectedDocumentId(null);
    setDocumentForm(null);
    setFolderEditorOpen(false);
  };

  const closeFolder = () => {
    setNavigationDirection('back');
    setSelectedFolderId(null);
    setSelectedDocumentId(null);
    setDocumentForm(null);
    setFolderEditorOpen(false);
  };

  const openNewDocument = () => {
    setError('');
    setNavigationDirection('forward');
    setSelectedDocumentId(null);
    setFolderEditorOpen(false);
    setPickedFile(null);
    setPickedFileName('');
    setDocumentForm({
      assigneeUserIds: [],
      contentHtml: '',
      file: null,
      folderId: selectedFolderId,
      kind: 'company_file',
      title: '',
    });
  };

  const openDocument = (document: CompanyDocumentSummary) => {
    setError('');
    setNavigationDirection('forward');
    setSelectedDocumentId(document.id);
    setDocumentForm(null);
    setFolderEditorOpen(false);
  };

  const openDocumentEditor = (document: CompanyDocumentSummary) => {
    setError('');
    setNavigationDirection('forward');
    setPickedFile(null);
    setPickedFileName('');
    setDocumentForm({
      assigneeUserIds: document.assigneeUserIds ?? [],
      contentHtml: document.contentHtml ?? '',
      documentId: document.id,
      existingFileName: document.fileName,
      existingFileUrl: document.fileUrl,
      file: null,
      folderId: document.folderId,
      kind: document.kind,
      removeFile: false,
      salesDocumentType: document.salesDocumentType,
      title: document.title,
    });
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPickedFile(new ExpoFile(asset.uri) as unknown as File);
    setPickedFileName(asset.name);
    setDocumentForm((current) => current ? { ...current, removeFile: false } : current);
  };

  const saveDocument = async () => {
    if (!documentForm || !onSaveDocument) return;
    if (!documentForm.title.trim()) {
      setError('Add a document title before saving.');
      return;
    }
    if (!documentForm.documentId && !documentForm.contentHtml.trim() && !pickedFile) {
      setError('Write something or attach a file.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const savedDocumentId = await onSaveDocument({
        ...documentForm,
        file: pickedFile,
        folderId: documentForm.folderId || null,
      });
      setNavigationDirection('back');
      setDocumentForm(null);
      setPickedFile(null);
      setPickedFileName('');
      const nextDocumentId = savedDocumentId ?? documentForm.documentId;
      if (nextDocumentId) setSelectedDocumentId(String(nextDocumentId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the document.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = () => {
    if (!documentForm?.documentId || !onArchiveDocument) return;
    Alert.alert(
      'Delete document?',
      `“${documentForm.title}” will be removed from the workspace.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSaving(true);
            void onArchiveDocument(documentForm.documentId!)
              .then(() => {
                setNavigationDirection('back');
                setDocumentForm(null);
                setSelectedDocumentId(null);
              })
              .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not delete the document.'))
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  const saveFolder = async () => {
    if (!onSaveFolder || !folderName.trim()) {
      setError('Add a folder name before saving.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input: UpsertCompanyDocumentFolderInput = {
        folderId: editingFolder?.id,
        name: folderName.trim(),
        scope: 'documents',
      };
      const folderId = await onSaveFolder(input);
      if (!editingFolder && folderId) setSelectedFolderId(String(folderId));
      setFolderEditorOpen(false);
      setEditingFolder(null);
      setFolderName('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the folder.');
    } finally {
      setSaving(false);
    }
  };

  const deleteFolder = () => {
    if (!editingFolder || !onDeleteFolder) return;
    Alert.alert(
      'Delete folder?',
      `Documents in “${editingFolder.name}” will stay saved without a folder.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSaving(true);
            void onDeleteFolder(editingFolder.id)
              .then(() => {
                setSelectedFolderId(null);
                setSelectedDocumentId(null);
                setFolderEditorOpen(false);
                setEditingFolder(null);
              })
              .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not delete the folder.'))
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  const openNewFolder = () => {
    setError('');
    setEditingFolder(null);
    setFolderName('');
    setFolderEditorOpen(true);
  };

  const openEditFolder = (folder: CompanyDocumentFolderSummary) => {
    setError('');
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderEditorOpen(true);
  };

  const chooseDocumentKind = () => {
    choose('Document type', documentKinds, (kind) => {
      if (kind) setDocumentForm((current) => current ? {
        ...current,
        assigneeUserIds: kind === 'sop' ? current.assigneeUserIds ?? [] : [],
        kind,
      } : current);
    });
  };

  const chooseDocumentFolder = () => {
    choose(
      'Folder',
      [{ label: 'No folder', value: null }, ...folders.map((folder) => ({ label: folder.name, value: folder.id }))],
      (folderId) => setDocumentForm((current) => current ? { ...current, folderId } : current),
    );
  };

  const renderDocumentList = (
    title: string,
    caption: string | undefined,
    items: CompanyDocumentSummary[],
  ) => {
    const content = items.length ? (
      <NativeCard>
        {items.map((document, index) => (
          <Fragment key={document.id}>
            {index ? <NativeSeparator inset={60} /> : null}
            <NativeListRow
              detail={`${kindLabel(document.kind)} · ${documentDate(document.updatedAt)}`}
              onPress={() => openDocument(document)}
              showChevron
              subtitle={plainDocumentText(document.contentHtml) || document.fileName || 'Open document'}
              symbol={document.fileUrl ? 'doc.badge.arrow.up' : 'doc.text'}
              title={document.title}
            />
          </Fragment>
        ))}
      </NativeCard>
    ) : (
      <NativeCard>
        <NativeEmptyState
          actionLabel="Create document"
          compact
          message="Create an editable note or attach a company file."
          onAction={openNewDocument}
          symbol="folder"
          title="No documents yet"
        />
      </NativeCard>
    );

    return title ? (
      <NativeSection
        actionLabel="New document"
        caption={caption}
        onPressAction={openNewDocument}
        title={title}
      >
        {content}
      </NativeSection>
    ) : content;
  };

  const renderFolderEditor = () => folderEditorOpen ? (
    <NativeSection title={editingFolder ? 'Edit folder' : 'New folder'}>
      <NativeCard style={styles.formCard}>
        <TextInput
          autoFocus
          onChangeText={setFolderName}
          placeholder="Folder name"
          placeholderTextColor={nativeColors.tertiaryLabel}
          style={styles.input}
          value={folderName}
        />
        <View style={styles.formActions}>
          {editingFolder && onDeleteFolder ? (
            <NativeButton label="Delete" onPress={deleteFolder} variant="secondary" />
          ) : null}
          <NativeButton label="Cancel" onPress={() => setFolderEditorOpen(false)} variant="secondary" />
          <NativeButton label="Save folder" loading={saving} onPress={() => void saveFolder()} />
        </View>
      </NativeCard>
    </NativeSection>
  ) : null;

  const renderDocumentEditor = (form: DocumentForm) => (
    <NativeSection title={form.documentId ? 'Edit document' : 'New document'}>
      <NativeCard style={styles.formCard}>
        <TextInput
          autoFocus={!form.documentId}
          onChangeText={(title) => setDocumentForm((current) => current ? { ...current, title } : current)}
          placeholder="Document title"
          placeholderTextColor={nativeColors.tertiaryLabel}
          style={styles.input}
          value={form.title}
        />
        <NativeListRow
          detail={kindLabel(form.kind)}
          onPress={chooseDocumentKind}
          symbol="doc.text"
          title="Type"
        />
        {form.kind === 'sop' ? (
          <View style={styles.assigneePicker}>
            <Text style={styles.assigneeLabel}>Assigned to</Text>
            <View style={styles.assigneePills}>
              {(data?.agencyMembers ?? [])
                .filter((member) => member.role === 'team_member' && member.status === 'active')
                .map((member) => {
                  const selected = form.assigneeUserIds?.includes(member.userId) ?? false;
                  return (
                    <NativeButton
                      key={member.userId}
                      label={member.name}
                      onPress={() => setDocumentForm((current) => current ? ({
                        ...current,
                        assigneeUserIds: selected
                          ? (current.assigneeUserIds ?? []).filter((userId) => userId !== member.userId)
                          : [...(current.assigneeUserIds ?? []), member.userId],
                      }) : current)}
                      variant={selected ? 'primary' : 'secondary'}
                    />
                  );
                })}
            </View>
          </View>
        ) : null}
        <NativeSeparator inset={60} />
        <NativeListRow
          detail={folders.find((folder) => folder.id === form.folderId)?.name ?? 'No folder'}
          onPress={chooseDocumentFolder}
          symbol="folder"
          title="Folder"
        />
        <NativeSeparator inset={60} />
        <TextInput
          multiline
          onChangeText={(contentHtml) => setDocumentForm((current) => current ? { ...current, contentHtml } : current)}
          placeholder="Write the document here…"
          placeholderTextColor={nativeColors.tertiaryLabel}
          style={[styles.input, styles.contentInput]}
          textAlignVertical="top"
          value={form.contentHtml}
        />
        {form.existingFileName && !pickedFile && !form.removeFile ? (
          <View style={styles.attachment}>
            <Text selectable style={styles.attachmentName}>{form.existingFileName}</Text>
            {form.existingFileUrl ? (
              <NativeButton label="Open" onPress={() => void Linking.openURL(form.existingFileUrl!)} variant="ghost" />
            ) : null}
            <NativeButton
              label="Remove"
              onPress={() => setDocumentForm((current) => current ? { ...current, removeFile: true } : current)}
              variant="ghost"
            />
          </View>
        ) : null}
        {pickedFileName ? <Text selectable style={styles.fileName}>Selected: {pickedFileName}</Text> : null}
        <NativeButton label="Attach file" onPress={() => void pickFile()} variant="secondary" />
        <View style={styles.formActions}>
          {form.documentId && onArchiveDocument ? (
            <NativeButton label="Delete" onPress={deleteDocument} variant="secondary" />
          ) : null}
          <NativeButton
            label="Cancel"
            onPress={() => {
              setNavigationDirection('back');
              setDocumentForm(null);
              if (form.documentId) setSelectedDocumentId(form.documentId);
            }}
            variant="secondary"
          />
          <NativeButton label="Save document" loading={saving} onPress={() => void saveDocument()} />
        </View>
      </NativeCard>
    </NativeSection>
  );

  const goBack = () => {
    setNavigationDirection('back');
    if (documentForm) {
      const documentId = documentForm.documentId;
      setDocumentForm(null);
      setPickedFile(null);
      setPickedFileName('');
      if (documentId) setSelectedDocumentId(documentId);
      return;
    }
    if (selectedDocumentId) {
      setSelectedDocumentId(null);
      return;
    }
    closeFolder();
  };

  const showBackButton = Boolean(selectedFolderId || selectedDocumentId || documentForm);
  const showFolderActions = Boolean(selectedFolder && !folderEditorOpen && !documentForm && !selectedDocument);
  const showDocumentActions = Boolean(selectedDocument && !documentForm);
  const showRootActions = Boolean(
    !selectedFolder && !selectedDocument && !documentForm && !folderEditorOpen,
  );

  const documentViewKey = documentForm
    ? `edit:${documentForm.documentId ?? 'new'}`
    : selectedDocument
      ? `document:${selectedDocument.id}`
      : selectedFolder
        ? `folder:${selectedFolder.id}`
        : 'folders';
  const enterAnimation = reducedMotion
    ? (navigationDirection === 'forward' ? FadeInRight.duration(120) : FadeInLeft.duration(120))
    : navigationDirection === 'forward'
      ? FadeInRight.duration(240)
      : FadeInLeft.duration(240);
  const exitAnimation = reducedMotion
    ? (navigationDirection === 'forward' ? FadeOutLeft.duration(90) : FadeOutRight.duration(90))
    : navigationDirection === 'forward'
      ? FadeOutLeft.duration(180)
      : FadeOutRight.duration(180);

  return (
    <>
      <NativeScreen
        automaticallyAdjustKeyboardInsets
        errorMessage={errorMessage}
        loading={loading}
        loadingLabel="Loading documents"
        onRefresh={onRefresh}
        onRetry={onRetry}
        refreshing={refreshing}
        supportsWideLayout
      >
        {error ? <Text selectable style={styles.error}>{error}</Text> : null}

      <Animated.View
        entering={enterAnimation}
        exiting={exitAnimation}
        key={documentViewKey}
      >
      {documentForm ? renderDocumentEditor(documentForm) : selectedDocument ? (
        <>
          <NativeSection
            caption={`${kindLabel(selectedDocument.kind)} · ${documentDate(selectedDocument.updatedAt)}`}
            title={selectedDocument.title}
          >
            <NativeCard style={styles.previewCard}>
              {plainDocumentText(selectedDocument.contentHtml) ? (
                <DocumentContent content={selectedDocument.contentHtml} />
              ) : (
                <NativeEmptyState
                  compact
                  message="This document has no written content."
                  symbol="doc.text"
                  title="File attachment"
                />
              )}
              {selectedDocument.fileName ? (
                <View style={styles.attachment}>
                  <Text selectable style={styles.attachmentName}>{selectedDocument.fileName}</Text>
                  {selectedDocument.fileUrl ? (
                    <NativeButton
                      label="Open file"
                      onPress={() => void Linking.openURL(selectedDocument.fileUrl!)}
                      variant="ghost"
                    />
                  ) : null}
                </View>
              ) : null}
            </NativeCard>
          </NativeSection>
        </>
      ) : selectedFolder ? (
        <>
          <NativeSection title={selectedFolder.name} />
          {renderFolderEditor()}
          {renderDocumentList('', undefined, visibleDocuments)}
        </>
      ) : (
        <>
          <NativeSection actionLabel="New folder" onPressAction={openNewFolder} title="Folders">
            {folders.length ? (
              <NativeCard>
                {folders.map((folder, index) => (
                  <Fragment key={folder.id}>
                    {index ? <NativeSeparator inset={60} /> : null}
                    <NativeListRow
                      detail={`${documents.filter((document) => document.folderId === folder.id).length} document${documents.filter((document) => document.folderId === folder.id).length === 1 ? '' : 's'}`}
                      onPress={() => openFolder(folder.id)}
                      showChevron
                      symbol="folder.fill"
                      title={folder.name}
                    />
                  </Fragment>
                ))}
              </NativeCard>
            ) : (
              <NativeCard>
                <NativeEmptyState
                  actionLabel="Create folder"
                  compact
                  message="Organize company files, SOPs, and sales documents into folders."
                  onAction={openNewFolder}
                  symbol="folder"
                  title="No folders yet"
                />
              </NativeCard>
            )}
          </NativeSection>
          {renderFolderEditor()}
          <View style={styles.unfiledSection}>
            {renderDocumentList('Unfiled documents', 'Documents that are not in a folder', visibleDocuments)}
          </View>
        </>
      )}
        </Animated.View>
      </NativeScreen>
      {showBackButton ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel={documentForm ? 'Close editor' : selectedDocument ? 'Back to folder' : 'Back to folders'}
            icon={toolbarIcon('chevron.left')}
            onPress={goBack}
          />
        </Stack.Toolbar>
      ) : null}
      {showFolderActions ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Edit folder"
            icon={toolbarIcon('pencil')}
            onPress={() => openEditFolder(selectedFolder!)}
          />
          <Stack.Toolbar.Button
            accessibilityLabel="New document"
            icon={toolbarIcon('plus')}
            onPress={openNewDocument}
          />
        </Stack.Toolbar>
      ) : null}
      {showDocumentActions ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Edit document"
            icon={toolbarIcon('pencil')}
            onPress={() => openDocumentEditor(selectedDocument!)}
          />
        </Stack.Toolbar>
      ) : null}
      {showRootActions ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="New document"
            icon={toolbarIcon('plus')}
            onPress={openNewDocument}
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  assigneeLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    fontWeight: '600',
  },
  assigneePicker: {
    gap: 8,
  },
  assigneePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachment: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  attachmentName: {
    color: nativeColors.label,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  contentInput: {
    minHeight: 150,
    paddingTop: 14,
  },
  previewCard: {
    gap: 16,
    padding: 20,
  },
  unfiledSection: {
    paddingTop: 20,
  },
  error: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 14,
    color: nativeColors.critical,
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
  },
  fileName: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  formCard: {
    gap: 12,
    padding: 16,
  },
  input: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 14,
    color: nativeColors.label,
    fontFamily: 'OutfitRegular',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
