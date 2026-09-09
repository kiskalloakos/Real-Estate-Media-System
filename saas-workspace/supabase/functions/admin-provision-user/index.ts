import { corsHeaders, json } from '../_shared/cors.ts';
import {
  authenticatedUser,
  FunctionHttpError,
  requireAgencyAdmin,
  serviceClient,
} from '../_shared/supabase.ts';

type ProvisionBody = {
  account?: {
    billingEmail: string;
    locationLabel?: string | null;
    metadata?: Record<string, unknown>;
    name: string;
    ownerName: string;
  };
  action?: 'create-client' | 'create-property' | 'provision' | 'register-contract-files' | 'require-password-reset' | 'update-property-cover' | 'update-team-member';
  agencyId?: string;
  avatarPath?: string;
  avatarUpload?: {
    contentType?: string;
    dataBase64: string;
    extension?: string;
  };
  clientAccountId?: string;
  contractId?: string;
  email?: string;
  files?: Array<{
    byteSize: number;
    mimeType: string;
    originalFilename: string;
    storagePath: string;
  }>;
  fullName?: string;
  property?: {
    description?: string | null;
    locationLabel?: string | null;
    name: string;
    scriptingBrief?: string | null;
  };
  propertyId?: string;
  membershipId?: string;
  phone?: string | null;
  coverImagePath?: string;
  role?: 'client' | 'team_member';
  status?: 'active' | 'suspended';
  title?: string | null;
  temporaryPassword?: string;
};

function normalizedEmail(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

function safeAvatarExtension(value?: string) {
  const extension = value?.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '')
    ? extension
    : 'jpg';
}

function safeAvatarContentType(value?: string) {
  const contentType = value?.trim().toLowerCase();
  return ['image/jpeg', 'image/png', 'image/webp'].includes(contentType ?? '')
    ? contentType
    : 'image/jpeg';
}

async function uploadTeamMemberAvatar(
  client: ReturnType<typeof serviceClient>,
  userId: string,
  upload: NonNullable<ProvisionBody['avatarUpload']>,
) {
  if (!upload.dataBase64) {
    throw new FunctionHttpError(400, 'Profile photo data is required.');
  }

  const binary = atob(upload.dataBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength > 10 * 1024 * 1024) {
    throw new FunctionHttpError(400, 'Profile photo must be smaller than 10 MB.');
  }

  const path = `${userId}/profile.${safeAvatarExtension(upload.extension)}`;
  const { error } = await client.storage.from('avatars').upload(path, bytes, {
    cacheControl: '3600',
    contentType: safeAvatarContentType(upload.contentType),
    upsert: true,
  });
  if (error) throw new Error(`Could not upload profile photo: ${error.message}`);
  return path;
}

