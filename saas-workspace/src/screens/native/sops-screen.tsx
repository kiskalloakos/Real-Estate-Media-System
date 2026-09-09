import { Fragment } from 'react';
import { Linking, StyleSheet } from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import type { CompanyDocumentSummary } from '@/screens/web/types';

export interface SopsNativeScreenProps extends NativeAsyncScreenProps {
  documents?: readonly CompanyDocumentSummary[];
  onPressDocument?: (document: CompanyDocumentSummary) => void;
}

function plainText(value?: string) {
  return value?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function SopsNativeScreen({
  documents = [],
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  onPressDocument,
}: SopsNativeScreenProps) {
  const sops = documents.filter((document) => document.kind === 'sop');

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel="Loading SOPs"
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      <NativeSection title="SOPs">
        {sops.length ? (
          <NativeCard>
            {sops.map((document, index) => (
              <Fragment key={document.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  detail={document.fileName ?? 'Standard operating procedure'}
                  onPress={
                    onPressDocument
                      ? () => onPressDocument(document)
                      : document.fileUrl
                        ? () => void Linking.openURL(document.fileUrl!)
                        : undefined
                  }
                  showChevron={Boolean(onPressDocument || document.fileUrl)}
                  subtitle={plainText(document.contentHtml) ?? 'Open this SOP from your team workspace.'}
                  symbol="doc.text"
                  symbolColor={nativeColors.accent}
                  title={document.title}
                />
              </Fragment>
            ))}
          </NativeCard>
        ) : (
          <NativeCard style={styles.emptyCard}>
            <NativeEmptyState
              message="Your assigned standard operating procedures will appear here."
              symbol="doc.text"
              title="No SOPs assigned yet"
            />
          </NativeCard>
        )}
      </NativeSection>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    minHeight: 280,
  },
});
