import { useWindowDimensions } from 'react-native';

export const nativeWideLayoutBreakpoint = 700;

export function useNativeWideLayout() {
  const { width } = useWindowDimensions();

  return width >= nativeWideLayoutBreakpoint;
}
