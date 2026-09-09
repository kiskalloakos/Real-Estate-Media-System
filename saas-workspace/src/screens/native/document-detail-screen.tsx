import {
  Linking,
  StyleSheet,
  View,
} from 'react-native';

import {
  NativeCard,
  NativeButton,
  NativeEmptyState,
  NativeScreen,
  NativeSection,
  NativeSymbol,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import type { CompanyDocumentSummary } from '@/screens/web/types';

import {
  documentDate,
  documentKindLabel,
  plainDocumentText,
} from './document-utils';
import { DocumentContent } from './document-content';

export interface DocumentDetailNativeScreenProps extends NativeAsyncScreenProps {
  document?: CompanyDocumentSummary;
}

export function DocumentDetailNativeScreen({
  document,
  errorMessage,
  loading,
  onRefresh,
  onRetry,
  refreshing,
}: DocumentDetailNativeScreenProps) {
  const isNote = document?.kind === 'note';
  const content = plainDocumentText(document?.contentHtml);

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={isNote ? 'Loading note' : 'Loading document'}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
    >
      {document ? (
        <>
          <NativeSection title={isNote ? 'Note details' : 'Document details'}>
            <NativeCard style={styles.documentCard}>
              <View style={styles.metadata}>
                <View style={styles.symbolWell}>
                  <NativeSymbol
                    color={nativeColors.accent}
                    name={isNote ? 'note.text' : 'doc.text'}
                    size={20}
                  />
                </View>
                <View style={styles.metadataCopy}>
                  <Text selectable style={styles.kind}>
                    {documentKindLabel(document.kind)}
                  </Text>
                  <Text selectable style={styles.date}>
                    Updated {documentDate(document.updatedAt)}
                  </Text>
                </View>
              </View>

              <Text selectable style={styles.title}>
                {document.title}
              </Text>

              {content ? (
                <DocumentContent content={document.contentHtml} />
              ) : (
                <Text selectable style={styles.emptyBody}>
                  {isNote
                    ? 'This note has no written content.'
                    : 'This document has no written content.'}
                </Text>
              )}
            </NativeCard>
          </NativeSection>

          {document.fileUrl ? (
            <NativeSection
              caption={document.fileName ?? 'Attached file'}
              title="Attachment"
            >
              <NativeCard style={styles.attachmentCard}>
                <NativeSymbol
                  color={nativeColors.accent}
                  name="paperclip"
                  size={22}
                />
                <View style={styles.attachmentCopy}>
                  <Text selectable style={styles.attachmentName}>
                    {document.fileName ?? 'Open attachment'}
                  </Text>
                  {document.mimeType ? (
                    <Text selectable style={styles.attachmentType}>
                      {document.mimeType}
                    </Text>
                  ) : null}
                </View>
                <NativeButton
                  label="Open"
                  onPress={() => void Linking.openURL(document.fileUrl as string)}
                  style={styles.openButton}
                />
              </NativeCard>
            </NativeSection>
          ) : null}
        </>
      ) : !loading && !errorMessage ? (
        <NativeEmptyState
          message="This item may have been archived or removed."
          symbol="doc.questionmark"
          title={isNote ? 'Note not found' : 'Document not found'}
        />
      ) : null}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  attachmentCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  attachmentCopy: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    color: nativeColors.label,
    fontSize: 15,
    fontWeight: '600',
  },
  attachmentType: {
    color: nativeColors.secondaryLabel,
    fontSize: 12,
  },
  openButton: {
    minWidth: 76,
  },
  date: {
    color: nativeColors.tertiaryLabel,
    fontSize: 12,
  },
  documentCard: {
    gap: 18,
    padding: 18,
  },
  emptyBody: {
    color: nativeColors.tertiaryLabel,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  kind: {
    color: nativeColors.secondaryLabel,
    fontSize: 14,
    fontWeight: '600',
  },
  metadata: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  metadataCopy: {
    flex: 1,
    gap: 2,
  },
  symbolWell: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  title: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
  },
});