async function findUserByEmail(
  client: ReturnType<typeof serviceClient>,
  email: string,
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`Could not inspect existing logins: ${error.message}`);
    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === email,
    );
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  throw new Error('The login directory is too large to search safely.');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const client = serviceClient();
    const admin = await authenticatedUser(request, client);
    const body = (await request.json()) as ProvisionBody;
    const agencyId = body.agencyId?.trim();
    if (!agencyId) {
      throw new FunctionHttpError(400, 'Agency is required.');
    }
    await requireAgencyAdmin(client, admin.id, agencyId);

    if (body.action === 'update-team-member') {
      const membershipId = body.membershipId?.trim();
      const email = normalizedEmail(body.email);
      const fullName = body.fullName?.trim();
      if (!membershipId || !email || !fullName) {
        throw new FunctionHttpError(400, 'Team member name, email, and membership are required.');
      }

      const { data: membership, error: membershipError } = await client
        .from('agency_memberships')
        .select('id, user_id, role')
        .eq('agency_id', agencyId)
        .eq('id', membershipId)
        .maybeSingle();
      if (membershipError || !membership || membership.role !== 'team_member') {
        throw new FunctionHttpError(404, 'The team member was not found.');
      }

      const { error: authError } = await client.auth.admin.updateUserById(
        membership.user_id,
        {
          email,
          user_metadata: {
            display_name: fullName,
            full_name: fullName,
            role: 'team_member',
          },
        },
      );
      if (authError) throw new Error(`Could not update login: ${authError.message}`);

      const avatarPath = body.avatarUpload
        ? await uploadTeamMemberAvatar(client, membership.user_id, body.avatarUpload)
        : body.avatarPath?.trim();
      const profileUpdates = {
        ...(avatarPath ? { avatar_path: avatarPath } : {}),
        email,
        full_name: fullName,
        phone: body.phone?.trim() || null,
      };
      const { error: profileError } = await client
        .from('profiles')
        .update(profileUpdates)
        .eq('id', membership.user_id);
      if (profileError) throw new Error(`Could not update member profile: ${profileError.message}`);

      const { error: accessError } = await client
        .from('agency_memberships')
        .update({
          status: body.status === 'suspended' ? 'suspended' : 'active',
          title: body.title?.trim() || null,
        })
        .eq('id', membership.id)
        .eq('agency_id', agencyId)
        .eq('role', 'team_member');
      if (accessError) throw new Error(`Could not update member access: ${accessError.message}`);

      return json(request, { updated: true, avatarPath });
    }

    if (body.action === 'register-contract-files') {
      const clientAccountId = body.clientAccountId?.trim();
      const contractId = body.contractId?.trim();
      const files = body.files ?? [];
      if (!clientAccountId || !contractId || !files.length) {
        throw new FunctionHttpError(
          400,
          'Client, agreement, and at least one file are required.',
        );
      }

      const { data: contract, error: contractError } = await client
        .from('service_contracts')
        .select('id')
        .eq('id', contractId)
        .eq('agency_id', agencyId)
        .eq('client_account_id', clientAccountId)
        .maybeSingle();
      if (contractError || !contract) {
        throw new FunctionHttpError(404, 'The client agreement was not found.');
      }

      const { data: existingNote, error: noteLookupError } = await client
        .from('notes')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('client_account_id', clientAccountId)
        .eq('title', 'Contract documents')
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (noteLookupError) {
        throw new Error(`Could not inspect contract documents: ${noteLookupError.message}`);
      }

      let noteId = existingNote?.id as string | undefined;
      if (!noteId) {
        const { data: note, error: noteError } = await client
          .from('notes')
          .insert({
            agency_id: agencyId,
            body: 'Client agreement documents.',
            client_account_id: clientAccountId,
            created_by: admin.id,
            title: 'Contract documents',
            visibility: 'client',
          })
          .select('id')
          .single();
        if (noteError || !note) {
          throw new Error(
            `Could not prepare contract documents: ${
              noteError?.message ?? 'Unknown database error'
            }`,
          );
        }
        noteId = note.id;
      }

      const storagePaths = files.map((file) => file.storagePath);
      const { data: existingAttachments, error: attachmentsLookupError } =
        await client
          .from('record_attachments')
          .select('storage_path')
          .eq('agency_id', agencyId)
          .eq('client_account_id', clientAccountId)
          .in('storage_path', storagePaths);
      if (attachmentsLookupError) {
        throw new Error(
          `Could not inspect existing attachments: ${attachmentsLookupError.message}`,
        );
      }
      const existingPaths = new Set(
        (existingAttachments ?? []).map((attachment) => attachment.storage_path),
      );
      const newFiles = files.filter((file) => !existingPaths.has(file.storagePath));
      if (newFiles.length) {
        const { error: attachmentsError } = await client
          .from('record_attachments')
          .insert(
            newFiles.map((file) => ({
              agency_id: agencyId,
              byte_size: file.byteSize,
              client_account_id: clientAccountId,
              mime_type: file.mimeType,
              note_id: noteId,
              original_filename: file.originalFilename,
              storage_path: file.storagePath,
              uploaded_by: admin.id,
            })),
          );
        if (attachmentsError) {
          throw new Error(
            `Could not register contract attachments: ${attachmentsError.message}`,
          );
        }
      }

      const { error: updateError } = await client
        .from('service_contracts')
        .update({ contract_file_path: files[0].storagePath })
        .eq('id', contractId);
      if (updateError) {
        throw new Error(`Could not link the agreement file: ${updateError.message}`);
      }
      return json(request, { registered: true });
    }

    if (body.action === 'create-property') {
      const clientAccountId = body.clientAccountId?.trim();
      const propertyName = body.property?.name?.trim();
      if (!clientAccountId || !propertyName) {
        throw new FunctionHttpError(400, 'Client and property names are required.');
      }

      const { data: clientAccount, error: clientError } = await client
        .from('client_accounts')
        .select('id')
        .eq('id', clientAccountId)
        .eq('agency_id', agencyId)
        .maybeSingle();
      if (clientError || !clientAccount) {
        throw new FunctionHttpError(404, 'The client workspace was not found.');
      }

      const { data: existingProperty, error: existingPropertyError } = await client
        .from('properties')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('client_account_id', clientAccountId)
        .eq('name', propertyName)
        .is('archived_at', null)
        .limit(1)
        .maybeSingle();
      if (existingPropertyError) {
        throw new Error(`Could not inspect the client property: ${existingPropertyError.message}`);
      }
      if (existingProperty) return json(request, { propertyId: existingProperty.id });

      const { data: property, error: propertyError } = await client
        .from('properties')
        .insert({
          agency_id: agencyId,
          client_account_id: clientAccountId,
          created_by: admin.id,
          description: body.property?.description?.trim() || null,
          location_label: body.property?.locationLabel?.trim() || null,
          name: propertyName,
          scripting_brief: body.property?.scriptingBrief?.trim() || '',
          status: 'onboarding',
        })
        .select('id')
        .single();
      if (propertyError || !property) {
        throw new Error(`Could not create the property: ${propertyError?.message ?? 'Unknown database error'}`);
      }
      return json(request, { propertyId: property.id });
    }

    if (body.action === 'update-property-cover') {
      const clientAccountId = body.clientAccountId?.trim();
      const propertyId = body.propertyId?.trim();
      const coverImagePath = body.coverImagePath?.trim();
      if (!clientAccountId || !propertyId || !coverImagePath) {
        throw new FunctionHttpError(400, 'Client, property, and image are required.');
      }

      const { data: property, error: propertyError } = await client
        .from('properties')
        .update({ cover_image_path: coverImagePath })
        .eq('id', propertyId)
        .eq('agency_id', agencyId)
        .eq('client_account_id', clientAccountId)
        .select('id')
        .maybeSingle();
      if (propertyError || !property) {
        throw new Error(`Could not attach the property image: ${propertyError?.message ?? 'Property was not found'}`);
      }
      return json(request, { propertyId: property.id });
    }

    const email = normalizedEmail(body.email);

    if (body.action === 'require-password-reset') {
      if (!email) {
        throw new FunctionHttpError(400, 'Team member email is required.');
      }
      const authUser = await findUserByEmail(client, email);
      if (!authUser) {
        throw new FunctionHttpError(404, 'No login exists for this team member.');
      }
      const { data: teamMembership, error: membershipError } = await client
        .from('agency_memberships')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('user_id', authUser.id)
        .eq('role', 'team_member')
        .maybeSingle();
      if (membershipError || !teamMembership) {
        throw new FunctionHttpError(404, 'No team member login exists in this workspace.');
      }
      const { error } = await client.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...(authUser.user_metadata ?? {}),
          must_reset_password: true,
        },
      });
      if (error) throw new Error(`Could not require a password reset: ${error.message}`);
      return json(request, { success: true });
    }

    const fullName = body.fullName?.trim() ?? '';
    const role = body.role === 'team_member' ? 'team_member' : 'client';

    if (!email || !fullName) {
      throw new FunctionHttpError(400, 'Name and email are required.');
    }

    let authUser = await findUserByEmail(client, email);
    let loginCreated = false;

    if (!authUser) {
      if (!body.temporaryPassword || body.temporaryPassword.length < 10) {
        throw new FunctionHttpError(
          400,
          'Temporary passwords must contain at least 10 characters.',
        );
      }
      const { data, error } = await client.auth.admin.createUser({
        email,
        email_confirm: true,
        password: body.temporaryPassword,
        user_metadata: {
          display_name: fullName,
          full_name: fullName,
          must_reset_password: true,
          role,
        },
      });
      if (error || !data.user) {
        throw new Error(error?.message ?? 'Could not create the client login.');
      }
      authUser = data.user;
      loginCreated = true;
    }

    if (body.action !== 'create-client') {
      return json(request, {
        authUserId: authUser.id,
        loginCreated,
      });
    }

    if (!body.account?.name?.trim() || !body.account.ownerName?.trim()) {
      if (loginCreated) await client.auth.admin.deleteUser(authUser.id);
      throw new FunctionHttpError(400, 'Client and owner names are required.');
    }

    const { data: existingClient, error: existingClientError } = await client
      .from('client_accounts')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('billing_email', body.account.billingEmail)
      .eq('name', body.account.name.trim())
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingClientError) {
      throw new Error(
        `Could not inspect existing clients: ${existingClientError.message}`,
      );
    }

    let clientAccount = existingClient;
    let clientAccountReused = Boolean(existingClient);
    let clientError: { message: string } | null = null;
    if (!clientAccount) {
      const created = await client
        .from('client_accounts')
        .insert({
          agency_id: agencyId,
          billing_email: body.account.billingEmail,
          created_by: admin.id,
          location_label: body.account.locationLabel || null,
          metadata: body.account.metadata ?? {},
          name: body.account.name.trim(),
          owner_name: body.account.ownerName.trim(),
        })
        .select('id')
        .single();
      clientAccount = created.data;
      clientError = created.error;
      clientAccountReused = false;
    }

    if (clientError || !clientAccount) {
      if (loginCreated) await client.auth.admin.deleteUser(authUser.id);
      throw new Error(
        `Could not create the client workspace: ${
          clientError?.message ?? 'Unknown database error'
        }`,
      );
    }

    return json(request, {
      authUserId: authUser.id,
      clientAccountId: clientAccount.id,
      clientAccountReused,
      loginCreated,
    });
  } catch (error) {
    if (!(error instanceof FunctionHttpError)) {
      console.error('Account provisioning failed', error);
    }
    const message = error instanceof FunctionHttpError
      ? error.message
      : 'Account provisioning failed. Please try again.';
    const status = error instanceof FunctionHttpError ? error.status : 500;
    return json(request, { error: message }, status);
  }
});
