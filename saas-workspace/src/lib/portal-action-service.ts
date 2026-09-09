import { supabase } from '@/lib/supabase';
import type {
  CreateCalendarEventInput,
  CreateCostInput,
  CreateDebtInput,
  DeleteContractDocumentInput,
  CreateGearInput,
  CreateMoneyMovementInput,
  CreateNoteInput,
  CreatePaymentInput,
  CreatePropertyInput,
  CreateTaskInput,
  TransferGearInput,
  UpdateDebtInput,
  UpdateDeliverableInput,
  UpdateGearInput,
  UpsertFinanceAccountInput,
  UpdateAgreementInput,
  UpdateCalendarEventInput,
  UpdateClientTeamInput,
  UpdateClientInput,
  UpdateContractDeliverableStatusInput,
  UpdatePaymentInput,
  UpdatePropertyInput,
  UpdateTaskInput,
  UpdateCostInput,
  UpdateMoneyMovementInput,
  UploadDeliverableInput,
} from '@/screens/web/types';

export interface PortalActionContext {
  agencyId: string;
  userId: string;
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const context = 'context' in error ? error.context : undefined;

  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as { error?: string };
      return payload.error || fallback;
    } catch {
      return fallback;
    }
  }

  return 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback;
}

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured for this build.');
  }

  return supabase;
}

function amountFrom(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return parsed;
}

function nonNegativeAmountFrom(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
  return parsed;
}

function agreementEndDate(startsOn: string, months: string) {
  const start = new Date(`${startsOn}T12:00:00`);
  const duration = Number(months);
  if (Number.isNaN(start.valueOf()) || !Number.isInteger(duration) || duration < 1) {
    throw new Error('Agreement start date and contract length must be valid.');
  }
  const end = new Date(start);
  end.setMonth(end.getMonth() + duration);
  end.setDate(end.getDate() - 1);
  return end.toISOString().slice(0, 10);
}

function agreementSummaryFromSchedule(monthlyDeliverables: string, deliverablePropertyIds: Record<string, string>) {
  return JSON.stringify({ monthlyDeliverables, deliverablePropertyIds });
}

function safeFilename(filename: string) {
  return (
    filename
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'file'
  );
}

function localDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time || '09:00'}:00`);
  if (Number.isNaN(value.valueOf())) {
    throw new Error('Choose a valid date and time.');
  }
  return value.toISOString();
}

function calendarDescription(
  type: CreateCalendarEventInput['type'],
  workScope: CreateCalendarEventInput['workScope'],
  description: string,
) {
  const trimmed = description.trim();
  return `[rm:type=${type}][rm:scope=${workScope}]${trimmed ? `\n${trimmed}` : ''}`;
}

function timestampSeconds(value: string) {
  if (value === 'General') return null;
  const parts = value.trim().split(':').map(Number);
  if (
    ![2, 3].includes(parts.length) ||
    parts.some((part) => !Number.isInteger(part) || part < 0)
  ) return null;
  if (parts.at(-1)! >= 60 || (parts.length === 3 && parts[1] >= 60)) return null;
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

function plainText(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
}

function scriptVersionText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|h2|p)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function latestMediaVersion(mediaAssetId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from('media_versions')
    .select('id')
    .eq('media_asset_id', mediaAssetId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not load the current version: ${error.message}`);
  if (!data) throw new Error('Upload a file version before adding review feedback.');
  return data.id;
}

async function uploadPropertyCover(
  agencyId: string,
  clientId: string,
  propertyId: string,
  file: File,
) {
  const client = requireClient();
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${agencyId}/${clientId}/${propertyId}/cover/${Date.now()}-${safeFilename(`cover.${extension}`)}`;
  const { error } = await client.storage.from('client-files').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`Could not upload the property image: ${error.message}`);
  return path;
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const startsAt = localDateTime(input.date, input.allDay ? '00:00' : input.start);
  const endsAt = input.allDay
    ? localDateTime(input.endDate || input.date, '23:59')
    : input.end ? localDateTime(input.endDate || input.date, input.end) : null;

  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new Error('The end time must be later than the start time.');
  }

  const { data: createdEvent, error } = await client
    .from('calendar_events')
    .insert({
      agency_id: context.agencyId,
      all_day: Boolean(input.allDay),
      client_account_id: input.clientId || null,
      created_by: context.userId,
      description: calendarDescription(input.type, input.workScope, input.description),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ends_at: endsAt,
      location: input.location.trim() || null,
      property_id: input.propertyId || null,
      starts_at: startsAt,
      title: input.title.trim(),
      visibility: input.visibility,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Could not create the event: ${error.message}`);
  const assigneeUserIds = [...new Set(input.assigneeUserIds ?? [])];
  if (assigneeUserIds.length && createdEvent) {
    const { error: assigneeError } = await client
      .from('calendar_event_assignees')
      .insert(
        assigneeUserIds.map((userId) => ({
          agency_id: context.agencyId,
          calendar_event_id: createdEvent.id,
          user_id: userId,
        })),
      );
    if (assigneeError) {
      throw new Error(`The event was created, but assignees could not be added: ${assigneeError.message}`);
    }
  }
}

export async function createWorkspaceNote(
  input: CreateNoteInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { error } = await client.from('notes').insert({
    agency_id: context.agencyId,
    body: input.body.trim(),
    created_by: context.userId,
    title: input.title.trim() || null,
    visibility: input.visibility,
  });

  if (error) throw new Error(`Could not save the note: ${error.message}`);
}

