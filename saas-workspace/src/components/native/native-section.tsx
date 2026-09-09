import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { Text } from './brand-text';
import { nativeColors } from './native-colors';

export interface NativeScreenIntroProps {
  eyebrow?: string;
  title: string;
  summary?: string;
  titleStyle?: StyleProp<TextStyle>;
}

export function NativeScreenIntro(_props: NativeScreenIntroProps) {
  return null;
}

export interface NativeSectionProps {
  title: string;
  caption?: string;
  actionLabel?: string;
  onPressAction?: () => void;
  children?: ReactNode;
}

export function NativeSection({
  title,
  caption,
  actionLabel,
  onPressAction,
  children,
}: NativeSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text selectable style={styles.sectionTitle}>
            {title}
          </Text>
          {caption ? (
            <Text selectable style={styles.sectionCaption}>
              {caption}
            </Text>
          ) : null}
        </View>
        {actionLabel && onPressAction ? (
          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onPressAction}
            style={({ pressed }) => pressed && styles.actionPressed}
          >
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 9,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    minHeight: 28,
    paddingHorizontal: 2,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.25,
    lineHeight: 25,
  },
  sectionCaption: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    lineHeight: 17,
  },
  actionLabel: {
    color: nativeColors.accent,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    paddingVertical: 3,
  },
  actionPressed: {
    opacity: 0.5,
  },
});
