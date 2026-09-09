import type { CalendarColor } from '@/lib/calendar-colors';
import type { PortalRole, PortalScreenKey, PortalUser } from '@/components/web';

export type { PortalRole, PortalScreenKey, PortalUser };

export type WorkStatus =
  | 'active'
  | 'draft'
  | 'scheduled'
  | 'in_review'
  | 'approved'
  | 'needs_changes'
  | 'complete'
  | 'overdue';

export interface ClientSummary {
  assignedTeam?: {
    role: string;
    userId: string;
  }[];
  avatarUrl?: string;
  contactName: string;
  email: string;
  id: string;
  location: string;
  monthlyDeliverables: number;
  monthlyPrice: number;
  name: string;
  nextShoot?: string;
  propertiesCount: number;
  status: 'active' | 'onboarding' | 'paused';
  totalContractValue: number;
}

export interface AgencyMemberSummary {
  avatarUrl?: string;
  email: string;
  id: string;
  name: string;
  phone?: string;
  role: 'admin' | 'team_member';
  status: 'invited' | 'active' | 'suspended';
  title?: string;
  userId: string;
}

export interface ClientMemberSummary {
  avatarUrl?: string;
  clientAccountId: string;
  clientName: string;
  email: string;
  id: string;
  name: string;
  role: 'owner' | 'member';
  status: 'invited' | 'active' | 'suspended';
  userId: string;
}

export interface PropertySummary {
  analytics: {
    engagement: string;
    followers: string;
    views: string;
  };
  assignedTeamNames: string[];
  assignedTeamUserIds: string[];
  clientId: string;
  clientName: string;
  completion: number;
  coverUrl: string;
  description: string;
  scriptingBrief: string;
  id: string;
  location: string;
  name: string;
  nextMilestone: string;
  status: WorkStatus;
  workspaceStatus: 'onboarding' | 'active' | 'paused';
}

export interface InstagramDailyMetricSummary {
  date: string;
  followers: number | null;
  mediaCount: number | null;
  profileViews: number;
  reach: number;
  views: number;
}

export interface InstagramMediaSummary {
  caption: string;
  comments: number;
  id: string;
  likes: number;
  mediaType: string;
  permalink?: string;
  postedAt?: string;
  reach: number;
  saves: number;
  shares: number;
  thumbnailUrl?: string;
  totalInteractions: number;
  views: number;
}

export interface InstagramAccountSummary {
  clientId: string | null;
  clientName: string;
  connectedAt: string;
  displayName: string;
  id: string;
  lastSyncError?: string;
  lastSyncedAt?: string;
  metrics: InstagramDailyMetricSummary[];
  media: InstagramMediaSummary[];
  profilePictureUrl?: string;
  status: 'active' | 'needs_reauth' | 'sync_error' | 'disconnected';
  username: string;
}

export interface TikTokDailyMetricSummary {
  comments: number;
  date: string;
  followers: number | null;
  likes: number;
  mediaCount: number | null;
  shares: number;
  totalInteractions: number;
  views: number;
}

export interface TikTokMediaSummary {
  caption: string;
  comments: number;
  id: string;
  likes: number;
  mediaType: string;
  permalink?: string;
  postedAt?: string;
  saves: number;
  shares: number;
  thumbnailUrl?: string;
  totalInteractions: number;
  views: number;
}

export interface TikTokAccountSummary {
  clientId: string | null;
  clientName: string;
  connectedAt: string;
  displayName: string;
  id: string;
  lastSyncError?: string;
  lastSyncedAt?: string;
  media: TikTokMediaSummary[];
  metrics: TikTokDailyMetricSummary[];
  profilePictureUrl?: string;
  profileUrl?: string;
  status: 'active' | 'needs_reauth' | 'sync_error' | 'disconnected';
  username: string;
}

export interface PropertyTeamAssignmentSummary {
  assignedAt: string;
  id: string;
  label?: string;
  propertyId: string;
  userId: string;
}

export interface ReviewComment {
  author: string;
  avatarUrl?: string;
  body: string;
  id: string;
  timestamp: string;
}

export interface ReviewItem {
  assignee: string;
  clientName: string;
  comments: ReviewComment[];
  contentHtml?: string;
  dueLabel: string;
  durationSeconds?: number;
  fileUrl?: string;
  id: string;
  kind: 'script' | 'video' | 'image' | 'document' | 'other';
  mimeType?: string;
  propertyId?: string;
  propertyName: string;
  status: Extract<WorkStatus, 'in_review' | 'approved' | 'needs_changes' | 'draft'>;
  thumbnailUrl?: string;
  title: string;
  version: string;
}

