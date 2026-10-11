import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Text } from '@/components/native';
import { useApp } from '@/providers/app-provider';

export function LoginScreen() {
  const router = useRouter();
  const { access } = useLocalSearchParams<{ access?: string }>();
  const { width } = useWindowDimensions();
  const compact = width < 860;
  const { requestPasswordReset, signIn } = useApp();
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
      contentContainerStyle={{ flexGrow: 1, minHeight: '100%' }}
      showsHorizontalScrollIndicator={false}
      style={{
        backgroundColor: '#000000',
        flex: 1,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          marginHorizontal: 'auto',
          padding: compact ? 18 : 36,
          width: '100%',
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderCurve: 'continuous',
            borderRadius: 32,
            justifyContent: 'center',
            maxWidth: 440,
            padding: compact ? 26 : 38,
            width: '100%',
          }}
        >
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: '#000000',
                fontFamily: 'OutfitSemiBold',
                fontSize: 43,
                lineHeight: 48,
              }}
            >
              Welcome back.
            </Text>
            <Text
              style={{
                color: '#000000',
                fontFamily: 'OutfitRegular',
                fontSize: 17,
              }}
            >
              Sign in to your agency workspace.
            </Text>
            {access === 'client' || access === 'team_member' ? (
              <Text style={{ color: '#5F6470', fontSize: 14, lineHeight: 21 }}>
                Your agency creates {access === 'client' ? 'client' : 'team member'} access. Use the email they invited, or check your invitation email to set your password. If you haven’t been invited yet, contact your agency owner.
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 14, paddingTop: 34 }}>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              onChangeText={setEmail}
              onSubmitEditing={() => password && void submit()}
              placeholder="Email address"
              placeholderTextColor="#000000"
              style={{
                backgroundColor: '#EEEEEE',
                borderColor: '#000000',
                borderCurve: 'continuous',
                borderRadius: 16,
                borderWidth: 1,
                color: '#000000',
                fontFamily: 'OutfitRegular',
                fontSize: 17,
                height: 52,
                outlineColor: '#5256E0',
                paddingHorizontal: 16,
              }}
              value={email}
            />
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={() => email && void submit()}
              placeholder="Password"
              placeholderTextColor="#000000"
              secureTextEntry
              style={{
                backgroundColor: '#EEEEEE',
                borderColor: '#000000',
                borderCurve: 'continuous',
                borderRadius: 16,
                borderWidth: 1,
                color: '#000000',
                fontFamily: 'OutfitRegular',
                fontSize: 17,
                height: 52,
                outlineColor: '#5256E0',
                paddingHorizontal: 16,
              }}
              value={password}
            />
            {error ? (
              <Text
                selectable
                style={{
                  color: '#5256E0',
                  fontFamily: 'OutfitSemiBold',
                  fontSize: 14,
                }}
              >
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={submitting || !email || !password}
              onPress={() => void submit()}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor:
                  submitting || !email || !password
                    ? '#000000'
                    : pressed
                      ? '#5256E0'
                      : '#5256E0',
                borderCurve: 'continuous',
                borderRadius: 16,
                height: 52,
                justifyContent: 'center',
                marginTop: 2,
              })}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontFamily: 'OutfitSemiBold',
                    fontSize: 16,
                    letterSpacing: 0.4,
                  }}
                >
                  Sign in
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void resetPassword()}
              style={({ pressed }) => ({
                alignItems: 'center',
                opacity: pressed ? 0.62 : 1,
                paddingVertical: 3,
              })}
            >
              <Text
                style={{
                  color: '#000000',
                  fontFamily: 'OutfitSemiBold',
                  fontSize: 14,
                }}
              >
                Forgot your password?
              </Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push('/signup')} style={{ paddingTop: 12 }}>
              <Text style={{ color: '#5256E0', fontFamily: 'OutfitSemiBold', fontSize: 14, textAlign: 'center' }}>New here? Get started</Text>
            </Pressable>
          </View>

        </View>
      </View>
    </ScrollView>
  );
}
