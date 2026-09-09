import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';

import { useNotifications } from '@/hooks/use-notifications';
import { setAppBadgeCount } from '@/lib/app-badge';
import { useApp } from '@/providers/app-provider';
import { nativeColors } from '@/components/native';
import { nativeText } from '@/lib/native-i18n';

export default function PortalNativeLayout() {
  const { authReady, identity, isPreview, notificationPreferences } = useApp();
  const notificationQuery = useNotifications({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
    userId: identity?.userId ?? 'anonymous',
  });

  const unreadNotifications = notificationPreferences.master
    ? (notificationQuery.data ?? []).filter(
        (notification) =>
          !notification.readAt &&
          (notification.kind === 'system' ||
            (notification.kind === 'review' &&
              notificationPreferences.reviews) ||
            (notification.kind === 'task' && notificationPreferences.tasks) ||
            (notification.kind === 'calendar' &&
              notificationPreferences.calendar) ||
            (notification.kind === 'payment' &&
              notificationPreferences.payments)),
      )
    : [];
  React.useEffect(() => {
    void setAppBadgeCount(unreadNotifications.length);
  }, [unreadNotifications.length]);

  if (!authReady || !identity) {
    return null;
  }
  if (!isPreview && identity.mustResetPassword) {
    return <Redirect href="/reset-password" />;
  }
  const isRo = identity.locale === 'ro';
  const isClient = identity.role === 'client';
  const isTeam = identity.role === 'team_member';

  return (
    <NativeTabs
      backgroundColor={nativeColors.card}
      disableTransparentOnScrollEdge
      iconColor={{ default: nativeColors.label, selected: nativeColors.accent }}
      labelStyle={{
        default: {
          color: nativeColors.label,
          fontFamily: 'OutfitRegular',
          fontWeight: '400',
        },
        selected: {
          color: nativeColors.accent,
          fontFamily: 'OutfitSemiBold',
          fontWeight: '600',
        },
      }}
      minimizeBehavior="never"
      shadowColor={nativeColors.separator}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon
          md="home"
          sf={{ default: 'house', selected: 'house.fill' }}
        />
        <NativeTabs.Trigger.Label>{isTeam ? (isRo ? 'Panou' : 'Dashboard') : nativeText(identity.locale, 'home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {isClient ? (
        <NativeTabs.Trigger name="(analytics)">
          <NativeTabs.Trigger.Icon
            md="monitoring"
          sf={{ default: 'chart.xyaxis.line', selected: 'chart.xyaxis.line' }}
          />
          <NativeTabs.Trigger.Label>{nativeText(identity.locale, 'analytics')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      {isClient ? (
        <NativeTabs.Trigger name="(reviews)">
          <NativeTabs.Trigger.Icon
            md="video_library"
          sf={{ default: 'play.rectangle', selected: 'play.rectangle.fill' }}
          />
          <NativeTabs.Trigger.Label>{nativeText(identity.locale, 'reviews')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      {isClient ? (
        <NativeTabs.Trigger name="(billing)">
          <NativeTabs.Trigger.Icon
            md="description"
          sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
          />
          <NativeTabs.Trigger.Label>{nativeText(identity.locale, 'deal')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      {!isClient && !isTeam ? (
        <NativeTabs.Trigger name="(calendar)">
          <NativeTabs.Trigger.Icon
            md="calendar_month"
          sf={{ default: 'calendar', selected: 'calendar' }}
          />
          <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      {!isClient && !isTeam ? (
        <NativeTabs.Trigger name="(tasks)">
          <NativeTabs.Trigger.Icon
            md="checklist"
          sf={{ default: 'checklist', selected: 'checklist.checked' }}
          />
          <NativeTabs.Trigger.Label>{nativeText(identity.locale, 'tasks')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      {!isClient && !isTeam ? (
        <NativeTabs.Trigger name="(documents)">
          <NativeTabs.Trigger.Icon
            md="folder"
          sf={{ default: 'folder', selected: 'folder.fill' }}
          />
          <NativeTabs.Trigger.Label>{isRo ? 'Documente' : 'Documents'}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      {isTeam ? (
        <NativeTabs.Trigger name="(sops)">
          <NativeTabs.Trigger.Icon
            md="description"
          sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
          />
          <NativeTabs.Trigger.Label>{isRo ? 'Proceduri' : 'SOPs'}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      {isTeam ? (
        <NativeTabs.Trigger name="(tasks)">
          <NativeTabs.Trigger.Icon
            md="checklist"
          sf={{ default: 'checklist', selected: 'checklist.checked' }}
          />
          <NativeTabs.Trigger.Label>{nativeText(identity.locale, 'tasks')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      {isTeam ? (
        <NativeTabs.Trigger name="(calendar)">
          <NativeTabs.Trigger.Icon
            md="calendar_month"
          sf={{ default: 'calendar', selected: 'calendar' }}
          />
          <NativeTabs.Trigger.Label>{nativeText(identity.locale, 'calendar')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
      <NativeTabs.Trigger hidden name="(clients)" />
      <NativeTabs.Trigger hidden name="(properties)" />
      <NativeTabs.Trigger name="(more)" role="more">
        <NativeTabs.Trigger.Icon
          md="more_horiz"
          sf={{ default: 'ellipsis', selected: 'ellipsis' }}
        />
        <NativeTabs.Trigger.Label>{nativeText(identity.locale, 'more')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {isClient ? <NativeTabs.Trigger hidden name="(calendar)" /> : null}
      {isClient ? <NativeTabs.Trigger hidden name="(tasks)" /> : null}
      {isClient ? <NativeTabs.Trigger hidden name="(finance)" /> : null}
      {!isClient ? <NativeTabs.Trigger hidden name="(reviews)" /> : null}
      {!isClient ? <NativeTabs.Trigger hidden name="(analytics)" /> : null}
      {!isClient ? <NativeTabs.Trigger hidden name="(billing)" /> : null}
    </NativeTabs>
  );
}
