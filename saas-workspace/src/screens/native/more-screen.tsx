import { Fragment } from 'react';
import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import {
  NativeCard,
  NativeButton,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  NativeSymbol,
  StatusPill,
  Text,
  nativeColors,
  type AppRole,
  type NativeAsyncScreenProps,
  useNativeWideLayout,
} from '@/components/native';
import { nativeText, type NativeLocale } from '@/lib/native-i18n';

export interface MoreMenuItem {
  id: string;
  label: string;
  detail?: string;
  symbol: string;
  destructive?: boolean;
  badgeLabel?: string;
}

export interface MoreNativeScreenProps extends NativeAsyncScreenProps {
  role: AppRole;
  displayName: string;
  email: string;
  organizationName?: string;
  avatarUrl?: string | null;
  notificationsEnabled?: boolean;
  menuItems?: readonly MoreMenuItem[];
  appVersion?: string;
  onNotificationsChange?: (enabled: boolean) => void;
  onPressNotifications?: () => void;
  onPressProfile?: () => void;
  onPressWorkspace?: () => void;
  onPressItem?: (item: MoreMenuItem) => void;
  onSignOut?: () => void;
  locale?: NativeLocale;
}

const defaultMenus: Record<AppRole, readonly MoreMenuItem[]> = {
  admin: [
    { id: 'analytics', label: 'Social Analytics', detail: 'Account and content performance', symbol: 'chart.xyaxis.line' },
    { id: 'finance', label: 'Finance', detail: 'Accounts, transactions, and costs', symbol: 'chart.pie' },
    { id: 'gear', label: 'Gear', detail: 'Custody, location, and availability', symbol: 'camera.aperture' },
    { id: 'team', label: 'Team', detail: 'People, roles, and assignments', symbol: 'person.2' },
    { id: 'documents', label: 'Documents', detail: 'Company files, templates, and references', symbol: 'folder' },
    { id: 'help', label: 'Help & Support', symbol: 'questionmark.circle' },
  ],
  team_member: [],
  client: [],
};

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function MoreNativeScreen({
  role,
  displayName,
  email,
  organizationName = 'Realty Media',
  avatarUrl,
  notificationsEnabled = true,
  menuItems,
  appVersion,
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  onNotificationsChange,
  onPressNotifications,
  onPressProfile,
  onPressWorkspace,
  onPressItem,
  onSignOut,
  locale = 'en',
}: MoreNativeScreenProps) {
  const items = menuItems ?? defaultMenus[role];
  const isWide = useNativeWideLayout();
  const localizedRole = role === 'client'
    ? nativeText(locale, 'clientRole')
    : role === 'team_member'
      ? nativeText(locale, 'teamMemberRole')
      : nativeText(locale, 'ownerRole');

  const workspaceSection = items.length ? (
    <NativeSection title="Workspace">
      <NativeCard>
        {items.map((item, index) => (
          <Fragment key={item.id}>
            <NativeListRow
              detail={item.detail}
              onPress={onPressItem ? () => onPressItem(item) : undefined}
              showChevron={Boolean(onPressItem)}
              symbol={item.symbol}
              symbolColor={item.destructive ? nativeColors.critical : nativeColors.accent}
              title={item.label}
              trailing={
                item.badgeLabel ? <StatusPill label={item.badgeLabel} tone="info" /> : undefined
              }
            />
            {index < items.length - 1 ? <NativeSeparator inset={60} /> : null}
          </Fragment>
        ))}
      </NativeCard>
    </NativeSection>
  ) : null;

  const preferencesSection = (
    <View style={styles.preferencesColumn}>
      <NativeSection title={nativeText(locale, 'preferences')}>
        <NativeCard>
          <NativeListRow
            detail={locale === 'ro' ? 'Recenzii, sarcini și mementouri' : 'Review requests, assignments, and reminders'}
            showChevron={false}
            symbol="bell"
            title={nativeText(locale, 'notifications')}
            trailing={
              <Switch
                accessibilityLabel={nativeText(locale, 'notifications')}
                disabled={!onNotificationsChange}
                onValueChange={onNotificationsChange}
                value={notificationsEnabled}
              />
            }
          />
          {onPressNotifications ? <NativeSeparator inset={60} /> : null}
          {onPressNotifications ? (
            <NativeListRow
              detail={locale === 'ro' ? 'Alege ce activitate apare ca alertă' : 'Choose which activity appears as an alert'}
              onPress={onPressNotifications}
              symbol="bell.badge"
              title={nativeText(locale, 'notificationCenter')}
            />
          ) : null}
        </NativeCard>
      </NativeSection>

      {onSignOut ? (
        <View style={styles.signOut}>
          <NativeButton
            label={nativeText(locale, 'signOut')}
            onPress={onSignOut}
            style={styles.signOutButton}
            variant="secondary"
          />
        </View>
      ) : null}

      {appVersion ? (
        <Text selectable style={styles.version}>
          Realty Media App {appVersion}
        </Text>
      ) : null}
    </View>
  );

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={locale === 'ro' ? 'Se încarcă contul' : 'Loading account'}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      <Pressable
        accessibilityHint="Opens your profile settings"
        accessibilityLabel={`${displayName}, ${localizedRole}`}
        accessibilityRole={onPressProfile ? 'button' : undefined}
        disabled={!onPressProfile}
        onPress={onPressProfile}
        style={({ pressed }) => pressed && styles.profilePressed}
      >
        <NativeCard style={styles.profileCard}>
          {avatarUrl ? (
            <Image
              accessibilityLabel={`${displayName} profile photo`}
              accessible
              contentFit="cover"
              source={avatarUrl}
              style={styles.avatar}
            />
          ) : (
            <View accessibilityLabel={`${displayName} initials`} style={styles.avatarFallback}>
              <Text selectable style={styles.initials}>
                {initialsFor(displayName)}
              </Text>
            </View>
          )}

          <View style={styles.profileCopy}>
            <Text selectable style={styles.name}>
              {displayName}
            </Text>
            <Text selectable style={styles.email}>
              {email}
            </Text>
            <View style={styles.profileMeta}>
              <StatusPill label={localizedRole} tone={role === 'admin' ? 'info' : 'neutral'} />
              <Text selectable style={styles.organization}>
                {organizationName}
              </Text>
            </View>
          </View>

          {onPressProfile ? (
            <NativeSymbol
              color={nativeColors.tertiaryLabel}
              name="chevron.right"
              size={13}
            />
          ) : null}
        </NativeCard>
      </Pressable>

      {onPressWorkspace ? (
        <NativeSection title={locale === 'ro' ? 'Spațiu de lucru' : 'Workspace'}>
          <NativeCard>
            <NativeListRow
              detail={organizationName}
              onPress={onPressWorkspace}
              symbol="building.2"
              title={locale === 'ro' ? 'Schimbă spațiul de lucru' : 'Switch workspace'}
            />
          </NativeCard>
        </NativeSection>
      ) : null}

      <Text numberOfLines={1} selectable style={styles.subtitle}>
        {locale === 'ro'
          ? 'Cont, preferințe și instrumente de lucru.'
          : 'Your account, preferences, and workspace tools.'}
      </Text>

      {isWide && workspaceSection ? (
        <View style={styles.wideColumns}>
          <View style={styles.workspaceColumn}>{workspaceSection}</View>
          {preferencesSection}
        </View>
      ) : (
        <>
          {workspaceSection}
          {preferencesSection}
        </>
      )}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  avatar: {
    borderRadius: 32,
    height: 60,
    width: 60,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: nativeColors.strongerFill,
    borderRadius: 32,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  initials: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  profileCopy: {
    flex: 1,
    gap: 2,
  },
  profilePressed: {
    opacity: 0.65,
  },
  subtitle: {
    color: nativeColors.secondaryLabel,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 2,
  },
  name: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
  },
  email: {
    color: nativeColors.secondaryLabel,
    fontSize: 14,
    lineHeight: 19,
  },
  profileMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 7,
  },
  organization: {
    color: nativeColors.secondaryLabel,
    fontSize: 12,
    lineHeight: 16,
  },
  signOut: {
    alignSelf: 'stretch',
  },
  signOutButton: {
    alignSelf: 'stretch',
  },
  wideColumns: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 20,
  },
  workspaceColumn: {
    flex: 1.35,
    minWidth: 0,
  },
  preferencesColumn: {
    flex: 1,
    gap: 24,
    minWidth: 0,
  },
  version: {
    color: nativeColors.tertiaryLabel,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
