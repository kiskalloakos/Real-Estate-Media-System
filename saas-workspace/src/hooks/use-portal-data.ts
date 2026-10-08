import { upcomingEvents } from '@/lib/upcoming-events';
import { fulfillmentCompletion } from '@/lib/monthly-fulfillment';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type {
  AgencyMemberSummary,
  AgreementSummary,
  CalendarEvent,
  ClientSummary,
  ClientMemberSummary,
  CompanyDocumentSummary,
  DebtItem,
  FinanceAccountSummary,
  FinanceMoneyMovementItem,
  GearHistoryItem,
  GearItem,
  InstagramAccountSummary,
  JobSummary,
  LeadSummary,
  MarketingContentSummary,
  NoteItem,
  PaymentRecord,
  PortalData,
  PropertySummary,
  PropertyTeamAssignmentSummary,
  RecurringCostItem,
  ReviewItem,
  TaskSummary,
  TikTokAccountSummary,
  WorkStatus,
} from '@/screens/web/types';

function throwIfError(label: string, error: { message: string } | null) {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

function isMissingMarketingScheduleColumn(message: string | undefined) {
  return Boolean(
    message
    && /marketing_content/i.test(message)
    && /\b(planned_until|all_day|assignee_user_ids)\b/i.test(message),
  );
}

function isMissingJobsTable(error: { code?: string; message?: string } | null) {
  return error?.code === 'PGRST205'
    || /(?:could not find|relation).+jobs.+(?:schema cache|does not exist)/i.test(error?.message ?? '');
}

async function fetchMarketingContent(agencyId: string) {
  if (!supabase) return { data: [], error: null };
  const scheduled = await supabase
    .from('marketing_content')
    .select(
      'id, title, platform, content_type, body, caption, planned_for, planned_until, all_day, status, assignee_user_ids',
    )
    .eq('agency_id', agencyId)
    .is('archived_at', null)
    .neq('status', 'archived')
    .order('planned_for', { ascending: true, nullsFirst: false });
  if (!scheduled.error || !isMissingMarketingScheduleColumn(scheduled.error.message)) return scheduled;

  // Keep the portal usable while a deployed database is catching up with the
  // range-scheduling migration. The legacy query intentionally omits only the
  // newly introduced columns and supplies their safe defaults below.
  const legacy = await supabase
    .from('marketing_content')
    .select('id, title, platform, content_type, body, caption, planned_for, status')
    .eq('agency_id', agencyId)
    .is('archived_at', null)
    .neq('status', 'archived')
    .order('planned_for', { ascending: true, nullsFirst: false });
  return {
    data: (legacy.data ?? []).map((item) => ({
      ...item,
      all_day: false,
      assignee_user_ids: [],
      planned_until: null,
    })),
    error: legacy.error,
  };
}

async function fetchCompanyDocumentAssignees(agencyId: string) {
  if (!supabase) return { data: [], error: null };
  const result = await supabase
    .from('company_document_assignees')
    .select('company_document_id, user_id')
    .eq('agency_id', agencyId);
  const isMissingTable = result.error?.code === 'PGRST205'
    || /(?:could not find|relation).+company_document_assignees.+(?:schema cache|does not exist)/i
      .test(result.error?.message ?? '');
  if (!result.error || !isMissingTable) return result;

  // Keep existing document views available until this release's migration has
  // reached the database. Saves still fail clearly instead of pretending that
  // an assignment was persisted.
  return { data: [], error: null };
}

function statusForProperty(status: string): WorkStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'paused':
      return 'scheduled';
    case 'archived':
      return 'complete';
    case 'onboarding':
    default:
      return 'draft';
  }
}

function statusForReview(status: string): ReviewItem['status'] {
  switch (status) {
    case 'ready_for_review':
      return 'in_review';
    case 'changes_requested':
      return 'needs_changes';
    case 'approved':
      return 'approved';
    case 'draft':
    default:
      return 'draft';
  }
}

function formatTime(value: string | null) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(value));
}

function calendarDate(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((item) => item.type === type)?.value
  );
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatTimestamp(secondsValue: unknown) {
  const seconds = Number(secondsValue ?? 0);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function clientTeamFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const assignments = (metadata as { teamAssignments?: unknown }).teamAssignments;
  if (!Array.isArray(assignments)) return [];
  return assignments.flatMap((assignment) => {
    if (!assignment || typeof assignment !== 'object') return [];
    const role = (assignment as { role?: unknown }).role;
    const userId = (assignment as { userId?: unknown }).userId;
    return typeof role === 'string' && typeof userId === 'string'
      ? [{ role, userId }]
      : [];
  });
}

async function signedUrl(
  bucket: string,
  path: string | null | undefined,
  imageSize?: number,
) {
  if (!path || !supabase) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(
      path,
      60 * 60 * 12,
      imageSize
        ? {
            transform: {
              height: imageSize,
              quality: 80,
              resize: 'cover',
              width: imageSize,
            },
          }
        : undefined,
    );
  return error ? undefined : data.signedUrl;
}

