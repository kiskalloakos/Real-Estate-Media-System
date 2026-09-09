import { Stack, useRouter } from 'expo-router';

import { NativeEmptyState, NativeScreen } from '@/components/native';
import {
  archivePreviewCompanyDocument,
  deletePreviewCompanyDocumentFolder,
  upsertPreviewCompanyDocument,
  upsertPreviewCompanyDocumentFolder,
  useNativePreviewPortalData,
} from '@/lib/native-preview-store';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePortalData } from '@/hooks/use-portal-data';
import { useApp } from '@/providers/app-provider';
import {
  createFinanceMoneyMovement,
  updateFinanceMoneyMovement,
  upsertFinanceAccount,
} from '@/lib/portal-action-service';
import {
  MoreDestinationNativeScreen,
  canOpenMoreDestination,
  moreDestinationTitles,
  type MoreDestination,
} from '@/screens/native';
import {
  archiveCompanyDocument,
  deleteCompanyDocumentFolder,
  upsertCompanyDocument,
  upsertCompanyDocumentFolder,
} from '@/lib/owner-workspace-service';

interface FixedMoreDestinationRouteProps {
  destination: Extract<MoreDestination, 'documents' | 'finance' | 'tasks'>;
  taskEditorHref?:
    | '/(portal)/(more)/task/new'
    | '/(portal)/(tasks)/task/new';
  taskPreviewHref?:
    | '/(portal)/(more)/task/[taskId]'
    | '/(portal)/(tasks)/task/[taskId]';
}

export function FixedMoreDestinationRoute({
  destination,
  taskEditorHref = '/(portal)/(more)/task/new',
  taskPreviewHref = '/(portal)/(more)/task/[taskId]',
}: FixedMoreDestinationRouteProps) {
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const query = usePortalData({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
  });
  const previewData = useNativePreviewPortalData();
  const manualRefresh = useManualRefresh(query.refetch);

  if (!identity) {
    return null;
  }

  if (!canOpenMoreDestination(identity.role, destination)) {
    return (
      <>
        <NativeScreen>
          <NativeEmptyState
            message="This page is not available for your account."
            symbol="lock"
            title="Access unavailable"
          />
        </NativeScreen>
        <Stack.Title>{moreDestinationTitles[destination]}</Stack.Title>
      </>
    );
  }

  return (
    <>
      <MoreDestinationNativeScreen
        clientAccountId={identity.clientAccountId}
        data={isPreview ? previewData : query.data}
        destination={destination}
        errorMessage={query.error?.message}
        loading={!isPreview && query.isLoading}
        role={identity.role}
        currentUserId={isPreview && identity.role === 'admin' ? 'demo-akos' : identity.userId}
        onSaveAccount={
          identity.role === 'admin' && !isPreview
            ? async (input) => {
                if (!identity.agencyId) throw new Error('Your Realty Media workspace is not ready yet.');
                await upsertFinanceAccount(input, { agencyId: identity.agencyId, userId: identity.userId });
                await manualRefresh.refresh();
              }
            : undefined
        }
        onSaveMovement={
          identity.role === 'admin' && !isPreview
            ? async (input) => {
                if (!identity.agencyId) throw new Error('Your Realty Media workspace is not ready yet.');
                const context = { agencyId: identity.agencyId, userId: identity.userId };
                if ('movementId' in input && input.movementId) {
                  await updateFinanceMoneyMovement(input, context);
                } else {
                  await createFinanceMoneyMovement(input, context);
                }
                await manualRefresh.refresh();
              }
            : undefined
        }
        onPressClient={(client) =>
          router.push({
            pathname: '/(portal)/(more)/client/[clientId]',
            params: { clientId: client.id },
          })
        }
        onPressDocument={(document) =>
          router.push({
            pathname: '/(portal)/(more)/document/[documentId]',
            params: { documentId: document.id },
          })
        }
        onArchiveDocument={
          destination === 'documents' && identity.role === 'admin'
            ? async (documentId) => {
                if (isPreview) {
                  archivePreviewCompanyDocument(documentId);
                  return;
                }
                await archiveCompanyDocument(documentId);
                await manualRefresh.refresh();
              }
            : undefined
        }
        onDeleteDocumentFolder={
          destination === 'documents' && identity.role === 'admin'
            ? async (folderId) => {
                if (isPreview) {
                  deletePreviewCompanyDocumentFolder(folderId);
                  return;
                }
                await deleteCompanyDocumentFolder(folderId);
                await manualRefresh.refresh();
              }
            : undefined
        }
        onSaveDocument={
          destination === 'documents' && identity.role === 'admin'
            ? async (input) => {
                if (isPreview) return upsertPreviewCompanyDocument(input);
                if (!identity.agencyId) throw new Error('Your Realty Media workspace is not ready yet.');
                const documentId = await upsertCompanyDocument(input, {
                  agencyId: identity.agencyId,
                  userId: identity.userId,
                });
                await manualRefresh.refresh();
                return documentId;
              }
            : undefined
        }
        onSaveDocumentFolder={
          destination === 'documents' && identity.role === 'admin'
            ? async (input) => {
                if (isPreview) return upsertPreviewCompanyDocumentFolder(input);
                if (!identity.agencyId) throw new Error('Your Realty Media workspace is not ready yet.');
                const folderId = await upsertCompanyDocumentFolder(input, {
                  agencyId: identity.agencyId,
                  userId: identity.userId,
                });
                await manualRefresh.refresh();
                return folderId;
              }
            : undefined
        }
        onPressTask={
          identity.role === 'admin' || identity.role === 'team_member'
            ? (task) =>
                router.push({
                  pathname: taskPreviewHref,
                  params: { taskId: task.id },
                })
            : undefined
        }
        previewTasks={isPreview ? previewData.tasks : undefined}
        onRefresh={() => void manualRefresh.refresh()}
        onRetry={() => void manualRefresh.refresh()}
        refreshing={!isPreview && manualRefresh.refreshing}
      />
      <Stack.Title>{moreDestinationTitles[destination]}</Stack.Title>
      {destination === 'tasks' && (identity.role === 'admin' || identity.role === 'team_member') ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Create task"
            icon="plus"
            onPress={() => router.push(taskEditorHref)}
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
