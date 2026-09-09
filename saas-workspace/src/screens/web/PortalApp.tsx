import { useEffect, useMemo, useState } from 'react';

import { useNotifications } from '@/hooks/use-notifications';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import {
  PortalShell,
  ToastProvider,
  portalNavigationForRole,
  type PortalNotification,
  type PortalRole,
  type PortalSearchItem,
  type PortalScreenKey,
  type PortalUser,
} from '@/components/web';

import { BillingScreen } from './BillingScreen';
import { AdminClientsHubScreen } from './AdminClientsHubScreen';
import { CalendarScreen } from './CalendarScreen';
import { ClientsScreen } from './ClientsScreen';
import { DashboardScreen } from './DashboardScreen';
import { DashboardNotesScreen } from './DashboardNotesScreen';
import { DocumentsScreen } from './DocumentsScreen';
import { FinancesScreen } from './FinancesScreen';
import { GearScreen } from './GearScreen';
import { InstagramAnalyticsScreen } from './InstagramAnalyticsScreen';
import { MembersScreen } from './MembersScreen';
import { MarketingScreen } from './MarketingScreen';
import { StudioHome } from '@/workspace/StudioHome';
import { ModulesScreen } from '@/workspace/ModulesScreen';
import { modules } from '@/workspace/modules';
import { WorkspaceProvider, useWorkspace } from '@/workspace/WorkspaceProvider';
import { PropertiesScreen } from './PropertiesScreen';
import { ReviewsScreen } from './ReviewsScreen';
import { SalesScreen } from './SalesScreen';
import { ScriptingScreen } from './ScriptingScreen';
import { SopsScreen } from './SopsScreen';
import { TeamAccessScreen } from './TeamAccessScreen';
import { TasksScreen } from './TasksScreen';
import {
  demoClients,
  demoEvents,
  demoGear,
  demoPayments,
  demoProperties,
  demoReviews,
  demoTasks,
} from './demoData';
import type {
  AgencyMemberSummary,
  ClientMemberSummary,
  PortalAppProps,
  PortalData,
} from './types';

const allowedScreens: Record<PortalRole, PortalScreenKey[]> = {
  admin: ['modules', 'dashboard', 'documents', 'clients', 'sales', 'team', 'gear', 'marketing', 'scripting', 'finances', 'tasks', 'calendar', 'reviews', 'notes'],
  client: ['dashboard', 'analytics', 'reviews', 'billing'],
  team_member: ['dashboard', 'sops', 'tasks', 'calendar'],
};

const defaultUsers: Record<PortalRole, PortalUser> = {
  admin: {
    email: 'akos@realtymedia.ro',
    name: 'Akos Kis',
  },
  client: {
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
    email: 'andrei@cabana-the-one.ro',
    name: 'Andrei Pop',
  },
  team_member: {
    avatarUrl:
      'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=160&q=80',
    email: 'soma@realtymedia.ro',
    name: 'Soma Irsai',
  },
};

function teamMemberWorkspaceData(
  data: PortalData | undefined,
  member: AgencyMemberSummary | undefined,
): PortalData | undefined {
  if (!data || !member) return data;

  const properties = (data.properties ?? []).filter((property) =>
    property.assignedTeamUserIds.includes(member.userId),
  );
  const propertyIds = new Set(properties.map((property) => property.id));
  const propertyNames = new Set(properties.map((property) => property.name));
  const clientIds = new Set(properties.map((property) => property.clientId));

  return {
    agencyMembers: data.agencyMembers,
    agreements: [],
    calendarEvents: (data.calendarEvents ?? []).filter(
      (event) => event.assigneeUserIds?.includes(member.userId),
    ),
    clientMembers: [],
    clients: (data.clients ?? []).filter((client) => clientIds.has(client.id)),
    companyDocumentFolders: data.companyDocumentFolders,
    companyDocuments: data.companyDocuments,
    costs: [],
    debts: [],
    financeMoneyMovements: [],
    financeAccounts: [],
    gear: [],
    gearHistory: [],
    instagramAccounts: [],
    tiktokAccounts: [],
    notes: (data.notes ?? []).filter((note) => note.visibility === 'team'),
    payments: [],
    properties,
    propertyAssignments: (data.propertyAssignments ?? []).filter(
      (assignment) => assignment.userId === member.userId,
    ),
    reviews: (data.reviews ?? []).filter((review) =>
      review.propertyId
        ? propertyIds.has(review.propertyId)
        : propertyNames.has(review.propertyName),
    ),
    tasks: (data.tasks ?? []).filter(
      (task) =>
        task.assigneeUserId === member.userId || task.visibility === 'team',
    ),
  };
}

