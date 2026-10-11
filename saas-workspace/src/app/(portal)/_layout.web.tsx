import React from 'react';
import { Redirect } from 'expo-router';

import { usePortalData } from '@/hooks/use-portal-data';
import {
  createClientMember,
  createTeamMember,
  sendTeamMemberPasswordReset,
  updateClientMemberAccess,
  updateTeamMemberAccess,
} from '@/lib/access-management-service';
import { createClientWorkspace } from '@/lib/admin-client-service';
import { createJob } from '@/lib/job-service';
import {
  archiveAgencyLead,
  deleteAgencyLeadList,
  archiveCompanyCredential,
  archiveCompanyDocument,
  deleteCompanyDocumentFolder,
  archiveMarketingContent,
  importAgencyLeads,
  moveCompanyDocumentToFolder,
  upsertAgencyLead,
  upsertCompanyCredential,
  upsertCompanyDocument,
  upsertCompanyDocumentFolder,
  upsertMarketingContent,
} from '@/lib/owner-workspace-service';
import { setPropertyTeamAssignments } from '@/lib/property-assignment-service';
import {
  addReviewComment,
  archiveCalendarEvent,
  archiveFinanceDebt,
  archiveClientWorkspace,
  archiveDeliverable,
  archivePaymentScheduleItem,
  archivePropertyWorkspace,
  archiveRecurringCost,
  archiveServiceAgreement,
  archiveWorkspaceTask,
  clearCompletedWorkspaceTasks,
  deleteContractDocument,
  deleteTaskAttachment,
  createCalendarEvent,
  createFinanceDebt,
  createFinanceMoneyMovement,
  createGearItem,
  createPaymentScheduleItem,
  createProperty,
  createRecurringCost,
  createWorkspaceNote,
  createWorkspaceTask,
  markPaymentScheduleItemPaid,
  recordFinanceDebtPayment,
  recordReviewDecision,
  restoreWorkspaceTask,
  toggleRecurringCostPaid,
  transferGearItem,
  upsertFinanceAccount,
  updateFinanceMoneyMovement,
  updateFinanceDebt,
  updateGearItem,
  updateCalendarEvent,
  updateDeliverable,
  updateContractDeliverableStatus,
  updateClientAccount,
  updateClientTeam,
  updatePaymentScheduleItem,
  updatePropertyWorkspace,
  updateRecurringCost,
  updateServiceAgreement,
  updateWorkspaceTask,
  uploadDeliverable,
} from '@/lib/portal-action-service';
import { useApp } from '@/providers/app-provider';
import {
  PortalApp,
  type CreateClientInput,
  type PortalActionHandlers,
  type PortalData,
} from '@/screens/web';

const emptyPortalData: PortalData = {
  agencyMembers: [],
  agreements: [],
  archivedTasks: [],
  calendarEvents: [],
  clientMembers: [],
  clients: [],
  companyCredentials: [],
  companyDocuments: [],
  costs: [],
  debts: [],
  financeMoneyMovements: [],
  financeAccounts: [],
  gear: [],
  gearHistory: [],
  leads: [],
  marketingContent: [],
  jobs: [],
  notes: [],
  payments: [],
  properties: [],
  propertyAssignments: [],
  reviews: [],
  tiktokAccounts: [],
  tasks: [],
};

