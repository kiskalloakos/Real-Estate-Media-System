import { useQueryClient } from '@tanstack/react-query';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { type Href, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import React from 'react';
import { Linking, Platform } from 'react-native';

import {
  clearStoredPushToken,
  loadStoredPushToken,
  saveStoredPushToken,
} from '@/lib/push-device-storage';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/providers/app-provider';
import {
  PushNotificationsContext,
  type PushNotificationsContextValue,
  type PushPermissionState,
} from '@/providers/push-notifications-context';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function permissionIsGranted(
  permission: Notifications.NotificationPermissionsStatus,
) {
  const iosStatus = permission.ios?.status;
  return (
    permission.granted ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function routeFromNotification(
  response: Notifications.NotificationResponse | null,
) {
  const route = response?.notification.request.content.data?.route;
  return typeof route === 'string' && route.startsWith('/(portal)/')
    ? route
    : null;
}

export function PushNotificationsProvider({
  children,
}: React.PropsWithChildren) {
  const { identity, isPreview } = useApp();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [permissionState, setPermissionState] =
    React.useState<PushPermissionState>('checking');
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const handledResponseId = React.useRef<string | null>(null);

  const registerDevice = React.useCallback(async () => {
    if (isExpoGo) throw new Error('Use a development build to enable push notifications.');
    if (!identity || isPreview || !supabase) {
      throw new Error('Sign in to enable push notifications.');
    }
    if (!Device.isDevice) {
      throw new Error('Push notifications must be enabled on a physical device.');
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      throw new Error('The Expo project ID is missing from this build.');
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;
    const previousToken = await loadStoredPushToken(identity.userId);

    if (previousToken && previousToken !== token) {
      const { error } = await supabase.rpc('disable_push_device', {
        p_expo_push_token: previousToken,
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    const { error } = await supabase.rpc('register_push_device', {
      p_app_version: Constants.expoConfig?.version ?? null,
      p_device_name: Device.deviceName ?? Device.modelName ?? null,
      p_expo_push_token: token,
      p_platform: Platform.OS === 'android' ? 'android' : 'ios',
    });

    if (error) {
      throw new Error(error.message);
    }

    await saveStoredPushToken(identity.userId, token);
    setPushEnabled(true);
    setPermissionState('enabled');
    await queryClient.invalidateQueries({
      queryKey: ['notifications', identity.userId],
    });
  }, [identity, isPreview, queryClient]);

  const enablePush = React.useCallback(async () => {
    setErrorMessage(null);
    setPermissionState('registering');

    try {
      if (isExpoGo) throw new Error('Use a development build to enable push notifications.');
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Workspace notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (!permissionIsGranted(permission)) {
        if (!permission.canAskAgain) {
          setPushEnabled(false);
          setPermissionState('denied');
          await Linking.openSettings();
          return;
        }
        permission = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
      }

      if (!permissionIsGranted(permission)) {
        setPushEnabled(false);
        setPermissionState('denied');
        throw new Error(
          'Notification permission is off. You can enable it in your device settings.',
        );
      }

      await registerDevice();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Push notifications could not be enabled.';
      setErrorMessage(message);
      setPushEnabled(false);
      setPermissionState((current) =>
        current === 'denied' ? 'denied' : 'disabled',
      );
      throw error;
    }
  }, [registerDevice]);

  const disablePush = React.useCallback(async () => {
    if (!identity || !supabase) {
      return;
    }

    setErrorMessage(null);
    try {
      const token = await loadStoredPushToken(identity.userId);
      if (token) {
        const { error } = await supabase.rpc('disable_push_device', {
          p_expo_push_token: token,
        });
        if (error) throw new Error(error.message);
      }
      await clearStoredPushToken(identity.userId);
      setPushEnabled(false);
      setPermissionState('disabled');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Push notifications could not be disabled.',
      );
      throw error;
    }
  }, [identity]);

  React.useEffect(() => {
    let mounted = true;

    if (!identity || isPreview || isExpoGo) {
      return undefined;
    }

    void Notifications.getPermissionsAsync().then(async (permission) => {
      if (!mounted) return;
      if (!permissionIsGranted(permission)) {
        setPushEnabled(false);
        setPermissionState(permission.canAskAgain ? 'disabled' : 'denied');
        return;
      }

      const storedToken = await loadStoredPushToken(identity.userId);
      if (!mounted) return;
      if (storedToken) {
        try {
          await registerDevice();
        } catch (error) {
          if (mounted) {
            setPushEnabled(false);
            setPermissionState('disabled');
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'This device could not reconnect to push notifications.',
            );
          }
        }
      } else {
        try {
          await registerDevice();
        } catch (error) {
          if (mounted) {
            setPushEnabled(false);
            setPermissionState('disabled');
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'This device could not connect to push notifications.',
            );
          }
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [identity, isPreview, registerDevice]);

  React.useEffect(() => {
    if (isExpoGo) return;
    const openResponse = (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (!response || !identity) return;
      const responseId = response.notification.request.identifier;
      if (handledResponseId.current === responseId) return;
      handledResponseId.current = responseId;

      const notificationId =
        response.notification.request.content.data?.notificationId;
      if (typeof notificationId === 'string' && supabase) {
        void supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notificationId)
          .is('read_at', null);
      }

      const route = routeFromNotification(response);
      if (route) {
        router.push(route as Href);
      }

      void queryClient.invalidateQueries({
        queryKey: ['notifications', identity.userId, identity.agencyId],
      });
    };

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(openResponse);
    const receivedSubscription =
      Notifications.addNotificationReceivedListener(() => {
        if (identity) {
          void queryClient.invalidateQueries({
            queryKey: ['notifications', identity.userId, identity.agencyId],
          });
        }
      });

    void Notifications.getLastNotificationResponseAsync().then(openResponse);

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [identity, queryClient, router]);

  const value = React.useMemo<PushNotificationsContextValue>(
    () => ({
      available: Boolean(identity) && !isPreview && !isExpoGo,
      disablePush,
      enablePush,
      errorMessage,
      permissionState:
        identity && !isPreview && !isExpoGo ? permissionState : 'unavailable',
      pushEnabled: Boolean(identity) && !isPreview && !isExpoGo && pushEnabled,
    }),
    [
      disablePush,
      enablePush,
      errorMessage,
      identity,
      isPreview,
      permissionState,
      pushEnabled,
    ],
  );

  return (
    <PushNotificationsContext value={value}>
      {children}
    </PushNotificationsContext>
  );
}