export interface CalendarEvent {
  color?: CalendarColor | null;
  allDay?: boolean;
  assignee: string;
  assigneeUserIds?: string[];
  clientId?: string;
  date: string;
  description?: string;
  end: string;
  endDate?: string;
  id: string;
  location: string;
  propertyCoverUrl?: string;
  propertyId?: string;
  propertyName: string;
  start: string;
  title: string;
  type: 'shoot' | 'deadline' | 'review' | 'internal';
  visibility?: 'admin_only' | 'team' | 'client';
  workScope: 'internal' | 'client' | 'other';
}

export interface TaskSummary {
  archivedAt?: string;
  attachments?: TaskAttachment[];
  assigneeName: string;
  assigneeUserId?: string;
  clientId?: string;
  clientName: string;
  completedAt?: string;
  createdAt: string;
  createdByName: string;
  description: string;
  dueAt?: string;
  id: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  propertyId?: string;
  propertyName: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  title: string;
  visibility: 'admin_only' | 'team' | 'client';
}

export interface TaskAttachment {
  id: string;
  mimeType: string;
  name: string;
  uploadedAt: string;
  uploadedByName: string;
  url?: string;
}

export interface PaymentRecord {
  amount: number;
  clientNote?: string;
  clientId?: string;
  clientName?: string;
  contractId?: string;
  dueDate: string;
  id: string;
  invoice: string;
  paidDate?: string;
  period: string;
  status: 'paid' | 'due' | 'overdue' | 'upcoming' | 'waived' | 'cancelled';
  scheduleStatus: 'upcoming' | 'due' | 'paid' | 'late' | 'waived' | 'cancelled';
}

export interface GearItem {
  assetTag: string;
  assignedTo?: string;
  assignedToUserId?: string;
  calendarEventId?: string;
  calendarEventTitle?: string;
  category: 'camera' | 'lens' | 'audio' | 'drone' | 'lighting' | 'support';
  id: string;
  location: string;
  name: string;
  notes: string;
  serial: string;
  status: 'available' | 'with_team' | 'on_site' | 'maintenance';
}

export interface GearHistoryItem {
  action: string;
  createdAt: string;
  gearId: string;
  id: string;
  location?: string;
  note?: string;
}

export interface DebtItem {
  amount: number;
  archivedAt?: string;
  direction: 'payable' | 'receivable';
  dueOn?: string;
  id: string;
  name: string;
  note: string;
  paid: number;
  lastPaidOn?: string;
}

export interface RecurringCostItem {
  amount: number;
  due: string;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly' | string;
  frequencyKey?: CreateCostInput['frequency'];
  id: string;
  name: string;
  notes?: string;
  paid: boolean;
  startsOn?: string;
  type: 'monthly' | 'periodic';
  vendor?: string;
}

export interface AgreementSummary {
  clientId: string;
  clientName: string;
  currency: string;
  deliverables?: AgreementDeliverableSummary[];
  documents?: { id: string; name: string; storagePath?: string; url?: string }[];
  endsOn?: string;
  filePath?: string;
  fileUrl?: string;
  id: string;
  monthlyAmount: number;
  startsOn?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  summary?: string;
  title: string;
  totalValue: number;
}

export interface AgreementDeliverableSummary {
  cadence: 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  completedAt?: string;
  id: string;
  name: string;
  quantity: number;
  status: 'planned' | 'in_progress' | 'ready_for_review' | 'changes_requested' | 'approved' | 'delivered' | 'skipped';
}

export interface ServicePackageSummary {
  archivedAt?: string;
  contractMonths: number;
  currency: string;
  deliverables: { name: string; quantity: number; unit?: string }[];
  description: string;
  id: string;
  isActive: boolean;
  monthlyPrice: number;
  name: string;
  steps: { assignmentRole?: string; checklist: string[]; dueOffsetDays: number; repeatsMonthly: boolean; title: string }[];
}

export interface MonthlyFulfillmentCycleSummary {
  clientId: string;
  committedDeliverables: { name: string; quantity: number; unit?: string }[];
  extraWorkCount: number;
  id: string;
  periodEnd: string;
  periodStart: string;
  revisionOverrunCount: number;
  status: 'planned' | 'active' | 'at_risk' | 'completed' | 'cancelled';
}