export default function PortalWebLayout() {
  const { authReady, identity, isPreview, selectWorkspace, signOut, updateProfile, workspaces } = useApp();
  const portalData = usePortalData({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
  });
  const { refetch: refetchPortalData } = portalData;

  const createClient = React.useCallback(
    async (input: CreateClientInput) => {
      if (isPreview) {
        return;
      }

      if (!identity || identity.role !== 'admin' || !identity.agencyId) {
        throw new Error('Only a Realty Media owner can create client accounts.');
      }

      await createClientWorkspace(input, {
        adminUserId: identity.userId,
        agencyId: identity.agencyId,
      });
      await portalData.refetch();
    },
    [identity, isPreview, portalData],
  );

  const mutate = React.useCallback(
    async <Result,>(
      mutation: (context: { agencyId: string; userId: string }) => Promise<Result>,
      waitForRefresh = true,
    ) => {
      if (isPreview) {
        throw new Error('Preview mode is read-only. Sign in to save Realty Media data.');
      }
      if (!identity?.agencyId) {
        throw new Error('Your Realty Media workspace is not ready yet.');
      }

      const result = await mutation({ agencyId: identity.agencyId, userId: identity.userId });
      if (waitForRefresh) {
        await portalData.refetch();
      } else {
        // The event write is already confirmed. Refresh the surrounding
        // workspace in the background so its editor can close immediately.
        void portalData.refetch();
      }
      return result;
    },
    [identity, isPreview, portalData],
  );

  const actions = React.useMemo<PortalActionHandlers>(
    () => ({
      archiveAgreement: (agreementId) =>
        mutate(() => archiveServiceAgreement(agreementId)),
      archiveClient: (clientId) =>
        mutate(() => archiveClientWorkspace(clientId)),
      archiveEvent: (eventId) =>
        mutate(() => archiveCalendarEvent(eventId)),
      archivePayment: (paymentId) =>
        mutate(() => archivePaymentScheduleItem(paymentId)),
      archiveProperty: (propertyId) =>
        mutate(() => archivePropertyWorkspace(propertyId)),
      archiveRecurringCost: (costId) =>
        mutate(async () => archiveRecurringCost(costId)),
      archiveDebt: (debtId) =>
        mutate((context) => archiveFinanceDebt(debtId, context)),
      archiveTask: (taskId) =>
        mutate(() => archiveWorkspaceTask(taskId)),
      restoreTask: (taskId) =>
        mutate(() => restoreWorkspaceTask(taskId)),
      archiveCompanyCredential: (credentialId) =>
        mutate((context) => archiveCompanyCredential(credentialId, context)),
      archiveCompanyDocument: (documentId) =>
        mutate(() => archiveCompanyDocument(documentId)),
      deleteCompanyDocumentFolder: (folderId) =>
        mutate(() => deleteCompanyDocumentFolder(folderId)),
      archiveDeliverable: (mediaAssetId) =>
        mutate(() => archiveDeliverable(mediaAssetId)),
      deleteContractDocument: (input) =>
        mutate(() => deleteContractDocument(input)),
      deleteTaskAttachment: (attachmentId) =>
        mutate(() => deleteTaskAttachment(attachmentId)),
      archiveLead: (leadId) =>
        mutate(() => archiveAgencyLead(leadId)),
      deleteLeadList: (sourceList) =>
        mutate((context) => deleteAgencyLeadList(sourceList, context)),
      archiveMarketingContent: (contentId) =>
        mutate(() => archiveMarketingContent(contentId)),
      clearCompletedTasks: () =>
        mutate((context) => clearCompletedWorkspaceTasks(context)),
      createCost: (input) =>
        mutate((context) => createRecurringCost(input, context)),
      createDebt: (input) =>
        mutate((context) => createFinanceDebt(input, context)),
      createEvent: (input) =>
        mutate((context) => createCalendarEvent(input, context)),
      createGear: (input) =>
        mutate((context) => createGearItem(input, context)),
      createJob: (input) =>
        mutate(async (context) => { await createJob(input, context); }),
      createMoneyMovement: (input) =>
        mutate((context) => createFinanceMoneyMovement(input, context)),
      updateFinanceMoneyMovement: (input) =>
        mutate((context) => updateFinanceMoneyMovement(input, context)),
      updateDebt: (input) =>
        mutate((context) => updateFinanceDebt(input, context)),
      upsertFinanceAccount: (input) =>
        mutate((context) => upsertFinanceAccount(input, context)),
      createClientMember: (input) =>
        mutate(async (context) => {
          await createClientMember(input, context);
        }),
      createNote: (input) =>
        mutate((context) => createWorkspaceNote(input, context)),
      createPayment: (input) =>
        mutate((context) => createPaymentScheduleItem(input, context)),
      createProperty: (input) =>
        mutate((context) => createProperty(input, context)),
      createTeamMember: (input) =>
        mutate(async (context) => {
          await createTeamMember(input, context);
        }),
      sendTeamMemberPasswordReset: (email) =>
        mutate((context) => sendTeamMemberPasswordReset(email, context), false),
      createTask: (input) =>
        mutate((context) => createWorkspaceTask(input, context)),
      importLeads: (input) =>
        mutate((context) => importAgencyLeads(input, context)),
      markPaymentPaid: (paymentId) =>
        mutate((context) => markPaymentScheduleItemPaid(paymentId, context)),
      recordDebtPayment: (debtId, amount, note) =>
        mutate((context) => recordFinanceDebtPayment(debtId, amount, note, context)),
      reviewComment: (reviewId, body, timestamp) =>
        mutate((context) => addReviewComment(reviewId, body, timestamp, context)),
      reviewDecision: (reviewId, decision) =>
        mutate((context) => recordReviewDecision(reviewId, decision, context)),
      toggleRecurringCost: (costId, paid) =>
        mutate((context) => toggleRecurringCostPaid(costId, paid, context)),
      updateRecurringCost: (input) =>
        mutate((context) => updateRecurringCost(input, context)),
      transferGear: (input) =>
        mutate((context) => transferGearItem(input, context)),
      updateGear: (input) =>
        mutate(() => updateGearItem(input)),
      updateClientMemberAccess: (input) =>
        mutate(() => updateClientMemberAccess(input)),
      updateAgreement: (input) =>
        mutate(() => updateServiceAgreement(input)),
      updateClient: (input) =>
        mutate((context) => updateClientAccount(input, context)),
      updateClientTeam: (input) =>
        mutate(() => updateClientTeam(input)),
      updateEvent: (input) =>
        mutate(() => updateCalendarEvent(input), false),
      updateDeliverable: (input) =>
        mutate(() => updateDeliverable(input)),
      updateContractDeliverableStatus: (input) =>
        mutate((context) => updateContractDeliverableStatus(input, context)),
      updatePayment: (input) =>
        mutate(() => updatePaymentScheduleItem(input)),
      updateProfile: async (input) => {
        if (isPreview) {
          throw new Error('Preview mode is read-only. Sign in to update your profile.');
        }
        const result = await updateProfile(input);
        if (result.error) throw new Error(result.error);
        await refetchPortalData();
      },
      updatePropertyAssignments: (input) =>
        mutate((context) => setPropertyTeamAssignments(input, context)),
      updateProperty: (input) =>
        mutate(() => updatePropertyWorkspace(input)),
      updateTeamMemberAccess: (input) =>
        mutate((context) => updateTeamMemberAccess(input, context)),
      updateTask: (input) =>
        mutate((context) => updateWorkspaceTask(input, context)),
      moveCompanyDocumentToFolder: (input) =>
        mutate(() => moveCompanyDocumentToFolder(input)),
      upsertCompanyCredential: (input) =>
        mutate((context) => upsertCompanyCredential(input, context)),
      upsertCompanyDocument: (input) =>
        mutate((context) => upsertCompanyDocument(input, context)),
      upsertCompanyDocumentFolder: (input) =>
        mutate((context) => upsertCompanyDocumentFolder(input, context)),
      upsertLead: (input) =>
        mutate((context) => upsertAgencyLead(input, context)),
      upsertMarketingContent: (input) =>
        mutate((context) => upsertMarketingContent(input, context)),
      uploadDeliverable: (input) =>
        mutate((context) => uploadDeliverable(input, context)),
    }),
    [isPreview, mutate, refetchPortalData, updateProfile],
  );

  if (authReady && !identity) {
    return null;
  }

  if (!identity) {
    return null;
  }

  if (!isPreview && identity.mustResetPassword) {
    return <Redirect href="/reset-password" />;
  }

  const data = isPreview ? undefined : (portalData.data ?? emptyPortalData);

  return (
    <>
      <PortalApp
        actions={actions}
        agencyId={identity.agencyId}
        clientAccountId={identity.clientAccountId}
        clientRole={identity.clientRole}
        currentUserId={identity.userId}
        data={data}
        onCreateClient={identity.role === 'admin' ? createClient : undefined}
        onSignOut={() => void signOut()}
        role={identity.role}
        organizationName={workspaces.find((workspace) => workspace.agencyId === identity.agencyId)?.name}
        workspaces={workspaces}
        onSelectWorkspace={(agencyId) => void selectWorkspace(agencyId)}
        user={{
          avatarUrl: identity.avatarUrl ?? undefined,
          email: identity.email,
          locale: identity.locale,
          name: identity.displayName,
          phone: identity.phone ?? undefined,
        }}
      />
      {!isPreview && (portalData.isLoading || portalData.error) ? (
        <div
          role={portalData.error ? 'alert' : 'status'}
          style={{
            background: portalData.error ? '#5256E0' : '#000000',
            border: '1px solid #EEEEEE',
            borderRadius: 999,
            bottom: 24,
            color: '#EEEEEE',
            fontFamily: 'OutfitRegular',
            fontSize: 14,
            left: '50%',
            padding: '10px 16px',
            position: 'fixed',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          {portalData.error
            ? `Live data could not load: ${portalData.error.message}`
            : 'Loading the live Realty Media workspace…'}
        </div>
      ) : null}
    </>
  );
}
