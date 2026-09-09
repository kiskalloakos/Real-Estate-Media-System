import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './brand-text';
import { NativeCard } from './native-card';
import { nativeColors } from './native-colors';
import { NativeSymbol } from './native-symbol';

export type NativeTaskCardStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export const nativeTaskCardStatusVisuals: Record<
  NativeTaskCardStatus,
  { backgroundColor: string; color: string; label: string }
> = {
  todo: {
    backgroundColor: '#FFF3D6',
    color: '#9A5B00',
    label: 'New tasks',
  },
  in_progress: {
    backgroundColor: '#EEF0FF',
    color: nativeColors.accent,
    label: 'In progress',
  },
  blocked: {
    backgroundColor: '#FCE8E6',
    color: '#B42318',
    label: 'Blocked',
  },
  done: {
    backgroundColor: '#E5F5EE',
    color: '#167A54',
    label: 'Completed',
  },
  cancelled: {
    backgroundColor: '#ECEEF2',
    color: '#5F6673',
    label: 'Cancelled',
  },
};

export interface NativeTaskCardProps {
  title: string;
  propertyName?: string;
  meta?: string;
  status: NativeTaskCardStatus;
  statusLabel?: string;
  urgent?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
}

export function NativeTaskCard({
  accessibilityHint,
  meta,
  onPress,
  propertyName,
  status,
  statusLabel,
  title,
  urgent = false,
}: NativeTaskCardProps) {
  const visual = nativeTaskCardStatusVisuals[status];
  const label = statusLabel ?? visual.label;
  const accessibilityLabel = [
    title,
    propertyName,
    meta,
    urgent ? 'Urgent' : undefined,
    label,
  ]
    .filter(Boolean)
    .join(', ');

  const content = (pressed = false) => (
    <NativeCard style={[styles.card, pressed && styles.pressed]}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <Text numberOfLines={2} selectable style={styles.title}>
            {title}
          </Text>
          {propertyName ? (
            <Text numberOfLines={1} selectable style={styles.property}>
              {propertyName}
            </Text>
          ) : null}
          {meta ? (
            <Text numberOfLines={1} selectable style={styles.meta}>
              {meta}
            </Text>
          ) : null}
        </View>
        <View style={styles.trailing}>
          <View style={styles.badges}>
            {urgent ? (
              <View accessibilityElementsHidden style={styles.urgentBadge}>
                <Text selectable style={styles.urgentLabel}>Urgent</Text>
              </View>
            ) : null}
            <View
              accessibilityElementsHidden
              style={[styles.statusBadge, { backgroundColor: visual.backgroundColor }]}
            >
              <View style={[styles.statusDot, { backgroundColor: visual.color }]} />
              <Text selectable style={[styles.statusLabel, { color: visual.color }]}>
                {label}
              </Text>
            </View>
          </View>
          {onPress ? (
            <NativeSymbol color={nativeColors.tertiaryLabel} name="chevron.right" size={13} />
          ) : null}
        </View>
      </View>
    </NativeCard>
  );

  if (!onPress) return content();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 13,
  },
  pressed: {
    backgroundColor: nativeColors.fill,
  },
  content: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  property: {
    color: nativeColors.secondaryLabel,
    fontSize: 14,
    lineHeight: 19,
  },
  meta: {
    color: nativeColors.tertiaryLabel,
    fontSize: 12,
    lineHeight: 16,
  },
  trailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 7,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  urgentBadge: {
    alignItems: 'center',
    backgroundColor: nativeColors.accent,
    borderCurve: 'continuous',
    borderRadius: 999,
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  urgentLabel: {
    color: nativeColors.card,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  statusBadge: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusDot: {
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
  },
});