export async function createProperty(
  input: CreatePropertyInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const propertyPayload = {
    agency_id: context.agencyId,
    client_account_id: input.clientId,
    created_by: context.userId,
    description: input.description.trim() || null,
    scripting_brief: input.scriptingBrief.trim(),
    location_label: input.location.trim() || null,
    name: input.name.trim(),
    status: input.status,
  };
  const { data: createdProperty, error } = await client
    .from('properties')
    .insert(propertyPayload)
    .select('id')
    .single();

  let propertyId = createdProperty?.id;
  if (error || !propertyId) {
    const { data: provisioned, error: provisionError } = await client.functions.invoke<{
      error?: string;
      propertyId?: string;
    }>('admin-provision-user', {
      body: {
        action: 'create-property',
        agencyId: context.agencyId,
        clientAccountId: input.clientId,
        property: {
          description: propertyPayload.description,
          locationLabel: propertyPayload.location_label,
          name: propertyPayload.name,
        },
      },
    });
    if (provisionError || !provisioned?.propertyId) {
      throw new Error(
        `Could not create the property: ${
          provisioned?.error || await functionErrorMessage(
            provisionError,
            error?.message ?? 'Unknown database error',
          )
        }`,
      );
    }
    propertyId = provisioned.propertyId;
  }

  if (input.coverImage && propertyId) {
    const coverImagePath = await uploadPropertyCover(
      context.agencyId,
      input.clientId,
      propertyId,
      input.coverImage,
    );
    const { error: coverError } = await client
      .from('properties')
      .update({ cover_image_path: coverImagePath })
      .eq('id', propertyId);
    if (coverError) {
      const { data: provisioned, error: provisionError } = await client.functions.invoke<{
        error?: string;
        propertyId?: string;
      }>('admin-provision-user', {
        body: {
          action: 'update-property-cover',
          agencyId: context.agencyId,
          clientAccountId: input.clientId,
          propertyId,
          coverImagePath,
        },
      });
      if (provisionError || !provisioned?.propertyId) {
        throw new Error(
          `The property was created, but its image could not be attached: ${
            provisioned?.error || await functionErrorMessage(provisionError, coverError.message)
          }`,
        );
      }
    }
  }
}

export async function updateClientAccount(
  input: UpdateClientInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const companyName = input.companyName.trim();
  const contactName = input.contactName.trim();
  if (!companyName || !contactName) {
    throw new Error('Client and contact names are required.');
  }

  let profileImagePath: string | undefined;
  if (input.profilePhoto) {
    profileImagePath = `${context.agencyId}/${input.clientId}/_account/profile/${Date.now()}-${safeFilename(input.profilePhoto.name)}`;
    const { error: uploadError } = await client.storage
      .from('client-files')
      .upload(profileImagePath, input.profilePhoto, {
        cacheControl: '3600',
        contentType: input.profilePhoto.type || 'application/octet-stream',
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Could not upload the profile photo: ${uploadError.message}`);
    }
  }

  const { error } = await client
    .from('client_accounts')
    .update({
      billing_email: input.email.trim() || null,
      location_label: input.location.trim() || null,
      name: companyName,
      owner_name: contactName,
      ...(profileImagePath ? { profile_image_path: profileImagePath } : {}),
    })
    .eq('id', input.clientId)
    .is('archived_at', null);

  if (error) throw new Error(`Could not update the client: ${error.message}`);

  const { data: existingAgreement, error: agreementError } = await client
    .from('service_contracts')
    .select('id, currency, starts_on, ends_on, status, title')
    .eq('client_account_id', input.clientId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (agreementError) {
    throw new Error(`Could not inspect the client agreement: ${agreementError.message}`);
  }

  const agreementValues = {
    ends_on: agreementEndDate(input.contractStartsOn, input.contractMonths),
    recurring_amount: nonNegativeAmountFrom(input.monthlyPrice, 'Monthly agreement'),
    summary: agreementSummaryFromSchedule(input.monthlyDeliverables, input.deliverablePropertyIds),
    starts_on: input.contractStartsOn,
    total_contract_value: nonNegativeAmountFrom(input.totalContractValue, 'Total agreement value'),
  };

  let agreement = existingAgreement;
  if (agreement) {
    const { error: agreementUpdateError } = await client
      .from('service_contracts')
      .update(agreementValues)
      .eq('id', agreement.id)
      .is('archived_at', null);
    if (agreementUpdateError) {
      throw new Error(`Could not update the client agreement: ${agreementUpdateError.message}`);
    }
  } else {
    const { data: createdAgreement, error: agreementCreateError } = await client
      .from('service_contracts')
      .insert({
        agency_id: context.agencyId,
        billing_frequency: 'monthly',
        client_account_id: input.clientId,
        client_visible: true,
        created_by: context.userId,
        currency: 'RON',
        status: 'active',
        title: `${companyName} agreement`,
        ...agreementValues,
      })
      .select('id, currency, starts_on, ends_on, status, title')
      .single();
    if (agreementCreateError || !createdAgreement) {
      throw new Error(
        `Could not create the client agreement: ${agreementCreateError?.message ?? 'Unknown database error'}`,
      );
    }
    agreement = createdAgreement;
  }

  const deliverableNames = input.monthlyDeliverables
    .split(/\r?\n|,|\+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const { error: removeDeliverablesError } = await client
    .from('contract_deliverables')
    .delete()
    .eq('contract_id', agreement.id);
  if (removeDeliverablesError) {
    throw new Error(`Could not update the offer: ${removeDeliverablesError.message}`);
  }
  if (deliverableNames.length) {
    const { error: insertDeliverablesError } = await client
      .from('contract_deliverables')
      .insert(deliverableNames.map((name, index) => {
        const monthMatch = name.match(/^([^:]+):\s*(.+)$/);
        const deliverable = monthMatch?.[2] ?? name;
        const match = deliverable.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
        return {
          agency_id: context.agencyId,
          contract_id: agreement.id,
          ...(monthMatch && input.deliverablePropertyIds[monthMatch[1].trim()]
            ? { property_id: input.deliverablePropertyIds[monthMatch[1].trim()] }
            : {}),
          name: monthMatch ? `${monthMatch[1].trim()}: ${match?.[2] ?? deliverable}` : match?.[2] ?? name,
          quantity: match ? Number(match[1]) : 1,
          sort_order: index,
        };
      }));
    if (insertDeliverablesError) {
      throw new Error(`Could not save monthly deliverables: ${insertDeliverablesError.message}`);
    }
  }

  if (input.contractDocuments.length) {
    const files = [] as {
      byteSize: number;
      mimeType: string;
      originalFilename: string;
      storagePath: string;
    }[];
    for (const file of input.contractDocuments) {
      const storagePath = `${context.agencyId}/${input.clientId}/_account/contracts/${Date.now()}-${safeFilename(file.name)}`;
      const { error: uploadError } = await client.storage.from('client-files').upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`);
      files.push({
        byteSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        originalFilename: file.name,
        storagePath,
      });
    }
    const { data: registered, error: registerError } = await client.functions.invoke<{ error?: string; registered?: boolean }>(
      'admin-provision-user',
      { body: { action: 'register-contract-files', agencyId: context.agencyId, clientAccountId: input.clientId, contractId: agreement.id, files } },
    );
    if (registerError || !registered?.registered) {
      throw new Error(registered?.error || await functionErrorMessage(registerError, 'The files uploaded but could not be linked to the agreement.'));
    }
  }
}

