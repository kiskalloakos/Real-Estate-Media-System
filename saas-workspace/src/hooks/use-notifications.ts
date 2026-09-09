import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import type { PortalScreenKey } from '@/components/web';
import { supabase } from '@/lib/supabase';
import type { NotificationKind } from '@/types/database';

const portalScreens = new Set<PortalScreenKey>([
  'dashboard',
  'clients',
  'team',
  'members',
  'properties',
  'reviews',
  'tasks',
  'calendar',
  'billing',
  'gear',
  'finances',
]);

export type AppNotification = {
  body: string;
  createdAt: string;
  entityId: string | null;
  entityType: string | null;
  id: string;
  kind: NotificationKind;
  metadata: Record<string, unknown>;
  nativeRoute: string | null;
  readAt: string | null;
  title: string;
  webScreen: PortalScreenKey;
};

function queryKey(userId: string, agencyId: string | null | undefined) {
  return ['notifications', userId, agencyId] as const;
}

function safeWebScreen(value: string): PortalScreenKey {
  return portalScreens.has(value as PortalScreenKey)
    ? (value as PortalScreenKey)
    : 'dashboard';
}

function isNecessaryNotification(
  notification: Pick<AppNotification, 'body' | 'kind' | 'title'>,
) {
  switch (notification.kind) {
    case 'task':
      return notification.title.startsWith('New task:');
    case 'calendar':
      return (
        notification.title.startsWith('New event:') ||
        notification.title.startsWith('Added to event:')
      );
    case 'review':
      return true;
    case 'payment':
      return notification.title === 'Upcoming payment';
    case 'system':
      return /\b(error|failed|failure|action required)\b/i.test(
        `${notification.title} ${notification.body}`,
      );
  }
}

async function fetchNotifications(userId: string, agencyId: string): Promise<AppNotification[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, kind, title, body, web_screen, native_route, entity_type, entity_id, metadata, read_at, created_at',
    )
    .eq('recipient_user_id', userId)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Notifications: ${error.message}`);
  }

  return (data ?? [])
    .map((notification) => ({
      body: notification.body,
      createdAt: notification.created_at,
      entityId: notification.entity_id,
      entityType: notification.entity_type,
      id: notification.id,
      kind: notification.kind,
      metadata: (notification.metadata ?? {}) as Record<string, unknown>,
      nativeRoute: notification.native_route,
      readAt: notification.read_at,
      title: notification.title,
      webScreen: safeWebScreen(notification.web_screen),
    }))
    .filter(isNecessaryNotification);
}

export function useNotifications({
  agencyId,
  enabled,
  subscribeToChanges = true,
  userId,
}: {
  agencyId: string | null | undefined;
  enabled: boolean;
  subscribeToChanges?: boolean;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const key = useMemo(() => queryKey(userId, agencyId), [agencyId, userId]);
  const query = useQuery({
    enabled: enabled && Boolean(supabase) && Boolean(agencyId),
    queryFn: () => fetchNotifications(userId, agencyId!),
    queryKey: key,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!enabled || !subscribeToChanges || !supabase || !userId || !agencyId) {
      return undefined;
    }

    const channel = supabase
      .channel(`notifications:${userId}:${agencyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `agency_id=eq.${agencyId}`,
          schema: 'public',
          table: 'notifications',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [agencyId, enabled, key, queryClient, subscribeToChanges, userId]);

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!supabase) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('recipient_user_id', userId)
        .eq('agency_id', agencyId!)
        .is('read_at', null);
      if (error) throw new Error(error.message);
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AppNotification[]>(key);
      queryClient.setQueryData<AppNotification[]>(key, (current = []) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      );
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!supabase) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_user_id', userId)
        .eq('agency_id', agencyId!)
        .is('read_at', null);
      if (error) throw new Error(error.message);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AppNotification[]>(key);
      const readAt = new Date().toISOString();
      queryClient.setQueryData<AppNotification[]>(key, (current = []) =>
        current.map((notification) => ({ ...notification, readAt })),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!supabase) return;
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('recipient_user_id', userId)
        .eq('agency_id', agencyId!);
      if (error) throw new Error(error.message);
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AppNotification[]>(key);
      queryClient.setQueryData<AppNotification[]>(key, (current = []) =>
        current.filter((notification) => notification.id !== notificationId),
      );
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!supabase) return;
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('recipient_user_id', userId)
        .eq('agency_id', agencyId!);
      if (error) throw new Error(error.message);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AppNotification[]>(key);
      queryClient.setQueryData<AppNotification[]>(key, []);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return {
    ...query,
    clearAll: () => clearAll.mutateAsync(),
    markAllRead: () => markAllRead.mutateAsync(),
    markRead: (notificationId: string) => markRead.mutateAsync(notificationId),
    remove: (notificationId: string) => remove.mutateAsync(notificationId),
    unreadCount: (query.data ?? []).filter((notification) => !notification.readAt)
      .length,
  };
}
