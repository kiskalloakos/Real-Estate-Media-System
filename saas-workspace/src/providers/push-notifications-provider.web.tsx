import React from 'react';

import {
  PushNotificationsContext,
  type PushNotificationsContextValue,
} from '@/providers/push-notifications-context';

const webValue: PushNotificationsContextValue = {
  available: false,
  disablePush: async () => undefined,
  enablePush: async () => undefined,
  errorMessage: null,
  permissionState: 'unavailable',
  pushEnabled: false,
};

export function PushNotificationsProvider({
  children,
}: React.PropsWithChildren) {
  return (
    <PushNotificationsContext value={webValue}>
      {children}
    </PushNotificationsContext>
  );
}
