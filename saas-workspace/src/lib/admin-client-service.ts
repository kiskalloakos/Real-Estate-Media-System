import type { SupabaseClient } from '@supabase/supabase-js';

import { sendPasswordSetupEmail } from '@/lib/password-setup-service';
import { supabase } from '@/lib/supabase';
import type { CreateClientInput } from '@/screens/web/types';
import type { Database } from '@/types/database';

type CreateClientContext = {
  adminUserId: string;
  agencyId: string;
};

type CreatedClient = {
  authUserId?: string;
  clientAccountId: string;
  contractId: string;
};

type ProvisionClientResult = {
  authUserId?: string;
  clientAccountId?: string;
  error?: string;
  propertyId?: string;
};

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

function requiredNumber(value: string, label: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid positive amount.`);
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

function deliverablesFrom(value: string) {
  return value
    .split(/\r?\n|,|\+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const match = part.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);

      return {
        name: match?.[2] ?? part,
        quantity: match ? Number(match[1]) : 1,
        sort_order: index,
      };
    });
}

function agreementSummaryFromSchedule(monthlyDeliverables: string, deliverablePropertyIds: Record<string, string>) {
  return JSON.stringify({ monthlyDeliverables, deliverablePropertyIds });
}

function safeFilename(filename: string) {
  const cleaned = filename
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return cleaned || 'file';
}

function uploadKey(prefix: string, filename: string) {
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeFilename(filename)}`;
}

async function uploadFile(
  client: SupabaseClient<Database>,
  bucket: string,
  path: string,
  file: File,
) {
  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    throw new Error(`Could not upload ${file.name}: ${error.message}`);
  }

  return path;
}

