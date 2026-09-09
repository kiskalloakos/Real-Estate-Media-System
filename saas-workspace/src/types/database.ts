/**
 * Hand-maintained Supabase schema types for the initial migration set.
 *
 * Regenerate these with the Supabase CLI after every applied migration once the
 * project is linked. Keeping this file dependency-free lets the app use it
 * before the Supabase client package is installed.
 */

import type { CalendarColor } from '@/lib/calendar-colors';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UUID = string;
export type ISODate = string;
export type ISODateTime = string;

export type AgencyRole = "admin" | "team_member" | "client";
export type MembershipStatus = "invited" | "active" | "suspended";
export type ClientMembershipRole = "owner" | "member";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type PropertyStatus = "onboarding" | "active" | "paused" | "archived";
export type ContractStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
export type BillingFrequency =
  | "one_time"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";
export type DeliverableStatus =
  | "planned"
  | "in_progress"
  | "ready_for_review"
  | "changes_requested"
  | "approved"
  | "delivered"
  | "skipped";
export type PaymentStatus = "upcoming" | "due" | "paid" | "late" | "waived" | "cancelled";
export type MediaKind = "script" | "video" | "image" | "document" | "other";
export type MediaStatus =
  | "draft"
  | "ready_for_review"
  | "changes_requested"
  | "approved"
  | "archived";
export type CommentVisibility = "client" | "internal";
export type CommentStatus = "open" | "resolved";
export type ReviewDecision =
  | "ready_for_review"
  | "changes_requested"
  | "approved"
  | "approval_revoked";
export type RecordVisibility = "admin_only" | "team" | "client";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type GearStatus =
  | "available"
  | "assigned"
  | "on_site"
  | "maintenance"
  | "missing"
  | "retired";
export type GearCustodyAction =
  | "checked_out"
  | "transferred"
  | "placed_on_site"
  | "returned"
  | "sent_to_maintenance"
  | "marked_missing"
  | "retired";
export type FinanceAccountType = "cash" | "bank" | "credit" | "savings" | "other";
export type FinanceTransactionType = "income" | "expense" | "transfer" | "adjustment";
export type DebtDirection = "payable" | "receivable";
export type DebtStatus = "open" | "partial" | "paid" | "waived" | "cancelled";
export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type NotificationKind = "review" | "task" | "calendar" | "payment" | "system";
export type InstagramConnectionStatus =
  | "active"
  | "needs_reauth"
  | "sync_error"
  | "disconnected";
export type SocialConnectionStatus = InstagramConnectionStatus;
export type LeadStatus =
  | "pending"
  | "follow_up"
  | "won"
  | "lost";
export type CompanyDocumentKind =
  | "company_file"
  | "template"
  | "foundation"
  | "sop"
  | "production"
  | "sales"
  | "curriculum_vitae"
  | "branding"
  | "note";
export type SalesDocumentType =
  | "general"
  | "script"
  | "offer"
  | "objection_handling"
  | "training"
  | "other";
export type MarketingContentStatus =
  | "idea"
  | "draft"
  | "ready"
  | "published"
  | "archived";
export type JobKind = "property_launch" | "content_campaign" | "recurring_content" | "internal";
export type JobStatus = "draft" | "planned" | "active" | "on_hold" | "complete" | "cancelled";

interface IdentifiedRow {
  id: UUID;
}

interface AgencyScopedRow extends IdentifiedRow {
  agency_id: UUID;
}

interface TimestampedRow {
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

interface ArchivableRow {
  archived_at: ISODateTime | null;
}

export interface AgencyRow extends IdentifiedRow, TimestampedRow, ArchivableRow {
  slug: string;
  name: string;
  legal_name: string | null;
  logo_path: string | null;
  timezone: string;
  default_currency: string;
  settings: Json;
  created_by: UUID | null;
}

export interface ProfileRow extends IdentifiedRow, TimestampedRow {
  email: string;
  full_name: string | null;
  avatar_path: string | null;
  phone: string | null;
  locale: string;
}

export interface AgencyMembershipRow extends AgencyScopedRow, TimestampedRow {
  user_id: UUID;
  role: AgencyRole;
  status: MembershipStatus;
  title: string | null;
  created_by: UUID | null;
}

export interface ClientAccountRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  name: string;
  owner_name: string | null;
  billing_email: string | null;
  profile_image_path: string | null;
  location_label: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  timezone: string | null;
  description: string | null;
  metadata: Json;
  created_by: UUID | null;
}

