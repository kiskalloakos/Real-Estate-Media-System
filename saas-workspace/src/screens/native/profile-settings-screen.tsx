import { Image } from 'expo-image';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  NativeCard,
  NativeButton,
  NativeScreen,
  NativeSection,
  Text,
  nativeColors,
} from '@/components/native';
import { nativeText } from '@/lib/native-i18n';

type SaveResult = {
  error?: string;
};

export interface ProfileSettingsNativeScreenProps {
  avatarUrl?: string | null;
  displayName: string;
  email: string;
  locale: 'en' | 'ro';
  phone?: string | null;
  onSave: (input: {
    fullName: string;
    locale: 'en' | 'ro';
    phone: string;
  }) => Promise<SaveResult>;
}

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function ProfileSettingsNativeScreen({
  avatarUrl,
  displayName,
  email,
  locale,
  phone,
  onSave,
}: ProfileSettingsNativeScreenProps) {
  const [fullName, setFullName] = React.useState(displayName);
  const [phoneNumber, setPhoneNumber] = React.useState(phone ?? '');
  const [selectedLocale, setSelectedLocale] = React.useState(locale);
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (!fullName.trim()) {
      setMessage(nativeText(locale, 'nameRequired'));
      return;
    }

    setMessage(null);
    setSaving(true);
    const result = await onSave({
      fullName: fullName.trim(),
      locale: selectedLocale,
      phone: phoneNumber.trim(),
    });
    setSaving(false);
    setMessage(result.error ?? nativeText(locale, 'profileSaved'));
  };

  return (
    <NativeScreen automaticallyAdjustKeyboardInsets>
      <View style={styles.avatarBlock}>
        {avatarUrl ? (
          <Image
            accessibilityLabel={`${displayName} profile photo`}
            contentFit="cover"
            source={avatarUrl}
            style={styles.avatar}
          />
        ) : (
          <View accessibilityLabel={`${displayName} initials`} style={styles.avatarFallback}>
            <Text selectable style={styles.initials}>
              {initialsFor(displayName)}
            </Text>
          </View>
        )}
        <Text selectable style={styles.avatarNote}>
          {nativeText(locale, 'profilePhotoNote')}
        </Text>
      </View>

      <NativeSection title={nativeText(locale, 'personalDetails')}>
        <NativeCard style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>{nativeText(locale, 'fullName')}</Text>
            <TextInput
              autoCapitalize="words"
              autoComplete="name"
              onChangeText={setFullName}
              placeholder={nativeText(locale, 'fullName')}
              placeholderTextColor={nativeColors.tertiaryLabel}
              returnKeyType="next"
              style={styles.input}
              value={fullName}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{nativeText(locale, 'interfaceLanguage')}</Text>
            <View accessibilityRole="radiogroup" style={styles.languageSwitch}>
              {(['en', 'ro'] as const).map((value) => {
                const selected = selectedLocale === value;
                return (
                  <Pressable
                    accessibilityLabel={value === 'en' ? nativeText(locale, 'useEnglish') : nativeText(locale, 'useRomanian')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    hitSlop={4}
                    key={value}
                    onPress={() => setSelectedLocale(value)}
                    style={[styles.languageOption, selected && styles.languageOptionSelected]}
                  >
                    <Text style={[styles.languageLabel, selected && styles.languageLabelSelected]}>
                      {value.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{nativeText(locale, 'phone')}</Text>
            <TextInput
              autoComplete="tel"
              keyboardType="phone-pad"
              onChangeText={setPhoneNumber}
              placeholder="Phone number"
              placeholderTextColor={nativeColors.tertiaryLabel}
              returnKeyType="done"
              style={styles.input}
              value={phoneNumber}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{nativeText(locale, 'email')}</Text>
            <Text selectable style={[styles.input, styles.readOnly]}>
              {email}
            </Text>
            <Text selectable style={styles.hint}>
              {nativeText(locale, 'loginEmailNote')}
            </Text>
          </View>
        </NativeCard>
      </NativeSection>

      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          selectable
          style={[
            styles.message,
            message === nativeText(locale, 'profileSaved') ? styles.success : styles.error,
          ]}
        >
          {message}
        </Text>
      ) : null}

      <View style={styles.save}>
        <NativeButton
          disabled={saving || !fullName.trim()}
          label={saving ? (locale === 'ro' ? 'Se salvează…' : 'Saving…') : nativeText(locale, 'saveProfile')}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  avatarBlock: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  avatar: {
    borderRadius: 42,
    height: 84,
    width: 84,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: nativeColors.strongerFill,
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  initials: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 26,
    fontWeight: '600',
  },
  avatarNote: {
    color: nativeColors.tertiaryLabel,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  form: {
    gap: 18,
    padding: 16,
  },
  field: {
    gap: 7,
  },
  label: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    color: nativeColors.label,
    fontFamily: 'OutfitRegular',
    fontSize: 17,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  readOnly: {
    color: nativeColors.secondaryLabel,
  },
  languageSwitch: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    padding: 3,
  },
  languageOption: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  languageOptionSelected: {
    backgroundColor: nativeColors.accent,
  },
  languageLabel: {
    color: nativeColors.secondaryLabel,
    fontFamily: 'OutfitSemiBold',
    fontSize: 14,
    fontWeight: '600',
  },
  languageLabelSelected: {
    color: nativeColors.card,
  },
  hint: {
    color: nativeColors.tertiaryLabel,
    fontSize: 12,
    lineHeight: 17,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  success: {
    color: nativeColors.success,
  },
  error: {
    color: nativeColors.critical,
  },
  save: {
    minHeight: 48,
    justifyContent: 'center',
  },
});
