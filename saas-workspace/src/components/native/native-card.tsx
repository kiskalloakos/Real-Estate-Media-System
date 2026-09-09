import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './brand-text';
import { nativeColors } from './native-colors';
import { NativeSymbol } from './native-symbol';

export interface NativeCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function NativeCard({ children, style }: NativeCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export interface NativeListRowProps {
  title: string;
  subtitle?: string | null;
  detail?: string | null;
  symbol?: string;
  symbolColor?: ColorValue;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  showChevron?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function NativeListRow({
  title,
  subtitle,
  detail,
  symbol,
  symbolColor = nativeColors.accent,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  showChevron = Boolean(onPress),
  disabled = false,
  testID,
}: NativeListRowProps) {
  const content = (
    <>
      {symbol ? (
        <View style={styles.symbolWell}>
          <NativeSymbol color={symbolColor} name={symbol} size={18} />
        </View>
      ) : null}

      <View style={styles.rowCopy}>
        <Text selectable style={styles.rowTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text selectable style={styles.rowDetail}>
            {detail}
          </Text>
        ) : null}
      </View>

      {trailing}
      {showChevron ? (
        <NativeSymbol color={nativeColors.tertiaryLabel} name="chevron.right" size={13} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, detail].filter(Boolean).join(', ')}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

export function NativeSeparator({ inset = 16 }: { inset?: number }) {
  return <View accessibilityElementsHidden style={[styles.separator, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: nativeColors.card,
    borderCurve: 'continuous',
    borderColor: nativeColors.separator,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  rowPressed: {
    backgroundColor: nativeColors.fill,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  symbolWell: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: nativeColors.label,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  rowSubtitle: {
    color: nativeColors.secondaryLabel,
    fontSize: 14,
    lineHeight: 19,
  },
  rowDetail: {
    color: nativeColors.tertiaryLabel,
    fontSize: 12,
    lineHeight: 16,
    paddingTop: 1,
  },
  separator: {
    backgroundColor: nativeColors.separator,
    height: StyleSheet.hairlineWidth,
  },
});