export async function updateClientTeam(input: UpdateClientTeamInput) {
  const client = requireClient();
  const { data: current, error: loadError } = await client
    .from('client_accounts')
    .select('metadata')
    .eq('id', input.clientId)
    .is('archived_at', null)
    .single();
  if (loadError || !current) {
    throw new Error(`Could not load the client team: ${loadError?.message ?? 'Unknown error'}`);
  }
  const metadata =
    current.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
      ? current.metadata
      : {};
  const assignments = input.assignments
    .map((assignment) => ({
      role: assignment.role.trim(),
      userId: assignment.userId,
    }))
    .filter((assignment) => assignment.role && assignment.userId);
  const { error } = await client
    .from('client_accounts')
    .update({ metadata: { ...metadata, teamAssignments: assignments } })
    .eq('id', input.clientId)
    .is('archived_at', null);
  if (error) throw new Error(`Could not update the client team: ${error.message}`);
}

export async function archiveClientWorkspace(clientId: string) {
  const client = requireClient();
  const { error } = await client.rpc('delete_client_workspace' as never, {
    p_client_account_id: clientId,
  } as never);
  if (error) throw new Error(`Could not delete the client: ${error.message}`);
}

export async function updatePropertyWorkspace(input: UpdatePropertyInput) {
  const client = requireClient();
  const name = input.name.trim();
  if (!name) throw new Error('Property name is required.');

  const { data: property, error: propertyError } = await client
    .from('properties')
    .select('agency_id, client_account_id')
    .eq('id', input.propertyId)
    .is('archived_at', null)
    .single();
  if (propertyError || !property) {
    throw new Error(`Could not load the property: ${propertyError?.message ?? 'Unknown error'}`);
  }
  const coverImagePath = input.coverImage
    ? await uploadPropertyCover(
        property.agency_id,
        property.client_account_id,
        input.propertyId,
        input.coverImage,
      )
    : undefined;
  const { error } = await client
    .from('properties')
    .update({
      ...(coverImagePath ? { cover_image_path: coverImagePath } : {}),
      description: input.description.trim() || null,
      scripting_brief: input.scriptingBrief.trim(),
      location_label: input.location.trim() || null,
      name,
      status: input.status,
    })
    .eq('id', input.propertyId)
    .is('archived_at', null);

  if (error) throw new Error(`Could not update the property: ${error.message}`);
}

export async function archivePropertyWorkspace(propertyId: string) {
  const client = requireClient();
  const { error } = await client.rpc('delete_property_workspace' as never, {
    p_property_id: propertyId,
  } as never);
  if (error) throw new Error(`Could not delete the property: ${error.message}`);
}

export async function deleteContractDocument(input: DeleteContractDocumentInput) {
  const client = requireClient();
  const { error } = await client
    .from('record_attachments')
    .delete()
    .eq('id', input.documentId);
  if (error) throw new Error(`Could not delete the contract document: ${error.message}`);
  if (input.storagePath) {
    const { error: storageError } = await client.storage.from('client-files').remove([input.storagePath]);
    if (storageError) {
      throw new Error(`The document record was removed, but its stored file could not be removed: ${storageError.message}`);
    }
  }
}

export async function deleteTaskAttachment(attachmentId: string) {
  const client = requireClient();
  const { data: attachment, error: lookupError } = await client
    .from('record_attachments')
    .select('storage_path, task_id')
    .eq('id', attachmentId)
    .not('task_id', 'is', null)
    .single();

  if (lookupError || !attachment) {
    throw new Error(`Could not load the task attachment: ${lookupError?.message ?? 'Attachment not found'}`);
  }

  const { error: deleteError } = await client
    .from('record_attachments')
    .delete()
    .eq('id', attachmentId);

  if (deleteError) {
    throw new Error(`Could not remove the task attachment: ${deleteError.message}`);
  }

  const { error: storageError } = await client.storage
    .from('agency-files')
    .remove([attachment.storage_path]);

  if (storageError) {
    throw new Error(`The attachment was removed, but its stored file could not be cleaned up: ${storageError.message}`);
  }
}

export async function updateServiceAgreement(input: UpdateAgreementInput) {
  const client = requireClient();
  const title = input.title.trim();
  if (!title) throw new Error('Agreement title is required.');
  if (!/^[A-Za-z]{3}$/.test(input.currency.trim())) {
    throw new Error('Currency must be a three-letter code, such as RON.');
  }
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) {
    throw new Error('The agreement end date cannot be before its start date.');
  }

  const { error } = await client
    .from('service_contracts')
    .update({
      currency: input.currency.trim().toUpperCase(),
      ends_on: input.endsOn || null,
      recurring_amount: nonNegativeAmountFrom(input.monthlyAmount, 'Monthly amount'),
      starts_on: input.startsOn || null,
      status: input.status,
      summary: input.summary.trim() || null,
      title,
      total_contract_value: nonNegativeAmountFrom(input.totalValue, 'Total value'),
    })
    .eq('id', input.agreementId)
    .is('archived_at', null);

  if (error) throw new Error(`Could not update the agreement: ${error.message}`);
}

