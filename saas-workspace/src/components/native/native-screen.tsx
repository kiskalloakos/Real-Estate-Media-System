import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './brand-text';
import { nativeColors } from './native-colors';
import { NativeSymbol } from './native-symbol';
import type { NativeAsyncScreenProps } from './native-types';

interface NativeStateProps {
  symbol: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function NativeEmptyState({
  symbol,
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: NativeStateProps) {
  return (
    <View accessibilityRole="summary" style={[styles.state, compact && styles.compactState]}>
      <View style={styles.stateSymbol}>
        <NativeSymbol color={nativeColors.secondaryLabel} name={symbol} size={28} />
      </View>
      <Text selectable style={styles.stateTitle}>
        {title}
      </Text>
      {message ? (
        <Text selectable style={styles.stateMessage}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [styles.stateAction, pressed && styles.stateActionPressed]}
        >
          <Text style={styles.stateActionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface NativeScreenProps extends NativeAsyncScreenProps {
  automaticallyAdjustKeyboardInsets?: boolean;
  bounces?: boolean;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  loadingLabel?: string;
  supportsWideLayout?: boolean;
}

export function NativeScreen({
  automaticallyAdjustKeyboardInsets = false,
  bounces = true,
  children,
  contentContainerStyle,
  loading = false,
  loadingLabel = 'Loading',
  errorMessage,
  refreshing = false,
  onRefresh,
  onRetry,
  supportsWideLayout = false,
}: NativeScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = supportsWideLayout && width >= 700;
  let content = children;

  if (loading) {
    content = (
      <View accessibilityLabel={loadingLabel} accessibilityRole="progressbar" style={styles.state}>
        <ActivityIndicator color={nativeColors.accent} size="large" />
        <Text selectable style={styles.stateMessage}>
          {loadingLabel}
        </Text>
      </View>
    );
  } else if (errorMessage) {
    content = (
      <NativeEmptyState
        actionLabel={onRetry ? 'Try Again' : undefined}
        message={errorMessage}
        onAction={onRetry}
        symbol="exclamationmark.triangle"
        title="Couldn’t load this view"
      />
    );
  }

  return (
    <ScrollView
      alwaysBounceVertical={false}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      bounces={bounces}
      contentContainerStyle={[
        styles.content,
        isWide && styles.wideContent,
        contentContainerStyle,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh && !loading ? (
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={nativeColors.secondaryLabel}
          />
        ) : undefined
      }
      style={styles.screen}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: nativeColors.background,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    gap: 24,
    maxWidth: 720,
    paddingBottom: 48,
    paddingHorizontal: 16,
    paddingTop: 8,
    width: '100%',
  },
  wideContent: {
    maxWidth: 1180,
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  state: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 10,
    justifyContent: 'center',
    maxWidth: 340,
    minHeight: 360,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  stateSymbol: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 24,
    height: 60,
    justifyContent: 'center',
    marginBottom: 4,
    width: 60,
  },
  compactState: {
    minHeight: 190,
    paddingVertical: 28,
  },
  stateTitle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 23,
    textAlign: 'center',
  },
  stateMessage: {
    color: nativeColors.secondaryLabel,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  stateAction: {
    borderCurve: 'continuous',
    borderRadius: 16,
    marginTop: 6,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  stateActionPressed: {
    backgroundColor: nativeColors.fill,
  },
  stateActionLabel: {
    color: nativeColors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
});
