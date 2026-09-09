import {
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './brand-text';
import { nativeColors } from './native-colors';
import { NativeSymbol } from './native-symbol';

export interface MetricTileProps {
  label: string;
  value: string | number;
  detail?: string;
  symbol?: string;
  symbolColor?: ColorValue;
  variant?: 'default' | 'brand';
  style?: StyleProp<ViewStyle>;
}

export function MetricTile({
  label,
  value,
  detail,
  symbol,
  symbolColor = nativeColors.accent,
  variant = 'default',
  style,
}: MetricTileProps) {
  const isBrand = variant === 'brand';
  return (
    <View
      accessibilityLabel={[label, value, detail].filter(Boolean).join(', ')}
      style={[styles.tile, isBrand && styles.brandTile, style]}
    >
      <View style={styles.topLine}>
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          selectable
          style={[styles.label, isBrand && styles.brandLabel]}
        >
          {label}
        </Text>
        {symbol ? (
          <NativeSymbol
            color={isBrand ? nativeColors.background : symbolColor}
            name={symbol}
            size={17}
          />
        ) : null}
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={1}
        selectable
        style={[styles.value, isBrand && styles.brandValue]}
      >
        {value}
      </Text>
      {detail ? (
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          selectable
          style={[styles.detail, isBrand && styles.brandDetail]}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: nativeColors.card,
    borderCurve: 'continuous',
    borderColor: nativeColors.separator,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '46%',
    flexGrow: 1,
    gap: 5,
    minHeight: 112,
    padding: 14,
  },
  brandTile: {
    backgroundColor: nativeColors.accent,
    borderColor: nativeColors.accent,
    minHeight: 126,
    padding: 17,
  },
  topLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  label: {
    color: nativeColors.secondaryLabel,
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  brandLabel: {
    color: '#E3E4FF',
  },
  value: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  brandValue: {
    color: nativeColors.background,
    fontSize: 30,
  },
  detail: {
    color: nativeColors.secondaryLabel,
    fontSize: 12,
    lineHeight: 16,
  },
  brandDetail: {
    color: '#E3E4FF',
  },
});
