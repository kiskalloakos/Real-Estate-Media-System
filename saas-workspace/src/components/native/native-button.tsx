import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './brand-text';
import { nativeColors } from './native-colors';

type NativeButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface NativeButtonProps {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: NativeButtonVariant;
}

export function NativeButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  loading = false,
  onPress,
  style,
  variant = 'primary',
}: NativeButtonProps) {
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        unavailable && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? nativeColors.card : nativeColors.label} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`], unavailable && styles.disabledLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: nativeColors.accent,
    borderColor: nativeColors.accent,
  },
  secondary: {
    backgroundColor: nativeColors.card,
    borderColor: nativeColors.separator,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  disabled: {
    backgroundColor: nativeColors.fill,
    borderColor: nativeColors.fill,
  },
  pressed: {
    opacity: 0.78,
  },
  label: {
    fontFamily: 'OutfitSemiBold',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryLabel: {
    color: nativeColors.card,
  },
  secondaryLabel: {
    color: nativeColors.label,
  },
  ghostLabel: {
    color: nativeColors.accent,
  },
  disabledLabel: {
    color: nativeColors.label,
  },
});
