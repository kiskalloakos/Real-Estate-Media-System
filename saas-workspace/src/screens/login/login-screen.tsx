import { ScrollView, TextInput, View } from 'react-native';
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { NativeButton, Text, nativeColors } from '@/components/native';
import { type AppRole, useApp } from '@/providers/app-provider';

const previews: { label: string; role: AppRole }[] = [
  { label: 'Preview owner portal', role: 'admin' },
  { label: 'Preview client portal', role: 'client' },
  { label: 'Preview team portal', role: 'team_member' },
];

export function LoginScreen() {
  const router = useRouter();
  const { access } = useLocalSearchParams<{ access?: string }>();
  const { enterPreview, isSupabaseConfigured, requestPasswordReset, signIn } =
    useApp();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    setError(result.error ?? null);
  };

  const resetPassword = async () => {
    if (!email) {
      setError('Enter your email first, then request a reset link.');
      return;
    }

    setError(null);
    const result = await requestPasswordReset(email);
    setError(result.error ?? 'Check your email for a secure password reset link.');
  };

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        alignSelf: 'center',
        flexGrow: 1,
        gap: 24,
        justifyContent: 'center',
        maxWidth: 520,
        padding: 24,
        width: '100%',
      }}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: nativeColors.background }}
    >
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            alignItems: 'center',
            height: 64,
            justifyContent: 'center',
            width: 64,
          }}
        >
          <Image
            accessibilityLabel="Realty Media"
            source={require('../../../assets/images/realty-media-brandmark-blue-background.jpg')}
            style={{ borderRadius: 16, height: 64, width: 64 }}
          />
        </View>
      </View>

      <View
        style={{
          backgroundColor: nativeColors.card,
          borderColor: nativeColors.separator,
          borderCurve: 'continuous',
          borderRadius: 24,
          borderWidth: 1,
          gap: 14,
          padding: 18,
        }}
      >
        {access === 'client' || access === 'team_member' ? (
          <Text style={{ color: nativeColors.label, fontSize: 14 }}>
            Your agency creates your access. Sign in with the email they invited, or check your invitation email to set your password.
          </Text>
        ) : null}
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={nativeColors.label}
          style={{
            backgroundColor: nativeColors.fill,
            borderColor: nativeColors.separator,
            borderCurve: 'continuous',
            borderRadius: 16,
            borderWidth: 1,
            color: nativeColors.label,
            fontFamily: 'OutfitRegular',
            fontSize: 17,
            minHeight: 48,
            paddingHorizontal: 14,
          }}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="current-password"
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={nativeColors.label}
          secureTextEntry
          style={{
            backgroundColor: nativeColors.fill,
            borderColor: nativeColors.separator,
            borderCurve: 'continuous',
            borderRadius: 16,
            borderWidth: 1,
            color: nativeColors.label,
            fontFamily: 'OutfitRegular',
            fontSize: 17,
            minHeight: 48,
            paddingHorizontal: 14,
          }}
          value={password}
        />
        {error ? (
          <Text selectable style={{ color: nativeColors.accent, fontSize: 14 }}>
            {error}
          </Text>
        ) : null}
        <NativeButton
          disabled={submitting || !email || !password}
          label={submitting ? 'Signing in…' : 'Sign in'}
          loading={submitting}
          onPress={() => void submit()}
        />
        <NativeButton
          disabled={submitting}
          label="Forgot your password?"
          onPress={() => void resetPassword()}
          variant="secondary"
        />
        <NativeButton label="New here? Get started" onPress={() => router.push('/signup')} variant="secondary" />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: nativeColors.label, fontSize: 13 }}>
          {isSupabaseConfigured
            ? 'Or explore the MVP without changing live data.'
            : 'Backend configuration is pending. Preview the complete interface now.'}
        </Text>
        {previews.map((preview) => (
          <NativeButton
            key={preview.role}
            label={preview.label}
            onPress={() => enterPreview(preview.role)}
            variant="secondary"
          />
        ))}
      </View>
    </ScrollView>
  );
}