export interface FinanceMoneyMovementItem {
  accountId: string;
  accountName: string;
  amount: number;
  counterparty?: string;
  date: string;
  description: string;
  id: string;
  transactionType: 'income' | 'expense';
}

export interface FinanceAccountSummary {
  accountReference?: string;
  accountType: 'cash' | 'bank' | 'savings' | 'other';
  currency: 'RON';
  currentBalance: number;
  id: string;
  institutionName?: string;
  name: string;
  notes?: string;
  openingBalance: number;
}

export interface NoteItem {
  body: string;
  createdAt: string;
  id: string;
  title: string;
  visibility: 'admin_only' | 'team' | 'client';
}

export type LeadStatus =
  | 'pending'
  | 'follow_up'
  | 'won'
  | 'lost';

export interface LeadSummary {
  county: string;
  facebook: string;
  id: string;
  instagram: string;
  listingLink: string;
  location: string;
  notes: string;
  phoneNumber: string;
  researchName: string;
  sourceList: string;
  status: LeadStatus;
  tiktok: string;
  website: string;
}

export type CompanyDocumentKind =
  | 'company_file'
  | 'template'
  | 'foundation'
  | 'sop'
  | 'production'
  | 'sales'
  | 'curriculum_vitae'
  | 'branding'
  | 'note';

export type SalesDocumentType =
  | 'general'
  | 'script'
  | 'offer'
  | 'objection_handling'
  | 'training'
  | 'other';

export interface CompanyDocumentSummary {
  assigneeUserIds: string[];
  callerList?: string;
  contentHtml?: string;
  fileName?: string;
  fileUrl?: string;
  folderId?: string;
  id: string;
  kind: CompanyDocumentKind;
  mimeType?: string;
  salesDocumentType?: SalesDocumentType;
  title: string;
  updatedAt: string;
}

export type CompanyDocumentFolderScope = 'documents' | 'notes';

export interface CompanyDocumentFolderSummary {
  id: string;
  name: string;
  parentFolderId?: string;
  scope: CompanyDocumentFolderScope;
}

export type MarketingContentStatus =
  | 'idea'
  | 'draft'
  | 'ready'
  | 'published'
  | 'archived';

export interface MarketingContentSummary {
  allDay?: boolean;
  assigneeUserIds?: string[];
  body: string;
  caption: string;
  contentType: string;
  id: string;
  plannedFor?: string;
  plannedUntil?: string;
  platform: string;
  status: MarketingContentStatus;
  title: string;
}

export interface CreateCalendarEventInput {
  color?: CalendarColor | null;
  allDay?: boolean;
  assigneeUserIds?: string[];
  clientId?: string;
  date: string;
  description: string;
  end: string;
  endDate?: string;
  location: string;
  propertyId?: string;
  start: string;
  title: string;
  type: CalendarEvent['type'];
  visibility: 'admin_only' | 'team' | 'client';
  workScope: CalendarEvent['workScope'];
}

export interface CreateNoteInput {
  body: string;
  title: string;
  visibility: 'admin_only' | 'team' | 'client';
}

export interface CreatePropertyInput {
  clientId: string;
  coverImage?: File | null;
  description: string;
  scriptingBrief: string;
  location: string;
  name: string;
  status: 'onboarding' | 'active' | 'paused';
}

export interface CreateTaskInput {
  attachments?: File[];
  assigneeUserId?: string;
  clientId?: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: TaskSummary['priority'];
  propertyId?: string;
  title: string;
  visibility: TaskSummary['visibility'];
}

export interface UpdateTaskInput extends CreateTaskInput {
  status: TaskSummary['status'];
  taskId: string;
}

export interface UpdateContractDeliverableStatusInput {
  deliverableId: string;
  status: AgreementDeliverableSummary['status'];
}

export interface UpdateClientInput {
  clientId: string;
  companyName: string;
  contractDocuments: File[];
  contractMonths: string;
  contractStartsOn: string;
  deliverablePropertyIds: Record<string, string>;
  contactName: string;
  email: string;
  location: string;
  monthlyDeliverables: string;
  monthlyPrice: string;
  profilePhoto: File | null;
  totalContractValue: string;
}

export interface DeleteContractDocumentInput {
  documentId: string;
  storagePath?: string;
}

export interface UpdatePropertyInput {
  coverImage?: File | null;
  description: string;
  scriptingBrief: string;
  location: string;
  name: string;
  propertyId: string;
  status: 'onboarding' | 'active' | 'paused';
}

