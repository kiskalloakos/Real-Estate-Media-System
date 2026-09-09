import type { Session, User } from '@supabase/supabase-js';
import React from 'react';

import { passwordResetRedirectUrl } from '@/lib/app-urls';
import {
  defaultNativeNotificationPreferences,
  loadNativeNotificationPreferences,
  saveNativeNotificationPreferences,
  type NativeNotificationPreferences,
} from '@/lib/native-notification-preferences';
import {
  clearStoredPushToken,
  loadStoredPushToken,
} from '@/lib/push-device-storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ProfileUpdateInput } from '@/screens/web/types';

export type AppRole = 'admin' | 'team_member' | 'client';

export type AppIdentity = {
  agencyId: string | null;
  avatarUrl: string | null;
  clientAccountId: string | null;
  clientRole: 'owner' | 'member' | null;
  displayName: string;
  email: string;
  locale: 'en' | 'ro';
  mustResetPassword: boolean;
  phone: string | null;
  role: AppRole;
  userId: string;
};

export type AgencyWorkspace = {
  agencyId: string;
  name: string;
  role: Extract<AppRole, 'admin' | 'team_member'>;
};

type AuthResult = {
  error?: string;
};

type AppContextValue = {
  authReady: boolean;
  identity: AppIdentity | null;
  isPreview: boolean;
  isSupabaseConfigured: boolean;
  notificationPreferences: NativeNotificationPreferences;
  session: Session | null;
  workspaces: AgencyWorkspace[];
  enterPreview: (role: AppRole) => void;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  setNotificationPreferences: (
    patch: Partial<NativeNotificationPreferences>,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  selectWorkspace: (agencyId: string) => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
};

function workspaceStorageKey(userId: string) {
  return `realty-media:active-agency:${userId}`;
}

function storedWorkspaceId(userId: string) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(workspaceStorageKey(userId));
}

function persistWorkspaceId(userId: string, agencyId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(workspaceStorageKey(userId), agencyId);
}

const AppContext = React.createContext<AppContextValue | null>(null);

const previewNames: Record<AppRole, string> = {
  admin: 'Alex Morgan',
  client: 'Alex Morgan',
  team_member: 'Mara Ionescu',
};

function roleFromValue(value: unknown): AppRole | null {
  if (value === 'admin' || value === 'team_member' || value === 'client') {
    return value;
  }

  return null;
}

function previewIdentity(role: AppRole): AppIdentity {
  return {
    agencyId: 'demo-realty-media',
    avatarUrl: null,
    clientAccountId: role === 'client' ? 'demo-client' : null,
    clientRole: role === 'client' ? 'owner' : null,
    displayName: previewNames[role],
    email: `${role.replace('_', '.')}@preview.realtymedia.ro`,
    locale: 'en',
    mustResetPassword: false,
    phone: null,
    role,
    userId: `preview-${role}`,
  };
}

function notificationPreferencePayload(
  userId: string,
  preferences: NativeNotificationPreferences,
) {
  return {
    calendar_enabled: preferences.calendar,
    in_app_enabled: preferences.master,
    payments_enabled: preferences.payments,
    reviews_enabled: preferences.reviews,
    tasks_enabled: preferences.tasks,
    user_id: userId,
  };
}

async function avatarUrlFromPath(path: string | null | undefined) {
  if (!path || !supabase) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, 60 * 60 * 12, {
      transform: {
        height: 160,
        quality: 80,
        resize: 'cover',
        width: 160,
      },
    });
  return error ? null : data.signedUrl;
}