export async function createClientWorkspace(
  input: CreateClientInput,
  context: CreateClientContext,
): Promise<CreatedClient> {
  if (!supabase) {
    throw new Error('Supabase is not configured for this build.');
  }

  const accountName = input.companyName.trim();
  const contactName = input.contactName.trim();
  const email = input.email.trim().toLowerCase();
  const properties = input.properties
    .map((property) => ({
      description: property.description.trim(),
      scriptingBrief: '',
      location: property.location.trim(),
      name: property.name.trim(),
    }))
    .filter((property) => property.name);
  const monthlyPrice = requiredNumber(input.monthlyPrice, 'Monthly price');
  const totalContractValue = requiredNumber(
    input.totalContractValue,
    'Total contract value',
  );
  const agreementEndsOn = agreementEndDate(input.contractStartsOn, input.contractMonths);

  if (!accountName || !contactName || !properties.length) {
    throw new Error('Company, contact, and at least one property are required.');
  }

  if (input.createLogin && (!email || !input.temporaryPassword)) {
    throw new Error('An email address and temporary password are required for portal access.');
  }

  let authUserId: string | undefined;
  let clientAccountId: string;

  if (input.createLogin) {
    const { data: provisioned, error: provisionError } =
      await supabase.functions.invoke<ProvisionClientResult>(
      'admin-provision-user',
      {
        body: {
          account: {
            billingEmail: email,
            locationLabel: input.location.trim() || null,
            metadata: {
              offer_text: input.monthlyDeliverables.trim(),
              service_package_template: input.packageTemplateId || null,
              password_reset_required: input.requirePasswordReset,
            },
            name: accountName,
            ownerName: contactName,
          },
          action: 'create-client',
          agencyId: context.agencyId,
          email,
          fullName: contactName,
          role: 'client',
          temporaryPassword: input.temporaryPassword,
        },
      },
    );

    if (
      provisionError ||
      !provisioned?.authUserId ||
      !provisioned.clientAccountId
    ) {
      throw new Error(
        provisioned?.error ||
          (await functionErrorMessage(
            provisionError,
            'Could not create the client login and workspace.',
          )),
      );
    }

    authUserId = provisioned.authUserId;
    clientAccountId = provisioned.clientAccountId;
  } else {
    const { data: clientAccount, error: clientAccountError } = await supabase
      .from('client_accounts')
      .insert({
        agency_id: context.agencyId,
        billing_email: email || null,
        created_by: context.adminUserId,
        location_label: input.location.trim() || null,
        metadata: {
          offer_text: input.monthlyDeliverables.trim(),
          service_package_template: input.packageTemplateId || null,
        },
        name: accountName,
        owner_name: contactName,
      })
      .select('id')
      .single();
    if (clientAccountError || !clientAccount) {
      throw new Error(
        `Could not create the client workspace: ${clientAccountError?.message ?? 'Unknown database error'}`,
      );
    }
    clientAccountId = clientAccount.id;
  }

  const clientAccount = { id: clientAccountId };

  const propertyIds: string[] = [];
  for (const property of properties) {
    const { data: existingProperty, error: existingPropertyError } = await supabase
      .from('properties')
      .select('id')
      .eq('client_account_id', clientAccount.id)
      .eq('name', property.name)
      .is('archived_at', null)
      .limit(1)
      .maybeSingle();
    if (existingPropertyError) {
      throw new Error(`Could not inspect a client property: ${existingPropertyError.message}`);
    }
    if (existingProperty) {
      propertyIds.push(existingProperty.id);
      continue;
    }

    const propertyPayload = {
      agency_id: context.agencyId,
      client_account_id: clientAccount.id,
      created_by: context.adminUserId,
      description: property.description || null,
      scripting_brief: property.scriptingBrief,
      location_label: property.location || input.location.trim() || null,
      name: property.name,
      status: 'onboarding' as const,
    };
    const { data, error } = await supabase
      .from('properties')
      .insert(propertyPayload)
      .select('id')
      .single();
    if (!error && data) {
      propertyIds.push(data.id);
      continue;
    }

    const { data: provisioned, error: provisionError } =
      await supabase.functions.invoke<ProvisionClientResult>('admin-provision-user', {
        body: {
          action: 'create-property',
          agencyId: context.agencyId,
          clientAccountId: clientAccount.id,
          property: {
            description: propertyPayload.description,
            scriptingBrief: propertyPayload.scripting_brief,
            locationLabel: propertyPayload.location_label,
            name: property.name,
          },
        },
      });
    if (!provisionError && provisioned?.propertyId) {
      propertyIds.push(provisioned.propertyId);
      continue;
    }

    const fallbackError = provisioned?.error || await functionErrorMessage(
      provisionError,
      error?.message ?? 'Unknown database error',
    );
    throw new Error(`The client was created, but a property could not be saved: ${fallbackError}`);
  }

  let profileImagePath: string | null = null;
  if (input.profilePhoto) {
    profileImagePath = await uploadFile(
      supabase,
      'client-files',
      uploadKey(
        `${context.agencyId}/${clientAccount.id}/_account/profile`,
        input.profilePhoto.name,
      ),
      input.profilePhoto,
    );

    const { error } = await supabase
      .from('client_accounts')
      .update({ profile_image_path: profileImagePath })
      .eq('id', clientAccount.id);

    if (error) {
      throw new Error(`The profile photo uploaded but could not be attached: ${error.message}`);
    }
  }

  const { data: existingContract, error: existingContractError } = await supabase
    .from('service_contracts')
    .select('id')
    .eq('client_account_id', clientAccount.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingContractError) {
    throw new Error(`Could not inspect the client agreement: ${existingContractError.message}`);
  }

  let contract = existingContract;
  let contractError: { message: string } | null = null;
  if (contract) {
    const { error } = await supabase
      .from('service_contracts')
      .update({
        ends_on: agreementEndsOn,
        recurring_amount: monthlyPrice,
        summary: agreementSummaryFromSchedule(input.monthlyDeliverables, input.deliverablePropertyIds),
        starts_on: input.contractStartsOn,
        total_contract_value: totalContractValue,
      })
      .eq('id', contract.id);
    contractError = error;
  } else {
    const created = await supabase
      .from('service_contracts')
      .insert({
        agency_id: context.agencyId,
        billing_frequency: 'monthly',
        client_account_id: clientAccount.id,
        client_visible: true,
        created_by: context.adminUserId,
        currency: 'RON',
        recurring_amount: monthlyPrice,
        status: 'active',
        summary: agreementSummaryFromSchedule(input.monthlyDeliverables, input.deliverablePropertyIds),
        starts_on: input.contractStartsOn,
        ends_on: agreementEndsOn,
        title: `${accountName} agreement`,
        total_contract_value: totalContractValue,
      })
      .select('id')
      .single();
    contract = created.data;
    contractError = created.error;
  }

  if (contractError || !contract) {
    throw new Error(
      `The client was created, but the agreement could not be saved: ${
        contractError?.message ?? 'Unknown database error'
      }`,
    );
  }

  const deliverables = deliverablesFrom(input.monthlyDeliverables);
  if (deliverables.length) {
    if (existingContract) {
      const { error: clearError } = await supabase
        .from('contract_deliverables')
        .delete()
        .eq('contract_id', contract.id);
      if (clearError) {
        throw new Error(`Could not refresh the agreement deliverables: ${clearError.message}`);
      }
    }
    const { error } = await supabase.from('contract_deliverables').insert(
      deliverables.map((deliverable) => ({
        ...deliverable,
        agency_id: context.agencyId,
        cadence: 'monthly',
        client_visible: true,
        contract_id: contract.id,
        created_by: context.adminUserId,
        unit: 'deliverable',
      })),
    );

    if (error) {
      throw new Error(`The client was created, but deliverables failed: ${error.message}`);
    }
  }

  if (input.contractDocuments.length) {
    const attachmentRows = [];
    for (const file of input.contractDocuments) {
      const storagePath = await uploadFile(
        supabase,
        'client-files',
        uploadKey(
          `${context.agencyId}/${clientAccount.id}/_account/contracts`,
          file.name,
        ),
        file,
      );
      attachmentRows.push({
        byteSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        originalFilename: file.name,
        storagePath,
      });
    }

    const { data: registered, error: registerError } =
      await supabase.functions.invoke<{ error?: string; registered?: boolean }>(
        'admin-provision-user',
        {
          body: {
            action: 'register-contract-files',
            agencyId: context.agencyId,
            clientAccountId: clientAccount.id,
            contractId: contract.id,
            files: attachmentRows,
          },
        },
      );
    if (registerError || !registered?.registered) {
      throw new Error(
        registered?.error ||
          (await functionErrorMessage(
            registerError,
            'The files uploaded but could not be linked to the agreement.',
          )),
      );
    }
  }

  if (authUserId) {
    const { error: attachError } = await supabase.rpc('admin_attach_client_user', {
      p_agency_id: context.agencyId,
      p_auth_user_id: authUserId,
      p_client_account_id: clientAccount.id,
      p_client_role: 'owner',
      p_full_name: contactName,
    });

    if (attachError) {
      throw new Error(
        `The workspace exists, but the login could not be attached: ${attachError.message}`,
      );
    }

    await sendPasswordSetupEmail(email);
  }

  if (input.workflowTasks?.length) {
    const now = new Date();
    const firstPropertyId = propertyIds[0] ?? null;
    const { error: taskError } = await supabase.from('tasks').insert(
      input.workflowTasks.map((task) => {
        const dueAt = new Date(now);
        dueAt.setDate(dueAt.getDate() + task.dueOffsetDays);
        dueAt.setHours(12, 0, 0, 0);
        return {
          agency_id: context.agencyId,
          client_account_id: clientAccount.id,
          created_by: context.adminUserId,
          description: [
            task.description,
            task.role ? `Role: ${task.role.replaceAll('_', ' ')}` : '',
            task.dependsOn ? `Depends on: ${task.dependsOn}` : '',
            task.checklist?.length ? `Checklist:\n${task.checklist.map((item) => `- ${item}`).join('\n')}` : '',
          ].filter(Boolean).join('\n\n'),
          due_at: dueAt.toISOString(),
          priority: task.priority,
          property_id: firstPropertyId,
          status: 'todo' as const,
          title: task.title,
          visibility: 'team' as const,
        };
      }),
    );
    if (taskError) throw new Error(`The client was created, but kickoff tasks could not be created: ${taskError.message}`);
  }

  const firstPropertyId = propertyIds[0] ?? null;
  const { error: jobError } = await supabase.from('jobs').insert({
    agency_id: context.agencyId,
    brief: input.monthlyDeliverables.trim() || null,
    client_account_id: clientAccount.id,
    created_by: context.adminUserId,
    kind: 'property_launch',
    name: firstPropertyId ? `${accountName} launch` : `${accountName} campaign`,
    property_id: firstPropertyId,
    starts_on: input.contractStartsOn || null,
    status: 'planned',
  });
  const jobsTableIsPending = jobError?.code === 'PGRST205'
    || /(?:could not find|relation).+jobs.+(?:schema cache|does not exist)/i.test(jobError?.message ?? '');
  if (jobError && !jobsTableIsPending) {
    throw new Error(`The client was created, but its launch job could not be created: ${jobError.message}`);
  }

  return {
    authUserId,
    clientAccountId: clientAccount.id,
    contractId: contract.id,
  };
}