export async function archiveServiceAgreement(agreementId: string) {
  const client = requireClient();
  const { error } = await client.rpc('delete_service_agreement' as never, {
    p_agreement_id: agreementId,
  } as never);
  if (error) throw new Error(`Could not delete the agreement: ${error.message}`);
}

export async function updateCalendarEvent(
  input: UpdateCalendarEventInput,
) {
  const client = requireClient();
  const startsAt = localDateTime(input.date, input.allDay ? '00:00' : input.start);
  const endsAt = input.allDay
    ? localDateTime(input.endDate || input.date, '23:59')
    : input.end ? localDateTime(input.endDate || input.date, input.end) : null;
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new Error('The end time must be later than the start time.');
  }

  const { data: updatedEvent, error } = await client
    .from('calendar_events')
    .update({
      client_account_id: input.clientId || null,
      all_day: Boolean(input.allDay),
      description: calendarDescription(input.type, input.workScope, input.description),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ends_at: endsAt,
      location: input.location.trim() || null,
      property_id: input.propertyId || null,
      starts_at: startsAt,
      title: input.title.trim(),
      visibility: input.visibility,
    })
    .eq('id', input.eventId)
    .is('archived_at', null)
    .select('agency_id')
    .single();

  if (error) throw new Error(`Could not update the event: ${error.message}`);
  if (input.assigneeUserIds !== undefined && updatedEvent) {
    const { error: deleteError } = await client
      .from('calendar_event_assignees')
      .delete()
      .eq('calendar_event_id', input.eventId);
    if (deleteError) {
      throw new Error(`The event was updated, but existing assignees could not be replaced: ${deleteError.message}`);
    }
    const assigneeUserIds = [...new Set(input.assigneeUserIds)];
    if (assigneeUserIds.length) {
      const { error: insertError } = await client
        .from('calendar_event_assignees')
        .insert(
          assigneeUserIds.map((userId) => ({
            agency_id: updatedEvent.agency_id,
            calendar_event_id: input.eventId,
            user_id: userId,
          })),
        );
      if (insertError) {
        throw new Error(`The event was updated, but assignees could not be added: ${insertError.message}`);
      }
    }
  }
}

export async function archiveCalendarEvent(eventId: string) {
  const client = requireClient();
  const { error } = await client
    .from('calendar_events')
    .delete()
    .eq('id', eventId);
  if (error) throw new Error(`Could not delete the event: ${error.message}`);
}

function taskDueAt(dueDate: string, dueTime: string) {
  return dueDate ? localDateTime(dueDate, dueTime || '17:00') : null;
}

function clientUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function createWorkspaceTask(
  input: CreateTaskInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required.');
  if (input.visibility === 'client' && !input.clientId) {
    throw new Error('Choose a client before making a task client visible.');
  }
  if (input.propertyId && !input.clientId) {
    throw new Error('A property task must stay connected to its client.');
  }

  // A task is immediately queried again by PostgREST when using `.select()`.
  // That read can be rejected by its own RLS visibility policy even after a
  // valid insert. Supplying the UUID here lets attachments use the task ID
  // without requesting the just-created row back.
  const taskId = clientUuid();
  const { error } = await client
    .from('tasks')
    .insert({
      agency_id: context.agencyId,
      assignee_user_id: input.assigneeUserId || null,
      client_account_id: input.clientId || null,
      created_by: context.userId,
      description: input.description.trim() || null,
      due_at: taskDueAt(input.dueDate, input.dueTime),
      id: taskId,
      priority: input.priority,
      property_id: input.propertyId || null,
      status: 'todo',
      title,
      visibility: input.visibility,
    });

  if (error) throw new Error(`Could not create the task: ${error.message}`);

  for (const [index, file] of (input.attachments ?? []).entries()) {
    const storagePath = `${context.agencyId}/tasks/${taskId}/${Date.now()}-${index}-${safeFilename(file.name)}`;
    const { error: uploadError } = await client.storage
      .from('agency-files')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`);

    const { error: attachmentError } = await client.from('record_attachments').insert({
      agency_id: context.agencyId,
      byte_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      original_filename: file.name,
      storage_path: storagePath,
      task_id: taskId,
      uploaded_by: context.userId,
    });

    if (attachmentError) {
      throw new Error(`The file uploaded, but its task attachment could not be saved: ${attachmentError.message}`);
    }
  }
}

export async function updateWorkspaceTask(input: UpdateTaskInput, context?: PortalActionContext) {
  const client = requireClient();
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required.');
  if (input.visibility === 'client' && !input.clientId) {
    throw new Error('Choose a client before making a task client visible.');
  }
  if (input.propertyId && !input.clientId) {
    throw new Error('A property task must stay connected to its client.');
  }

  const { data: current, error: currentError } = await client
    .from('tasks')
    .select('completed_at, status')
    .eq('id', input.taskId)
    .is('archived_at', null)
    .single();
  if (currentError || !current) {
    throw new Error(`Could not load the task: ${currentError?.message ?? 'Unknown error'}`);
  }

  const completedAt =
    input.status === 'done'
      ? current.status === 'done' && current.completed_at
        ? current.completed_at
        : new Date().toISOString()
      : null;

  const { error } = await client
    .from('tasks')
    .update({
      assignee_user_id: input.assigneeUserId || null,
      client_account_id: input.clientId || null,
      completed_at: completedAt,
      description: input.description.trim() || null,
      due_at: taskDueAt(input.dueDate, input.dueTime),
      priority: input.priority,
      property_id: input.propertyId || null,
      status: input.status,
      title,
      visibility: input.visibility,
    })
    .eq('id', input.taskId)
    .is('archived_at', null);

  if (error) throw new Error(`Could not update the task: ${error.message}`);

  if (!(input.attachments?.length)) return;
  if (!context) throw new Error('Your session context is required to attach files to this task.');

  for (const [index, file] of input.attachments.entries()) {
    const storagePath = `${context.agencyId}/tasks/${input.taskId}/${Date.now()}-${index}-${safeFilename(file.name)}`;
    const { error: uploadError } = await client.storage
      .from('agency-files')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`);

    const { error: attachmentError } = await client.from('record_attachments').insert({
      agency_id: context.agencyId,
      byte_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      original_filename: file.name,
      storage_path: storagePath,
      task_id: input.taskId,
      uploaded_by: context.userId,
    });

    if (attachmentError) {
      throw new Error(`The file uploaded, but its task attachment could not be saved: ${attachmentError.message}`);
    }
  }
}