function clientMemberWorkspaceData(
  data: PortalData | undefined,
  member: ClientMemberSummary | undefined,
): PortalData | undefined {
  if (!data || !member) return data;

  const properties = (data.properties ?? []).filter(
    (property) => property.clientId === member.clientAccountId,
  );
  const propertyIds = new Set(properties.map((property) => property.id));
  const propertyNames = new Set(properties.map((property) => property.name));
  const belongsToClient = (clientId: string | undefined) =>
    clientId === member.clientAccountId;

  return {
    agencyMembers: [],
    agreements: (data.agreements ?? []).filter((agreement) =>
      belongsToClient(agreement.clientId),
    ),
    calendarEvents: (data.calendarEvents ?? []).filter(
      (event) =>
        event.visibility !== 'admin_only' &&
        (belongsToClient(event.clientId) ||
          Boolean(event.propertyId && propertyIds.has(event.propertyId))),
    ),
    clientMembers: (data.clientMembers ?? []).filter(
      (clientMember) => clientMember.clientAccountId === member.clientAccountId,
    ),
    clients: (data.clients ?? []).filter((client) =>
      belongsToClient(client.id),
    ),
    companyDocumentFolders: [],
    companyDocuments: [],
    costs: [],
    debts: [],
    financeMoneyMovements: [],
    financeAccounts: [],
    gear: [],
    gearHistory: [],
    instagramAccounts: (data.instagramAccounts ?? []).filter((account) =>
      belongsToClient(account.clientId ?? undefined),
    ),
    tiktokAccounts: (data.tiktokAccounts ?? []).filter((account) =>
      belongsToClient(account.clientId ?? undefined),
    ),
    notes: (data.notes ?? []).filter((note) => note.visibility === 'client'),
    payments: (data.payments ?? []).filter((payment) =>
      belongsToClient(payment.clientId),
    ),
    properties,
    propertyAssignments: [],
    reviews: (data.reviews ?? []).filter((review) =>
      review.propertyId
        ? propertyIds.has(review.propertyId)
        : propertyNames.has(review.propertyName),
    ),
    tasks: (data.tasks ?? []).filter(
      (task) =>
        task.visibility !== 'admin_only' &&
        (belongsToClient(task.clientId) ||
          Boolean(task.propertyId && propertyIds.has(task.propertyId))),
    ),
  };
}

function notificationTimeLabel(value: string) {
  const date = new Date(value);
  const difference = Date.now() - date.valueOf();
  const minutes = Math.max(0, Math.floor(difference / 60_000));

  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

type PortalHubNavigation = {
  sales: 'leads' | 'caller';
  dashboard: 'overview' | 'tasks' | 'calendar' | 'notes';
  marketing: 'calendar' | 'analytics';
};

type StoredPortalNavigation = {
  hubs?: Partial<PortalHubNavigation> & { marketing?: PortalHubNavigation['marketing'] | 'scripts' };
  screen?: PortalScreenKey;
  workspaceId?: string;
};

function readStoredNavigation(key: string): StoredPortalNavigation {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '{}') as StoredPortalNavigation;
  } catch {
    return {};
  }
}