export interface ClientMembershipRow extends AgencyScopedRow, TimestampedRow {
  client_account_id: UUID;
  user_id: UUID;
  role: ClientMembershipRole;
  status: MembershipStatus;
  invited_by: UUID | null;
}

export interface InvitationRow extends AgencyScopedRow, TimestampedRow {
  client_account_id: UUID | null;
  email: string;
  agency_role: AgencyRole;
  client_role: ClientMembershipRole | null;
  token_hash: string;
  status: InvitationStatus;
  expires_at: ISODateTime;
  accepted_by: UUID | null;
  accepted_at: ISODateTime | null;
  invited_by: UUID;
}

export interface PropertyRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  client_account_id: UUID;
  name: string;
  status: PropertyStatus;
  description: string | null;
  scripting_brief: string;
  cover_image_path: string | null;
  location_label: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  metadata: Json;
  created_by: UUID | null;
}

export interface PropertyTeamAssignmentRow extends AgencyScopedRow, TimestampedRow {
  property_id: UUID;
  user_id: UUID;
  assignment_label: string | null;
  assigned_by: UUID | null;
  assigned_at: ISODateTime;
}

export interface ServiceContractRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  client_account_id: UUID;
  property_id: UUID | null;
  title: string;
  reference_code: string | null;
  status: ContractStatus;
  billing_frequency: BillingFrequency;
  recurring_amount: number;
  total_contract_value: number | null;
  currency: string;
  starts_on: ISODate | null;
  ends_on: ISODate | null;
  signed_at: ISODateTime | null;
  summary: string | null;
  contract_file_path: string | null;
  client_visible: boolean;
  created_by: UUID | null;
}

export interface ContractDeliverableRow extends AgencyScopedRow, TimestampedRow {
  contract_id: UUID;
  property_id: UUID | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  cadence: BillingFrequency;
  status: DeliverableStatus;
  due_at: ISODateTime | null;
  completed_at: ISODateTime | null;
  client_visible: boolean;
  sort_order: number;
  created_by: UUID | null;
}

export interface PaymentScheduleItemRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  client_account_id: UUID;
  contract_id: UUID;
  label: string | null;
  due_on: ISODate;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paid_at: ISODateTime | null;
  invoice_reference: string | null;
  attachment_path: string | null;
  client_note: string | null;
  client_visible: boolean;
  created_by: UUID | null;
}

export interface PaymentRecordRow extends AgencyScopedRow, TimestampedRow {
  client_account_id: UUID;
  schedule_item_id: UUID | null;
  finance_transaction_id: UUID | null;
  amount: number;
  currency: string;
  paid_on: ISODate;
  payment_method: string | null;
  reference: string | null;
  receipt_path: string | null;
  client_note: string | null;
  client_visible: boolean;
  recorded_by: UUID | null;
}

export interface MediaAssetRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  property_id: UUID;
  job_id: UUID | null;
  kind: MediaKind;
  title: string;
  description: string | null;
  status: MediaStatus;
  client_visible: boolean;
  created_by: UUID | null;
}

export interface MediaVersionRow extends AgencyScopedRow, IdentifiedRow {
  media_asset_id: UUID;
  version_number: number;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  duration_seconds: number | null;
  checksum_sha256: string | null;
  metadata: Json;
  uploaded_by: UUID | null;
  created_at: ISODateTime;
}

export interface ReviewCommentRow extends AgencyScopedRow, TimestampedRow {
  media_asset_id: UUID;
  media_version_id: UUID;
  parent_comment_id: UUID | null;
  author_id: UUID;
  body: string;
  timestamp_seconds: number | null;
  visibility: CommentVisibility;
  status: CommentStatus;
  resolved_by: UUID | null;
  resolved_at: ISODateTime | null;
}

export interface ReviewApprovalEventRow extends AgencyScopedRow {
  media_asset_id: UUID;
  media_version_id: UUID;
  decision: ReviewDecision;
  note: string | null;
  actor_id: UUID;
  created_at: ISODateTime;
}

