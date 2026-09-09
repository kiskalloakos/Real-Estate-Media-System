import {
  StyleSheet,
  Text as ReactNativeText,
  type TextProps,
} from 'react-native';

export function Text({ style, ...props }: TextProps) {
  const flattenedStyle = StyleSheet.flatten(style);
  const requestedWeight = Number.parseInt(String(flattenedStyle?.fontWeight ?? '400'), 10);
  const semiBold =
    flattenedStyle?.fontFamily === 'OutfitSemiBold'
    || Number.isFinite(requestedWeight) && requestedWeight >= 600;

  return (
    <ReactNativeText
      {...props}
      style={[styles.base, style, semiBold ? styles.semiBold : styles.regular]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'OutfitRegular',
  },
  regular: {
    fontFamily: 'OutfitRegular',
    fontWeight: '400',
  },
  semiBold: {
    fontFamily: 'OutfitSemiBold',
    fontWeight: '600',
  },
});
