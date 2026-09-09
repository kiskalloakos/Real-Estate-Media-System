import { nativeColors, type AppRole } from '@/components/native';

import type { CalendarEventSummary } from './calendar-screen';
import type { HomeMetric, HomePriorityItem, HomeScheduleItem } from './home-screen';
import type { ClientTaskSummary } from './client-home-screen';
import type { ReviewItem } from '@/screens/web/types';
import type { PropertySummary } from './properties-screen';
import type { ReviewSummary } from './reviews-screen';

export interface NativeDemoBundle {
  clientHome?: {
    agreement?: import('@/screens/web/types').AgreementSummary;
    approvals?: readonly ReviewItem[];
    deliveredAssets?: readonly ReviewItem[];
    productionDays: readonly HomeScheduleItem[];
    properties: readonly PropertySummary[];
    tasks: readonly ClientTaskSummary[];
  };
  home: {
    userName: string;
    metrics: readonly HomeMetric[];
    priorities: readonly HomePriorityItem[];
    upcoming: readonly HomeScheduleItem[];
  };
  properties: {
    properties: readonly PropertySummary[];
  };
  reviews: {
    reviews: readonly ReviewSummary[];
  };
  calendar: {
    events: readonly CalendarEventSummary[];
  };
  more: {
    displayName: string;
    email: string;
    organizationName: string;
    notificationsEnabled: boolean;
    appVersion: string;
  };
}

const properties: readonly PropertySummary[] = [
  {
    id: 'property-sunset',
    name: 'Sunset Penthouse',
    location: 'Cluj-Napoca',
    clientName: 'Ana Pop',
    coverImageUrl: 'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=85',
    statusLabel: 'Active',
    statusTone: 'success',
    assignedTeamNames: ['Mara', 'Victor'],
    awaitingReviewCount: 2,
    openTaskCount: 3,
    nextMilestone: 'Shoot tomorrow',
    lastUpdatedLabel: 'Updated 18 min ago',
    socialSummary: '124k views across Instagram',
  },
  {
    id: 'property-forest',
    name: 'Forest House',
    location: 'Beliș',
    clientName: 'North Ridge Homes',
    coverImageUrl: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=85',
    statusLabel: 'In production',
    statusTone: 'info',
    assignedTeamNames: ['Victor'],
    awaitingReviewCount: 0,
    openTaskCount: 1,
    nextMilestone: 'Edit due Friday',
    lastUpdatedLabel: 'Updated yesterday',
    socialSummary: '38k views in the last 30 days',
  },
  {
    id: 'property-river',
    name: 'Riverstone Residence',
    location: 'Florești',
    clientName: 'Riverstone Development',
    coverImageUrl: 'https://images.unsplash.com/photo-1520984032042-162d526883e0?auto=format&fit=crop&w=1200&q=85',
    statusLabel: 'Planning',
    statusTone: 'neutral',
    assignedTeamNames: [],
    awaitingReviewCount: 0,
    openTaskCount: 2,
    nextMilestone: 'Brief approval',
    lastUpdatedLabel: 'Updated 3 days ago',
  },
];

const reviews: readonly ReviewSummary[] = [
  {
    id: 'review-sunset-tour',
    title: 'Sunset Penthouse · Main tour',
    propertyName: 'Sunset Penthouse',
    kind: 'video',
    status: 'awaiting_review',
    durationLabel: '0:46',
    commentCount: 2,
    timecodedCommentCount: 1,
    dueLabel: 'Due today',
    submittedBy: 'Mara',
  },
  {
    id: 'review-forest-reel',
    title: 'Forest House · Reel v2',
    propertyName: 'Forest House',
    kind: 'video',
    status: 'changes_requested',
    durationLabel: '0:28',
    commentCount: 4,
    timecodedCommentCount: 3,
    dueLabel: 'Due tomorrow',
    submittedBy: 'Victor',
  },
  {
    id: 'review-river-script',
    title: 'Riverstone launch script',
    propertyName: 'Riverstone Residence',
    kind: 'script',
    status: 'in_progress',
    commentCount: 1,
    updatedLabel: 'Updated 1 hr ago',
    submittedBy: 'Mara',
  },
  {
    id: 'review-forest-script',
    title: 'Forest House hook options',
    propertyName: 'Forest House',
    kind: 'script',
    status: 'approved',
    updatedLabel: 'Approved yesterday',
    submittedBy: 'Ana',
  },
];