export async function archiveWorkspaceTask(taskId: string) {
  const client = requireClient();
  const { error } = await client
    .from('tasks')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw new Error(`Could not archive the task: ${error.message}`);
}

export async function restoreWorkspaceTask(taskId: string) {
  const client = requireClient();
  const { error } = await client
    .from('tasks')
    .update({ archived_at: null })
    .eq('id', taskId);
  if (error) throw new Error(`Could not restore the task: ${error.message}`);
}

export async function clearCompletedWorkspaceTasks(context: PortalActionContext) {
  const client = requireClient();
  const { error } = await client
    .from('tasks')
    .update({ archived_at: new Date().toISOString() })
    .eq('agency_id', context.agencyId)
    .eq('status', 'done');
  if (error) throw new Error(`Could not archive completed tasks: ${error.message}`);
}

export async function createPaymentScheduleItem(
  input: CreatePaymentInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { data: contract, error: contractError } = await client
    .from('service_contracts')
    .select('id')
    .eq('client_account_id', input.clientId)
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contractError) {
    throw new Error(`Could not load the client agreement: ${contractError.message}`);
  }
  if (!contract) {
    throw new Error('This client needs an active agreement before adding a payment.');
  }

  const status = input.dueOn <= new Date().toISOString().slice(0, 10) ? 'due' : 'upcoming';
  const { error } = await client.from('payment_schedule_items').insert({
    agency_id: context.agencyId,
    amount: amountFrom(input.amount, 'Payment amount'),
    client_account_id: input.clientId,
    client_note: input.clientNote.trim() || null,
    client_visible: true,
    contract_id: contract.id,
    created_by: context.userId,
    currency: 'RON',
    due_on: input.dueOn,
    invoice_reference: input.invoiceReference.trim() || null,
    label: input.label.trim() || null,
    status,
  });

  if (error) throw new Error(`Could not add the payment: ${error.message}`);
}

export async function markPaymentScheduleItemPaid(
  paymentId: string,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { data: schedule, error: scheduleError } = await client
    .from('payment_schedule_items')
    .select('id, client_account_id, amount, currency')
    .eq('id', paymentId)
    .is('archived_at', null)
    .single();

  if (scheduleError || !schedule) {
    throw new Error(`Could not load the payment: ${scheduleError?.message ?? 'Unknown error'}`);
  }

  const paidAt = new Date().toISOString();
  const { error: updateError } = await client
    .from('payment_schedule_items')
    .update({ paid_at: paidAt, status: 'paid' })
    .eq('id', paymentId);

  if (updateError) throw new Error(`Could not mark the payment paid: ${updateError.message}`);

  const { data: existing, error: existingError } = await client
    .from('payment_records')
    .select('id')
    .eq('schedule_item_id', paymentId)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(`Could not verify the payment record: ${existingError.message}`);
  if (existing) return;

  const { error: recordError } = await client.from('payment_records').insert({
    agency_id: context.agencyId,
    amount: schedule.amount,
    client_account_id: schedule.client_account_id,
    client_visible: true,
    currency: schedule.currency,
    paid_on: paidAt.slice(0, 10),
    recorded_by: context.userId,
    schedule_item_id: schedule.id,
  });

  if (recordError) throw new Error(`Payment was marked paid, but its ledger record failed: ${recordError.message}`);
}

export async function updatePaymentScheduleItem(input: UpdatePaymentInput) {
  const client = requireClient();
  const amount = amountFrom(input.amount, 'Payment amount');
  const { data: current, error: currentError } = await client
    .from('payment_schedule_items')
    .select('status')
    .eq('id', input.paymentId)
    .is('archived_at', null)
    .single();
  if (currentError || !current) {
    throw new Error(`Could not load the payment: ${currentError?.message ?? 'Unknown error'}`);
  }

  const { error } = await client
    .from('payment_schedule_items')
    .update({
      amount,
      client_note: input.clientNote.trim() || null,
      due_on: input.dueOn,
      invoice_reference: input.invoiceReference.trim() || null,
      label: input.label.trim() || null,
      ...(current.status === 'paid' || !input.status ? {} : { status: input.status }),
    })
    .eq('id', input.paymentId)
    .is('archived_at', null);
  if (error) throw new Error(`Could not update the payment: ${error.message}`);

  if (current.status === 'paid') {
    const { error: recordError } = await client
      .from('payment_records')
      .update({
        amount,
        client_note: input.clientNote.trim() || null,
      })
      .eq('schedule_item_id', input.paymentId);
    if (recordError) {
      throw new Error(`Payment updated, but its paid ledger copy failed: ${recordError.message}`);
    }
  }
}

export async function archivePaymentScheduleItem(paymentId: string) {
  const client = requireClient();
  const { error: recordError } = await client
    .from('payment_records')
    .delete()
    .eq('schedule_item_id', paymentId);
  if (recordError) throw new Error(`Could not delete the payment ledger record: ${recordError.message}`);
  const { error } = await client
    .from('payment_schedule_items')
    .delete()
    .eq('id', paymentId);
  if (error) throw new Error(`Could not delete the payment: ${error.message}`);
}

export async function createGearItem(
  input: CreateGearInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { error } = await client.from('gear_items').insert({
    agency_id: context.agencyId,
    asset_tag: input.assetTag.trim(),
    category: input.category,
    created_by: context.userId,
    current_location: input.location.trim() || null,
    home_location: input.location.trim() || null,
    name: input.name.trim(),
    notes: input.notes.trim() || null,
    serial_number: input.serial.trim() || null,
    status: 'available',
  });

  if (error) throw new Error(`Could not add the gear item: ${error.message}`);
}