export interface UpdateClientTeamInput {
  assignments: {
    role: string;
    userId: string;
  }[];
  clientId: string;
}

export interface UpdateAgreementInput {
  agreementId: string;
  currency: string;
  endsOn: string;
  monthlyAmount: string;
  startsOn: string;
  status: AgreementSummary['status'];
  summary: string;
  title: string;
  totalValue: string;
}

export interface UpdateCalendarEventInput extends CreateCalendarEventInput {
  eventId: string;
}

export interface UpdatePaymentInput {
  amount: string;
  clientNote: string;
  dueOn: string;
  invoiceReference: string;
  label: string;
  paymentId: string;
  status?: 'upcoming' | 'due' | 'late' | 'waived' | 'cancelled';
}

export interface CreatePaymentInput {
  amount: string;
  clientId: string;
  clientNote: string;
  dueOn: string;
  invoiceReference: string;
  label: string;
}

export interface CreateGearInput {
  assetTag: string;
  category: GearItem['category'];
  location: string;
  name: string;
  notes: string;
  serial: string;
}

export interface TransferGearInput {
  custodianUserId?: string;
  eventId?: string;
  gearId: string;
  location: string;
  note: string;
  propertyId?: string;
  status: GearItem['status'];
}

export interface UpdateGearInput {
  assetTag: string;
  category: GearItem['category'];
  gearId: string;
  name: string;
  notes: string;
}

export interface CreateMoneyMovementInput {
  accountId: string;
  amount: string;
  counterparty: string;
  description: string;
  occurredOn: string;
  transactionType: 'income' | 'expense';
}

export interface UpdateMoneyMovementInput extends CreateMoneyMovementInput {
  movementId: string;
}

export interface UpsertFinanceAccountInput {
  accountId?: string;
  accountReference: string;
  accountType: FinanceAccountSummary['accountType'];
  currentBalance: string;
  institutionName: string;
  name: string;
  notes: string;
}

export interface CreateDebtInput {
  amount: string;
  counterparty: string;
  direction: 'payable' | 'receivable';
  dueOn: string;
  note: string;
}

export interface UpdateDebtInput extends CreateDebtInput {
  debtId: string;
}

export interface CreateCostInput {
  amount: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  name: string;
  nextDueOn: string;
  notes: string;
  startsOn: string;
  vendor: string;
}

export interface UpdateCostInput extends CreateCostInput {
  costId: string;
}

export interface UploadDeliverableInput {
  clientVisible?: boolean;
  contentHtml?: string;
  file?: File | null;
  kind: 'script' | 'video' | 'image' | 'document' | 'other';
  propertyId: string;
  title: string;
}

export interface UpdateDeliverableInput {
  clientVisible: boolean;
  mediaAssetId: string;
  propertyId: string;
  status: 'draft' | 'ready_for_review';
  title: string;
}

export interface ProfileUpdateInput {
  avatarFile: File | null;
  fullName: string;
  locale: 'en' | 'ro';
  phone: string;
}

export interface UpsertDocumentInput {
  assigneeUserIds?: string[];
  callerList?: string;
  contentHtml: string;
  documentId?: string;
  file: File | null;
  folderId?: string | null;
  kind: CompanyDocumentKind;
  removeFile?: boolean;
  salesDocumentType?: SalesDocumentType;
  title: string;
}

export interface UpsertCompanyDocumentFolderInput {
  folderId?: string;
  name: string;
  parentFolderId?: string | null;
  scope: CompanyDocumentFolderScope;
}

export interface MoveCompanyDocumentToFolderInput {
  documentId: string;
  folderId: string | null;
}

export interface LeadImportInput {
  county: string;
  facebook: string;
  instagram: string;
  listingLink: string;
  location: string;
  notes: string;
  phoneNumber: string;
  researchName: string;
  sourceList: string;
  status: LeadStatus;
  tiktok: string;
  website: string;
}

export interface UpsertLeadInput extends LeadImportInput {
  leadId?: string;
}

export interface UpsertMarketingContentInput {
  allDay?: boolean;
  assigneeUserIds?: string[];
  body: string;
  caption: string;
  contentId?: string;
  contentType: string;
  plannedFor: string;
  plannedUntil?: string;
  platform: string;
  status: MarketingContentStatus;
  title: string;
}

