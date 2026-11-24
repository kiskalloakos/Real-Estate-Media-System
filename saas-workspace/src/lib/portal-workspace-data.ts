import type {AgencyMemberSummary,ClientMemberSummary,PortalData} from '@/screens/web/types';

export function teamMemberWorkspaceData(
  data: PortalData | undefined,
  member: AgencyMemberSummary | undefined,
): PortalData | undefined {
  if (!data || !member) return data;

  const properties = (data.properties ?? []).filter((property) =>
    property.assignedTeamUserIds.includes(member.userId),
  );
  const propertyIds = new Set(properties.map((property) => property.id));

  const clientIds = new Set(properties.map((property) => property.clientId));

  return {
    agencyMembers: data.agencyMembers,
    jobs: data.jobs,
    agreements: [],
    calendarEvents: (data.calendarEvents ?? []).filter(
      (event) => event.visibility !== 'admin_only' && (event.visibility === 'team' || event.createdByUserId === member.userId || event.assigneeUserIds?.includes(member.userId) || Boolean(event.propertyId && propertyIds.has(event.propertyId))),
    ),
    clientMembers: [],
    clients: (data.clients ?? []).filter((client) => clientIds.has(client.id)),
    companyDocumentFolders: data.companyDocumentFolders,
    companyDocuments: data.companyDocuments,
    costs: [],
    debts: [],
    financeMoneyMovements: [],
    financeAccounts: [],
    gear: [],
    gearHistory: [],
    instagramAccounts: [],
    tiktokAccounts: [],
    notes: (data.notes ?? []).filter((note) => note.visibility === 'team'),
    payments: [],
    properties,
    propertyAssignments: (data.propertyAssignments ?? []).filter(
      (assignment) => assignment.userId === member.userId,
    ),
    reviews: (data.reviews ?? []).filter((review) =>
      review.createdByUserId === member.userId || Boolean(review.propertyId && propertyIds.has(review.propertyId)) || Boolean(review.jobId && data.jobs?.some(job=>job.id===review.jobId && job.ownerUserId===member.userId)),
    ),
    tasks: (data.tasks ?? []).filter(
      (task) =>
        task.visibility !== 'admin_only' && (task.assigneeUserId === member.userId || task.createdByUserId === member.userId || Boolean(task.propertyId && propertyIds.has(task.propertyId))),
    ),
  };
}

export function clientMemberWorkspaceData(
  data: PortalData | undefined,
  member: Pick<ClientMemberSummary,'clientAccountId'> | undefined,
): PortalData | undefined {
  if (!data || !member) return data;

  const properties = (data.properties ?? []).filter(
    (property) => property.clientId === member.clientAccountId,
  );
  const propertyIds = new Set(properties.map((property) => property.id));

  const belongsToClient = (clientId: string | undefined) =>
    clientId === member.clientAccountId;

  return {
    agencyMembers: [],
    agreements: (data.agreements ?? []).filter((agreement) =>
      belongsToClient(agreement.clientId),
    ),
    calendarEvents: (data.calendarEvents ?? []).filter(
      (event) =>
        event.visibility === 'client' &&
        (belongsToClient(event.clientId) ||
          Boolean(event.propertyId && propertyIds.has(event.propertyId))),
    ),
    clientMembers: (data.clientMembers ?? []).filter(
      (clientMember) => clientMember.clientAccountId === member.clientAccountId,
    ),
    clients: (data.clients ?? []).filter((client) =>
      belongsToClient(client.id),
    ),
    jobs: (data.jobs ?? []).filter(job => belongsToClient(job.clientId)),
    companyDocumentFolders: [],
    companyDocuments: [],
    costs: [],
    debts: [],
    financeMoneyMovements: [],
    financeAccounts: [],
    gear: [],
    gearHistory: [],
    instagramAccounts: (data.instagramAccounts ?? []).filter((account) =>
      belongsToClient(account.clientId ?? undefined),
    ),
    tiktokAccounts: (data.tiktokAccounts ?? []).filter((account) =>
      belongsToClient(account.clientId ?? undefined),
    ),
    notes: [],
    payments: (data.payments ?? []).filter((payment) =>
      belongsToClient(payment.clientId),
    ),
    properties,
    propertyAssignments: [],
    reviews: (data.reviews ?? []).filter(review => review.clientVisible === true && (review.clientId ? belongsToClient(review.clientId) : Boolean(review.propertyId && propertyIds.has(review.propertyId)))),
    tasks: (data.tasks ?? []).filter(
      (task) =>
        task.visibility === 'client' &&
        (belongsToClient(task.clientId) ||
          Boolean(task.propertyId && propertyIds.has(task.propertyId))),
    ),
  };
}