export async function updateGearItem(input: UpdateGearInput) {
  const client = requireClient();
  const name = input.name.trim();
  const assetTag = input.assetTag.trim();
  if (!name || !assetTag) {
    throw new Error('Item name and asset tag are required.');
  }

  const { error } = await client
    .from('gear_items')
    .update({
      asset_tag: assetTag,
      category: input.category,
      name,
      notes: input.notes.trim() || null,
    })
    .eq('id', input.gearId)
    .is('archived_at', null);

  if (error) throw new Error(`Could not update the gear item: ${error.message}`);
}

export async function transferGearItem(
  input: TransferGearInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { data: current, error: currentError } = await client
    .from('gear_items')
    .select('current_custodian_user_id, current_location, current_property_id')
    .eq('id', input.gearId)
    .single();

  if (currentError || !current) {
    throw new Error(`Could not load the gear item: ${currentError?.message ?? 'Unknown error'}`);
  }

  if (input.status === 'on_site' && !input.propertyId) {
    throw new Error('Choose a property for gear placed on site.');
  }
  if (input.status === 'with_team' && !input.custodianUserId) {
    throw new Error('Choose a team member for assigned gear.');
  }

  const nextLocation = input.location.trim()
    || (input.status === 'available' ? 'Realty Media studio' : current.current_location);
  const { error: updateError } = await client
    .from('gear_items')
    .update({
      current_custodian_user_id: input.status === 'with_team' ? input.custodianUserId : null,
      current_location: nextLocation,
      current_property_id: input.status === 'on_site' ? input.propertyId : null,
      status: input.status === 'with_team' ? 'assigned' : input.status,
    })
    .eq('id', input.gearId);

  if (updateError) throw new Error(`Could not transfer the gear item: ${updateError.message}`);

  const action =
    input.status === 'with_team'
      ? current.current_custodian_user_id
        ? 'transferred'
        : 'checked_out'
      : input.status === 'on_site'
      ? 'placed_on_site'
      : input.status === 'maintenance'
        ? 'sent_to_maintenance'
        : 'returned';
  const eventMarker = input.eventId ? `[rm:calendar-event=${input.eventId}]` : '';
  const { error: historyError } = await client.from('gear_custody_history').insert({
    action,
    agency_id: context.agencyId,
    from_location: current.current_location,
    from_property_id: current.current_property_id,
    from_user_id: current.current_custodian_user_id,
    gear_item_id: input.gearId,
    note: [eventMarker, input.note.trim()].filter(Boolean).join('\n') || null,
    to_location: nextLocation,
    to_property_id: input.status === 'on_site' ? input.propertyId : null,
    to_user_id: input.status === 'with_team' ? input.custodianUserId : null,
    transferred_by: context.userId,
  });

  if (historyError) {
    throw new Error(`Gear moved, but the custody entry failed: ${historyError.message}`);
  }
}

