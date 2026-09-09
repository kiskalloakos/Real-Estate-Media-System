import { supabase } from '@/lib/supabase';
import type {
  LeadImportInput,
  MoveCompanyDocumentToFolderInput,
  UpsertCompanyDocumentFolderInput,
  UpsertDocumentInput,
  UpsertLeadInput,
  UpsertMarketingContentInput,
} from '@/screens/web/types';

export interface OwnerWorkspaceContext {
  agencyId: string;
  userId: string;
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function nullable(value: string) {
  return value.trim() || null;
}

function plainText(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
}

function isMissingMarketingScheduleColumn(message: string | undefined) {
  return Boolean(
    message
    && /marketing_content/i.test(message)
    && /\b(planned_until|all_day|assignee_user_ids)\b/i.test(message),
  );
}

function safeFileName(value: string) {
  const parts = value.split('.');
  const extension = parts.length > 1 ? `.${parts.pop()}` : '';
  const stem = parts.join('.').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  return `${stem || 'file'}${extension.toLowerCase().replace(/[^a-z0-9.]/g, '')}`;
}

export async function upsertCompanyDocument(
  input: UpsertDocumentInput,
  context: OwnerWorkspaceContext,
) {
  const client = requireClient();
  const title = input.title.trim();
  if (!title) throw new Error('Document title is required.');
  if (!input.contentHtml.trim() && !input.file && !input.documentId) {
    throw new Error('Write something or attach a file.');
  }

  const salesDocumentType = input.kind === 'sales'
    ? input.salesDocumentType ?? 'general'
    : null;
  const callerList = salesDocumentType === 'script'
    ? nullable(input.callerList ?? '')
    : null;
  if (salesDocumentType === 'script' && !callerList) {
    throw new Error('Choose the caller lead list for this script.');
  }
  if (salesDocumentType === 'script' && !plainText(input.contentHtml)) {
    throw new Error('Scripts need document text so callers can read them in the app.');
  }

  let previousStoragePath: string | null = null;
  if (input.documentId && (input.file || input.removeFile)) {
    const { data: existingDocument, error: existingDocumentError } = await client
      .from('company_documents')
      .select('storage_path')
      .eq('id', input.documentId)
      .is('archived_at', null)
      .single();
    if (existingDocumentError) {
      throw new Error(`Could not load the existing attachment: ${existingDocumentError.message}`);
    }
    previousStoragePath = existingDocument.storage_path;
  }

  let storagePath: string | undefined;
  if (input.file) {
    storagePath = `${context.agencyId}/documents/${Date.now()}-${safeFileName(input.file.name)}`;
    const { error: uploadError } = await client.storage
      .from('agency-files')
      .upload(storagePath, input.file, {
        contentType: input.file.type || 'application/octet-stream',
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Could not upload the document: ${uploadError.message}`);
    }
  }

  const payload = {
    content_html: nullable(input.contentHtml),
    caller_list: callerList,
    folder_id: input.folderId || null,
    kind: input.kind,
    sales_document_type: salesDocumentType,
    title,
    ...(storagePath
      ? {
          byte_size: input.file?.size ?? null,
          mime_type: input.file?.type || 'application/octet-stream',
          original_filename: input.file?.name ?? null,
          storage_path: storagePath,
        }
      : {}),
    ...(input.removeFile && !input.file
      ? {
          byte_size: null,
          mime_type: null,
          original_filename: null,
          storage_path: null,
        }
      : {}),
  };

  const result = input.documentId
    ? await client
        .from('company_documents')
        .update(payload)
        .eq('id', input.documentId)
        .is('archived_at', null)
        .select('id')
        .single()
    : await client.from('company_documents').insert({
        ...payload,
        agency_id: context.agencyId,
        created_by: context.userId,
      }).select('id').single();

  if (result.error) {
    throw new Error(`Could not save the document: ${result.error.message}`);
  }

  const { error: clearAssigneesError } = await client
    .from('company_document_assignees')
    .delete()
    .eq('company_document_id', result.data.id);
  if (clearAssigneesError) {
    throw new Error(`Document saved, but its SOP assignments could not be updated: ${clearAssigneesError.message}`);
  }

  const assigneeUserIds = input.kind === 'sop'
    ? [...new Set(input.assigneeUserIds ?? [])]
    : [];
  if (assigneeUserIds.length) {
    const { error: assigneeError } = await client
      .from('company_document_assignees')
      .insert(assigneeUserIds.map((userId) => ({
        agency_id: context.agencyId,
        assigned_by: context.userId,
        company_document_id: result.data.id,
        user_id: userId,
      })));
    if (assigneeError) {
      throw new Error(`Document saved, but its SOP assignees could not be added: ${assigneeError.message}`);
    }
  }

  if (previousStoragePath && (input.file || input.removeFile)) {
    const { error: removeError } = await client.storage
      .from('agency-files')
      .remove([previousStoragePath]);
    if (removeError) {
      throw new Error(`Document saved, but the previous attachment could not be removed: ${removeError.message}`);
    }
  }

  return result.data.id;
}

export async function archiveCompanyDocument(documentId: string) {
  const client = requireClient();
  const { error } = await client
    .from('company_documents')
    .delete()
    .eq('id', documentId);
  if (error) throw new Error(`Could not delete the document: ${error.message}`);
}

export async function upsertCompanyDocumentFolder(
  input: UpsertCompanyDocumentFolderInput,
  context: OwnerWorkspaceContext,
) {
  const client = requireClient();
  const name = input.name.trim();
  if (!name) throw new Error('Folder name is required.');

  const result = input.folderId
    ? await client
        .from('company_document_folders')
        .update({ name, parent_folder_id: input.parentFolderId || null })
        .eq('id', input.folderId)
        .select('id')
        .single()
    : await client
        .from('company_document_folders')
        .insert({
          agency_id: context.agencyId,
          created_by: context.userId,
          name,
           parent_folder_id: input.parentFolderId || null,
          scope: input.scope,
        })
        .select('id')
        .single();

  if (result.error) {
    throw new Error(`Could not save the folder: ${result.error.message}`);
  }

  return result.data.id;
}

export async function deleteCompanyDocumentFolder(folderId: string) {
  const client = requireClient();
  const { error } = await client
    .from('company_document_folders')
    .delete()
    .eq('id', folderId);
  if (error) throw new Error(`Could not delete the folder: ${error.message}`);
}

export async function moveCompanyDocumentToFolder(input: MoveCompanyDocumentToFolderInput) {
  const client = requireClient();
  const { error } = await client
    .from('company_documents')
    .update({ folder_id: input.folderId })
    .eq('id', input.documentId)
    .is('archived_at', null);
  if (error) throw new Error(`Could not move the document: ${error.message}`);
}

function leadPayload(input: LeadImportInput) {
  return {
    county: nullable(input.county),
    facebook: nullable(input.facebook),
    instagram: nullable(input.instagram),
    listing_link: nullable(input.listingLink),
    location: nullable(input.location),
    notes: nullable(input.notes),
    phone_number: nullable(input.phoneNumber),
    research_name: input.researchName.trim(),
    source_list: nullable(input.sourceList),
    status: input.status,
    tiktok: nullable(input.tiktok),
    website: nullable(input.website),
  };
}

export async function importAgencyLeads(
  inputs: LeadImportInput[],
  context: OwnerWorkspaceContext,
) {
  const client = requireClient();
  const rows = inputs
    .filter((input) => input.researchName.trim())
    .map((input) => ({
      ...leadPayload(input),
      agency_id: context.agencyId,
      created_by: context.userId,
    }));
  if (!rows.length) throw new Error('The file does not contain any named leads.');

  const { error } = await client.from('agency_leads').insert(rows);
  if (error) throw new Error(`Could not import the leads: ${error.message}`);
}

export async function upsertAgencyLead(
  input: UpsertLeadInput,
  context: OwnerWorkspaceContext,
) {
  const client = requireClient();
  if (!input.researchName.trim()) throw new Error('Lead name is required.');
  const payload = leadPayload(input);
  const result = input.leadId
    ? await client
        .from('agency_leads')
        .update(payload)
        .eq('id', input.leadId)
        .is('archived_at', null)
    : await client.from('agency_leads').insert({
        ...payload,
        agency_id: context.agencyId,
        created_by: context.userId,
      });
  if (result.error) throw new Error(`Could not save the lead: ${result.error.message}`);
}

export async function archiveAgencyLead(leadId: string) {
  const client = requireClient();
  const { error } = await client
    .from('agency_leads')
    .delete()
    .eq('id', leadId);
  if (error) throw new Error(`Could not delete the lead: ${error.message}`);
}

export async function deleteAgencyLeadList(
  leadIds: string[],
  context: OwnerWorkspaceContext,
) {
  const client = requireClient();
  if (!leadIds.length) return;
  const { error } = await client
    .from('agency_leads')
    .delete()
    .eq('agency_id', context.agencyId)
    .in('id', leadIds);
  if (error) throw new Error(`Could not delete the lead list: ${error.message}`);
}

export async function upsertMarketingContent(
  input: UpsertMarketingContentInput,
  context: OwnerWorkspaceContext,
) {
  const client = requireClient();
  const title = input.title.trim();
  if (!title) throw new Error('Content title is required.');
  const payload = {
    assignee_user_ids: [...new Set(input.assigneeUserIds ?? [])],
    body: nullable(input.body),
    caption: nullable(input.caption),
    content_type: nullable(input.contentType),
    all_day: Boolean(input.allDay),
    planned_for: input.plannedFor ? new Date(input.plannedFor).toISOString() : null,
    planned_until: input.plannedUntil ? new Date(input.plannedUntil).toISOString() : null,
    platform: nullable(input.platform),
    status: input.status,
    title,
  };
  let result = input.contentId
    ? await client
        .from('marketing_content')
        .update(payload)
        .eq('id', input.contentId)
        .is('archived_at', null)
    : await client.from('marketing_content').insert({
        ...payload,
        agency_id: context.agencyId,
        created_by: context.userId,
      });
  if (result.error && isMissingMarketingScheduleColumn(result.error.message)) {
    const legacyPayload = {
      body: nullable(input.body),
      caption: nullable(input.caption),
      content_type: nullable(input.contentType),
      planned_for: input.plannedFor ? new Date(input.plannedFor).toISOString() : null,
      platform: nullable(input.platform),
      status: input.status,
      title,
    };
    result = input.contentId
      ? await client
          .from('marketing_content')
          .update(legacyPayload)
          .eq('id', input.contentId)
          .is('archived_at', null)
      : await client.from('marketing_content').insert({
          ...legacyPayload,
          agency_id: context.agencyId,
          created_by: context.userId,
        });
  }
  if (result.error) {
    throw new Error(`Could not save the marketing item: ${result.error.message}`);
  }
}

export async function archiveMarketingContent(contentId: string) {
  const client = requireClient();
  const { error } = await client
    .from('marketing_content')
    .delete()
    .eq('id', contentId);
  if (error) throw new Error(`Could not delete the marketing item: ${error.message}`);
}
