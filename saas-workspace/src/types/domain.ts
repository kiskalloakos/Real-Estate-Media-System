import type {
  AgencyMembershipRow,
  AgencyRole,
  CalendarEventRow,
  ClientAccountRow,
  ClientMembershipRow,
  ContractDeliverableRow,
  FinanceAccountRow,
  FinanceDebtRow,
  FinanceTransactionRow,
  GearItemRow,
  MediaAssetRow,
  MediaVersionRow,
  PaymentRecordRow,
  PaymentScheduleItemRow,
  ProfileRow,
  PropertyRow,
  RecurringCostRow,
  ReviewCommentRow,
  ServiceContractRow,
  TaskRow,
  UUID,
} from "./database";

export interface AuthenticatedIdentity {
  userId: UUID;
  profile: ProfileRow;
  agencyMemberships: AgencyMembershipRow[];
}

export interface ActiveAgencyContext {
  agencyId: UUID;
  role: AgencyRole;
  membershipId: UUID;
}

export interface ClientAccountAccess {
  account: ClientAccountRow;
  membership: ClientMembershipRow;
  properties: PropertyRow[];
}

export interface ClientDirectoryEntry {
  account: ClientAccountRow;
  properties: PropertyRow[];
  activeContract: ServiceContractRow | null;
  nextPayment: PaymentScheduleItemRow | null;
}

export interface PropertyWorkspace {
  property: PropertyRow;
  client: ClientAccountRow;
  contract: ServiceContractRow | null;
  deliverables: ContractDeliverableRow[];
  reviewAssets: MediaAssetRow[];
  upcomingEvents: CalendarEventRow[];
  openTasks: TaskRow[];
}

export interface ReviewAssetWithLatestVersion {
  asset: MediaAssetRow;
  latestVersion: MediaVersionRow | null;
  comments: ReviewCommentRow[];
}

export interface TimestampedVideoCommentDraft {
  mediaAssetId: UUID;
  mediaVersionId: UUID;
  body: string;
  timestampSeconds: number;
}

export interface ClientBillingSummary {
  contract: ServiceContractRow | null;
  deliverables: ContractDeliverableRow[];
  upcomingPayments: PaymentScheduleItemRow[];
  paymentHistory: PaymentRecordRow[];
}

export interface FinanceOverview {
  accounts: FinanceAccountRow[];
  recentTransactions: FinanceTransactionRow[];
  openDebts: FinanceDebtRow[];
  recurringCosts: RecurringCostRow[];
}

export interface GearAssignmentSummary {
  item: GearItemRow;
  property: PropertyRow | null;
  custodian: ProfileRow | null;
}

export const ROLE_LABELS: Record<AgencyRole, string> = {
  admin: "Owner",
  team_member: "Team member",
  client: "Client",
};

export const canManageAgency = (role: AgencyRole): boolean => role === "admin";

export const canSeeClientBilling = (role: AgencyRole): boolean =>
  role === "admin" || role === "client";

export const canSeeFinances = (role: AgencyRole): boolean => role === "admin";

