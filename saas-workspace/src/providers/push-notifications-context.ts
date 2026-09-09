import React from 'react';

export type PushPermissionState =
  | 'checking'
  | 'disabled'
  | 'denied'
  | 'enabled'
  | 'registering'
  | 'unavailable';

export type PushNotificationsContextValue = {
  available: boolean;
  disablePush: () => Promise<void>;
  enablePush: () => Promise<void>;
  errorMessage: string | null;
  permissionState: PushPermissionState;
  pushEnabled: boolean;
};

export const PushNotificationsContext =
  React.createContext<PushNotificationsContextValue>({
    available: false,
    disablePush: async () => undefined,
    enablePush: async () => undefined,
    errorMessage: null,
    permissionState: 'unavailable',
    pushEnabled: false,
  });

export function usePushNotifications() {
  return React.use(PushNotificationsContext);
}