function PortalAppInner({
  actions,
  agencyId,
  clientAccountId,
  clientRole,
  currentUserId,
  data,
  initialScreen = 'dashboard',
  onCreateClient,
  onNavigate,
  onSelectWorkspace,
  onSignOut,
  organizationName = 'Realty Media',
  role = 'admin',
  user,
  workspaces,
}: PortalAppProps) {
  const { config } = useWorkspace();
  const navigationStorageKey = `rm:portal-navigation:${currentUserId ?? role}`;
  const storedNavigation = readStoredNavigation(navigationStorageKey);
  const hasInstagramCallback =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('instagram');
  const callbackInitialScreen =
    hasInstagramCallback
      ? role === 'admin' ? 'marketing' : 'analytics'
      : storedNavigation.screen ?? initialScreen;
  const initialAllowedScreen = allowedScreens[role].includes(callbackInitialScreen)
    ? callbackInitialScreen
    : 'dashboard';
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    storedNavigation.workspaceId ?? 'owner',
  );
  const activeTeamMembers = useMemo(
    () =>
      (data?.agencyMembers ?? []).filter(
        (member) =>
          member.role === 'team_member' && member.status === 'active',
      ),
    [data?.agencyMembers],
  );
  const activeClientMembers = useMemo(
    () =>
      (data?.clientMembers ?? []).filter(
        (member) => member.status === 'active',
      ),
    [data?.clientMembers],
  );
  const clientWorkspaceMembers = useMemo<ClientMemberSummary[]>(
    () =>
      (data?.clients ?? []).map((client) => {
        const existingMember = activeClientMembers.find(
          (member) => member.clientAccountId === client.id,
        );
        if (existingMember) return existingMember;

        return {
          avatarUrl: client.avatarUrl,
          clientAccountId: client.id,
          clientName: client.name,
          email: client.email,
          id: `workspace-preview:${client.id}`,
          name: client.contactName || client.name,
          role: 'owner',
          status: 'active',
          userId: `workspace-preview:${client.id}`,
        };
      }),
    [activeClientMembers, data?.clients],
  );
  const selectedTeamMember =
    role === 'admin'
      ? activeTeamMembers.find(
          (member) =>
            activeWorkspaceId === `team:${member.userId}` ||
            activeWorkspaceId === member.userId,
        )
      : undefined;
  const selectedClientMember =
    role === 'admin'
      ? clientWorkspaceMembers.find(
          (member) =>
            activeWorkspaceId === `client:${member.clientAccountId}:${member.userId}`,
        )
      : undefined;
  const visibleWorkspaceId = selectedTeamMember
    ? `team:${selectedTeamMember.userId}`
    : selectedClientMember
      ? `client:${selectedClientMember.clientAccountId}:${selectedClientMember.userId}`
      : 'owner';
  const effectiveRole: PortalRole = selectedTeamMember
    ? 'team_member'
    : selectedClientMember
      ? 'client'
      : role;
  const effectiveClientAccountId =
    selectedClientMember?.clientAccountId ?? clientAccountId;
  const effectiveClientRole = selectedClientMember?.role ?? clientRole;
  const workspaceData = useMemo(
    () =>
      selectedClientMember
        ? clientMemberWorkspaceData(data, selectedClientMember)
        : teamMemberWorkspaceData(data, selectedTeamMember),
    [data, selectedClientMember, selectedTeamMember],
  );
  const hasLiveIdentity = Boolean(
    currentUserId && !currentUserId.startsWith('preview-'),
  );
  const [activeScreen, setActiveScreen] = useState<PortalScreenKey>(initialAllowedScreen);
  useEffect(() => {
    const scrollOptions: ScrollToOptions = { top: 0, left: 0, behavior: 'instant' };
    document.querySelector<HTMLElement>('.aw-frame')?.scrollTo(scrollOptions);
    window.scrollTo(scrollOptions);
  }, [activeScreen, visibleWorkspaceId]);
  const [searchedTaskId, setSearchedTaskId] = useState<string | undefined>();
  const [openedReviewId, setOpenedReviewId] = useState<string | undefined>();
  const [openedCalendarEventId, setOpenedCalendarEventId] = useState<string | undefined>();
  const [openedMarketingContentId, setOpenedMarketingContentId] = useState<string | undefined>();
  const [adminHubTarget, setAdminHubTarget] = useState<PortalHubNavigation & { revision: number }>({
    sales: storedNavigation.hubs?.sales === 'caller' ? 'caller' : 'leads',
    dashboard: storedNavigation.hubs?.dashboard ?? 'overview',
    marketing: hasInstagramCallback
      ? 'analytics'
      : storedNavigation.hubs?.marketing === 'analytics' ? 'analytics' : 'calendar',
    revision: 0,
  });
  useEffect(() => {
    window.localStorage.setItem(
      navigationStorageKey,
      JSON.stringify({
        hubs: {
          sales: adminHubTarget.sales,
          dashboard: adminHubTarget.dashboard,
          marketing: adminHubTarget.marketing,
        },
        screen: activeScreen,
        workspaceId: visibleWorkspaceId,
      } satisfies StoredPortalNavigation),
    );
  }, [activeScreen, adminHubTarget, navigationStorageKey, visibleWorkspaceId]);
  const notificationQuery = useNotifications({
    agencyId,
    enabled: hasLiveIdentity && !selectedTeamMember && !selectedClientMember,
    userId: currentUserId ?? 'preview',
  });
  const authenticatedUser = useMemo(
    () => user ?? defaultUsers[role],
    [role, user],
  );
  const resolvedUser: PortalUser = selectedTeamMember
    ? {
        avatarUrl: selectedTeamMember.avatarUrl,
        email: selectedTeamMember.email,
        name: selectedTeamMember.name,
      }
    : selectedClientMember
      ? {
          avatarUrl: selectedClientMember.avatarUrl,
          email: selectedClientMember.email,
          name: selectedClientMember.name,
        }
    : authenticatedUser;
  const workspaceUserId =
    selectedTeamMember?.userId ?? selectedClientMember?.userId ?? currentUserId;
  const taskAssigneeStateKey = `rm:tasks-state:${workspaceUserId ?? effectiveRole}:assignee`;
  const [, setTaskAssigneeFilter] = useBrowserPersistedState(
    taskAssigneeStateKey,
    'all',
  );
  useEffect(() => {
    const syncTaskAssigneeFilter = (event: Event) => {
      const detail = (event as CustomEvent<{ assigneeId?: string; stateKey?: string }>).detail;
      if (detail?.stateKey === taskAssigneeStateKey && detail.assigneeId) {
        setTaskAssigneeFilter(detail.assigneeId);
      }
    };
    window.addEventListener('rm:task-assignee-filter', syncTaskAssigneeFilter);
    return () => window.removeEventListener('rm:task-assignee-filter', syncTaskAssigneeFilter);
  }, [setTaskAssigneeFilter, taskAssigneeStateKey]);
  const visibleScreen = allowedScreens[effectiveRole].includes(activeScreen)
    ? activeScreen
    : 'dashboard';
  const shellData = useMemo(
    () =>
      workspaceData ?? {
        calendarEvents: demoEvents,
        clients: demoClients,
        gear: demoGear,
        payments: demoPayments,
        properties: demoProperties,
        reviews: demoReviews,
        tasks: demoTasks,
      },
    [workspaceData],
  );
  const searchItems = useMemo<PortalSearchItem[]>(() => {
    const searchableTasks = effectiveRole === 'team_member'
      ? (shellData.tasks ?? []).filter(
          (task) => Boolean(workspaceUserId) && task.assigneeUserId === workspaceUserId,
        )
      : shellData.tasks ?? [];
    const pageNavigation = effectiveRole === 'admin' ? [{key: 'dashboard' as const, label: 'Overview', icon: 'grid' as const, labelRo: 'Overview'}, ...modules.filter(m => config.enabled.includes(m.id)).map(m => ({key: m.id, label: m.label, icon: m.icon, labelRo: m.label})), {key: 'modules' as const, label: 'Customize workspace', icon: 'settings' as const, labelRo: 'Customize workspace'}] : portalNavigationForRole(effectiveRole);
    const pageItems = pageNavigation.map((item) => ({
      detail: 'Workspace page',
      icon: item.icon,
      id: `page-${item.key}`,
      screen: item.key,
      title: authenticatedUser.locale === 'ro' ? (item.labelRo ?? item.label) : item.label,
    }));

    return [
      ...pageItems,
      ...(shellData.clients ?? []).map((client) => ({
        detail: `${client.contactName} · ${client.location}`,
        icon: 'users' as const,
        id: `client-${client.id}`,
        screen: 'clients' as const,
        title: client.name,
      })),
      ...(shellData.properties ?? []).map((property) => ({
        detail: `${property.clientName} · ${property.location}`,
        icon: 'building' as const,
        id: `property-${property.id}`,
        screen: 'properties' as const,
        title: property.name,
      })),
      ...(shellData.reviews ?? []).map((review) => ({
        detail: `${review.propertyName} · ${review.version}`,
        icon: 'play' as const,
        id: `review-${review.id}`,
        screen: 'reviews' as const,
        title: review.title,
      })),
      ...(shellData.calendarEvents ?? []).map((event) => ({
        detail: `${event.date} · ${event.location || event.propertyName}`,
        icon: 'calendar' as const,
        id: `event-${event.id}`,
        screen: 'calendar' as const,
        title: event.title,
      })),
      ...searchableTasks.map((task) => ({
        detail: `${task.propertyName} · ${task.assigneeName}`,
        icon: 'list-check' as const,
        id: `task-${task.id}`,
        screen: 'tasks' as const,
        targetId: task.id,
        title: task.title,
      })),
      ...(shellData.gear ?? []).map((item) => ({
        detail: `${item.serial} · ${item.location}`,
        icon: 'camera' as const,
        id: `gear-${item.id}`,
        screen: 'gear' as const,
        title: item.name,
      })),
    ].filter((item) => allowedScreens[effectiveRole].includes(item.screen) && (effectiveRole !== 'admin' || !modules.some(m => m.id === item.screen) || config.enabled.some(id => id === item.screen)));
  }, [authenticatedUser.locale, effectiveRole, shellData, workspaceUserId, config.enabled]);

  const previewNotifications = useMemo<PortalNotification[]>(() => {
    const reviewNotifications = (shellData.reviews ?? [])
      .filter((review) => review.status !== 'approved')
      .map((review) => ({
        body: `${review.propertyName} · ${review.dueLabel}`,
        id: `review-${review.id}-${review.status}`,
        read: false,
        screen: 'reviews' as const,
        timeLabel: review.version,
        title:
          review.status === 'needs_changes'
            ? `Changes requested: ${review.title}`
            : `Review ready: ${review.title}`,
      }));
    const paymentNotifications = (shellData.payments ?? [])
      .filter((payment) => !['paid', 'waived', 'cancelled'].includes(payment.status))
      .map((payment) => ({
        body: `${payment.clientName ?? 'Client'} · ${payment.amount.toLocaleString('ro-RO')} RON`,
        id: `payment-${payment.id}-${payment.status}`,
        read: false,
        screen: 'billing' as const,
        timeLabel: `Due ${payment.dueDate}`,
        title: payment.status === 'overdue' ? 'Payment overdue' : 'Payment coming up',
      }));
    const now = new Date();
    const calendarNotifications = (shellData.calendarEvents ?? [])
      .filter(
        (event) =>
          !workspaceUserId || event.assigneeUserIds?.includes(workspaceUserId),
      )
      .filter((event) => {
        const eventDate = new Date(`${event.date}T${event.start || '09:00'}:00`);
        const difference = eventDate.valueOf() - now.valueOf();
        return difference >= 0 && difference <= 7 * 24 * 60 * 60 * 1000;
      })
      .map((event) => ({
        body: `${event.propertyName} · ${event.location || 'Location pending'}`,
        id: `event-${event.id}`,
        read: false,
        screen: 'calendar' as const,
        timeLabel: `${event.date} · ${event.start}`,
        title: event.title,
      }));

    const taskNotifications = (shellData.tasks ?? [])
      .filter((task) => !['done', 'cancelled'].includes(task.status))
      .filter(
        (task) => !workspaceUserId || task.assigneeUserId === workspaceUserId,
      )
      .filter((task) => task.dueAt)
      .map((task) => ({
        body: `${task.propertyName} · ${task.assigneeName}`,
        id: `task-${task.id}-${task.status}`,
        read: false,
        screen: 'tasks' as const,
        timeLabel: task.dueAt
          ? new Intl.DateTimeFormat('en-GB', {
              day: 'numeric',
              month: 'short',
            }).format(new Date(task.dueAt))
          : 'No deadline',
        title: task.title,
      }));

    return [...taskNotifications, ...reviewNotifications, ...paymentNotifications, ...calendarNotifications].slice(0, 16);
  }, [shellData, workspaceUserId]);
  const notifications = useMemo<PortalNotification[]>(
    () => {
      const source = hasLiveIdentity && !selectedTeamMember && !selectedClientMember
        ? (notificationQuery.data ?? []).map((notification) => ({
            body: notification.body,
            id: notification.id,
            read: Boolean(notification.readAt),
            screen: notification.webScreen,
            timeLabel: notificationTimeLabel(notification.createdAt),
            title: notification.title,
          }))
        : previewNotifications;

      return source.filter((notification) =>
        allowedScreens[effectiveRole].includes(notification.screen),
      );
    },
    [
      effectiveRole,
      hasLiveIdentity,
      notificationQuery.data,
      previewNotifications,
      selectedClientMember,
      selectedTeamMember,
    ],
  );

  const navigate = (screen: PortalScreenKey) => {
    if (effectiveRole === 'admin') {
      const nestedTargets: Partial<Record<PortalScreenKey, {
        parent: PortalScreenKey;
        section: string;
      }>> = {
        analytics: { parent: 'marketing', section: 'analytics' },
        properties: { parent: 'clients', section: 'clients' },
      };
      const nested = nestedTargets[screen];
      if (nested) {
        setAdminHubTarget((current) => ({
          ...current,
          [nested.parent]: nested.section,
          revision: current.revision + 1,
        }));
        setActiveScreen(nested.parent);
        onNavigate?.(nested.parent);
        return;
      }
    }
    if (!allowedScreens[effectiveRole].includes(screen)) return;
    setActiveScreen(screen);
    onNavigate?.(screen);
  };

  const screen = (() => {
    switch (visibleScreen) {
      case 'clients':
        if (effectiveRole === 'admin') {
          return (
            <AdminClientsHubScreen
              actions={actions}
              currentUserId={workspaceUserId}
              data={workspaceData}
              key={`clients-${adminHubTarget.revision}`}
              onCreateClient={onCreateClient}
              onOpenProductionCalendar={(eventId) => {
                setOpenedCalendarEventId(eventId);
                navigate('calendar');
              }}
              onOpenReview={(reviewId) => {
                setOpenedReviewId(reviewId);
                navigate('reviews');
              }}
              onOpenTask={(taskId) => {
                setSearchedTaskId(taskId);
                navigate('tasks');
              }}
              onOpenWorkspace={(client) => {
                const member = clientWorkspaceMembers.find(
                  (candidate) => candidate.clientAccountId === client.id,
                );
                if (member) setActiveWorkspaceId(`client:${member.clientAccountId}:${member.userId}`);
              }}
            />
          );
        }
        return (
          <ClientsScreen
            accounts={workspaceData?.instagramAccounts}
            clientMembers={workspaceData?.clientMembers}
            clients={workspaceData?.clients}
            currentUserId={workspaceUserId}
            onCreateClient={onCreateClient}
            onCreateClientMember={actions?.createClientMember}
            onArchiveClient={actions?.archiveClient}
            onOpenTask={(taskId) => {
              setSearchedTaskId(taskId);
              navigate('tasks');
            }}
            onUpdateClient={actions?.updateClient}
            onUpdateClientMember={actions?.updateClientMemberAccess}
          />
        );
      case 'sales':
        return effectiveRole === 'admin' ? (
          <SalesScreen
            actions={actions}
            data={workspaceData}
            initialTab={adminHubTarget.sales}
            key={`sales-${adminHubTarget.revision}`}
            onOpenDocuments={() => navigate('documents')}
            onTabChange={(tab) => {
              setAdminHubTarget((current) => ({ ...current, sales: tab }));
            }}
          />
        ) : (
          <DashboardScreen
            currentUserId={workspaceUserId}
            data={workspaceData}
            onNavigate={navigate}
            onOpenCalendarEvent={(eventId) => {
              setOpenedCalendarEventId(eventId);
              navigate('calendar');
            }}
            onOpenReview={(reviewId) => {
              setOpenedReviewId(reviewId);
              navigate('reviews');
            }}
            role={effectiveRole}
            userName={resolvedUser.name}
          />
        );
      case 'team':
        return (
          <TeamAccessScreen
            assignments={workspaceData?.propertyAssignments}
            currentUserId={workspaceUserId}
            members={workspaceData?.agencyMembers}
            onCreate={actions?.createTeamMember}
            onSendPasswordReset={actions?.sendTeamMemberPasswordReset}
            onUpdateAssignments={actions?.updatePropertyAssignments}
            onUpdate={actions?.updateTeamMemberAccess}
            onOpenWorkspace={(member) => setActiveWorkspaceId(`team:${member.userId}`)}
            properties={shellData.properties}
          />
        );
      case 'sops':
        return effectiveRole === 'team_member' ? (
          <SopsScreen documents={workspaceData?.companyDocuments} userId={workspaceUserId} />
        ) : (
          <DashboardScreen
            currentUserId={workspaceUserId}
            data={workspaceData}
            onNavigate={navigate}
            onOpenCalendarEvent={(eventId) => {
              setOpenedCalendarEventId(eventId);
              navigate('calendar');
            }}
            onOpenReview={(reviewId) => {
              setOpenedReviewId(reviewId);
              navigate('reviews');
            }}
            role={effectiveRole}
            userName={resolvedUser.name}
          />
        );
      case 'members': {
        const clientName =
          shellData.clients?.find((client) => client.id === effectiveClientAccountId)?.name ??
          shellData.clients?.[0]?.name ??
          'Your account';
        return effectiveClientAccountId ? (
          <MembersScreen
            canManage={effectiveClientRole === 'owner'}
            clientAccountId={effectiveClientAccountId}
            clientName={clientName}
            currentUserId={workspaceUserId}
            members={workspaceData?.clientMembers}
            onCreate={actions?.createClientMember}
            onUpdate={actions?.updateClientMemberAccess}
          />
        ) : (
          <DashboardScreen
            data={workspaceData}
            onNavigate={navigate}
            role={effectiveRole}
            userName={resolvedUser.name}
          />
        );
      }
      case 'properties':
        return (
          <PropertiesScreen
            clients={shellData.clients}
            onArchiveProperty={actions?.archiveProperty}
            onCreateProperty={actions?.createProperty}
            onUpdateProperty={actions?.updateProperty}
            properties={workspaceData?.properties}
            role={effectiveRole}
          />
        );
      case 'analytics':
        return effectiveRole === 'admin' || effectiveRole === 'client' ? (
          <InstagramAnalyticsScreen
            accounts={workspaceData?.instagramAccounts}
            clientAccountId={effectiveClientAccountId}
            clients={shellData.clients}
            role={effectiveRole}
            scope={effectiveRole === 'admin' ? 'agency' : 'client'}
            tiktokAccounts={workspaceData?.tiktokAccounts}
          />
        ) : (
          <DashboardScreen
            data={workspaceData}
            onNavigate={navigate}
            role={effectiveRole}
            userName={resolvedUser.name}
          />
        );
      case 'reviews':
        return (
          <ReviewsScreen
            initialReviewId={openedReviewId}
            onArchive={effectiveRole !== 'client' ? actions?.archiveDeliverable : undefined}
            onBack={() => navigate(effectiveRole === 'admin' ? 'clients' : 'dashboard')}
            onComment={actions?.reviewComment}
            onDecision={(reviewId, decision) => actions?.reviewDecision(reviewId, decision)}
            onUpload={actions?.uploadDeliverable}
            onUpdate={effectiveRole !== 'client' ? actions?.updateDeliverable : undefined}
            properties={shellData.properties}
            reviews={workspaceData?.reviews}
            role={effectiveRole}
          />
        );
      case 'tasks':
        return (
          <TasksScreen
            archivedTasks={workspaceData?.archivedTasks}
            clients={shellData.clients}
            currentUserId={workspaceUserId}
            initialTaskId={searchedTaskId}
            onInitialTaskOpened={() => setSearchedTaskId(undefined)}
            members={workspaceData?.agencyMembers}
            onArchiveTask={effectiveRole !== 'client' ? actions?.archiveTask : undefined}
            onCreateTask={effectiveRole !== 'client' ? actions?.createTask : undefined}
            onDeleteAttachment={effectiveRole === 'admin' ? actions?.deleteTaskAttachment : undefined}
            onRestoreTask={effectiveRole !== 'client' ? actions?.restoreTask : undefined}
            onUpdateTask={effectiveRole !== 'client' ? actions?.updateTask : undefined}
            properties={shellData.properties}
            role={effectiveRole}
            tasks={workspaceData?.tasks}
          />
        );
      case 'calendar':
        return (
          <CalendarScreen
            clients={shellData.clients}
            currentUserId={workspaceUserId}
            events={workspaceData?.calendarEvents}
            gear={workspaceData?.gear}
            marketingContent={workspaceData?.marketingContent}
            members={workspaceData?.agencyMembers}
            notes={workspaceData?.notes}
            initialEventId={openedCalendarEventId}
            onInitialEventOpened={() => setOpenedCalendarEventId(undefined)}
            onArchiveEvent={effectiveRole === 'admin' ? actions?.archiveEvent : undefined}
            onCreateEvent={actions?.createEvent}
            onCreateNote={actions?.createNote}
            onUpdateEvent={effectiveRole === 'admin' ? actions?.updateEvent : undefined}
            onSaveMarketingContent={effectiveRole === 'admin' ? actions?.upsertMarketingContent : undefined}
            onEditMarketingContent={effectiveRole === 'admin' ? (contentId) => {
              setOpenedMarketingContentId(contentId);
              setAdminHubTarget((current) => ({
                ...current,
                marketing: 'calendar',
                revision: current.revision + 1,
              }));
              navigate('marketing');
            } : undefined}
            properties={shellData.properties}
            role={effectiveRole}
          />
        );
      case 'notes':
        return effectiveRole === 'admin' ? (
          <DashboardNotesScreen
            folders={workspaceData?.companyDocumentFolders}
            locale={resolvedUser.locale ?? 'en'}
            notes={(workspaceData?.companyDocuments ?? []).filter(
              (document) => document.kind === 'note',
            )}
            onArchiveNote={actions?.archiveCompanyDocument}
            onDeleteFolder={actions?.deleteCompanyDocumentFolder}
            onMoveNoteToFolder={actions?.moveCompanyDocumentToFolder}
            onSaveFolder={actions?.upsertCompanyDocumentFolder}
            onSaveNote={actions?.upsertCompanyDocument}
          />
        ) : (
          <DashboardScreen data={workspaceData} onNavigate={navigate} role={effectiveRole} userName={resolvedUser.name} />
        );
      case 'billing':
        return effectiveRole === 'team_member' ? (
          <DashboardScreen data={workspaceData} onNavigate={navigate} role={effectiveRole} userName={resolvedUser.name} />
        ) : (
          <BillingScreen
            agreements={workspaceData?.agreements}
            clients={shellData.clients}
            onAddPayment={actions?.createPayment}
            onArchiveAgreement={actions?.archiveAgreement}
            onArchivePayment={actions?.archivePayment}
            onMarkPaid={actions?.markPaymentPaid}
            onUpdateAgreement={actions?.updateAgreement}
            onUpdatePayment={actions?.updatePayment}
            payments={workspaceData?.payments}
            role={effectiveRole}
          />
        );
      case 'gear':
        return effectiveRole === 'admin' ? (
          <GearScreen
            currentUserId={workspaceUserId}
            events={workspaceData?.calendarEvents}
            gear={workspaceData?.gear}
            history={workspaceData?.gearHistory}
            members={workspaceData?.agencyMembers}
            onAddGear={actions?.createGear}
            onTransferGear={actions?.transferGear}
            onUpdateGear={actions?.updateGear}
            properties={shellData.properties}
          />
        ) : (
          <DashboardScreen data={workspaceData} onNavigate={navigate} role={effectiveRole} userName={resolvedUser.name} />
        );
      case 'finances':
        return effectiveRole === 'admin' ? (
          <FinancesScreen
            accounts={workspaceData?.financeAccounts}
            clients={workspaceData?.clients}
            costs={workspaceData?.costs}
            debts={workspaceData?.debts}
            archivedDebts={workspaceData?.archivedDebts}
            moneyMovements={workspaceData?.financeMoneyMovements}
            onAddCost={actions?.createCost}
            onAddDebt={actions?.createDebt}
            onCreateMoneyMovement={actions?.createMoneyMovement}
            onArchiveCost={actions?.archiveRecurringCost}
            onArchiveDebt={actions?.archiveDebt}
            onRecordDebtPayment={actions?.recordDebtPayment}
            onToggleCost={actions?.toggleRecurringCost}
            onUpdateMoneyMovement={actions?.updateFinanceMoneyMovement}
            onUpdateDebt={actions?.updateDebt}
            onUpdateCost={actions?.updateRecurringCost}
            onUpsertAccount={actions?.upsertFinanceAccount}
          />
        ) : (
          <DashboardScreen data={workspaceData} onNavigate={navigate} role={effectiveRole} userName={resolvedUser.name} />
        );
      case 'documents':
        return effectiveRole === 'admin' ? (
          <DocumentsScreen
            folders={workspaceData?.companyDocumentFolders}
            documents={workspaceData?.companyDocuments}
            leadLists={[...new Set((workspaceData?.leads ?? []).map((lead) => lead.sourceList.trim()).filter(Boolean))]}
            members={workspaceData?.agencyMembers}
            locale={resolvedUser.locale ?? 'en'}
            onArchiveDocument={actions?.archiveCompanyDocument}
            onDeleteFolder={actions?.deleteCompanyDocumentFolder}
            onMoveDocumentToFolder={actions?.moveCompanyDocumentToFolder}
            onSaveDocument={actions?.upsertCompanyDocument}
            onSaveFolder={actions?.upsertCompanyDocumentFolder}
          />
        ) : (
          <DashboardScreen data={workspaceData} onNavigate={navigate} role={effectiveRole} userName={resolvedUser.name} />
        );
      case 'marketing':
        return effectiveRole === 'admin' ? (
          <MarketingScreen
            accounts={workspaceData?.instagramAccounts}
            content={workspaceData?.marketingContent}
            initialTab={adminHubTarget.marketing}
            initialContentId={openedMarketingContentId}
            members={workspaceData?.agencyMembers}
            key={`marketing-${adminHubTarget.revision}`}
            locale={resolvedUser.locale ?? 'en'}
            onArchive={actions?.archiveMarketingContent}
            onSave={actions?.upsertMarketingContent}
            onInitialContentOpened={() => setOpenedMarketingContentId(undefined)}
            onTabChange={(tab) => {
              setAdminHubTarget((current) => ({ ...current, marketing: tab }));
            }}
            tiktokAccounts={workspaceData?.tiktokAccounts}
          />
        ) : (
          <DashboardScreen data={workspaceData} onNavigate={navigate} role={effectiveRole} userName={resolvedUser.name} />
        );
      case 'scripting':
        return effectiveRole === 'admin' || effectiveRole === 'team_member' ? (
          <ScriptingScreen properties={shellData.properties} />
        ) : (
          <DashboardScreen data={workspaceData} onNavigate={navigate} role={effectiveRole} userName={resolvedUser.name} />
        );
      case 'modules':
        return effectiveRole === 'admin' ? <ModulesScreen agencyId={agencyId} /> : null;
      case 'dashboard':
      default:
        return effectiveRole === 'admin' ? (
          <StudioHome data={workspaceData} onNavigate={navigate} userName={resolvedUser.name} />
        ) : (
          <DashboardScreen
            currentUserId={workspaceUserId}
            data={workspaceData}
            onNavigate={navigate}
            onOpenCalendarEvent={(eventId) => {
              setOpenedCalendarEventId(eventId);
              navigate('calendar');
            }}
            onOpenReview={(reviewId) => {
              setOpenedReviewId(reviewId);
              navigate('reviews');
            }}
            role={effectiveRole}
            userName={resolvedUser.name}
          />
        );
    }
  })();

  return (
    <ToastProvider>
      <PortalShell
        activeScreen={visibleScreen}
        notificationCount={notifications.length}
        notifications={notifications}
        onMarkAllNotificationsRead={
          hasLiveIdentity && !selectedTeamMember && !selectedClientMember
            ? notificationQuery.markAllRead
            : undefined
        }
        onDeleteNotification={
          hasLiveIdentity && !selectedTeamMember && !selectedClientMember
            ? notificationQuery.remove
            : undefined
        }
        onClearNotifications={
          hasLiveIdentity && !selectedTeamMember && !selectedClientMember
            ? notificationQuery.clearAll
            : undefined
        }
        onNavigate={navigate}
        onSelectWorkspace={onSelectWorkspace}
        onSearchSelect={(item) => {
          if (item.screen === 'tasks' && item.targetId) setSearchedTaskId(item.targetId);
        }}
        onReadNotification={
          hasLiveIdentity && !selectedTeamMember && !selectedClientMember
            ? notificationQuery.markRead
            : undefined
        }
        onSignOut={onSignOut}
        onUpdateProfile={
          selectedTeamMember || selectedClientMember
            ? undefined
            : actions?.updateProfile
        }
        isAdminViewingWorkspace={role === 'admin' && visibleWorkspaceId !== 'owner'}
        onReturnToOwnerWorkspace={() => setActiveWorkspaceId('owner')}
        role={effectiveRole}
        searchItems={searchItems}
        user={resolvedUser}
        organizationName={organizationName}
        workspaces={workspaces}
      >
        <div
          className="rm-page-transition"
          key={`${effectiveRole}-${visibleWorkspaceId}-${visibleScreen}`}
        >
          {screen}
        </div>
      </PortalShell>
    </ToastProvider>
  );
}

export function PortalApp(props: PortalAppProps) {
  const scope = `${props.organizationName ?? 'studio'}:${props.currentUserId ?? props.role ?? 'admin'}`;
  return <WorkspaceProvider key={scope} scope={scope}><PortalAppInner {...props}/></WorkspaceProvider>;
}
export default PortalApp;
