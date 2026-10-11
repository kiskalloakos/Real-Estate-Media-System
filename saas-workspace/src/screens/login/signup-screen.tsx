import React from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Text } from '@/components/native';
import { signUpAgencyOwner } from '@/lib/agency-signup';
import { useApp } from '@/providers/app-provider';

const roles = [
  { value: 'owner', title: 'I own an agency', description: 'Create a workspace for your agency and invite your team and clients.' },
  { value: 'client', title: 'I’m a client', description: 'See the work your agency is doing for you.' },
  { value: 'team_member', title: 'I’m a team member', description: 'Work with the agency that invited you.' },
] as const;

export function SignupScreen() {
  const router = useRouter();
  const { isSupabaseConfigured } = useApp();
  const [ownerForm, setOwnerForm] = React.useState(false);
  const [agencyName, setAgencyName] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmationSent, setConfirmationSent] = React.useState(false);

  const submit = async () => {
    if (submitting) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await signUpAgencyOwner({ agencyName, fullName, email, password, confirmation });
      setPassword('');
      setConfirmation('');
      if (result.needsEmailConfirmation) setConfirmationSent(true);
      else router.replace('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create your account. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
      style={{ backgroundColor: '#000000' }}
    >
      <View style={{ alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 28, gap: 22, maxWidth: 500, padding: 30, width: '100%' }}>
        <View style={{ gap: 10 }}>
          <Text accessibilityRole="header" style={{ color: '#191B22', fontFamily: 'OutfitSemiBold', fontSize: 34, lineHeight: 40 }}>
            {confirmationSent ? 'Check your email.' : ownerForm ? 'Create your agency workspace.' : 'How will you use the workspace?'}
          </Text>
          <Text style={{ color: '#5F6470', fontSize: 16, lineHeight: 24 }}>
            {confirmationSent
              ? 'If this email is eligible for a new account, you’ll receive a confirmation link. Confirm your email to open your agency workspace. Already have an account? Sign in below.'
              : ownerForm
                ? 'Your agency gets its own workspace. Only people you invite can access it.'
                : 'Agency owners create workspaces. Clients and team members receive access from their agency.'}
          </Text>
        </View>

        {confirmationSent ? null : !ownerForm ? (
          <View style={{ gap: 12 }}>
            {roles.map((role) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={role.title}
                key={role.value}
                onPress={() => role.value === 'owner' ? setOwnerForm(true) : router.replace({ pathname: '/', params: { access: role.value } })}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#F0F0FF' : '#F5F6F8', borderColor: pressed ? '#5256E0' : '#DDE0E6', borderWidth: 1, borderRadius: 16, gap: 6, padding: 18 })}
              >
                <Text style={{ color: '#191B22', fontFamily: 'OutfitSemiBold', fontSize: 18 }}>{role.title}</Text>
                <Text style={{ color: '#5F6470', fontSize: 15, lineHeight: 22 }}>{role.description}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: 15 }}>
            {[
              { label: 'Agency name', value: agencyName, change: setAgencyName, complete: 'organization' as const, length: 120 },
              { label: 'Your full name', value: fullName, change: setFullName, complete: 'name' as const, length: 120 },
              { label: 'Email address', value: email, change: setEmail, complete: 'email' as const, length: 254 },
              { label: 'Password', value: password, change: setPassword, complete: 'new-password' as const, secret: true },
              { label: 'Confirm password', value: confirmation, change: setConfirmation, complete: 'new-password' as const, secret: true },
            ].map((field) => (
              <View key={field.label} style={{ gap: 6 }}>
                <Text style={{ color: '#191B22', fontFamily: 'OutfitSemiBold', fontSize: 14 }}>{field.label}</Text>
                <TextInput
                  accessibilityLabel={field.label}
                  autoCapitalize={field.complete === 'email' || field.secret ? 'none' : 'words'}
                  autoComplete={field.complete}
                  editable={!submitting}
                  keyboardType={field.complete === 'email' ? 'email-address' : 'default'}
                  maxLength={field.length}
                  onChangeText={field.change}
                  onSubmitEditing={field.label === 'Confirm password' ? () => void submit() : undefined}
                  secureTextEntry={field.secret}
                  style={{ backgroundColor: '#F5F6F8', borderColor: '#DDE0E6', borderWidth: 1, borderRadius: 12, color: '#191B22', fontFamily: 'OutfitRegular', fontSize: 16, minHeight: 48, paddingHorizontal: 14 }}
                  value={field.value}
                />
              </View>
            ))}
            <Text style={{ color: '#5F6470', fontSize: 13 }}>Use at least 10 characters for your password.</Text>
            {message ? <Text accessibilityRole="alert" selectable style={{ color: '#5256E0', fontSize: 14 }}>{message}</Text> : null}
            {!isSupabaseConfigured ? <Text style={{ color: '#5F6470', fontSize: 14 }}>Account creation is unavailable in this local preview.</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={submitting || !isSupabaseConfigured}
              onPress={() => void submit()}
              style={{ alignItems: 'center', backgroundColor: '#5256E0', borderRadius: 12, minHeight: 50, justifyContent: 'center', opacity: submitting || !isSupabaseConfigured ? 0.55 : 1 }}
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontFamily: 'OutfitSemiBold', fontSize: 16 }}>Create agency workspace</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" disabled={submitting} onPress={() => { setOwnerForm(false); setMessage(null); setPassword(''); setConfirmation(''); }}>
              <Text style={{ color: '#5F6470', textAlign: 'center' }}>Choose a different role</Text>
            </Pressable>
          </View>
        )}
        <Pressable accessibilityRole="link" disabled={submitting} onPress={() => router.replace('/')}>
          <Text style={{ color: '#5256E0', fontFamily: 'OutfitSemiBold', textAlign: 'center' }}>Already have access? Sign in</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
