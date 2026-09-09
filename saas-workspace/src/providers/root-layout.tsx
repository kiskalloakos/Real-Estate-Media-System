import {
  DefaultTheme,
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React from 'react';

import { nativeColors } from '@/components/native';
import { useApp } from '@/providers/app-provider';
import { NativeChoiceProvider } from '@/components/native/native-choice';
import { RootProviders } from '@/providers/root-providers';

void SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(nativeColors.card);

const realtyTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: nativeColors.background,
    border: nativeColors.separator,
    card: nativeColors.card,
    notification: nativeColors.accent,
    primary: nativeColors.accent,
    text: nativeColors.label,
  },
};

export function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    OutfitRegular: require('../../assets/fonts/Outfit-Regular.ttf'),
    OutfitSemiBold: require('../../assets/fonts/Outfit-SemiBold.ttf'),
  });

  React.useEffect(() => {
    if (fontError) {
      throw fontError;
    }
  }, [fontError]);

  React.useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <RootProviders>
      <ThemeProvider value={realtyTheme}>
        <NativeChoiceProvider><AppNavigator /></NativeChoiceProvider>
        <StatusBar style="dark" />
      </ThemeProvider>
    </RootProviders>
  );
}

function AppNavigator() {
  const { authReady, identity } = useApp();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!authReady || !identity}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected
          guard={Boolean(identity && !identity.mustResetPassword)}
        >
          <Stack.Screen name="(portal)" />
        </Stack.Protected>
        <Stack.Screen name="reset-password" />
      </Stack>
    </>
  );
}
