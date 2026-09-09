import { nativeColors, type AppRole } from '@/components/native';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { usePortalData } from '@/hooks/use-portal-data';
import {
  loadNativeShootBriefCache,
  saveNativeShootBriefCache,
} from '@/lib/native-shoot-brief-cache';
import { useNativePreviewPortalData } from '@/lib/native-preview-store';
import { taskBoardStatus, taskStatusLabel, taskStatusTone } from '@/lib/task-presentation';
import type { AppIdentity } from '@/providers/app-provider';
import type { CalendarEvent, PortalData, RecurringCostItem } from '@/screens/web/types';
import {
  nativeDemoData,
  type NativeDemoBundle,
} from '@/screens/native';

function reviewStatus(
  status: 'in_review' | 'approved' | 'needs_changes' | 'draft',
) {
  switch (status) {
    case 'in_review':
      return 'awaiting_review' as const;
    case 'needs_changes':
      return 'changes_requested' as const;
    case 'approved':
      return 'approved' as const;
    case 'draft':
    default:
      return 'in_progress' as const;
  }
}

function statusTone(
  status: 'active' | 'draft' | 'scheduled' | 'complete' | string,
) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'scheduled':
      return 'info' as const;
    case 'complete':
      return 'neutral' as const;
    default:
      return 'warning' as const;
  }
}

function monthlyCost(cost: RecurringCostItem) {
  const amount = Number.isFinite(cost.amount) ? Math.max(0, cost.amount) : 0;
  const frequency = (cost.frequencyKey || cost.frequency).toLowerCase();
  if (frequency === 'weekly') return (amount * 52) / 12;
  if (frequency === 'quarterly') return amount / 3;
  if (frequency === 'yearly') return amount / 12;
  if (frequency === 'every 6 months') return amount / 6;
  const monthInterval = frequency.match(/^every (\d+) months?$/)?.[1];
  return monthInterval ? amount / Math.max(1, Number(monthInterval)) : amount;
}