const events: readonly CalendarEventSummary[] = [
  {
    id: 'event-sunset-shoot',
    dateKey: 'today',
    dateLabel: 'Today',
    weekdayLabel: 'Sunday',
    title: 'Sunset Penthouse shoot',
    startTimeLabel: '15:00',
    endTimeLabel: '17:30',
    propertyName: 'Sunset Penthouse',
    location: 'Cluj-Napoca',
    kind: 'shoot',
  },
  {
    id: 'event-forest-review',
    dateKey: 'today',
    dateLabel: 'Today',
    weekdayLabel: 'Sunday',
    title: 'Forest House edit review',
    startTimeLabel: '18:00',
    propertyName: 'Forest House',
    kind: 'review',
    statusLabel: 'Review',
    statusTone: 'warning',
  },
  {
    id: 'event-river-brief',
    dateKey: 'tomorrow',
    dateLabel: 'Tomorrow',
    weekdayLabel: 'Monday',
    title: 'Riverstone brief call',
    startTimeLabel: '10:30',
    endTimeLabel: '11:00',
    propertyName: 'Riverstone Residence',
    kind: 'meeting',
  },
  {
    id: 'event-payment',
    dateKey: 'friday',
    dateLabel: '31 July',
    weekdayLabel: 'Friday',
    title: 'Upcoming monthly payment',
    startTimeLabel: 'All day',
    propertyName: 'Sunset Penthouse',
    kind: 'payment',
  },
];

