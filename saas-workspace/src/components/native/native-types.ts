import type { StyleProp, TextStyle } from 'react-native';

export type AppRole = 'admin' | 'team_member' | 'client';

export type NativeStatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'critical';

export interface NativeAsyncScreenProps {
  loading?: boolean;
  errorMessage?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onRetry?: () => void;
}

export interface NativeEditorialStyleProps {
  /**
   * Optional branded typography for editorial copy only.
   * Navigation labels and action controls always retain system typography.
   */
  editorialTitleStyle?: StyleProp<TextStyle>;
}

export const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  team_member: 'Team member',
  client: 'Client',
};