export interface CalendarEventRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  color: CalendarColor | null;
  client_account_id: UUID | null;
  property_id: UUID | null;
  job_id: UUID | null;
  title: string;
  description: string | null;
  starts_at: ISODateTime;
  ends_at: ISODateTime | null;
  all_day: boolean;
  location: string | null;
  visibility: RecordVisibility;
  created_by: UUID;
}

export interface CalendarEventAssigneeRow extends AgencyScopedRow {
  calendar_event_id: UUID;
  user_id: UUID;
  created_at: ISODateTime;
}

export interface TaskRow extends AgencyScopedRow, TimestampedRow, ArchivableRow {
  client_account_id: UUID | null;
  property_id: UUID | null;
  job_id: UUID | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: ISODateTime | null;
  completed_at: ISODateTime | null;
  visibility: RecordVisibility;
  assignee_user_id: UUID | null;
  created_by: UUID;
}

export interface JobRow extends AgencyScopedRow, TimestampedRow, ArchivableRow {
  client_account_id: UUID | null;
  property_id: UUID | null;
  name: string;
  kind: JobKind;
  status: JobStatus;
  brief: string | null;
  starts_on: ISODate | null;
  due_on: ISODate | null;
  created_by: UUID;
}

export interface NoteRow extends AgencyScopedRow, TimestampedRow, ArchivableRow {
  client_account_id: UUID | null;
  property_id: UUID | null;
  calendar_event_id: UUID | null;
  task_id: UUID | null;
  title: string | null;
  body: string;
  visibility: RecordVisibility;
  created_by: UUID;
}

export interface RecordAttachmentRow extends AgencyScopedRow {
  client_account_id: UUID | null;
  property_id: UUID | null;
  calendar_event_id: UUID | null;
  task_id: UUID | null;
  note_id: UUID | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  uploaded_by: UUID | null;
  created_at: ISODateTime;
}

export interface GearItemRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  asset_tag: string;
  name: string;
  category: string;
  serial_number: string | null;
  status: GearStatus;
  condition_label: string | null;
  home_location: string | null;
  current_location: string | null;
  current_custodian_user_id: UUID | null;
  current_property_id: UUID | null;
  image_path: string | null;
  notes: string | null;
  created_by: UUID | null;
}

export interface GearCustodyHistoryRow extends AgencyScopedRow {
  gear_item_id: UUID;
  action: GearCustodyAction;
  from_user_id: UUID | null;
  to_user_id: UUID | null;
  from_property_id: UUID | null;
  to_property_id: UUID | null;
  from_location: string | null;
  to_location: string | null;
  condition_label: string | null;
  note: string | null;
  transferred_by: UUID;
  acknowledged_by: UUID | null;
  acknowledged_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface FinanceAccountRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  name: string;
  account_type: FinanceAccountType;
  currency: string;
  opening_balance: number;
  institution_name: string | null;
  account_reference: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: UUID | null;
}

export interface FinanceCategoryRow extends AgencyScopedRow, TimestampedRow {
  parent_category_id: UUID | null;
  name: string;
  applies_to: FinanceTransactionType;
  color: string | null;
  is_active: boolean;
}

export interface FinanceTransactionRow extends AgencyScopedRow, TimestampedRow {
  account_id: UUID;
  category_id: UUID | null;
  client_account_id: UUID | null;
  transaction_type: FinanceTransactionType;
  amount: number;
  currency: string;
  occurred_on: ISODate;
  counterparty: string | null;
  description: string;
  reference: string | null;
  receipt_path: string | null;
  transfer_group_id: UUID | null;
  related_transaction_id: UUID | null;
  created_by: UUID | null;
}

export interface FinanceDebtRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  client_account_id: UUID | null;
  direction: DebtDirection;
  status: DebtStatus;
  counterparty: string;
  description: string | null;
  original_amount: number;
  outstanding_amount: number;
  currency: string;
  issued_on: ISODate | null;
  due_on: ISODate | null;
  reference: string | null;
  attachment_path: string | null;
  notes: string | null;
  created_by: UUID | null;
}

