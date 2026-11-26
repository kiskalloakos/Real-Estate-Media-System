import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSyncExternalStore } from 'react';

import { nativeColors } from '@/components/native';
import { useApp } from '@/providers/app-provider';
import { LoginScreen } from '@/screens/login';
import PortalWebLayout from './(portal)/_layout.web';

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function IndexRoute() {
  const { authReady, identity } = useApp();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);

  // Browser-only record URLs and saved workspace preferences are read after
  // hydration, so a phone deep link never hydrates against another screen.
  if (!authReady || !hydrated) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: nativeColors.background,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={nativeColors.accent} />
      </View>
    );
  }

  if (identity) {
    if (identity.mustResetPassword) {
      return <Redirect href="/reset-password" />;
    }
    // The web workspace is a single page. Keep its record URL intact through authentication.
    return <PortalWebLayout />;
  }

  return <LoginScreen />;
}
