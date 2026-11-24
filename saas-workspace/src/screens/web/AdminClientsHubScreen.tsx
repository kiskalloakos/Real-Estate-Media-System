import { ClientsScreen } from './ClientsScreen';
import type { PortalLocation } from '@/lib/portal-location';
import type {
  CreateClientInput,
  ClientSummary,
  PortalActionHandlers,
  PortalData,
} from './types';

export interface AdminClientsHubScreenProps {
  onOpenProject?: (jobId: string) => void;
  onManageProjects?: () => void;
  actions?: PortalActionHandlers;
  currentUserId?: string;
  data?: PortalData;
  selectedClientId?: string | null;
  projectLocation?: PortalLocation;
  onProjectLocationChange?: (changes: Partial<PortalLocation>) => void;
  onClientSelectionChange?: (id: string | null) => void;
  onCreateClient?: (client: CreateClientInput) => void | Promise<void>;
  onOpenProductionCalendar?: (eventId: string) => void;
  onOpenReview?: (reviewId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenWorkspace?: (client: ClientSummary) => void;
}

export function AdminClientsHubScreen({
  onOpenProject,
  onManageProjects,
  actions,
  currentUserId,
  data,
  selectedClientId,
  projectLocation,
  onProjectLocationChange,
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
        payments={data?.payments}
        projectWorkspace
        projectLocation={projectLocation}
        onProjectLocationChange={onProjectLocationChange}
        actions={actions}
        archivedTasks={data?.archivedTasks}
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
        onOpenProject={onOpenProject}
        onManageProjects={onManageProjects}
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
