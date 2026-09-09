import { StyleSheet, View } from 'react-native';

import { Text } from './brand-text';
import { nativeColors } from './native-colors';
import type { NativeStatusTone } from './native-types';

const toneColors = {
  neutral: nativeColors.secondaryLabel,
  info: nativeColors.accent,
  success: nativeColors.success,
  warning: nativeColors.warning,
  critical: nativeColors.critical,
} as const;

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: NativeStatusTone;
}) {
  return (
    <View accessibilityLabel={`Status: ${label}`} style={styles.pill}>
      <View
        accessibilityElementsHidden
        style={[styles.dot, { backgroundColor: toneColors[tone] }]}
      />
      <Text selectable style={[styles.label, { color: toneColors[tone] }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 26,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  dot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