export interface CreateClientInput {
  companyName: string;
  contactName: string;
  contractDocuments: File[];
  contractMonths: string;
  contractStartsOn: string;
  deliverablePropertyIds: Record<string, string>;
  createLogin: boolean;
  email: string;
  location: string;
  monthlyDeliverables: string;
  monthlyPrice: string;
  profilePhoto: File | null;
  properties: CreateClientPropertyInput[];
  packageTemplateId?: string;
  requirePasswordReset: boolean;
  temporaryPassword: string;
  totalContractValue: string;
  workflowTasks?: {
    checklist?: string[];
    dependsOn?: string;
    description: string;
    dueOffsetDays: number;
    priority: 'normal' | 'high';
    role?: 'account_manager' | 'producer' | 'videographer' | 'editor';
    title: string;
  }[];
}

export interface CreateClientPropertyInput {
  description: string;
  location: string;
  name: string;
}

export interface CreateTeamMemberInput {
  avatarFile: File | null;
  email: string;
  fullName: string;
  phone: string;
  title: string;
}

export interface CreateClientMemberInput {
  clientAccountId: string;
  email: string;
  fullName: string;
  role: 'owner' | 'member';
  temporaryPassword: string;
}

export interface UpdateTeamMemberAccessInput {
  avatarFile: File | null;
  email: string;
  fullName: string;
  membershipId: string;
  phone: string;
  status: 'active' | 'suspended';
  title: string;
}

export interface UpdateClientMemberAccessInput {
  membershipId: string;
  role: 'owner' | 'member';
  status: 'active' | 'suspended';
}

export interface UpdatePropertyAssignmentsInput {
  propertyIds: string[];
  userId: string;
}

export interface JobSummary {
  brief: string;
  clientId?: string;
  dueOn?: string;
  id: string;
  kind: 'property_launch' | 'content_campaign' | 'recurring_content' | 'internal';
  name: string;
  propertyId?: string;
  startsOn?: string;
  status: 'draft' | 'planned' | 'active' | 'on_hold' | 'complete' | 'cancelled';
}

export interface CreateJobInput {
  brief: string;
  clientId?: string;
  dueOn: string;
  kind: JobSummary['kind'];
  name: string;
  propertyId?: string;
  startsOn: string;
}

export interface PortalData {
  agencyMembers?: AgencyMemberSummary[];
  agreements?: AgreementSummary[];
  calendarEvents?: CalendarEvent[];
  clientMembers?: ClientMemberSummary[];
  clients?: ClientSummary[];
  companyDocumentFolders?: CompanyDocumentFolderSummary[];
  companyDocuments?: CompanyDocumentSummary[];
  costs?: RecurringCostItem[];
  debts?: DebtItem[];
  archivedDebts?: DebtItem[];
  financeMoneyMovements?: FinanceMoneyMovementItem[];
  financeAccounts?: FinanceAccountSummary[];
  gear?: GearItem[];
  gearHistory?: GearHistoryItem[];
  instagramAccounts?: InstagramAccountSummary[];
  jobs?: JobSummary[];
  tiktokAccounts?: TikTokAccountSummary[];
  leads?: LeadSummary[];
  marketingContent?: MarketingContentSummary[];
  notes?: NoteItem[];
  payments?: PaymentRecord[];
  properties?: PropertySummary[];
  propertyAssignments?: PropertyTeamAssignmentSummary[];
  reviews?: ReviewItem[];
  archivedTasks?: TaskSummary[];
  tasks?: TaskSummary[];
}

