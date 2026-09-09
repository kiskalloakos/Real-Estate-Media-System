import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { AppState, Platform } from 'react-native';

import { AppProvider } from '@/providers/app-provider';
import { PushNotificationsProvider } from '@/providers/push-notifications-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function RootProviders({ children }: React.PropsWithChildren) {
  React.useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });

    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <PushNotificationsProvider>{children}</PushNotificationsProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
