import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import { NativeEmptyState, NativeScreen } from '@/components/native';
import { NotificationCenterRoute } from '@/components/native/notification-center-route';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePortalData } from '@/hooks/use-portal-data';
import {
  archivePreviewCompanyDocument,
  deletePreviewCompanyDocumentFolder,
  upsertPreviewCompanyDocument,
  upsertPreviewCompanyDocumentFolder,
  useNativePreviewPortalData,
} from '@/lib/native-preview-store';
import {
  archiveCompanyDocument,
  deleteCompanyDocumentFolder,
  upsertCompanyDocument,
  upsertCompanyDocumentFolder,
} from '@/lib/owner-workspace-service';
import {
  createFinanceMoneyMovement,
  updateFinanceMoneyMovement,
  upsertFinanceAccount,
} from '@/lib/portal-action-service';
import { useApp } from '@/providers/app-provider';
import {
  MoreDestinationNativeScreen,
  ProfileSettingsNativeScreen,
  canOpenMoreDestination,
  isMoreDestination,
  moreDestinationTitles,
} from '@/screens/native';
import { nativeText } from '@/lib/native-i18n';

export default function MoreDestinationRoute() {
  const toolbarIcon = useToolbarIcons();
  const router = useRouter();
  const params = useLocalSearchParams<{ destination: string | string[] }>();
  const {
    identity,
    isPreview,
    updateProfile,
  } = useApp();
  const query = usePortalData({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
  });
  const previewData = useNativePreviewPortalData();
  const manualRefresh = useManualRefresh(query.refetch);
  const destinationValue = Array.isArray(params.destination)
    ? params.destination[0]
    : params.destination;
  const destination =
    destinationValue && isMoreDestination(destinationValue)
      ? destinationValue
      : null;

  if (!identity) {
    return null;
  }

  if (!destination || !canOpenMoreDestination(identity.role, destination)) {
    return (
      <>
        <NativeScreen>
          <NativeEmptyState
            message="This page is not available for your account."
            symbol="lock"
            title="Access unavailable"
          />
        </NativeScreen>
        <Stack.Title>More</Stack.Title>
      </>
    );
  }

  if (destination === 'profile') {
    return (
      <>
        <ProfileSettingsNativeScreen
          avatarUrl={identity.avatarUrl}
          displayName={identity.displayName}
          email={identity.email}
          locale={identity.locale}
          onSave={(input) =>
            updateProfile({
              avatarFile: null,
              fullName: input.fullName,
              locale: input.locale,
              phone: input.phone,
            })
          }
          phone={identity.phone}
        />
        <Stack.Title>{destination === 'profile' ? nativeText(identity.locale, 'profile') : moreDestinationTitles[destination]}</Stack.Title>
      </>
    );
  }

  if (destination === 'notifications') {
    return <NotificationCenterRoute />;
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
        onPressGear={
          identity.role === 'admin' && !isPreview
            ? (item) =>
                router.push({
                  pathname: '/(portal)/(more)/gear/edit',
                  params: { gearId: item.id },
                })
            : undefined
        }
        onPressTask={
          identity.role === 'admin' || identity.role === 'team_member'
            ? (task) =>
                router.push({
                  pathname: '/(portal)/(more)/task/[taskId]',
                  params: { taskId: task.id },
                })
            : undefined
        }
        onArchiveDocument={
          identity.role === 'admin'
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
          identity.role === 'admin'
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
          identity.role === 'admin'
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
          identity.role === 'admin'
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
            icon={toolbarIcon('plus')}
            onPress={() => router.push('/(portal)/(more)/task/new')}
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