export interface FinanceDebtPaymentRow extends AgencyScopedRow {
  debt_id: UUID;
  account_id: UUID | null;
  transaction_id: UUID | null;
  amount: number;
  paid_on: ISODate;
  note: string | null;
  recorded_by: UUID | null;
  created_at: ISODateTime;
}

export interface RecurringCostRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  account_id: UUID | null;
  category_id: UUID | null;
  name: string;
  vendor: string | null;
  amount: number;
  currency: string;
  frequency: RecurrenceFrequency;
  interval_count: number;
  starts_on: ISODate;
  next_due_on: ISODate;
  ends_on: ISODate | null;
  is_active: boolean;
  notes: string | null;
  created_by: UUID | null;
}

export interface RecurringCostOccurrenceRow extends AgencyScopedRow, TimestampedRow {
  recurring_cost_id: UUID;
  transaction_id: UUID | null;
  due_on: ISODate;
  amount: number;
  status: PaymentStatus;
  paid_at: ISODateTime | null;
  note: string | null;
}

export interface NotificationRow extends IdentifiedRow {
  agency_id: UUID;
  recipient_user_id: UUID;
  kind: NotificationKind;
  title: string;
  body: string;
  web_screen: string;
  native_route: string | null;
  entity_type: string | null;
  entity_id: UUID | null;
  dedupe_key: string | null;
  metadata: Json;
  read_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface NotificationPreferenceRow extends TimestampedRow {
  user_id: UUID;
  in_app_enabled: boolean;
  push_enabled: boolean;
  reviews_enabled: boolean;
  tasks_enabled: boolean;
  calendar_enabled: boolean;
  payments_enabled: boolean;
}

export interface PushDeviceRow extends IdentifiedRow, TimestampedRow {
  user_id: UUID;
  expo_push_token: string;
  platform: "ios" | "android";
  device_name: string | null;
  app_version: string | null;
  enabled: boolean;
  last_seen_at: ISODateTime;
}

export interface InstagramConnectionRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  client_account_id: UUID | null;
  instagram_business_id: string;
  facebook_page_id: string;
  facebook_page_name: string | null;
  username: string | null;
  display_name: string | null;
  profile_picture_url: string | null;
  token_secret_id: UUID | null;
  token_expires_at: ISODateTime | null;
  status: InstagramConnectionStatus;
  connected_by: UUID | null;
  connected_at: ISODateTime;
  last_synced_at: ISODateTime | null;
  last_sync_error: string | null;
  next_sync_at: ISODateTime;
}

export interface InstagramOauthStateRow {
  state_hash: string;
  agency_id: UUID;
  client_account_id: UUID | null;
  initiated_by: UUID;
  expires_at: ISODateTime;
  created_at: ISODateTime;
}

export interface InstagramAccountDailyMetricRow
  extends AgencyScopedRow,
    TimestampedRow {
  client_account_id: UUID | null;
  connection_id: UUID;
  metric_date: ISODate;
  followers_count: number | null;
  follows_count: number | null;
  media_count: number | null;
  views: number | null;
  reach: number | null;
  profile_views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  total_interactions: number | null;
  fetched_at: ISODateTime;
}

export interface InstagramMediaRow
  extends AgencyScopedRow,
    TimestampedRow {
  client_account_id: UUID | null;
  connection_id: UUID;
  instagram_media_id: string;
  caption: string | null;
  media_type: string | null;
  media_product_type: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  posted_at: ISODateTime | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  total_interactions: number | null;
  fetched_at: ISODateTime;
}

export interface InstagramSyncRunRow extends IdentifiedRow {
  agency_id: UUID;
  client_account_id: UUID | null;
  connection_id: UUID;
  status: "running" | "succeeded" | "partial" | "failed";
  trigger_source: "connect" | "manual" | "scheduled";
  warning_messages: Json;
  error_message: string | null;
  started_at: ISODateTime;
  completed_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface TikTokConnectionRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  client_account_id: UUID | null;
  open_id: string;
  union_id: string | null;
  username: string | null;
  display_name: string | null;
  profile_picture_url: string | null;
  profile_url: string | null;
  token_secret_id: UUID | null;
  refresh_token_secret_id: UUID | null;
  token_expires_at: ISODateTime | null;
  refresh_token_expires_at: ISODateTime | null;
  status: SocialConnectionStatus;
  connected_by: UUID | null;
  connected_at: ISODateTime;
  last_synced_at: ISODateTime | null;
  last_sync_error: string | null;
  next_sync_at: ISODateTime;
}