async function requireFinanceAccount(
  accountId: string,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { data, error } = await client
    .from('finance_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('agency_id', context.agencyId)
    .eq('is_active', true)
    .is('archived_at', null)
    .single();

  if (error || !data) {
    throw new Error('Choose an active account for this money movement.');
  }
  return data.id;
}

export async function upsertFinanceAccount(
  input: UpsertFinanceAccountInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const name = input.name.trim();
  if (!name) throw new Error('Add an account name.');
  const desiredBalance = nonNegativeAmountFrom(
    input.currentBalance || '0',
    'Current balance',
  );
  let openingBalance = desiredBalance;

  if (input.accountId) {
    const { data: transactions, error: transactionError } = await client
      .from('finance_transactions')
      .select('amount, transaction_type')
      .eq('account_id', input.accountId)
      .eq('agency_id', context.agencyId);
    if (transactionError) {
      throw new Error(
        `Could not reconcile the account balance: ${transactionError.message}`,
      );
    }
    const transactionBalance = (transactions ?? []).reduce(
      (sum, transaction) =>
        transaction.transaction_type === 'income'
          ? sum + Number(transaction.amount)
          : transaction.transaction_type === 'expense'
            ? sum - Number(transaction.amount)
            : sum,
      0,
    );
    openingBalance = desiredBalance - transactionBalance;
  }
  const record = {
    account_reference: input.accountReference.trim() || null,
    account_type: input.accountType,
    currency: 'RON',
    institution_name: input.institutionName.trim() || null,
    name,
    notes: input.notes.trim() || null,
    opening_balance: openingBalance,
  };

  if (input.accountId) {
    const { error } = await client
      .from('finance_accounts')
      .update(record)
      .eq('id', input.accountId)
      .eq('agency_id', context.agencyId)
      .is('archived_at', null);
    if (error) throw new Error(`Could not update the account: ${error.message}`);
    return;
  }

  const { error } = await client.from('finance_accounts').insert({
    ...record,
    agency_id: context.agencyId,
    created_by: context.userId,
    is_active: true,
  });
  if (error) throw new Error(`Could not add the account: ${error.message}`);
}

export async function createFinanceMoneyMovement(
  input: CreateMoneyMovementInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const accountId = await requireFinanceAccount(input.accountId, context);
  const { error } = await client.from('finance_transactions').insert({
    account_id: accountId,
    agency_id: context.agencyId,
    amount: amountFrom(input.amount, 'Amount'),
    counterparty: input.counterparty.trim() || null,
    created_by: context.userId,
    currency: 'RON',
    description: input.description.trim(),
    occurred_on: input.occurredOn,
    transaction_type: input.transactionType,
  });

  if (error) throw new Error(`Could not add the money movement: ${error.message}`);
}

export async function updateFinanceMoneyMovement(
  input: UpdateMoneyMovementInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const accountId = await requireFinanceAccount(input.accountId, context);
  const { error } = await client
    .from('finance_transactions')
    .update({
      account_id: accountId,
      amount: amountFrom(input.amount, 'Amount'),
      counterparty: input.counterparty.trim() || null,
      description: input.description.trim(),
      occurred_on: input.occurredOn,
    })
    .eq('id', input.movementId)
    .eq('agency_id', context.agencyId)
    .in('transaction_type', ['income', 'expense']);

  if (error) throw new Error(`Could not update the money movement: ${error.message}`);
}

export async function createFinanceDebt(
  input: CreateDebtInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const amount = amountFrom(input.amount, 'Debt amount');
  const { error } = await client.from('finance_debts').insert({
    agency_id: context.agencyId,
    counterparty: input.counterparty.trim(),
    created_by: context.userId,
    currency: 'RON',
    direction: input.direction,
    due_on: input.dueOn || null,
    notes: input.note.trim() || null,
    original_amount: amount,
    outstanding_amount: amount,
    status: 'open',
  });

  if (error) throw new Error(`Could not add the debt: ${error.message}`);
}

export async function archiveFinanceDebt(
  debtId: string,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { error } = await client
    .from('finance_debts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', debtId)
    .eq('agency_id', context.agencyId)
    .is('archived_at', null);

  if (error) throw new Error(`Could not archive the debt: ${error.message}`);
}

export async function updateFinanceDebt(
  input: UpdateDebtInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const amount = amountFrom(input.amount, 'Debt amount');
  const counterparty = input.counterparty.trim();
  if (!counterparty) throw new Error('Counterparty is required.');

  const { data: current, error: currentError } = await client
    .from('finance_debts')
    .select('original_amount, outstanding_amount')
    .eq('id', input.debtId)
    .eq('agency_id', context.agencyId)
    .is('archived_at', null)
    .single();
  if (currentError || !current) {
    throw new Error(`Could not load the debt: ${currentError?.message ?? 'Unknown error'}`);
  }

  const paidAmount = Math.max(0, Number(current.original_amount) - Number(current.outstanding_amount));
  if (amount < paidAmount) {
    throw new Error(`Debt amount cannot be lower than the ${paidAmount.toLocaleString('ro-RO')} RON already paid.`);
  }
  const outstandingAmount = Math.max(0, amount - paidAmount);
  const status = outstandingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'open';
  const { error } = await client
    .from('finance_debts')
    .update({
      counterparty,
      direction: input.direction,
      due_on: input.dueOn || null,
      notes: input.note.trim() || null,
      original_amount: amount,
      outstanding_amount: outstandingAmount,
      status,
    })
    .eq('id', input.debtId)
    .eq('agency_id', context.agencyId)
    .is('archived_at', null);

  if (error) throw new Error(`Could not update the debt: ${error.message}`);
}

export async function recordFinanceDebtPayment(
  debtId: string,
  amountValue: string,
  note: string,
  context: PortalActionContext,
) {
  const client = requireClient();
  const amount = amountFrom(amountValue, 'Payment amount');
  const { data: debt, error: debtError } = await client
    .from('finance_debts')
    .select('outstanding_amount')
    .eq('id', debtId)
    .single();

  if (debtError || !debt) {
    throw new Error(`Could not load the debt: ${debtError?.message ?? 'Unknown error'}`);
  }

  const outstanding = Number(debt.outstanding_amount);
  if (amount > outstanding) {
    throw new Error(`Payment cannot exceed the outstanding ${outstanding.toLocaleString('ro-RO')} RON.`);
  }

  const nextOutstanding = Math.max(0, outstanding - amount);
  const { error: paymentError } = await client.from('finance_debt_payments').insert({
    agency_id: context.agencyId,
    amount,
    debt_id: debtId,
    note: note.trim() || null,
    paid_on: new Date().toISOString().slice(0, 10),
    recorded_by: context.userId,
  });

  if (paymentError) throw new Error(`Could not record the debt payment: ${paymentError.message}`);

  const { error: updateError } = await client
    .from('finance_debts')
    .update({
      outstanding_amount: nextOutstanding,
      status: nextOutstanding === 0 ? 'paid' : 'partial',
    })
    .eq('id', debtId);

  if (updateError) {
    throw new Error(`Payment was recorded, but the balance failed: ${updateError.message}`);
  }
}

export async function createRecurringCost(
  input: CreateCostInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { error } = await client.from('recurring_costs').insert({
    agency_id: context.agencyId,
    amount: amountFrom(input.amount, 'Cost amount'),
    created_by: context.userId,
    currency: 'RON',
    frequency: input.frequency,
    name: input.name.trim(),
    next_due_on: input.nextDueOn,
    notes: input.notes.trim() || null,
    starts_on: input.startsOn,
    vendor: input.vendor.trim() || null,
  });

  if (error) throw new Error(`Could not add the recurring cost: ${error.message}`);
}

export async function updateRecurringCost(
  input: UpdateCostInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { error } = await client
    .from('recurring_costs')
    .update({
      amount: amountFrom(input.amount, 'Cost amount'),
      frequency: input.frequency,
      name: input.name.trim(),
      next_due_on: input.nextDueOn,
      notes: input.notes.trim() || null,
      starts_on: input.startsOn,
      vendor: input.vendor.trim() || null,
    })
    .eq('agency_id', context.agencyId)
    .eq('id', input.costId);

  if (error) throw new Error(`Could not update the recurring cost: ${error.message}`);
}

export async function toggleRecurringCostPaid(
  costId: string,
  paid: boolean,
  context: PortalActionContext,
) {
  const client = requireClient();
  const { data: cost, error: costError } = await client
    .from('recurring_costs')
    .select('amount, next_due_on')
    .eq('id', costId)
    .single();

  if (costError || !cost) {
    throw new Error(`Could not load the recurring cost: ${costError?.message ?? 'Unknown error'}`);
  }

  const { error } = await client.from('recurring_cost_occurrences').upsert(
    {
      agency_id: context.agencyId,
      amount: cost.amount,
      due_on: cost.next_due_on,
      paid_at: paid ? new Date().toISOString() : null,
      recurring_cost_id: costId,
      status: paid ? 'paid' : 'upcoming',
    },
    { onConflict: 'recurring_cost_id,due_on' },
  );

  if (error) throw new Error(`Could not update the cost status: ${error.message}`);
}

export async function archiveRecurringCost(costId: string) {
  const client = requireClient();
  const { error } = await client
    .from('recurring_costs')
    .delete()
    .eq('id', costId);

  if (error) throw new Error(`Could not delete the recurring cost: ${error.message}`);
}

export async function addReviewComment(
  mediaAssetId: string,
  body: string,
  timestamp: string,
  context: PortalActionContext,
) {
  const client = requireClient();
  const comment = body.trim();
  if (!comment) throw new Error('Write a comment before saving.');
  const versionId = await latestMediaVersion(mediaAssetId);
  const { error } = await client.from('review_comments').insert({
    agency_id: context.agencyId,
    author_id: context.userId,
    body: comment,
    media_asset_id: mediaAssetId,
    media_version_id: versionId,
    timestamp_seconds: timestampSeconds(timestamp),
    visibility: 'client',
  });

  if (error) throw new Error(`Could not add the comment: ${error.message}`);
}

export async function recordReviewDecision(
  mediaAssetId: string,
  decision: 'approved' | 'changes_requested' | 'approval_revoked',
  context: PortalActionContext,
) {
  const client = requireClient();
  const versionId = await latestMediaVersion(mediaAssetId);
  const { error: eventError } = await client.from('review_approval_events').insert({
    actor_id: context.userId,
    agency_id: context.agencyId,
    decision,
    media_asset_id: mediaAssetId,
    media_version_id: versionId,
  });

  if (eventError) throw new Error(`Could not save the review decision: ${eventError.message}`);
}

export async function uploadDeliverable(
  input: UploadDeliverableInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const isScript = input.kind === 'script';
  const contentHtml = input.contentHtml?.trim() ?? '';
  if (isScript && !input.file && !plainText(contentHtml)) {
    throw new Error('Write the script before saving content.');
  }
  if (!isScript && !input.file) {
    throw new Error('Choose a content file before uploading.');
  }
  const { data: property, error: propertyError } = await client
    .from('properties')
    .select('client_account_id')
    .eq('id', input.propertyId)
    .single();

  if (propertyError || !property) {
    throw new Error(`Could not load the selected property: ${propertyError?.message ?? 'Unknown error'}`);
  }

  const { data: asset, error: assetError } = await client
    .from('media_assets')
    .insert({
      agency_id: context.agencyId,
      client_visible: true,
      created_by: context.userId,
      description: isScript ? contentHtml : null,
      kind: input.kind,
      property_id: input.propertyId,
      status: 'ready_for_review',
      title: input.title.trim(),
    })
    .select('id')
    .single();

  if (assetError || !asset) {
    throw new Error(`Could not create the deliverable: ${assetError?.message ?? 'Unknown error'}`);
  }

  const generatedScriptFile = isScript && !input.file
    ? new File([scriptVersionText(contentHtml)], `${safeFilename(input.title)}.txt`, { type: 'text/plain' })
    : null;
  const uploadFile = input.file ?? generatedScriptFile;
  if (!uploadFile) return;

  const storagePath = [
    context.agencyId,
    property.client_account_id,
    input.propertyId,
    asset.id,
    `${Date.now()}-${safeFilename(uploadFile.name)}`,
  ].join('/');
  const { error: uploadError } = await client.storage
    .from('media-review')
    .upload(storagePath, uploadFile, {
      contentType: uploadFile.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) throw new Error(`Could not upload ${uploadFile.name}: ${uploadError.message}`);

  const { error: versionError } = await client.from('media_versions').insert({
    agency_id: context.agencyId,
    byte_size: uploadFile.size,
    media_asset_id: asset.id,
    mime_type: uploadFile.type || 'application/octet-stream',
    original_filename: uploadFile.name,
    storage_path: storagePath,
    uploaded_by: context.userId,
    version_number: 1,
  });

  if (versionError) {
    throw new Error(`The file uploaded, but its review version failed: ${versionError.message}`);
  }
}

export async function updateDeliverable(input: UpdateDeliverableInput) {
  const client = requireClient();
  if (!input.title.trim()) throw new Error('Content title is required.');
  const { error } = await client
    .from('media_assets')
    .update({
      client_visible: input.clientVisible ?? true,
      property_id: input.propertyId,
      status: input.status,
      title: input.title.trim(),
    })
    .eq('id', input.mediaAssetId)
    .is('archived_at', null);
  if (error) throw new Error(`Could not update the content: ${error.message}`);
}

export async function updateContractDeliverableStatus(
  input: UpdateContractDeliverableStatusInput,
  context: PortalActionContext,
) {
  const client = requireClient();
  const completedAt = input.status === 'delivered' ? new Date().toISOString() : null;
  const { error } = await client
    .from('contract_deliverables')
    .update({ completed_at: completedAt, status: input.status })
    .eq('id', input.deliverableId)
    .eq('agency_id', context.agencyId);
  if (error) throw new Error(`Could not update fulfillment: ${error.message}`);
}

export async function archiveDeliverable(mediaAssetId: string) {
  const client = requireClient();
  const { data: versions, error: versionsError } = await client
    .from('media_versions')
    .select('storage_path')
    .eq('media_asset_id', mediaAssetId);
  if (versionsError) throw new Error(`Could not prepare the content for deletion: ${versionsError.message}`);

  const { error } = await client
    .from('media_assets')
    .delete()
    .eq('id', mediaAssetId);
  if (error) throw new Error(`Could not delete the content: ${error.message}`);

  const paths = (versions ?? []).map((version) => version.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await client.storage.from('media-review').remove(paths);
    if (storageError) throw new Error(`Content was removed, but its stored file could not be removed: ${storageError.message}`);
  }
}