async function loadIdentity(
  user: User,
  preferredAgencyId = storedWorkspaceId(user.id),
): Promise<{ identity: AppIdentity; workspaces: AgencyWorkspace[] }> {
  const fallbackRole =
    roleFromValue(user.app_metadata.role) ??
    roleFromValue(user.user_metadata.role) ??
    'client';

  if (!supabase) {
    return { identity: {
      ...previewIdentity(fallbackRole),
      displayName:
        user.user_metadata.display_name ??
        user.user_metadata.full_name ??
        user.email?.split('@')[0] ??
        'Realty Media member',
      email: user.email ?? '',
      mustResetPassword: user.user_metadata.must_reset_password === true,
      phone: null,
      userId: user.id,
    }, workspaces: [] };
  }

  const [{ data: profile }, { data: agencyMemberships }, { data: clientMemberships }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, avatar_path, phone, locale')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('agency_memberships')
        .select('agency_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true }),
      supabase
        .from('client_memberships')
        .select('client_account_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true }),
    ]);

  const membershipRows = (agencyMemberships ?? []).flatMap((membership) => {
    const role = roleFromValue(membership.role);
    return role === 'admin' || role === 'team_member'
      ? [{ agencyId: membership.agency_id, role }]
      : [];
  });
  const agencyIds = membershipRows.map((membership) => membership.agencyId);
  const { data: agencies } = agencyIds.length
    ? await supabase.from('agencies').select('id, name').in('id', agencyIds)
    : { data: [] };
  const agencyNames = new Map((agencies ?? []).map((agency) => [agency.id, agency.name]));
  const workspaces = membershipRows.map((membership) => ({
    ...membership,
    name: agencyNames.get(membership.agencyId) ?? 'Untitled workspace',
  }));
  const selectedAgencyMembership =
    workspaces.find((workspace) => workspace.agencyId === preferredAgencyId) ??
    workspaces[0] ??
    null;
  if (selectedAgencyMembership) persistWorkspaceId(user.id, selectedAgencyMembership.agencyId);

  const clientMembership = (clientMemberships ?? [])[0] ?? null;

  const role =
    selectedAgencyMembership?.role ??
    (clientMembership?.client_account_id ? 'client' : fallbackRole);
  const { data: clientAccount } =
    !selectedAgencyMembership?.agencyId && clientMembership?.client_account_id
      ? await supabase
          .from('client_accounts')
          .select('agency_id')
          .eq('id', clientMembership.client_account_id)
          .maybeSingle()
      : { data: null };

  return { identity: {
    agencyId: selectedAgencyMembership?.agencyId ?? clientAccount?.agency_id ?? null,
    avatarUrl: await avatarUrlFromPath(profile?.avatar_path),
    clientAccountId: selectedAgencyMembership ? null : clientMembership?.client_account_id ?? null,
    clientRole: selectedAgencyMembership ? null : clientMembership?.role ?? null,
    displayName:
      profile?.full_name ??
      user.user_metadata.display_name ??
      user.user_metadata.full_name ??
      user.email?.split('@')[0] ??
        'Realty Media member',
    email: user.email ?? '',
    locale: profile?.locale === 'ro' ? 'ro' : 'en',
    mustResetPassword: user.user_metadata.must_reset_password === true,
    phone: profile?.phone ?? null,
    role,
    userId: user.id,
  }, workspaces };
}

export function AppProvider({ children }: React.PropsWithChildren) {
  const [authReady, setAuthReady] = React.useState(!supabase);
  // A local build has no sign-in service. Start in its sample workspace on the
  // first render instead of briefly rendering the login screen and then
  // switching to preview mode in an effect.
  const [identity, setIdentity] = React.useState<AppIdentity | null>(() =>
    supabase ? null : previewIdentity('admin'),
  );
  const [isPreview, setIsPreview] = React.useState(() => !supabase);
  const [notificationPreferences, setNotificationPreferencesState] =
    React.useState<NativeNotificationPreferences>(
      defaultNativeNotificationPreferences,
    );
  const [session, setSession] = React.useState<Session | null>(null);
  const [workspaces, setWorkspaces] = React.useState<AgencyWorkspace[]>([]);
  const signingOutRef = React.useRef(false);
  const notificationUserId = identity?.userId;

  React.useEffect(() => {
    let mounted = true;

    if (!supabase) {
      return;
    }

    const applySession = async (nextSession: Session | null) => {
      if (!mounted || signingOutRef.current) {
        return;
      }

      setSession(nextSession);
      setIsPreview(false);
      const resolved = nextSession ? await loadIdentity(nextSession.user) : null;
      setIdentity(resolved?.identity ?? null);
      setWorkspaces(resolved?.workspaces ?? []);
      setAuthReady(true);
    };

    void supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const selectWorkspace = React.useCallback(async (agencyId: string) => {
    if (!session) throw new Error('You need to be signed in to change workspaces.');
    if (!workspaces.some((workspace) => workspace.agencyId === agencyId)) {
      throw new Error('You do not have access to that workspace.');
    }
    persistWorkspaceId(session.user.id, agencyId);
    const resolved = await loadIdentity(session.user, agencyId);
    setIdentity(resolved.identity);
    setWorkspaces(resolved.workspaces);
  }, [session, workspaces]);

  React.useEffect(() => {
    let mounted = true;

    if (!notificationUserId) {
      return;
    }

    void Promise.all([
      loadNativeNotificationPreferences(notificationUserId),
      supabase
        ? supabase
            .from('notification_preferences')
            .select(
              'in_app_enabled, reviews_enabled, tasks_enabled, calendar_enabled, payments_enabled',
            )
            .eq('user_id', notificationUserId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]).then(async ([localPreferences, remoteResult]) => {
      const preferences = remoteResult.data
        ? {
            calendar: remoteResult.data.calendar_enabled,
            master: remoteResult.data.in_app_enabled,
            payments: remoteResult.data.payments_enabled,
            reviews: remoteResult.data.reviews_enabled,
            tasks: remoteResult.data.tasks_enabled,
          }
        : localPreferences;

      if (mounted) {
        setNotificationPreferencesState(preferences);
      }

      if (supabase && !remoteResult.data && !remoteResult.error) {
        await supabase
          .from('notification_preferences')
          .upsert(notificationPreferencePayload(notificationUserId, preferences), {
            onConflict: 'user_id',
          });
      }

      await saveNativeNotificationPreferences(notificationUserId, preferences);
    });

    return () => {
      mounted = false;
    };
  }, [notificationUserId]);

  const setNotificationPreferences = React.useCallback(
    async (patch: Partial<NativeNotificationPreferences>) => {
      if (!identity) {
        return;
      }

      const next = {
        ...notificationPreferences,
        ...patch,
      };
      setNotificationPreferencesState(next);

      try {
        const remoteResult = supabase
          ? await supabase
              .from('notification_preferences')
              .upsert(notificationPreferencePayload(identity.userId, next), {
                onConflict: 'user_id',
              })
          : { error: null };

        if (remoteResult.error) {
          throw remoteResult.error;
        }

        await saveNativeNotificationPreferences(identity.userId, next);
      } catch {
        setNotificationPreferencesState(notificationPreferences);
      }
    },
    [identity, notificationPreferences],
  );

  const enterPreview = React.useCallback((role: AppRole) => {
    setSession(null);
    setIdentity(previewIdentity(role));
    setIsPreview(true);
    setAuthReady(true);
  }, []);

  const signIn = React.useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) {
        return { error: 'Supabase is not configured on this build yet.' };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      return error ? { error: error.message } : {};
    },
    [],
  );

  const requestPasswordReset = React.useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!supabase) {
        return { error: 'Supabase is not configured on this build yet.' };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: passwordResetRedirectUrl(),
        },
      );

      return error ? { error: error.message } : {};
    },
    [],
  );

  const updatePassword = React.useCallback(
    async (password: string): Promise<AuthResult> => {
      if (!supabase) {
        return { error: 'Supabase is not configured on this build yet.' };
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.auth.updateUser({
        data: {
          ...(user?.user_metadata ?? {}),
          must_reset_password: false,
        },
        password,
      });

      if (!error) {
        setIdentity((current) =>
          current ? { ...current, mustResetPassword: false } : current,
        );
      }

      return error ? { error: error.message } : {};
    },
    [],
  );

  const updateProfile = React.useCallback(
    async (input: ProfileUpdateInput): Promise<AuthResult> => {
      if (!identity) {
        return { error: 'Your profile is not available on this build.' };
      }

      if (isPreview) {
        setIdentity((current) =>
          current
            ? {
                ...current,
                displayName: input.fullName.trim(),
                locale: input.locale,
                phone: input.phone.trim() || null,
              }
            : current,
        );
        return {};
      }

      if (!supabase) {
        return { error: 'Your profile is not available on this build.' };
      }

      let avatarPath: string | undefined;
      if (input.avatarFile) {
        const extension = input.avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        avatarPath = `${identity.userId}/profile.${extension.replace(/[^a-z0-9]/g, '')}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(avatarPath, input.avatarFile, {
            contentType: input.avatarFile.type || 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          return { error: `Could not upload the profile photo: ${uploadError.message}` };
        }
      }

      const profileUpdate = {
        full_name: input.fullName.trim(),
        locale: input.locale,
        phone: input.phone.trim() || null,
        ...(avatarPath ? { avatar_path: avatarPath } : {}),
      };
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', identity.userId);

      if (profileError) {
        return { error: `Could not update the profile: ${profileError.message}` };
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: input.fullName.trim(),
          full_name: input.fullName.trim(),
        },
      });

      if (authError) {
        return { error: `Profile saved, but account metadata failed: ${authError.message}` };
      }

      const avatarUrl = avatarPath
        ? await avatarUrlFromPath(avatarPath)
        : identity.avatarUrl;
      setIdentity((current) =>
        current
          ? {
              ...current,
              avatarUrl,
              displayName: input.fullName.trim(),
              locale: input.locale,
              phone: input.phone.trim() || null,
            }
          : current,
      );
      return {};
    },
    [identity, isPreview],
  );

  const signOut = React.useCallback(async () => {
    signingOutRef.current = true;
    try {
      if (supabase && identity && !isPreview) {
        try {
          const pushToken = await loadStoredPushToken(identity.userId);
          if (pushToken) {
            const { error } = await supabase.rpc('disable_push_device', {
              p_expo_push_token: pushToken,
            });
            if (!error) {
              await clearStoredPushToken(identity.userId);
            }
          }
        } catch {
          // Signing out must still succeed if device-token cleanup is unavailable.
        }
      }

      if (supabase && !isPreview) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } finally {
      setIdentity(null);
      setIsPreview(false);
      setSession(null);
      setWorkspaces([]);
      setAuthReady(true);
      signingOutRef.current = false;
    }
  }, [identity, isPreview]);

  const value = React.useMemo<AppContextValue>(
    () => ({
      authReady,
      enterPreview,
      identity,
      isPreview,
      isSupabaseConfigured,
      notificationPreferences,
      requestPasswordReset,
      session,
      setNotificationPreferences,
      signIn,
      signOut,
      selectWorkspace,
      updateProfile,
      updatePassword,
      workspaces,
    }),
    [
      authReady,
      enterPreview,
      identity,
      isPreview,
      notificationPreferences,
      requestPasswordReset,
      session,
      setNotificationPreferences,
      signIn,
      signOut,
      selectWorkspace,
      updateProfile,
      updatePassword,
      workspaces,
    ],
  );

  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp() {
  const value = React.use(AppContext);

  if (!value) {
    throw new Error('useApp must be used inside AppProvider.');
  }

  return value;
}
