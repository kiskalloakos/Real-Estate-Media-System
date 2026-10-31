import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { nativeColors } from '@/components/native';
import { useApp } from '@/providers/app-provider';
import { LoginScreen } from '@/screens/login';
import PortalWebLayout from './(portal)/_layout.web';

export default function IndexRoute() {
  const { authReady, identity } = useApp();

  if (!authReady) {
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
