import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { NativeButton, Text, nativeColors } from '@/components/native';
import { useApp } from '@/providers/app-provider';

export default function ResetPasswordRoute() {
  const router = useRouter();
  const { updatePassword } = useApp();
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (password.length < 10) {
      setMessage('Use at least 10 characters.');
      return;
    }

    if (password !== confirmation) {
      setMessage('The passwords do not match.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    const result = await updatePassword(password);
    setSubmitting(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    router.replace('/');
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
        padding: 28,
        width: '100%',
      }}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: nativeColors.background }}
    >
      <View
        style={{
          backgroundColor: nativeColors.card,
          borderColor: nativeColors.separator,
          borderCurve: 'continuous',
          borderRadius: 32,
          borderWidth: 1,
          gap: 24,
          padding: 24,
          shadowColor: '#353774',
          shadowOffset: { height: 16, width: 0 },
          shadowOpacity: 0.12,
          shadowRadius: 28,
        }}
      >
      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: nativeColors.accent,
            fontFamily: 'OutfitSemiBold',
            fontSize: 13,
            letterSpacing: 2.2,
          }}
        >
          ACCOUNT SECURITY
        </Text>
        <Text
          style={{
            color: nativeColors.label,
            fontFamily: 'OutfitSemiBold',
            fontSize: 46,
            lineHeight: 50,
          }}
        >
          Choose a new password.
        </Text>
        <Text
          style={{
            color: nativeColors.label,
            fontFamily: 'OutfitRegular',
            fontSize: 17,
            lineHeight: 24,
          }}
        >
          Set a private password for your realty media account. This secure link can also be used after an administrator requests a reset.
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        <TextInput
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder="New password"
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
            minHeight: 50,
            paddingHorizontal: 15,
          }}
          value={password}
        />
        <TextInput
          autoComplete="new-password"
          onChangeText={setConfirmation}
          onSubmitEditing={() => void submit()}
          placeholder="Confirm new password"
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
            minHeight: 50,
            paddingHorizontal: 15,
          }}
          value={confirmation}
        />
        {message ? (
          <Text selectable style={{ color: nativeColors.accent, fontSize: 14 }}>
            {message}
          </Text>
        ) : null}
        <NativeButton
          disabled={submitting}
          label={submitting ? 'Saving…' : 'Save new password'}
          loading={submitting}
          onPress={() => void submit()}
        />
      </View>
      </View>
    </ScrollView>
  );
}
