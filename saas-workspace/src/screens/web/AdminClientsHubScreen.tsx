import { ClientsScreen } from './ClientsScreen';
import type {
  CreateClientInput,
  ClientSummary,
  PortalActionHandlers,
  PortalData,
} from './types';

export interface AdminClientsHubScreenProps {
  actions?: PortalActionHandlers;
  currentUserId?: string;
  data?: PortalData;
  selectedClientId?: string | null;
  onClientSelectionChange?: (id: string | null) => void;
  onCreateClient?: (client: CreateClientInput) => void | Promise<void>;
  onOpenProductionCalendar?: (eventId: string) => void;
  onOpenReview?: (reviewId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenWorkspace?: (client: ClientSummary) => void;
}

export function AdminClientsHubScreen({
  actions,
  currentUserId,
  data,
  selectedClientId,
  onClientSelectionChange,
  onCreateClient,
  onOpenProductionCalendar,
  onOpenReview,
  onOpenTask,
  onOpenWorkspace,
}: AdminClientsHubScreenProps) {
  return (
    <div className="rm-page rm-hub-page">
      <ClientsScreen
        accounts={data?.instagramAccounts}
        agreements={data?.agreements}
        agencyMembers={data?.agencyMembers}
        clientMembers={data?.clientMembers}
        clients={data?.clients}
        calendarEvents={data?.calendarEvents}
        currentUserId={currentUserId}
        jobs={data?.jobs}
        selectedClientId={selectedClientId}
        onClientSelectionChange={onClientSelectionChange}
        onArchiveClient={actions?.archiveClient}
        onArchiveDeliverable={actions?.archiveDeliverable}
        onArchiveProperty={actions?.archiveProperty}
        onDeleteContractDocument={actions?.deleteContractDocument}
        onCreateClient={onCreateClient}
        onCreateClientMember={actions?.createClientMember}
        onCreateEvent={actions?.createEvent}
        onCreateJob={actions?.createJob}
        onCreateProperty={actions?.createProperty}
        onCreateTask={actions?.createTask}
        onOpenProductionCalendar={onOpenProductionCalendar}
        onOpenReview={onOpenReview}
        onOpenTask={onOpenTask}
        onOpenWorkspace={onOpenWorkspace}
        onUploadDeliverable={actions?.uploadDeliverable}
        properties={data?.properties}
        reviews={data?.reviews}
        onUpdateClient={actions?.updateClient}
        onUpdateContractDeliverableStatus={actions?.updateContractDeliverableStatus}
        onUpdateClientTeam={actions?.updateClientTeam}
        onUpdateClientMember={actions?.updateClientMemberAccess}
        onUpdateProperty={actions?.updateProperty}
        tasks={data?.tasks}
      />
    </div>
  );
}