export interface PortalActionHandlers {
  archiveAgreement: (agreementId: string) => Promise<void>;
  archiveClient: (clientId: string) => Promise<void>;
  archiveEvent: (eventId: string) => Promise<void>;
  archivePayment: (paymentId: string) => Promise<void>;
  archiveProperty: (propertyId: string) => Promise<void>;
  archiveRecurringCost: (costId: string) => Promise<void>;
  archiveDebt: (debtId: string) => Promise<void>;
  archiveTask: (taskId: string) => Promise<void>;
  restoreTask: (taskId: string) => Promise<void>;
  archiveCompanyDocument: (documentId: string) => Promise<void>;
  deleteCompanyDocumentFolder: (folderId: string) => Promise<void>;
  deleteContractDocument: (input: DeleteContractDocumentInput) => Promise<void>;
  deleteTaskAttachment: (attachmentId: string) => Promise<void>;
  archiveLead: (leadId: string) => Promise<void>;
  deleteLeadList: (leadIds: string[]) => Promise<void>;
  archiveMarketingContent: (contentId: string) => Promise<void>;
  clearCompletedTasks: () => Promise<void>;
  createCost: (input: CreateCostInput) => Promise<void>;
  createDebt: (input: CreateDebtInput) => Promise<void>;
  createEvent: (input: CreateCalendarEventInput) => Promise<void>;
  createGear: (input: CreateGearInput) => Promise<void>;
  createJob: (input: CreateJobInput) => Promise<void>;
  createMoneyMovement: (input: CreateMoneyMovementInput) => Promise<void>;
  upsertFinanceAccount: (input: UpsertFinanceAccountInput) => Promise<void>;
  createClientMember: (input: CreateClientMemberInput) => Promise<void>;
  createNote: (input: CreateNoteInput) => Promise<void>;
  createPayment: (input: CreatePaymentInput) => Promise<void>;
  createProperty: (input: CreatePropertyInput) => Promise<void>;
  createTeamMember: (input: CreateTeamMemberInput) => Promise<void>;
  sendTeamMemberPasswordReset: (email: string) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
  importLeads: (input: LeadImportInput[]) => Promise<void>;
  markPaymentPaid: (paymentId: string) => Promise<void>;
  recordDebtPayment: (debtId: string, amount: string, note: string) => Promise<void>;
  reviewComment: (reviewId: string, body: string, timestamp: string) => Promise<void>;
  reviewDecision: (
    reviewId: string,
    decision: 'approved' | 'changes_requested' | 'approval_revoked',
  ) => Promise<void>;
  archiveDeliverable: (mediaAssetId: string) => Promise<void>;
  toggleRecurringCost: (costId: string, paid: boolean) => Promise<void>;
  updateDebt: (input: UpdateDebtInput) => Promise<void>;
  updateFinanceMoneyMovement: (input: UpdateMoneyMovementInput) => Promise<void>;
  updateRecurringCost: (input: UpdateCostInput) => Promise<void>;
  transferGear: (input: TransferGearInput) => Promise<void>;
  updateGear: (input: UpdateGearInput) => Promise<void>;
  updateClientMemberAccess: (input: UpdateClientMemberAccessInput) => Promise<void>;
  updateAgreement: (input: UpdateAgreementInput) => Promise<void>;
  updateClient: (input: UpdateClientInput) => Promise<void>;
  updateClientTeam: (input: UpdateClientTeamInput) => Promise<void>;
  updateEvent: (input: UpdateCalendarEventInput) => Promise<void>;
  updatePayment: (input: UpdatePaymentInput) => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  updateProperty: (input: UpdatePropertyInput) => Promise<void>;
  updatePropertyAssignments: (
    input: UpdatePropertyAssignmentsInput,
  ) => Promise<void>;
  updateTeamMemberAccess: (input: UpdateTeamMemberAccessInput) => Promise<void>;
  updateTask: (input: UpdateTaskInput) => Promise<void>;
  moveCompanyDocumentToFolder: (input: MoveCompanyDocumentToFolderInput) => Promise<void>;
  updateDeliverable: (input: UpdateDeliverableInput) => Promise<void>;
  updateContractDeliverableStatus: (input: UpdateContractDeliverableStatusInput) => Promise<void>;
  upsertCompanyDocument: (input: UpsertDocumentInput) => Promise<string | void>;
  upsertCompanyDocumentFolder: (input: UpsertCompanyDocumentFolderInput) => Promise<string | void>;
  upsertLead: (input: UpsertLeadInput) => Promise<void>;
  upsertMarketingContent: (input: UpsertMarketingContentInput) => Promise<void>;
  uploadDeliverable: (input: UploadDeliverableInput) => Promise<void>;
}

export interface PortalAppProps {
  actions?: PortalActionHandlers;
  agencyId?: string | null;
  clientAccountId?: string | null;
  clientRole?: 'owner' | 'member' | null;
  currentUserId?: string;
  data?: PortalData;
  initialScreen?: PortalScreenKey;
  onCreateClient?: (client: CreateClientInput) => void | Promise<void>;
  onNavigate?: (screen: PortalScreenKey) => void;
  onSelectWorkspace?: (agencyId: string) => void;
  onSignOut?: () => void;
  organizationName?: string;
  role?: PortalRole;
  user?: PortalUser;
  workspaces?: Array<{ agencyId: string; name: string }>;
}