function formatMoney(value: number, locale: AppIdentity['locale']) {
  return new Intl.NumberFormat(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    currency: 'RON',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function eventTimestamp(event: CalendarEvent, end = false) {
  const date = end ? (event.endDate ?? event.date) : event.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = event.allDay ? '' : end ? event.end : event.start;
  const parsed = new Date(`${date}T${time && /^\d{2}:\d{2}$/.test(time) ? time : end ? '23:59' : '00:00'}:00`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.valueOf();
}

function isUpcomingEvent(event: CalendarEvent) {
  const timestamp = eventTimestamp(event, true);
  return timestamp === null || timestamp >= Date.now();
}

function calendarDateLabel(value: string, locale: AppIdentity['locale']) {
  return new Intl.DateTimeFormat(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

function calendarDateRangeLabel(event: CalendarEvent, locale: AppIdentity['locale']) {
  const start = calendarDateLabel(event.date, locale);
  const endDate = event.endDate ?? event.date;
  const end = calendarDateLabel(endDate, locale);
  return endDate !== event.date ? `${start} – ${end}` : start;
}

function calendarTimeLabel(event: CalendarEvent) {
  if (event.allDay) return 'All day';
  return [event.start || 'TBC', event.end].filter(Boolean).join('–');
}

function bundleFromLiveData(
  role: AppRole,
  identity: AppIdentity,
  data: NonNullable<ReturnType<typeof usePortalData>['data']>,
): NativeDemoBundle {
  const reviews = data.reviews ?? [];
  const properties = data.properties ?? [];
  const events = data.calendarEvents ?? [];
  const tasks = data.tasks ?? [];
  const previewOwnerUserId = role === 'admin' ? 'demo-akos' : role === 'team_member' ? 'demo-soma' : null;
  const ownerTasks = role === 'admin'
    ? tasks.filter((task) => task.assigneeUserId === identity.userId || task.assigneeUserId === previewOwnerUserId)
    : tasks;
  const upcomingEvents = events
    .filter(isUpcomingEvent)
    .sort((left, right) => (eventTimestamp(left) ?? 0) - (eventTimestamp(right) ?? 0));
  const actionableReviews = reviews.filter(
    (review) =>
      review.status === 'in_review' || review.status === 'needs_changes',
  );
  const openTasks = tasks.filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled',
  );
  const nativeProperties = properties.map((property) => ({
    awaitingReviewCount: reviews.filter(
      (review) =>
        review.propertyName === property.name &&
        review.status === 'in_review',
    ).length,
    assignedTeamNames: property.assignedTeamNames,
    clientName: property.clientName,
    coverImageUrl: property.coverUrl,
    id: property.id,
    lastUpdatedLabel: 'Live workspace',
    location: property.location,
    name: property.name,
    nextMilestone: property.nextMilestone,
    openTaskCount: openTasks.filter(
      (task) => task.propertyId === property.id,
    ).length,
    socialSummary:
      property.analytics.views === 'Connect social'
        ? 'Social analytics connection pending'
        : `${property.analytics.views} views`,
    statusLabel:
      property.status === 'active'
        ? 'Active'
        : property.status === 'complete'
          ? 'Complete'
          : 'In production',
    statusTone: statusTone(property.status),
  }));
  const productionDays = upcomingEvents
    .filter((event) => event.type === 'shoot')
    .slice(0, 4)
    .map((event) => ({
      id: event.id,
      subtitle: [event.propertyName, event.location].filter(Boolean).join(' · '),
      symbol: 'camera',
      timeLabel: calendarDateRangeLabel(event, identity.locale) + ' · ' + calendarTimeLabel(event),
      title: event.title,
    }));
  const clientTasks = openTasks
    .filter((task) => task.visibility !== 'admin_only')
    .slice(0, 8)
    .map((task) => ({
      dueAt: task.dueAt,
      id: task.id,
      priority: task.priority,
      propertyName: task.propertyName,
      status: task.status,
      title: task.title,
    }));
  const agreement = (data.agreements ?? []).find(
    (item) => item.status === 'active',
  ) ?? data.agreements?.[0];
  const clientApprovals = reviews.filter((review) =>
    review.status === 'in_review' || review.status === 'needs_changes',
  );
  const clientDeliveredAssets = reviews.filter((review) => review.status === 'approved');
  const liquidity = (data.financeAccounts ?? []).reduce(
    (sum, account) => sum + Math.max(0, account.currentBalance),
    0,
  );
  const monthlyCommitments = (data.costs ?? []).reduce(
    (sum, cost) => sum + monthlyCost(cost),
    0,
  );
  const runwayMonths = monthlyCommitments > 0 ? liquidity / monthlyCommitments : null;
  const activeAgreements = (data.agreements ?? []).filter(
    (item) => item.status === 'active',
  );
  const monthlyRecurringRevenue = activeAgreements.reduce(
    (sum, item) => sum + Math.max(0, item.monthlyAmount),
    0,
  );
  const adminMetrics = [
    {
      detail: runwayMonths === null
        ? 'Add recurring costs to calculate runway'
        : `${runwayMonths.toFixed(1)} months covered`,
      id: 'available-cash',
      label: 'Available cash',
      value: formatMoney(liquidity, identity.locale),
    },
    {
      detail: identity.locale === 'ro' ? 'Venit lunar curent' : 'Current monthly revenue',
      id: 'monthly-recurring-revenue',
      label: 'MRR',
      value: formatMoney(monthlyRecurringRevenue, identity.locale),
    },
  ];
  const priorities = role === 'admin'
    ? ownerTasks
        .filter((task) => task.status !== 'done' && task.status !== 'cancelled')
        .map((task) => ({
        detail: task.dueAt
          ? new Intl.DateTimeFormat(identity.locale === 'ro' ? 'ro-RO' : 'en-GB', {
              day: 'numeric',
              month: 'short',
            }).format(new Date(task.dueAt))
          : 'No deadline',
        id: `task-${task.id}`,
        urgent: task.priority === 'urgent',
        taskStatus: taskBoardStatus(task.status),
        statusLabel: taskStatusLabel(task.status, identity.locale),
        statusTone: taskStatusTone(task.status),
        subtitle: task.propertyName,
        symbol: 'checklist',
        title: task.title,
        }))
    : [
        ...openTasks.map((task) => ({
          detail: task.dueAt
            ? new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'short',
              }).format(new Date(task.dueAt))
            : 'No deadline',
          id: `task-${task.id}`,
          urgent: task.priority === 'urgent',
          taskStatus: taskBoardStatus(task.status),
          statusLabel: taskStatusLabel(task.status, identity.locale),
          statusTone: taskStatusTone(task.status),
          subtitle: task.propertyName,
          symbol: 'checklist',
          title: task.title,
        })),
        ...actionableReviews.map((review) => ({
          detail: `${review.comments.length} comments · ${review.version}`,
          id: `review-${review.id}`,
          statusLabel:
            review.status === 'needs_changes' ? 'Changes' : 'Review',
          statusTone:
            review.status === 'needs_changes'
              ? ('critical' as const)
              : ('warning' as const),
          subtitle: review.propertyName,
          symbol: 'play.rectangle',
          title: review.title,
        })),
      ];

  return {
    clientHome: role === 'client'
      ? {
          agreement,
          approvals: clientApprovals,
          deliveredAssets: clientDeliveredAssets,
          productionDays,
          properties: nativeProperties,
          tasks: clientTasks,
        }
      : undefined,
    home: {
      metrics: role === 'admin' ? adminMetrics : [
        {
          detail: 'Owned by your account',
          id: 'visible-properties',
          label: 'Properties',
          symbol: 'building.2',
          symbolColor: nativeColors.accent,
          value: properties.length,
        },
        {
          detail: 'Ready for a decision',
          id: 'actionable-reviews',
          label: 'Waiting reviews',
          symbol: 'checkmark.bubble',
          symbolColor: nativeColors.warning,
          value: actionableReviews.length,
        },
        {
          detail: 'On your live calendar',
          id: 'upcoming-events',
          label: 'Scheduled',
          symbol: 'calendar',
          symbolColor: nativeColors.success,
          value: events.length,
        },
      ],
      priorities: priorities.slice(0, 4),
      upcoming: upcomingEvents.slice(0, 4).map((event) => ({
        id: event.id,
        subtitle: event.propertyName,
        symbol: event.type === 'shoot' ? 'camera' : 'calendar',
        timeLabel: calendarDateRangeLabel(event, identity.locale) + ' · ' + calendarTimeLabel(event),
        title: event.title,
      })),
      userName: identity.displayName,
    },
    properties: {
      properties: nativeProperties,
    },
    reviews: {
      reviews: reviews.map((review) => ({
        commentCount: review.comments.length,
        dueLabel: review.dueLabel,
        id: review.id,
        kind: 'video' as const,
        propertyName: review.propertyName,
        status: reviewStatus(review.status),
        submittedBy: review.assignee,
        timecodedCommentCount: review.comments.filter(
          (comment) => comment.timestamp !== 'General',
        ).length,
        title: review.title,
        updatedLabel: review.version,
      })),
    },
    calendar: {
      events: upcomingEvents.map((event) => ({
        color: event.color,
        dateKey: event.date,
        dateLabel: calendarDateLabel(event.date, identity.locale),
        endDateKey: event.endDate ?? event.date,
        endDateLabel: calendarDateLabel(event.endDate ?? event.date, identity.locale),
        endTimeLabel: event.allDay ? undefined : event.end || undefined,
        id: event.id,
        kind:
          event.type === 'shoot'
            ? ('shoot' as const)
            : event.type === 'review'
              ? ('review' as const)
              : event.type === 'deadline'
                ? ('deadline' as const)
                : ('meeting' as const),
        location: event.location || undefined,
        propertyName: event.propertyName,
        startTimeLabel: event.allDay ? 'All day' : event.start || 'TBC',
        title: event.title,
        weekdayLabel: new Intl.DateTimeFormat('en-GB', {
          weekday: 'long',
        }).format(new Date(`${event.date}T12:00:00`)),
      })),
    },
    more: {
      appVersion: '1.0.0',
      displayName: identity.displayName,
      email: identity.email,
      notificationsEnabled: true,
      organizationName: 'Realty Media',
    },
  };
}

export function useNativePortalData({
  identity,
  isPreview,
}: {
  identity: AppIdentity | null;
  isPreview: boolean;
}) {
  const query = usePortalData({
    agencyId: identity?.agencyId,
    enabled: Boolean(identity) && !isPreview,
  });
  const manualRefresh = useManualRefresh(query.refetch);
  const [cachedBriefData, setCachedBriefData] = React.useState<PortalData | null>(null);
  React.useEffect(() => {
    if (!identity?.agencyId || isPreview) return;
    let active = true;
    void loadNativeShootBriefCache(identity.userId, identity.agencyId).then((cached) => {
      if (active && cached) setCachedBriefData(cached);
    });
    return () => { active = false; };
  }, [identity?.agencyId, identity?.userId, isPreview]);
  React.useEffect(() => {
    if (!identity?.agencyId || !query.data || isPreview) return;
    void saveNativeShootBriefCache(identity.userId, identity.agencyId, query.data);
  }, [identity?.agencyId, identity?.userId, isPreview, query.data]);
  const role = identity?.role ?? 'client';
  const resolvedPortalData: PortalData = query.data ?? cachedBriefData ?? {};
  const previewData = useNativePreviewPortalData();
  const demo = nativeDemoData[role];
  const bundle =
    identity && !isPreview
      ? bundleFromLiveData(role, identity, resolvedPortalData)
      : identity
        ? bundleFromLiveData(role, identity, previewData)
        : demo;

  return {
    bundle,
    data: isPreview ? previewData : resolvedPortalData,
    errorMessage: query.error && !cachedBriefData ? query.error.message : undefined,
    loading: !isPreview && query.isLoading,
    refreshing: !isPreview && manualRefresh.refreshing,
    retry: manualRefresh.refresh,
  };
}
import React from 'react';