async function fetchPortalData(agencyId: string): Promise<PortalData> {
  if (!supabase) {
    return {};
  }

  const marketingContentPromise = fetchMarketingContent(agencyId);
  const companyDocumentAssigneePromise = fetchCompanyDocumentAssignees(agencyId);
  const [
    clientResult,
    contractResult,
    deliverableResult,
    propertyResult,
    propertyAssignmentResult,
    mediaResult,
    versionResult,
    commentResult,
    calendarResult,
    calendarAssigneeResult,
    taskResult,
    taskAttachmentResult,
    noteResult,
    paymentResult,
    gearResult,
    gearHistoryResult,
    debtResult,
    archivedDebtResult,
    debtPaymentResult,
    recurringResult,
    recurringOccurrenceResult,
    financeAccountResult,
    financeTransactionResult,
    agencyMembershipResult,
    clientMembershipResult,
    profileResult,
    instagramConnectionResult,
    jobResult,
    instagramMetricResult,
    instagramMediaResult,
    tiktokConnectionResult,
    tiktokMetricResult,
    tiktokMediaResult,
    companyDocumentFolderResult,
    companyDocumentResult,
    companyDocumentAssigneeResult,
    leadResult,
    marketingContentResult,
    assignedEventPropertyCoverResult,
  ] = await Promise.all([
    supabase
      .from('client_accounts')
      .select(
        'id, name, owner_name, billing_email, location_label, profile_image_path, metadata, archived_at',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_contracts')
      .select(
        'id, client_account_id, title, status, recurring_amount, total_contract_value, currency, starts_on, ends_on, summary, contract_file_path',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null),
    supabase
      .from('contract_deliverables')
      .select('id, contract_id, name, quantity, cadence, status, completed_at')
      .eq('agency_id', agencyId),
    supabase
      .from('properties')
      .select(
        'id, client_account_id, name, description, scripting_brief, location_label, status, cover_image_path, updated_at',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('property_team_assignments')
      .select('id, property_id, user_id, assignment_label, assigned_at')
      .eq('agency_id', agencyId)
      .order('assigned_at', { ascending: true }),
    supabase
      .from('media_assets')
      .select('id, property_id, kind, title, description, status, updated_at')
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('media_versions')
      .select('id, media_asset_id, version_number, duration_seconds, storage_path, mime_type, created_at')
      .eq('agency_id', agencyId)
      .order('version_number', { ascending: false }),
    supabase
      .from('review_comments')
      .select('id, media_asset_id, author_id, body, timestamp_seconds, created_at')
      .eq('agency_id', agencyId),
    supabase
      .from('calendar_events')
      .select(
        'id, client_account_id, property_id, title, starts_at, ends_at, all_day, location, description, visibility, color',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('starts_at', { ascending: true }),
    supabase
      .from('calendar_event_assignees')
      .select('calendar_event_id, user_id')
      .eq('agency_id', agencyId),
    supabase
      .from('tasks')
      .select(
        'id, client_account_id, property_id, title, description, status, priority, due_at, completed_at, visibility, assignee_user_id, created_by, created_at, archived_at',
      )
      .eq('agency_id', agencyId)
      .order('due_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('record_attachments')
      .select('id, task_id, client_account_id, storage_path, original_filename, mime_type, uploaded_by, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: true }),
    supabase
      .from('notes')
      .select('id, title, body, visibility, created_at')
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('payment_schedule_items')
      .select(
        'id, client_account_id, contract_id, label, due_on, amount, currency, status, paid_at, invoice_reference, client_note, archived_at',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('due_on', { ascending: false }),
    supabase
      .from('gear_items')
      .select(
        'id, asset_tag, name, category, notes, serial_number, status, current_location, home_location, current_custodian_user_id',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('name'),
    supabase
      .from('gear_custody_history')
      .select('id, gear_item_id, action, to_location, note, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('finance_debts')
      .select(
        'id, counterparty, description, direction, due_on, original_amount, outstanding_amount, notes',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('due_on', { ascending: true }),
    supabase
      .from('finance_debts')
      .select(
        'id, counterparty, description, direction, due_on, original_amount, outstanding_amount, notes, archived_at',
      )
      .eq('agency_id', agencyId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false }),
    supabase
      .from('finance_debt_payments')
      .select('debt_id, paid_on')
      .eq('agency_id', agencyId)
      .order('paid_on', { ascending: false }),
    supabase
      .from('recurring_costs')
      .select('id, name, amount, frequency, interval_count, next_due_on, starts_on, vendor, notes, is_active')
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .eq('is_active', true)
      .order('next_due_on', { ascending: true }),
    supabase
      .from('recurring_cost_occurrences')
      .select('recurring_cost_id, due_on, status, paid_at')
      .eq('agency_id', agencyId),
    supabase
      .from('finance_accounts')
      .select(
        'id, name, account_type, currency, opening_balance, institution_name, account_reference, notes',
      )
      .eq('agency_id', agencyId)
      .eq('currency', 'RON')
      .eq('is_active', true)
      .is('archived_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('finance_transactions')
      .select(
        'id, account_id, transaction_type, amount, occurred_on, counterparty, description',
      )
      .eq('agency_id', agencyId)
      .order('occurred_on', { ascending: false }),
    supabase
      .from('agency_memberships')
      .select('id, user_id, role, status, title')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: true }),
    supabase
      .from('client_memberships')
      .select('id, client_account_id, user_id, role, status')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_path, phone'),
    supabase
      .from('instagram_connections')
      .select(
        'id, client_account_id, username, display_name, profile_picture_url, status, connected_at, last_synced_at, last_sync_error',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .neq('status', 'disconnected')
      .order('connected_at', { ascending: false }),
    supabase
      .from('jobs')
      .select('id, client_account_id, property_id, name, kind, status, brief, starts_on, due_on')
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('due_on', { ascending: true, nullsFirst: false }),
    supabase
      .from('instagram_account_daily_metrics')
      .select(
        'connection_id, metric_date, followers_count, media_count, views, reach, profile_views',
      )
      .eq('agency_id', agencyId)
      .gte(
        'metric_date',
        new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      )
      .order('metric_date', { ascending: true }),
    supabase
      .from('instagram_media')
      .select(
        'instagram_media_id, connection_id, caption, media_type, permalink, thumbnail_url, posted_at, views, reach, likes, comments, shares, saves, total_interactions',
      )
      .eq('agency_id', agencyId)
      .gte(
        'posted_at',
        new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order('posted_at', { ascending: false }),
    supabase
      .from('tiktok_connections')
      .select(
        'id, client_account_id, username, display_name, profile_picture_url, profile_url, status, connected_at, last_synced_at, last_sync_error',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .neq('status', 'disconnected')
      .order('connected_at', { ascending: false }),
    supabase
      .from('tiktok_account_daily_metrics')
      .select(
        'connection_id, metric_date, followers_count, media_count, views, likes, comments, shares, saves, total_interactions',
      )
      .eq('agency_id', agencyId)
      .gte(
        'metric_date',
        new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      )
      .order('metric_date', { ascending: true }),
    supabase
      .from('tiktok_media')
      .select(
        'tiktok_video_id, connection_id, caption, media_type, permalink, thumbnail_url, posted_at, views, likes, comments, shares, saves, total_interactions',
      )
      .eq('agency_id', agencyId)
      .gte(
        'posted_at',
        new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order('posted_at', { ascending: false }),
    supabase
      .from('company_document_folders')
      .select('id, name, parent_folder_id, scope')
      .eq('agency_id', agencyId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('company_documents')
      .select(
        'id, folder_id, kind, title, content_html, storage_path, original_filename, mime_type, sales_document_type, caller_list, updated_at',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    companyDocumentAssigneePromise,
    supabase
      .from('agency_leads')
      .select(
        'id, research_name, county, location, phone_number, website, instagram, facebook, tiktok, listing_link, notes, status, source_list',
      )
      .eq('agency_id', agencyId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    marketingContentPromise,
    supabase.rpc('list_assigned_event_property_covers'),
  ]);

  [
    ['Clients', clientResult.error],
    ['Contracts', contractResult.error],
    ['Deliverables', deliverableResult.error],
    ['Properties', propertyResult.error],
    ['Property assignments', propertyAssignmentResult.error],
    ['Reviews', mediaResult.error],
    ['Review versions', versionResult.error],
    ['Review comments', commentResult.error],
    ['Calendar', calendarResult.error],
    ['Calendar assignees', calendarAssigneeResult.error],
    ['Tasks', taskResult.error],
    ['Task attachments', taskAttachmentResult.error],
    ['Notes', noteResult.error],
    ['Payments', paymentResult.error],
    ['Gear', gearResult.error],
    ['Gear history', gearHistoryResult.error],
    ['Debts', debtResult.error],
    ['Recurring costs', recurringResult.error],
    ['Recurring occurrences', recurringOccurrenceResult.error],
    ['Finance accounts', financeAccountResult.error],
    ['Finance income', financeTransactionResult.error],
    ['Agency memberships', agencyMembershipResult.error],
    ['Client memberships', clientMembershipResult.error],
    ['Profiles', profileResult.error],
    ['Instagram connections', instagramConnectionResult.error],
    ['Jobs', isMissingJobsTable(jobResult.error) ? null : jobResult.error],
    ['Instagram account metrics', instagramMetricResult.error],
    ['Instagram media', instagramMediaResult.error],
    ['Company document folders', companyDocumentFolderResult.error],
    ['Company documents', companyDocumentResult.error],
    ['Company document assignees', companyDocumentAssigneeResult.error],
    ['Leads', leadResult.error],
    ['Marketing content', marketingContentResult.error],
    ['Assigned event property covers', assignedEventPropertyCoverResult.error],
  ].forEach(([label, error]) =>
    throwIfError(String(label), error as { message: string } | null),
  );

  const clientsById = new Map(
    (clientResult.data ?? []).map((client) => [client.id, client]),
  );
  const jobs: JobSummary[] = (isMissingJobsTable(jobResult.error) ? [] : jobResult.data ?? []).map((job) => ({
    brief: job.brief ?? '',
    clientId: job.client_account_id ?? undefined,
    dueOn: job.due_on ?? undefined,
    id: job.id,
    kind: job.kind,
    name: job.name,
    propertyId: job.property_id ?? undefined,
    startsOn: job.starts_on ?? undefined,
    status: job.status,
  }));
  const contractsByClient = new Map<
    string,
    NonNullable<typeof contractResult.data>[number]
  >();
  for (const contract of contractResult.data ?? []) {
    const current = contractsByClient.get(contract.client_account_id);
    if (!current || contract.status === 'active') {
      contractsByClient.set(contract.client_account_id, contract);
    }
  }

  const deliverablesByContract = new Map<string, number>();
  for (const deliverable of deliverableResult.data ?? []) {
    deliverablesByContract.set(
      deliverable.contract_id,
      (deliverablesByContract.get(deliverable.contract_id) ?? 0) +
        Number(deliverable.quantity),
    );
  }

  const propertyRows = propertyResult.data ?? [];
  const assignedEventPropertyCoverRows = assignedEventPropertyCoverResult.data ?? [];
  const propertyCountByClient = new Map<string, number>();
  for (const property of propertyRows) {
    propertyCountByClient.set(
      property.client_account_id,
      (propertyCountByClient.get(property.client_account_id) ?? 0) + 1,
    );
  }

  const [
    clientAvatarEntries,
    propertyCoverEntries,
    contractFileEntries,
    mediaVersionEntries,
    companyDocumentEntries,
    attachmentEntries,
    profileAvatarEntries,
    assignedEventPropertyCoverEntries,
  ] = await Promise.all([
    Promise.all(
      (clientResult.data ?? []).map(async (client) => [
        client.id,
        await signedUrl('client-files', client.profile_image_path, 160),
      ] as const),
    ),
    Promise.all(
      propertyRows.map(async (property) => [
        property.id,
        await signedUrl('client-files', property.cover_image_path),
      ] as const),
    ),
    Promise.all(
      (contractResult.data ?? []).map(async (contract) => [
        contract.id,
        await signedUrl('client-files', contract.contract_file_path),
      ] as const),
    ),
    Promise.all(
      (versionResult.data ?? []).map(async (version) => [
        version.id,
        await signedUrl('media-review', version.storage_path),
      ] as const),
    ),
    Promise.all(
      (companyDocumentResult.data ?? []).map(async (document) => [
        document.id,
        await signedUrl('agency-files', document.storage_path),
      ] as const),
    ),
    Promise.all(
      (taskAttachmentResult.data ?? []).map(async (attachment) => [
        attachment.id,
        await signedUrl(
          attachment.storage_path.includes('/_account/contracts/') ? 'client-files' : 'agency-files',
          attachment.storage_path,
        ),
      ] as const),
    ),
    Promise.all(
      (profileResult.data ?? []).map(async (profile) => [
        profile.id,
        await signedUrl('avatars', profile.avatar_path, 160),
      ] as const),
    ),
    Promise.all(
      assignedEventPropertyCoverRows.map(async (eventProperty) => [
        eventProperty.calendar_event_id,
        await signedUrl('client-files', eventProperty.cover_image_path),
      ] as const),
    ),
  ]);
  const clientAvatarUrls = new Map(clientAvatarEntries);
  const propertyCoverUrls = new Map(propertyCoverEntries);
  const contractFileUrls = new Map(contractFileEntries);
  const mediaVersionUrls = new Map(mediaVersionEntries);
  const companyDocumentUrls = new Map(companyDocumentEntries);
  const attachmentUrls = new Map(attachmentEntries);
  const profileAvatarUrls = new Map(profileAvatarEntries);
  const assignedEventPropertyCoverUrls = new Map(assignedEventPropertyCoverEntries);
  const assignedEventPropertiesByEvent = new Map(
    assignedEventPropertyCoverRows.map((eventProperty) => [
      eventProperty.calendar_event_id,
      eventProperty,
    ]),
  );
  const profileNames = new Map(
    (profileResult.data ?? []).map((profile) => [
      profile.id,
      profile.full_name ?? 'Workspace member',
    ]),
  );
  const profilesById = new Map(
    (profileResult.data ?? []).map((profile) => [profile.id, profile]),
  );
  const attachmentsByTask = new Map<string, TaskSummary['attachments']>();
  for (const attachment of taskAttachmentResult.data ?? []) {
    if (!attachment.task_id) continue;
    const current = attachmentsByTask.get(attachment.task_id) ?? [];
    current.push({
      id: attachment.id,
      mimeType: attachment.mime_type,
      name: attachment.original_filename,
      uploadedAt: attachment.created_at,
      uploadedByName: attachment.uploaded_by
        ? profileNames.get(attachment.uploaded_by) ?? 'Workspace member'
        : 'Workspace member',
      url: attachmentUrls.get(attachment.id),
    });
    attachmentsByTask.set(attachment.task_id, current);
  }
  const propertyAssignments: PropertyTeamAssignmentSummary[] = (
    propertyAssignmentResult.data ?? []
  ).map((assignment) => ({
    assignedAt: assignment.assigned_at,
    id: assignment.id,
    label: assignment.assignment_label ?? undefined,
    propertyId: assignment.property_id,
    userId: assignment.user_id,
  }));
  const assignmentsByProperty = new Map<
    string,
    PropertyTeamAssignmentSummary[]
  >();
  for (const assignment of propertyAssignments) {
    const current = assignmentsByProperty.get(assignment.propertyId) ?? [];
    current.push(assignment);
    assignmentsByProperty.set(assignment.propertyId, current);
  }

  const agencyMembers: AgencyMemberSummary[] = (agencyMembershipResult.data ?? [])
    .filter(
      (membership) =>
        membership.role === 'admin' || membership.role === 'team_member',
    )
    .map((membership) => {
      const profile = profilesById.get(membership.user_id);
      return {
        avatarUrl: profileAvatarUrls.get(membership.user_id),
        email: profile?.email ?? '',
        id: membership.id,
        name: profile?.full_name ?? profile?.email ?? 'Realty Media member',
        phone: profile?.phone ?? undefined,
        role: membership.role as AgencyMemberSummary['role'],
        status: membership.status,
        title: membership.title ?? undefined,
        userId: membership.user_id,
      };
    });

  const clientMembers: ClientMemberSummary[] = (clientMembershipResult.data ?? [])
    .map((membership) => {
      const profile = profilesById.get(membership.user_id);
      return {
        avatarUrl: profileAvatarUrls.get(membership.user_id),
        clientAccountId: membership.client_account_id,
        clientName:
          clientsById.get(membership.client_account_id)?.name ?? 'Realty Media client',
        email: profile?.email ?? '',
        id: membership.id,
        name: profile?.full_name ?? profile?.email ?? 'Client member',
        role: membership.role,
        status: membership.status,
        userId: membership.user_id,
      };
    });

  const clients: ClientSummary[] = (clientResult.data ?? []).map((client) => {
    const contract = contractsByClient.get(client.id);

    return {
      assignedTeam: clientTeamFromMetadata(client.metadata),
      avatarUrl: clientAvatarUrls.get(client.id),
      contactName: client.owner_name ?? client.name,
      email: client.billing_email ?? '',
      id: client.id,
      location: client.location_label ?? 'Location pending',
      monthlyDeliverables: contract
        ? Math.round(deliverablesByContract.get(contract.id) ?? 0)
        : 0,
      monthlyPrice: Number(contract?.recurring_amount ?? 0),
      name: client.name,
      nextShoot: undefined,
      propertiesCount: propertyCountByClient.get(client.id) ?? 0,
      status:
        contract?.status === 'active'
          ? 'active'
          : contract?.status === 'paused'
            ? 'paused'
            : 'onboarding',
      totalContractValue: Number(contract?.total_contract_value ?? 0),
    };
  });

  const agreements: AgreementSummary[] = (contractResult.data ?? []).map(
    (contract) => ({
      clientId: contract.client_account_id,
      clientName:
        clientsById.get(contract.client_account_id)?.name ?? 'Realty Media client',
      currency: contract.currency,
      deliverables: (deliverableResult.data ?? [])
        .filter((deliverable) => deliverable.contract_id === contract.id)
        .map((deliverable) => ({
          cadence: deliverable.cadence,
          completedAt: deliverable.completed_at ?? undefined,
          id: deliverable.id,
          name: deliverable.name,
          quantity: Number(deliverable.quantity),
          status: deliverable.status,
        })),
      documents: (taskAttachmentResult.data ?? [])
        .filter(
          (attachment) =>
            attachment.client_account_id === contract.client_account_id &&
            attachment.storage_path.includes('/_account/contracts/'),
        )
        .map((attachment) => ({
          id: attachment.id,
          name: attachment.original_filename,
          storagePath: attachment.storage_path,
          url: attachmentUrls.get(attachment.id),
        })),
      endsOn: contract.ends_on ?? undefined,
      filePath: contract.contract_file_path ?? undefined,
      fileUrl: contractFileUrls.get(contract.id),
      id: contract.id,
      monthlyAmount: Number(contract.recurring_amount),
      startsOn: contract.starts_on ?? undefined,
      status: contract.status,
      summary: contract.summary ?? undefined,
      title: contract.title,
      totalValue: Number(contract.total_contract_value ?? 0),
    }),
  );

  const instagramMetricsByConnection = new Map<
    string,
    InstagramAccountSummary['metrics']
  >();
  for (const metric of instagramMetricResult.data ?? []) {
    const current = instagramMetricsByConnection.get(metric.connection_id) ?? [];
    current.push({
      date: metric.metric_date,
      followers:
        metric.followers_count == null ? null : Number(metric.followers_count),
      mediaCount: metric.media_count == null ? null : Number(metric.media_count),
      profileViews: Number(metric.profile_views ?? 0),
      reach: Number(metric.reach ?? 0),
      views: Number(metric.views ?? 0),
    });
    instagramMetricsByConnection.set(metric.connection_id, current);
  }

  const instagramMediaByConnection = new Map<
    string,
    InstagramAccountSummary['media']
  >();
  for (const media of instagramMediaResult.data ?? []) {
    const current = instagramMediaByConnection.get(media.connection_id) ?? [];
    current.push({
      caption: media.caption ?? '',
      comments: Number(media.comments ?? 0),
      id: media.instagram_media_id,
      likes: Number(media.likes ?? 0),
      mediaType: media.media_type ?? 'MEDIA',
      permalink: media.permalink ?? undefined,
      postedAt: media.posted_at ?? undefined,
      reach: Number(media.reach ?? 0),
      saves: Number(media.saves ?? 0),
      shares: Number(media.shares ?? 0),
      thumbnailUrl: media.thumbnail_url ?? undefined,
      totalInteractions: Number(media.total_interactions ?? 0),
      views: Number(media.views ?? 0),
    });
    instagramMediaByConnection.set(media.connection_id, current);
  }

  const instagramAccounts: InstagramAccountSummary[] = (
    instagramConnectionResult.data ?? []
  ).map((connection) => ({
    clientId: connection.client_account_id,
    clientName:
      (connection.client_account_id
        ? clientsById.get(connection.client_account_id)?.name
        : 'Realty Media') ?? 'Realty Media client',
    connectedAt: connection.connected_at,
    displayName:
      connection.display_name ??
      connection.username ??
      'Instagram professional account',
    id: connection.id,
    lastSyncError: connection.last_sync_error ?? undefined,
    lastSyncedAt: connection.last_synced_at ?? undefined,
    media: instagramMediaByConnection.get(connection.id) ?? [],
    metrics: instagramMetricsByConnection.get(connection.id) ?? [],
    profilePictureUrl: connection.profile_picture_url ?? undefined,
    status: connection.status,
    username: connection.username ?? 'instagram',
  }));

  const tiktokMetricsByConnection = new Map<
    string,
    TikTokAccountSummary['metrics']
  >();
  for (const metric of tiktokMetricResult.data ?? []) {
    const current = tiktokMetricsByConnection.get(metric.connection_id) ?? [];
    current.push({
      comments: Number(metric.comments ?? 0),
      date: metric.metric_date,
      followers:
        metric.followers_count == null ? null : Number(metric.followers_count),
      likes: Number(metric.likes ?? 0),
      mediaCount: metric.media_count == null ? null : Number(metric.media_count),
      shares: Number(metric.shares ?? 0),
      totalInteractions: Number(metric.total_interactions ?? 0),
      views: Number(metric.views ?? 0),
    });
    tiktokMetricsByConnection.set(metric.connection_id, current);
  }

  const tiktokMediaByConnection = new Map<
    string,
    TikTokAccountSummary['media']
  >();
  for (const media of tiktokMediaResult.data ?? []) {
    const current = tiktokMediaByConnection.get(media.connection_id) ?? [];
    current.push({
      caption: media.caption ?? '',
      comments: Number(media.comments ?? 0),
      id: media.tiktok_video_id,
      likes: Number(media.likes ?? 0),
      mediaType: media.media_type ?? 'VIDEO',
      permalink: media.permalink ?? undefined,
      postedAt: media.posted_at ?? undefined,
      saves: Number(media.saves ?? 0),
      shares: Number(media.shares ?? 0),
      thumbnailUrl: media.thumbnail_url ?? undefined,
      totalInteractions: Number(media.total_interactions ?? 0),
      views: Number(media.views ?? 0),
    });
    tiktokMediaByConnection.set(media.connection_id, current);
  }

  const tiktokAccounts: TikTokAccountSummary[] = (
    tiktokConnectionResult.data ?? []
  ).map((connection) => ({
    clientId: connection.client_account_id,
    clientName:
      (connection.client_account_id
        ? clientsById.get(connection.client_account_id)?.name
        : 'Realty Media') ?? 'Realty Media client',
    connectedAt: connection.connected_at,
    displayName:
      connection.display_name ??
      connection.username ??
      'TikTok profile',
    id: connection.id,
    lastSyncError: connection.last_sync_error ?? undefined,
    lastSyncedAt: connection.last_synced_at ?? undefined,
    media: tiktokMediaByConnection.get(connection.id) ?? [],
    metrics: tiktokMetricsByConnection.get(connection.id) ?? [],
    profilePictureUrl: connection.profile_picture_url ?? undefined,
    profileUrl: connection.profile_url ?? undefined,
    status: connection.status,
    username: connection.username ?? 'tiktok',
  }));

  const instagramAccountsByClient = new Map<string, InstagramAccountSummary[]>();
  for (const account of instagramAccounts) {
    if (!account.clientId) continue;
    const current = instagramAccountsByClient.get(account.clientId) ?? [];
    current.push(account);
    instagramAccountsByClient.set(account.clientId, current);
  }
  const tiktokAccountsByClient = new Map<string, TikTokAccountSummary[]>();
  for (const account of tiktokAccounts) {
    if (!account.clientId) continue;
    const current = tiktokAccountsByClient.get(account.clientId) ?? [];
    current.push(account);
    tiktokAccountsByClient.set(account.clientId, current);
  }

  const propertiesById = new Map(propertyRows.map((property) => [property.id, property]));
  const properties: PropertySummary[] = propertyRows.map((property) => {
    const accounts = [
      ...(instagramAccountsByClient.get(property.client_account_id) ?? []),
      ...(tiktokAccountsByClient.get(property.client_account_id) ?? []),
    ];
    const rangeStart = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const followers = accounts.reduce((sum, account) => {
      const latest = [...account.metrics]
        .reverse()
        .find((metric) => metric.followers !== null)?.followers;
      return sum + (latest ?? 0);
    }, 0);
    const views = accounts.reduce(
      (sum, account) =>
        sum +
        account.metrics
          .filter((metric) => new Date(metric.date).valueOf() >= rangeStart)
          .reduce((metricSum, metric) => metricSum + metric.views, 0),
      0,
    );
    const recentMedia = accounts.flatMap((account) =>
      account.media.filter(
        (media) => !media.postedAt || new Date(media.postedAt).valueOf() >= rangeStart,
      ),
    );
    const interactions = recentMedia.reduce(
      (sum, media) => sum + media.totalInteractions,
      0,
    );
    const mediaViews = recentMedia.reduce((sum, media) => sum + media.views, 0);
    const compact = (value: number) =>
      new Intl.NumberFormat('en', {
        maximumFractionDigits: 1,
        notation: 'compact',
      }).format(value);

    return {
    analytics: accounts.length
      ? {
          engagement: `${((interactions / Math.max(mediaViews || views, 1)) * 100).toFixed(1)}%`,
          followers: compact(followers),
          views: compact(views),
        }
      : {
          engagement: '—',
          followers: '—',
          views: 'Connect social',
        },
    assignedTeamNames: (assignmentsByProperty.get(property.id) ?? []).map(
      (assignment) =>
        profilesById.get(assignment.userId)?.full_name ??
        profilesById.get(assignment.userId)?.email ??
        'Team member',
    ),
    assignedTeamUserIds: (assignmentsByProperty.get(property.id) ?? []).map(
      (assignment) => assignment.userId,
    ),
    clientId: property.client_account_id,
    clientName:
      clientsById.get(property.client_account_id)?.name ?? 'Realty Media client',
    completion:
      fulfillmentCompletion(agreements.find(agreement => agreement.clientId === property.client_account_id)?.deliverables).percentage,
    coverUrl: propertyCoverUrls.get(property.id) ?? '',
    description: property.description ?? '',
    scriptingBrief: property.scripting_brief ?? '',
    id: property.id,
    location: property.location_label ?? 'Location pending',
    name: property.name,
    nextMilestone:
      property.status === 'onboarding'
        ? 'Complete property brief'
        : 'Open the production calendar',
    status: statusForProperty(property.status),
    workspaceStatus:
      property.status === 'active'
        ? 'active'
        : property.status === 'paused'
          ? 'paused'
          : 'onboarding',
    };
  });

  const versionsByAsset = new Map<
    string,
    NonNullable<typeof versionResult.data>[number]
  >();
  for (const version of versionResult.data ?? []) {
    if (!versionsByAsset.has(version.media_asset_id)) {
      versionsByAsset.set(version.media_asset_id, version);
    }
  }
  const commentsByAsset = new Map<string, ReviewItem['comments']>();
  for (const comment of commentResult.data ?? []) {
    const current = commentsByAsset.get(comment.media_asset_id) ?? [];
    current.push({
      author: profileNames.get(comment.author_id) ?? 'Workspace member',
      avatarUrl: profileAvatarUrls.get(comment.author_id),
      body: comment.body,
      id: comment.id,
      timestamp:
        comment.timestamp_seconds == null
          ? 'General'
          : formatTimestamp(comment.timestamp_seconds),
    });
    commentsByAsset.set(comment.media_asset_id, current);
  }

  const reviews: ReviewItem[] = (mediaResult.data ?? []).map((asset) => {
    const property = propertiesById.get(asset.property_id);
    const client = property
      ? clientsById.get(property.client_account_id)
      : undefined;
    const version = versionsByAsset.get(asset.id);

    return {
      assignee: 'Realty Media',
      clientName: client?.name ?? 'Client',
      comments: commentsByAsset.get(asset.id) ?? [],
      contentHtml: asset.description ?? undefined,
      dueLabel: 'Open review',
      durationSeconds:
        version?.duration_seconds == null ? undefined : Number(version.duration_seconds),
      fileUrl: version ? mediaVersionUrls.get(version.id) : undefined,
      id: asset.id,
      kind: asset.kind,
      mimeType: version?.mime_type,
      propertyId: property?.id,
      propertyName: property?.name ?? 'Property',
      status: statusForReview(asset.status),
      title: asset.title,
      version: version ? `v${version.version_number}` : 'Draft',
    };
  });

  const calendarAssigneesByEvent = new Map<string, string[]>();
  for (const assignment of calendarAssigneeResult.data ?? []) {
    const current = calendarAssigneesByEvent.get(assignment.calendar_event_id) ?? [];
    current.push(assignment.user_id);
    calendarAssigneesByEvent.set(assignment.calendar_event_id, current);
  }
  const calendarEvents: CalendarEvent[] = (calendarResult.data ?? []).map(
    (event) => {
      const property = event.property_id
        ? propertiesById.get(event.property_id)
        : undefined;
      const assignedEventProperty = assignedEventPropertiesByEvent.get(event.id);
      const lowerTitle = event.title.toLowerCase();
      const storedType = event.description?.match(
        /^\[rm:type=(shoot|deadline|review|internal)\]/,
      )?.[1] as CalendarEvent['type'] | undefined;
      const storedWorkScope = event.description?.match(
        /^\[rm:type=(?:shoot|deadline|review|internal)\]\[rm:scope=(internal|client|other)\]/,
      )?.[1] as CalendarEvent['workScope'] | undefined;
      const type: CalendarEvent['type'] = storedType ?? (
        lowerTitle.includes('shoot')
          ? 'shoot'
          : lowerTitle.includes('review')
            ? 'review'
            : lowerTitle.includes('deadline')
              ? 'deadline'
              : 'internal'
      );

      return {
        allDay: event.all_day,
        color: event.color,
        assignee:
          (calendarAssigneesByEvent.get(event.id) ?? [])
            .map((userId) => profileNames.get(userId))
            .filter(Boolean)
        .join(', ') || 'Realty Media',
        assigneeUserIds: calendarAssigneesByEvent.get(event.id) ?? [],
        clientId: event.client_account_id ?? undefined,
        date: calendarDate(event.starts_at),
        description:
          event.description
            ?.replace(/^\[rm:type=(shoot|deadline|review|internal)\](?:\[rm:scope=(internal|client|other)\])?\n?/, '')
            .trim() || undefined,
        end: formatTime(event.ends_at),
        endDate: event.ends_at ? calendarDate(event.ends_at) : calendarDate(event.starts_at),
        id: event.id,
        location: event.location ?? '',
        propertyCoverUrl:
          propertyCoverUrls.get(event.property_id ?? '') ??
          assignedEventPropertyCoverUrls.get(event.id),
        propertyId: event.property_id ?? undefined,
        propertyName: property?.name ?? assignedEventProperty?.property_name ?? 'Agency',
        start: formatTime(event.starts_at),
        title: event.title,
        type,
        visibility: event.visibility,
        workScope: storedWorkScope ?? (event.client_account_id || event.property_id ? 'client' : 'other'),
      };
    },
  );

  const nextShootByClient = new Map<string, CalendarEvent>();
  for (const event of upcomingEvents(calendarEvents).filter((item) => item.type === 'shoot')) {
    const clientId = event.clientId ?? (event.propertyId ? propertiesById.get(event.propertyId)?.client_account_id : undefined);
    if (clientId && !nextShootByClient.has(clientId)) nextShootByClient.set(clientId, event);
  }
  clients.forEach((client) => {
    const nextShoot = nextShootByClient.get(client.id);
    if (nextShoot) client.nextShoot = `${nextShoot.date} · ${nextShoot.start || 'TBC'}`;
  });

  const mappedTasks: TaskSummary[] = (taskResult.data ?? []).map((task) => {
    const property = task.property_id
      ? propertiesById.get(task.property_id)
      : undefined;
    const clientAccount = task.client_account_id
      ? clientsById.get(task.client_account_id)
      : undefined;
    const assignee = task.assignee_user_id
      ? profilesById.get(task.assignee_user_id)
      : undefined;
    const creator = profilesById.get(task.created_by);

    return {
      archivedAt: task.archived_at ?? undefined,
      attachments: attachmentsByTask.get(task.id) ?? [],
      assigneeName:
        assignee?.full_name ?? assignee?.email ?? 'Unassigned',
      assigneeUserId: task.assignee_user_id ?? undefined,
      clientId: task.client_account_id ?? undefined,
      clientName: clientAccount?.name ?? 'Internal',
      completedAt: task.completed_at ?? undefined,
      createdAt: task.created_at,
      createdByName:
        creator?.full_name ?? creator?.email ?? 'Realty Media',
      description: task.description ?? '',
      dueAt: task.due_at ?? undefined,
      id: task.id,
      priority: task.priority,
      propertyId: task.property_id ?? undefined,
      propertyName: property?.name ?? (clientAccount ? 'Client account' : 'Agency'),
      status: task.status,
      title: task.title,
      visibility: task.visibility,
    };
  });
  const tasks = mappedTasks.filter((task) => !task.archivedAt);
  const archivedTasks = mappedTasks.filter((task) => Boolean(task.archivedAt));

  const payments: PaymentRecord[] = (paymentResult.data ?? []).map((payment) => ({
    amount: Number(payment.amount),
    clientNote: payment.client_note ?? undefined,
    clientId: payment.client_account_id,
    clientName:
      clientsById.get(payment.client_account_id)?.name ?? 'Realty Media client',
    contractId: payment.contract_id,
    dueDate: payment.due_on,
    id: payment.id,
    invoice: payment.invoice_reference ?? payment.label ?? 'Manual payment',
    paidDate: payment.paid_at?.slice(0, 10),
    period: payment.label ?? payment.due_on.slice(0, 7),
    scheduleStatus: payment.status,
    status:
      payment.status === 'paid'
        ? 'paid'
        : payment.status === 'late'
          ? 'overdue'
          : payment.status === 'upcoming'
            ? 'upcoming'
            : payment.status === 'waived'
              ? 'waived'
              : payment.status === 'cancelled'
                ? 'cancelled'
                : 'due',
  }));

  const gearEventIdByGearId = new Map<string, string>();
  for (const item of gearHistoryResult.data ?? []) {
    if (gearEventIdByGearId.has(item.gear_item_id) || item.action !== 'placed_on_site') continue;
    const match = item.note?.match(/^\[rm:calendar-event=([^\]]+)\]/);
    if (match?.[1]) gearEventIdByGearId.set(item.gear_item_id, match[1]);
  }
  const calendarEventsById = new Map(calendarEvents.map((event) => [event.id, event]));

  const gear: GearItem[] = (gearResult.data ?? []).map((item) => ({
    assetTag: item.asset_tag,
    assignedTo: item.current_custodian_user_id
      ? profilesById.get(item.current_custodian_user_id)?.full_name
        ?? profilesById.get(item.current_custodian_user_id)?.email
        ?? 'Team member'
      : undefined,
    assignedToUserId: item.current_custodian_user_id ?? undefined,
    category: (
      ['camera', 'lens', 'audio', 'drone', 'lighting', 'support'].includes(
        item.category,
      )
        ? item.category
        : 'support'
    ) as GearItem['category'],
    calendarEventId: gearEventIdByGearId.get(item.id),
    calendarEventTitle: (() => {
      const eventId = gearEventIdByGearId.get(item.id);
      return eventId ? calendarEventsById.get(eventId)?.title : undefined;
    })(),
    id: item.id,
    location: item.current_location ?? item.home_location ?? 'Location pending',
    name: item.name,
    notes: item.notes ?? '',
    serial: item.serial_number ?? item.asset_tag,
    status:
      item.status === 'assigned'
        ? 'with_team'
        : item.status === 'on_site'
          ? 'on_site'
          : item.status === 'maintenance' ||
              item.status === 'missing' ||
              item.status === 'retired'
            ? 'maintenance'
            : 'available',
  }));

  const gearHistory: GearHistoryItem[] = (gearHistoryResult.data ?? []).map(
    (item) => ({
      action: item.action,
      createdAt: item.created_at,
      gearId: item.gear_item_id,
      id: item.id,
      location: item.to_location ?? undefined,
      note: item.note ?? undefined,
    }),
  );

  const debts: DebtItem[] = (debtResult.data ?? []).map((debt) => ({
    amount: Number(debt.original_amount),
    direction: debt.direction === 'receivable' ? 'receivable' : 'payable',
    dueOn: debt.due_on ?? undefined,
    id: debt.id,
    name: debt.counterparty,
    note: debt.notes ?? debt.description ?? '',
    paid: Math.max(
      0,
      Number(debt.original_amount) - Number(debt.outstanding_amount),
    ),
  }));

  const latestDebtPaymentDates = new Map<string, string>();
  for (const payment of debtPaymentResult.data ?? []) {
    if (!latestDebtPaymentDates.has(payment.debt_id)) {
      latestDebtPaymentDates.set(payment.debt_id, payment.paid_on);
    }
  }

  const archivedDebts: DebtItem[] = (archivedDebtResult.data ?? []).map((debt) => ({
    amount: Number(debt.original_amount),
    archivedAt: debt.archived_at ?? undefined,
    direction: debt.direction === 'receivable' ? 'receivable' : 'payable',
    dueOn: debt.due_on ?? undefined,
    id: debt.id,
    lastPaidOn: latestDebtPaymentDates.get(debt.id),
    name: debt.counterparty,
    note: debt.notes ?? debt.description ?? '',
    paid: Math.max(0, Number(debt.original_amount) - Number(debt.outstanding_amount)),
  }));

  const costs: RecurringCostItem[] = (recurringResult.data ?? []).map((cost) => {
    const frequency =
      cost.frequency === 'monthly'
        ? 'Monthly'
        : cost.frequency === 'quarterly'
          ? 'Quarterly'
          : cost.frequency === 'yearly'
            ? 'Yearly'
            : cost.frequency === 'weekly'
              ? 'Weekly'
              : `Every ${cost.interval_count} months`;

    return {
      amount: Number(cost.amount),
      due: cost.next_due_on,
      frequency,
      frequencyKey: cost.frequency === 'weekly' || cost.frequency === 'quarterly' || cost.frequency === 'yearly' || cost.frequency === 'monthly'
        ? cost.frequency
        : 'quarterly',
      id: cost.id,
      name: cost.name,
      notes: cost.notes ?? '',
      paid: (recurringOccurrenceResult.data ?? []).some(
        (occurrence) =>
          occurrence.recurring_cost_id === cost.id &&
          occurrence.due_on === cost.next_due_on &&
          occurrence.status === 'paid',
      ),
      startsOn: cost.starts_on,
      type: cost.frequency === 'monthly' ? 'monthly' : 'periodic',
      vendor: cost.vendor ?? '',
    };
  });

  const notes: NoteItem[] = (noteResult.data ?? []).map((note) => ({
    body: note.body,
    createdAt: note.created_at,
    id: note.id,
    title: note.title ?? 'Workspace note',
    visibility: note.visibility,
  }));

  const financeTransactions = financeTransactionResult.data ?? [];
  const accountNames = new Map(
    (financeAccountResult.data ?? []).map((account) => [account.id, account.name]),
  );
  const accountTransactionBalances = financeTransactions.reduce(
    (balances, transaction) => {
      const amount = Number(transaction.amount);
      const effect =
        transaction.transaction_type === 'expense'
          ? -amount
          : transaction.transaction_type === 'income'
            ? amount
            : 0;
      balances.set(
        transaction.account_id,
        (balances.get(transaction.account_id) ?? 0) + effect,
      );
      return balances;
    },
    new Map<string, number>(),
  );
  const financeAccounts: FinanceAccountSummary[] = (
    financeAccountResult.data ?? []
  )
    .filter(
      (account) =>
        account.account_type === 'cash' ||
        account.account_type === 'bank' ||
        account.account_type === 'savings' ||
        account.account_type === 'other',
    )
    .map((account) => ({
      accountReference: account.account_reference ?? undefined,
      accountType: account.account_type as FinanceAccountSummary['accountType'],
      currency: 'RON',
      currentBalance:
        Number(account.opening_balance) +
        (accountTransactionBalances.get(account.id) ?? 0),
      id: account.id,
      institutionName: account.institution_name ?? undefined,
      name: account.name,
      notes: account.notes ?? undefined,
      openingBalance: Number(account.opening_balance),
    }));

  const financeMoneyMovements: FinanceMoneyMovementItem[] = financeTransactions
    .filter((item) => item.transaction_type === 'income' || item.transaction_type === 'expense')
    .map((item) => ({
      accountId: item.account_id,
      accountName: accountNames.get(item.account_id) ?? 'Archived account',
      amount: Number(item.amount),
      counterparty: item.counterparty ?? undefined,
      date: item.occurred_on,
      description: item.description,
      id: item.id,
      transactionType: item.transaction_type as FinanceMoneyMovementItem['transactionType'],
    }));

  const companyDocumentAssigneesByDocument = new Map<string, string[]>();
  for (const assignment of companyDocumentAssigneeResult.data ?? []) {
    const current = companyDocumentAssigneesByDocument.get(assignment.company_document_id) ?? [];
    current.push(assignment.user_id);
    companyDocumentAssigneesByDocument.set(assignment.company_document_id, current);
  }

  const companyDocuments: CompanyDocumentSummary[] = (
    companyDocumentResult.data ?? []
  ).map((document) => ({
    assigneeUserIds: companyDocumentAssigneesByDocument.get(document.id) ?? [],
    callerList: document.caller_list ?? undefined,
    contentHtml: document.content_html ?? undefined,
    fileName: document.original_filename ?? undefined,
    fileUrl: companyDocumentUrls.get(document.id),
    folderId: document.folder_id ?? undefined,
    id: document.id,
    kind: document.kind,
    mimeType: document.mime_type ?? undefined,
    salesDocumentType: document.sales_document_type ?? undefined,
    title: document.title,
    updatedAt: document.updated_at,
  }));

  const companyDocumentFolders = (companyDocumentFolderResult.data ?? []).map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentFolderId: folder.parent_folder_id ?? undefined,
    scope: folder.scope,
  }));

  const leads: LeadSummary[] = (leadResult.data ?? []).map((lead) => ({
    county: lead.county ?? '',
    facebook: lead.facebook ?? '',
    id: lead.id,
    instagram: lead.instagram ?? '',
    listingLink: lead.listing_link ?? '',
    location: lead.location ?? '',
    notes: typeof lead.notes === 'string' ? lead.notes : '',
    phoneNumber: lead.phone_number ?? '',
    researchName: lead.research_name,
    sourceList: lead.source_list ?? '',
    status: (
      ['contacted', 'interested'].includes(String(lead.status))
        ? 'pending'
        : lead.status
    ) as LeadSummary['status'],
    tiktok: lead.tiktok ?? '',
    website: lead.website ?? '',
  }));

  const marketingContent: MarketingContentSummary[] = (
    marketingContentResult.data ?? []
  ).map((item) => ({
    allDay: item.all_day,
    assigneeUserIds: item.assignee_user_ids ?? [],
    body: item.body ?? '',
    caption: item.caption ?? '',
    contentType: item.content_type ?? '',
    id: item.id,
    plannedFor: item.planned_for ?? undefined,
    plannedUntil: item.planned_until ?? undefined,
    platform: item.platform ?? '',
    status: item.status,
    title: item.title,
  }));

  return {
    agencyMembers,
    agreements,
    archivedTasks,
    calendarEvents,
    clientMembers,
    clients,
    companyDocumentFolders,
    companyDocuments,
    costs,
    debts,
    archivedDebts,
    financeMoneyMovements,
    financeAccounts,
    gear,
    gearHistory,
    instagramAccounts,
    jobs,
    tiktokAccounts,
    leads,
    marketingContent,
    notes,
    payments,
    properties,
    propertyAssignments,
    reviews,
    tasks,
  };
}

export function usePortalData({
  agencyId,
  enabled,
}: {
  agencyId: string | null | undefined;
  enabled: boolean;
}) {
  return useQuery({
    enabled: enabled && Boolean(supabase) && Boolean(agencyId),
    queryFn: () => fetchPortalData(agencyId!),
    queryKey: ['portal-data', agencyId],
  });
}