export interface TikTokOauthStateRow {
  state_hash: string;
  agency_id: UUID;
  client_account_id: UUID | null;
  initiated_by: UUID;
  expires_at: ISODateTime;
  created_at: ISODateTime;
}

export interface TikTokAccountDailyMetricRow
  extends AgencyScopedRow,
    TimestampedRow {
  client_account_id: UUID | null;
  connection_id: UUID;
  metric_date: ISODate;
  followers_count: number | null;
  follows_count: number | null;
  media_count: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  total_interactions: number | null;
  fetched_at: ISODateTime;
}

export interface TikTokMediaRow
  extends AgencyScopedRow,
    TimestampedRow {
  client_account_id: UUID | null;
  connection_id: UUID;
  tiktok_video_id: string;
  caption: string | null;
  media_type: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  posted_at: ISODateTime | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  total_interactions: number | null;
  fetched_at: ISODateTime;
}

export interface TikTokSyncRunRow extends IdentifiedRow {
  agency_id: UUID;
  client_account_id: UUID | null;
  connection_id: UUID;
  status: "running" | "succeeded" | "partial" | "failed";
  trigger_source: "connect" | "manual" | "scheduled";
  warning_messages: Json;
  error_message: string | null;
  started_at: ISODateTime;
  completed_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface CompanyDocumentRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  folder_id: UUID | null;
  kind: CompanyDocumentKind;
  sales_document_type: SalesDocumentType | null;
  caller_list: string | null;
  title: string;
  content_html: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  byte_size: number | null;
  created_by: UUID | null;
}

export interface CompanyDocumentAssigneeRow extends IdentifiedRow {
  agency_id: UUID;
  company_document_id: UUID;
  user_id: UUID;
  assigned_by: UUID | null;
  assigned_at: ISODateTime;
}

export interface CompanyDocumentFolderRow
  extends AgencyScopedRow,
    TimestampedRow {
  parent_folder_id: UUID | null;
  scope: "documents" | "notes";
  name: string;
  created_by: UUID | null;
}

export interface CompanyCredentialRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  label: string;
  username: string | null;
  secret_value: string | null;
  url: string | null;
  notes: string | null;
  created_by: UUID | null;
}

export interface CabanaScriptRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  approved_at: ISODateTime | null;
  title: string;
  hooks: Json;
  script: string;
  brief: Json;
  client_account_id: UUID | null;
  model: string | null;
  property_id: UUID | null;
  status: "draft" | "approved";
  created_by: UUID | null;
}

export interface AgencyLeadRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  research_name: string;
  county: string | null;
  location: string | null;
  phone_number: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  listing_link: string | null;
  status: LeadStatus;
  source_list: string | null;
  created_by: UUID | null;
}

export interface MarketingContentRow
  extends AgencyScopedRow,
    TimestampedRow,
    ArchivableRow {
  assignee_user_ids: UUID[];
  title: string;
  platform: string | null;
  content_type: string | null;
  body: string | null;
  caption: string | null;
  planned_for: ISODateTime | null;
  planned_until: ISODateTime | null;
  all_day: boolean;
  status: MarketingContentStatus;
  created_by: UUID | null;
}

export interface AuditEventRow {
  id: number;
  agency_id: UUID;
  actor_user_id: UUID | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity_schema: string;
  entity_table: string;
  entity_id: UUID | null;
  old_record: Json | null;
  new_record: Json | null;
  occurred_at: ISODateTime;
}