export const nativeDemoData: Record<AppRole, NativeDemoBundle> = {
  admin: {
    home: {
      userName: 'Akos',
      metrics: [
        {
          id: 'active-properties',
          label: 'Active properties',
          value: 12,
          detail: 'Across 8 clients',
          symbol: 'building.2',
          symbolColor: nativeColors.accent,
        },
        {
          id: 'waiting-reviews',
          label: 'Waiting reviews',
          value: 5,
          detail: '2 due today',
          symbol: 'checkmark.bubble',
          symbolColor: nativeColors.warning,
        },
        {
          id: 'team-on-site',
          label: 'Team on site',
          value: 2,
          detail: '1 shoot this afternoon',
          symbol: 'person.2',
          symbolColor: nativeColors.success,
        },
      ],
      priorities: [
        {
          id: 'admin-priority-forest',
          title: 'Forest House revision is due',
          subtitle: 'Victor · video edit',
          detail: '3 timecoded comments',
          symbol: 'play.rectangle',
          statusLabel: 'Changes',
          statusTone: 'critical',
        },
        {
          id: 'admin-priority-river',
          title: 'Assign the Riverstone brief',
          subtitle: 'Riverstone Residence',
          detail: 'No team member assigned',
          symbol: 'person.badge.plus',
          statusLabel: 'Unassigned',
          statusTone: 'warning',
        },
      ],
      upcoming: [
        {
          id: 'admin-upcoming-shoot',
          title: 'Sunset Penthouse shoot',
          subtitle: 'Mara and Victor',
          timeLabel: 'Today · 15:00–17:30',
          symbol: 'camera',
        },
        {
          id: 'admin-upcoming-call',
          title: 'Riverstone brief call',
          subtitle: 'Client kickoff',
          timeLabel: 'Tomorrow · 10:30',
          symbol: 'person.2',
        },
      ],
    },
    properties: { properties },
    reviews: { reviews },
    calendar: { events },
    more: {
      displayName: 'Akos Kiskallo',
      email: 'akos@realtymedia.ro',
      organizationName: 'Realty Media',
      notificationsEnabled: true,
      appVersion: '1.0.0',
    },
  },
  team_member: {
    home: {
      userName: 'Victor',
      metrics: [
        {
          id: 'assigned-properties',
          label: 'Assigned properties',
          value: 2,
          detail: '1 shoot today',
          symbol: 'building.2',
          symbolColor: nativeColors.accent,
        },
        {
          id: 'changes',
          label: 'Changes requested',
          value: 1,
          detail: '3 timecoded comments',
          symbol: 'arrow.triangle.2.circlepath',
          symbolColor: nativeColors.critical,
        },
        {
          id: 'approved',
          label: 'Approved this week',
          value: 4,
          detail: 'Ready for delivery',
          symbol: 'checkmark.circle',
          symbolColor: nativeColors.success,
        },
      ],
      priorities: [
        {
          id: 'team-priority-forest',
          title: 'Revise Forest House Reel v2',
          subtitle: 'Forest House',
          detail: 'Due tomorrow · 3 timecoded comments',
          symbol: 'play.rectangle',
          statusLabel: 'Changes',
          statusTone: 'critical',
        },
      ],
      upcoming: [
        {
          id: 'team-upcoming-shoot',
          title: 'Sunset Penthouse shoot',
          subtitle: 'Meet Mara on site',
          timeLabel: 'Today · 15:00–17:30',
          symbol: 'camera',
        },
      ],
    },
    properties: { properties: properties.slice(0, 2) },
    reviews: {
      reviews: reviews.filter((review) =>
        ['changes_requested', 'in_progress', 'approved'].includes(review.status),
      ),
    },
    calendar: {
      events: events.filter((event) => event.kind !== 'payment'),
    },
    more: {
      displayName: 'Victor Muresan',
      email: 'victor@realtymedia.ro',
      organizationName: 'Realty Media',
      notificationsEnabled: true,
      appVersion: '1.0.0',
    },
  },
  client: {
    clientHome: {
      agreement: {
        clientId: 'client-demo',
        clientName: 'Ana Pop',
        currency: 'RON',
        endsOn: '2027-07-31',
        filePath: 'realty-media-agreement.pdf',
        fileUrl: 'https://example.com/realty-media-agreement.pdf',
        id: 'agreement-demo',
        monthlyAmount: 1000,
        startsOn: '2026-08-01',
        status: 'active',
        summary: 'Monthly property production and social content.',
        title: 'Ana Pop · Realty Media agreement',
        totalValue: 12000,
      },
      productionDays: [
        {
          id: 'event-sunset-shoot',
          title: 'Sunset Penthouse production',
          subtitle: 'Realty Media team on site',
          timeLabel: 'Today · 15:00–17:30',
          symbol: 'camera',
        },
      ],
      properties: properties.slice(0, 2),
      tasks: [
        {
          dueAt: '2026-08-20T12:00:00.000Z',
          id: 'client-task-demo',
          priority: 'normal',
          propertyName: 'Sunset Penthouse',
          status: 'in_progress',
          title: 'Confirm final property details',
        },
      ],
    },
    home: {
      userName: 'Ana',
      metrics: [
        {
          id: 'client-properties',
          label: 'Properties',
          value: 2,
          detail: 'Both active',
          symbol: 'building.2',
          symbolColor: nativeColors.accent,
        },
        {
          id: 'client-reviews',
          label: 'Ready to review',
          value: 1,
          detail: 'New video delivery',
          symbol: 'checkmark.bubble',
          symbolColor: nativeColors.warning,
        },
        {
          id: 'client-views',
          label: 'Views this month',
          value: '162k',
          detail: 'Instagram',
          symbol: 'chart.line.uptrend.xyaxis',
          symbolColor: nativeColors.success,
        },
      ],
      priorities: [
        {
          id: 'client-priority-sunset',
          title: 'Review the main property tour',
          subtitle: 'Sunset Penthouse',
          detail: '0:46 · uploaded 18 min ago',
          symbol: 'play.rectangle',
          statusLabel: 'Review',
          statusTone: 'warning',
        },
      ],
      upcoming: [
        {
          id: 'client-upcoming-shoot',
          title: 'Sunset Penthouse shoot',
          subtitle: 'Realty Media team on site',
          timeLabel: 'Today · 15:00–17:30',
          symbol: 'camera',
        },
        {
          id: 'client-upcoming-payment',
          title: 'Upcoming monthly payment',
          subtitle: 'Current Realty Media agreement',
          timeLabel: '31 July',
          symbol: 'creditcard',
        },
      ],
    },
    properties: { properties: properties.slice(0, 2) },
    reviews: {
      reviews: reviews.filter((review) =>
        ['awaiting_review', 'approved'].includes(review.status),
      ),
    },
    calendar: {
      events: events.filter((event) =>
        ['shoot', 'review', 'payment'].includes(event.kind),
      ),
    },
    more: {
      displayName: 'Ana Pop',
      email: 'ana@example.com',
      organizationName: 'Sunset Properties',
      notificationsEnabled: true,
      appVersion: '1.0.0',
    },
  },
};
