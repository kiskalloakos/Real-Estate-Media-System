import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { useApp } from '@/providers/app-provider';
import { MoreNativeScreen, type MoreDestination } from '@/screens/native';

export default function MoreRoute() {
  const router = useRouter();
  const {
    identity,
    isPreview,
    notificationPreferences,
    setNotificationPreferences,
    selectWorkspace,
    signOut,
    workspaces,
  } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  if (!identity) {
    return null;
  }
  const role = identity.role;
  const openDestination = (destination: MoreDestination) => {
    router.push({
      pathname: '/(portal)/(more)/[destination]',
      params: { destination },
    });
  };

  return (
    <MoreNativeScreen
      role={role}
      {...live.bundle.more}
      avatarUrl={identity.avatarUrl}
      displayName={identity.displayName}
      email={identity.email}
      errorMessage={live.errorMessage}
      loading={live.loading}
      locale={identity.locale}
      organizationName={workspaces.find((workspace) => workspace.agencyId === identity.agencyId)?.name ?? live.bundle.more.organizationName}
      notificationsEnabled={notificationPreferences.master}
      onNotificationsChange={(master) =>
        void setNotificationPreferences({ master })
      }
      onPressItem={(item) =>
        openDestination(item.id as MoreDestination)
      }
      onPressNotifications={() => openDestination('notifications')}
      onPressProfile={() => openDestination('profile')}
      onPressWorkspace={workspaces.length > 1 ? () => {
        Alert.alert(
          identity.locale === 'ro' ? 'Schimbă spațiul de lucru' : 'Switch workspace',
          undefined,
          [
            ...workspaces.slice(0, 6).map((workspace) => ({
              text: workspace.agencyId === identity.agencyId ? `✓ ${workspace.name}` : workspace.name,
              onPress: () => void selectWorkspace(workspace.agencyId),
            })),
            { text: identity.locale === 'ro' ? 'Anulează' : 'Cancel', style: 'cancel' as const },
          ],
        );
      } : undefined}
      onRefresh={() => void live.retry()}
      onRetry={() => void live.retry()}
      onSignOut={() => void signOut()}
      refreshing={live.refreshing}
    />
  );
}