type TableDefinition<Row extends object, RequiredInsertKeys extends keyof Row = never> = {
  Row: Row & Record<string, unknown>;
  Insert: Partial<Row> & Pick<Row, RequiredInsertKeys> & Record<string, unknown>;
  Update: Partial<Row> & Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      agencies: TableDefinition<AgencyRow, "name" | "slug">;
      profiles: TableDefinition<ProfileRow, "id" | "email">;
      agency_memberships: TableDefinition<
        AgencyMembershipRow,
        "agency_id" | "user_id" | "role"
      >;
      client_accounts: TableDefinition<ClientAccountRow, "agency_id" | "name">;
      client_memberships: TableDefinition<
        ClientMembershipRow,
        "agency_id" | "client_account_id" | "user_id"
      >;
      invitations: TableDefinition<
        InvitationRow,
        | "agency_id"
        | "email"
        | "agency_role"
        | "token_hash"
        | "expires_at"
        | "invited_by"
      >;
      properties: TableDefinition<
        PropertyRow,
        "agency_id" | "client_account_id" | "name"
      >;
      property_team_assignments: TableDefinition<
        PropertyTeamAssignmentRow,
        "agency_id" | "property_id" | "user_id"
      >;
      service_contracts: TableDefinition<
        ServiceContractRow,
        "agency_id" | "client_account_id" | "title"
      >;
      contract_deliverables: TableDefinition<
        ContractDeliverableRow,
        "agency_id" | "contract_id" | "name"
      >;
      payment_schedule_items: TableDefinition<
        PaymentScheduleItemRow,
        "agency_id" | "client_account_id" | "contract_id" | "due_on" | "amount"
      >;
      payment_records: TableDefinition<
        PaymentRecordRow,
        "agency_id" | "client_account_id" | "amount" | "paid_on"
      >;
      media_assets: TableDefinition<
        MediaAssetRow,
        "agency_id" | "property_id" | "kind" | "title"
      >;
      media_versions: TableDefinition<
        MediaVersionRow,
        | "agency_id"
        | "media_asset_id"
        | "version_number"
        | "storage_path"
        | "original_filename"
        | "mime_type"
        | "byte_size"
      >;
      review_comments: TableDefinition<
        ReviewCommentRow,
        "agency_id" | "media_asset_id" | "media_version_id" | "author_id" | "body"
      >;
      review_approval_events: TableDefinition<
        ReviewApprovalEventRow,
        "agency_id" | "media_asset_id" | "media_version_id" | "decision" | "actor_id"
      >;
      calendar_events: TableDefinition<
        CalendarEventRow,
        "agency_id" | "title" | "starts_at" | "created_by"
      >;
      calendar_event_assignees: TableDefinition<
        CalendarEventAssigneeRow,
        "agency_id" | "calendar_event_id" | "user_id"
      >;
      tasks: TableDefinition<TaskRow, "agency_id" | "title" | "created_by">;
      notes: TableDefinition<NoteRow, "agency_id" | "body" | "created_by">;
      record_attachments: TableDefinition<
        RecordAttachmentRow,
        | "agency_id"
        | "storage_path"
        | "original_filename"
        | "mime_type"
        | "byte_size"
      >;
      gear_items: TableDefinition<
        GearItemRow,
        "agency_id" | "asset_tag" | "name" | "category"
      >;
      gear_custody_history: TableDefinition<
        GearCustodyHistoryRow,
        "agency_id" | "gear_item_id" | "action" | "transferred_by"
      >;
      finance_accounts: TableDefinition<
        FinanceAccountRow,
        "agency_id" | "name" | "account_type"
      >;
      finance_categories: TableDefinition<
        FinanceCategoryRow,
        "agency_id" | "name" | "applies_to"
      >;
      finance_transactions: TableDefinition<
        FinanceTransactionRow,
        | "agency_id"
        | "account_id"
        | "transaction_type"
        | "amount"
        | "occurred_on"
        | "description"
      >;
      finance_debts: TableDefinition<
        FinanceDebtRow,
        "agency_id" | "direction" | "counterparty" | "original_amount" | "outstanding_amount"
      >;
      finance_debt_payments: TableDefinition<
        FinanceDebtPaymentRow,
        "agency_id" | "debt_id" | "amount" | "paid_on"
      >;
      recurring_costs: TableDefinition<
        RecurringCostRow,
        "agency_id" | "name" | "amount" | "starts_on" | "next_due_on"
      >;
      recurring_cost_occurrences: TableDefinition<
        RecurringCostOccurrenceRow,
        "agency_id" | "recurring_cost_id" | "due_on" | "amount"
      >;
      notifications: TableDefinition<
        NotificationRow,
        "agency_id" | "recipient_user_id" | "kind" | "title" | "body"
      >;
      notification_preferences: TableDefinition<
        NotificationPreferenceRow,
        "user_id"
      >;
      push_devices: TableDefinition<
        PushDeviceRow,
        "user_id" | "expo_push_token" | "platform"
      >;
      instagram_connections: TableDefinition<
        InstagramConnectionRow,
        | "agency_id"
        | "instagram_business_id"
        | "facebook_page_id"
      >;
      instagram_oauth_states: TableDefinition<
        InstagramOauthStateRow,
        | "state_hash"
        | "agency_id"
        | "initiated_by"
        | "expires_at"
      >;
      instagram_account_daily_metrics: TableDefinition<
        InstagramAccountDailyMetricRow,
        "agency_id" | "connection_id" | "metric_date"
      >;
      instagram_media: TableDefinition<
        InstagramMediaRow,
        | "agency_id"
        | "connection_id"
        | "instagram_media_id"
      >;
      instagram_sync_runs: TableDefinition<
        InstagramSyncRunRow,
        | "agency_id"
        | "connection_id"
        | "status"
        | "trigger_source"
      >;
      tiktok_connections: TableDefinition<
        TikTokConnectionRow,
        | "agency_id"
        | "open_id"
      >;
      tiktok_oauth_states: TableDefinition<
        TikTokOauthStateRow,
        | "state_hash"
        | "agency_id"
        | "initiated_by"
        | "expires_at"
      >;
      tiktok_account_daily_metrics: TableDefinition<
        TikTokAccountDailyMetricRow,
        "agency_id" | "connection_id" | "metric_date"
      >;
      tiktok_media: TableDefinition<
        TikTokMediaRow,
        | "agency_id"
        | "connection_id"
        | "tiktok_video_id"
      >;
      tiktok_sync_runs: TableDefinition<
        TikTokSyncRunRow,
        | "agency_id"
        | "connection_id"
        | "status"
        | "trigger_source"
      >;
      company_documents: TableDefinition<
        CompanyDocumentRow,
        "agency_id" | "kind" | "title"
      >;
      company_document_assignees: TableDefinition<
        CompanyDocumentAssigneeRow,
        "agency_id" | "company_document_id" | "user_id"
      >;
      company_document_folders: TableDefinition<
        CompanyDocumentFolderRow,
        "agency_id" | "scope" | "name"
      >;
      company_credentials: TableDefinition<
        CompanyCredentialRow,
        "agency_id" | "label"
      >;
      jobs: TableDefinition<
        JobRow,
        "agency_id" | "name" | "created_by"
      >;
      cabana_scripts: TableDefinition<
        CabanaScriptRow,
        "agency_id" | "title" | "script"
      >;
      agency_leads: TableDefinition<
        AgencyLeadRow,
        "agency_id" | "research_name"
      >;
      marketing_content: TableDefinition<
        MarketingContentRow,
        "agency_id" | "title"
      >;
      audit_events: TableDefinition<
        AuditEventRow,
        "agency_id" | "action" | "entity_schema" | "entity_table"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      list_assigned_event_property_covers: {
        Args: Record<PropertyKey, never>;
        Returns: {
          calendar_event_id: UUID;
          property_id: UUID;
          property_name: string;
          cover_image_path: string | null;
        }[];
      };
      bootstrap_first_admin: {
        Args: {
          p_owner_user_id: UUID;
          p_agency_name?: string;
          p_agency_slug?: string;
        };
        Returns: UUID;
      };
      admin_attach_client_user: {
        Args: {
          p_agency_id: UUID;
          p_auth_user_id: UUID;
          p_client_account_id: UUID;
          p_client_role?: ClientMembershipRole;
          p_full_name?: string | null;
        };
        Returns: UUID;
      };
      admin_attach_team_user: {
        Args: {
          p_agency_id: UUID;
          p_auth_user_id: UUID;
          p_full_name?: string | null;
        };
        Returns: UUID;
      };
      attach_client_user: {
        Args: {
          p_agency_id: UUID;
          p_auth_user_id: UUID;
          p_client_account_id: UUID;
          p_client_role?: ClientMembershipRole;
          p_full_name?: string | null;
        };
        Returns: UUID;
      };
      create_invitation: {
        Args: {
          p_agency_id: UUID;
          p_email: string;
          p_agency_role: AgencyRole;
          p_client_account_id?: UUID | null;
          p_client_role?: ClientMembershipRole | null;
          p_expires_at?: ISODateTime;
        };
        Returns: {
          invitation_id: UUID;
          token: string;
          expires_at: ISODateTime;
        }[];
      };
      accept_invitation: {
        Args: { p_token: string };
        Returns: {
          agency_id: UUID;
          client_account_id: UUID | null;
          agency_role: AgencyRole;
        }[];
      };
      acknowledge_gear_transfer: {
        Args: { p_history_id: UUID };
        Returns: undefined;
      };
      set_agency_member_access: {
        Args: {
          p_membership_id: UUID;
          p_status: MembershipStatus;
          p_title?: string | null;
        };
        Returns: undefined;
      };
      set_client_member_access: {
        Args: {
          p_membership_id: UUID;
          p_status: MembershipStatus;
          p_role: ClientMembershipRole;
        };
        Returns: undefined;
      };
      set_property_team_assignments: {
        Args: {
          p_agency_id: UUID;
          p_user_id: UUID;
          p_property_ids: UUID[];
        };
        Returns: number;
      };
      archive_client_workspace: {
        Args: {
          p_client_account_id: UUID;
        };
        Returns: undefined;
      };
      archive_property_workspace: {
        Args: {
          p_property_id: UUID;
        };
        Returns: undefined;
      };
      archive_service_agreement: {
        Args: {
          p_agreement_id: UUID;
        };
        Returns: undefined;
      };
      register_push_device: {
        Args: {
          p_expo_push_token: string;
          p_platform: "ios" | "android";
          p_device_name?: string | null;
          p_app_version?: string | null;
        };
        Returns: undefined;
      };
      disable_push_device: {
        Args: {
          p_expo_push_token: string;
        };
        Returns: undefined;
      };
      upsert_instagram_connection_secret: {
        Args: {
          p_access_token: string;
          p_agency_id: UUID;
          p_client_account_id: UUID;
          p_connected_by: UUID;
          p_display_name: string;
          p_facebook_page_id: string;
          p_facebook_page_name: string;
          p_instagram_business_id: string;
          p_profile_picture_url: string;
          p_token_expires_at: ISODateTime | null;
          p_username: string;
        };
        Returns: UUID;
      };
      get_instagram_connection_secret: {
        Args: { p_connection_id: UUID };
        Returns: string | null;
      };
      disconnect_instagram_connection: {
        Args: { p_connection_id: UUID };
        Returns: undefined;
      };
    };
    Enums: {
      agency_role: AgencyRole;
      membership_status: MembershipStatus;
      client_membership_role: ClientMembershipRole;
      invitation_status: InvitationStatus;
      property_status: PropertyStatus;
      contract_status: ContractStatus;
      billing_frequency: BillingFrequency;
      deliverable_status: DeliverableStatus;
      payment_status: PaymentStatus;
      media_kind: MediaKind;
      media_status: MediaStatus;
      comment_visibility: CommentVisibility;
      comment_status: CommentStatus;
      review_decision: ReviewDecision;
      record_visibility: RecordVisibility;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      gear_status: GearStatus;
      gear_custody_action: GearCustodyAction;
      finance_account_type: FinanceAccountType;
      finance_transaction_type: FinanceTransactionType;
      debt_direction: DebtDirection;
      debt_status: DebtStatus;
      recurrence_frequency: RecurrenceFrequency;
      notification_kind: NotificationKind;
      instagram_connection_status: InstagramConnectionStatus;
      lead_status: LeadStatus;
      company_document_kind: CompanyDocumentKind;
      marketing_content_status: MarketingContentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type PublicSchema = Database["public"];
export type TableName = keyof PublicSchema["Tables"];
export type Tables<T extends TableName> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends TableName> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends TableName> = PublicSchema["Tables"][T]["Update"];
