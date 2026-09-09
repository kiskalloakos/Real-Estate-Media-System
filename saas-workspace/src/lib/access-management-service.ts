import { sendPasswordSetupEmail } from '@/lib/password-setup-service';
import { supabase } from '@/lib/supabase';
import type {
  CreateClientMemberInput,
  CreateTeamMemberInput,
  UpdateClientMemberAccessInput,
  UpdateTeamMemberAccessInput,
} from '@/screens/web/types';

type AccessContext = {
  agencyId: string;
};

type ProvisionedUser = {
  id: string;
};

function safeAvatarExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '')
    ? extension
    : 'jpg';
}

async function uploadTeamMemberAvatar(userId: string, file: File) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  const path = `${userId}/profile.${safeAvatarExtension(file)}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(`Could not upload profile photo: ${error.message}`);
  return path;
}

async function updateTeamMemberRecord(
  input: Omit<UpdateTeamMemberAccessInput, 'avatarFile'> & { avatarPath?: string },
  context: AccessContext,
) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  const { data, error } = await supabase.functions.invoke<{ error?: string }>(
    'admin-provision-user',
    {
      body: {
        action: 'update-team-member',
        agencyId: context.agencyId,
        avatarPath: input.avatarPath,
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName.trim(),
        membershipId: input.membershipId,
        phone: input.phone.trim() || null,
        status: input.status,
        title: input.title.trim() || null,
      },
    },
  );
  if (error || data?.error) {
    throw new Error(data?.error || error?.message || 'Team member could not be updated.');
  }
}

function normalizedAccount(input: {
  email: string;
  fullName: string;
  temporaryPassword: string;
}) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const temporaryPassword = input.temporaryPassword;

  if (!email || !fullName || !temporaryPassword) {
    throw new Error('Name, email, and a temporary password are required.');
  }

  if (temporaryPassword.length < 10) {
    throw new Error('Temporary passwords must contain at least 10 characters.');
  }

  return { email, fullName, temporaryPassword };
}

function normalizedIdentity(input: { email: string; fullName: string }) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (!email || !fullName) {
    throw new Error('Name and email are required.');
  }

  return { email, fullName };
}

function provisioningPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

async function provisionTeamAuthUser(
  input: { email: string; fullName: string },
  context: AccessContext,
): Promise<ProvisionedUser> {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  const { data, error } = await supabase.functions.invoke<{
    authUserId?: string;
    error?: string;
  }>('admin-provision-user', {
    body: {
      action: 'provision',
      agencyId: context.agencyId,
      email: input.email,
      fullName: input.fullName,
      role: 'team_member',
      temporaryPassword: provisioningPassword(),
    },
  });

  if (error || data?.error || !data?.authUserId) {
    throw new Error(
      data?.error || error?.message || 'Supabase did not return a team member account.',
    );
  }

  return { id: data.authUserId };
}

async function provisionAuthUser(
  input: {
    email: string;
    fullName: string;
    role: 'client' | 'team_member';
    temporaryPassword: string;
  },
  context: AccessContext,
): Promise<ProvisionedUser> {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  const { data, error } = await supabase.functions.invoke<{
    authUserId?: string;
    error?: string;
  }>('admin-provision-user', {
    body: {
      action: 'provision',
      agencyId: context.agencyId,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      temporaryPassword: input.temporaryPassword,
    },
  });

  if (error || data?.error || !data?.authUserId) {
    throw new Error(
      data?.error || error?.message || 'Supabase did not return a client account.',
    );
  }

  return { id: data.authUserId };
}

export async function createTeamMember(
  input: CreateTeamMemberInput,
  context: AccessContext,
) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');

  const account = normalizedIdentity(input);
  const user = await provisionTeamAuthUser(account, context);

  const { data: membershipId, error: attachError } = await supabase.rpc(
    'admin_attach_team_user',
    {
      p_agency_id: context.agencyId,
      p_auth_user_id: user.id,
      p_full_name: account.fullName,
    },
  );

  if (attachError || !membershipId) {
    throw new Error(
      `The login was created, but team access could not be attached: ${
        attachError?.message ?? 'Unknown database error'
      }`,
    );
  }

  const { error: accessError } = await supabase.rpc('set_agency_member_access', {
    p_membership_id: membershipId,
    p_status: 'active',
    p_title: input.title.trim() || null,
  });

  if (accessError) {
    throw new Error(`Team access was created, but the title failed: ${accessError.message}`);
  }

  const avatarPath = input.avatarFile
    ? await uploadTeamMemberAvatar(user.id, input.avatarFile)
    : undefined;
  await updateTeamMemberRecord(
    {
      avatarPath,
      email: account.email,
      fullName: account.fullName,
      membershipId,
      phone: input.phone,
      status: 'active',
      title: input.title,
    },
    context,
  );

  await sendPasswordSetupEmail(account.email);

  return membershipId;
}

export async function sendTeamMemberPasswordReset(
  email: string,
  context: AccessContext,
) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('A team member email is required.');

  const { data, error } = await supabase.functions.invoke<{ error?: string }>(
    'admin-provision-user',
    {
      body: {
        action: 'require-password-reset',
        agencyId: context.agencyId,
        email: normalizedEmail,
      },
    },
  );
  if (error || data?.error) {
    throw new Error(data?.error || error?.message || 'Password reset could not be prepared.');
  }

  await sendPasswordSetupEmail(normalizedEmail);
}

export async function createClientMember(
  input: CreateClientMemberInput,
  context: AccessContext,
) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');

  const account = normalizedAccount(input);
  const user = await provisionAuthUser(
    {
      ...account,
      role: 'client',
    },
    context,
  );

  const { data: membershipId, error } = await supabase.rpc('attach_client_user', {
    p_agency_id: context.agencyId,
    p_auth_user_id: user.id,
    p_client_account_id: input.clientAccountId,
    p_client_role: input.role,
    p_full_name: account.fullName,
  });

  if (error || !membershipId) {
    throw new Error(
      `The login was created, but client access could not be attached: ${
        error?.message ?? 'Unknown database error'
      }`,
    );
  }

  await sendPasswordSetupEmail(account.email);

  return membershipId;
}

export async function updateTeamMemberAccess(
  input: UpdateTeamMemberAccessInput,
  context: AccessContext,
) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  const { data: membership, error: membershipError } = await supabase
    .from('agency_memberships')
    .select('user_id')
    .eq('id', input.membershipId)
    .eq('agency_id', context.agencyId)
    .single();
  if (membershipError || !membership) {
    throw new Error(`Could not find team member: ${membershipError?.message ?? 'Unknown error'}`);
  }
  const avatarPath = input.avatarFile
    ? await uploadTeamMemberAvatar(membership.user_id, input.avatarFile)
    : undefined;
  await updateTeamMemberRecord({ ...input, avatarPath }, context);
}

export async function updateClientMemberAccess(
  input: UpdateClientMemberAccessInput,
) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');

  const { error } = await supabase.rpc('set_client_member_access', {
    p_membership_id: input.membershipId,
    p_role: input.role,
    p_status: input.status,
  });

  if (error) throw new Error(`Could not update client access: ${error.message}`);
}
