import { useEffect, useMemo, useState } from 'react';

import type { PortalActionHandlers } from './types';
import { EngagementWorkspace } from './EngagementWorkspace';
import { useProjectPreview, previewJobs } from '@/hooks/use-project-preview';
import { useReviewPreview } from '@/hooks/use-review-preview';
import { usePortalLocation } from '@/hooks/use-portal-location';
import type { PortalLocation } from '@/lib/portal-location';
import type { TaskView } from '@/lib/task-workspace';
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
import { DocumentsWorkspace } from './DocumentsWorkspace';
import { FinancesScreen } from './FinancesScreen';
import { GearScreen } from './GearScreen';
import { InstagramAnalyticsScreen } from './InstagramAnalyticsScreen';
import { MembersScreen } from './MembersScreen';
import { MarketingScreen } from './MarketingScreen';
import { MarketingItemEditor } from './MarketingItemEditor';
import { StudioHome } from '@/workspace/StudioHome';
import { ModulesScreen } from '@/workspace/ModulesScreen';
import { modules } from '@/workspace/modules';
import { workspacePages } from '@/workspace/navigation';
import { WorkspaceProvider, useWorkspace } from '@/workspace/WorkspaceProvider';
import { shouldOnboardAgency } from '@/workspace/agency-settings';
import { WorkspaceOnboarding } from '@/workspace/WorkspaceOnboarding';
import { WorkspaceGettingStarted, WorkspaceWelcome } from '@/workspace/WorkspaceGettingStarted';
import '@/workspace/onboarding.css';
import { PropertiesScreen } from './PropertiesScreen';
import { ProjectsScreen } from './ProjectsScreen';
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
  admin: ['modules', 'dashboard', 'documents', 'projects', 'clients', 'sales', 'team', 'gear', 'marketing', 'scripting', 'finances', 'tasks', 'calendar', 'reviews', 'notes'],
  client: ['dashboard', 'analytics', 'reviews', 'billing', 'documents'],
  team_member: ['dashboard', 'sops', 'tasks', 'calendar', 'documents'],
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
    jobs: data.jobs,
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
    jobs: (data.jobs ?? []).filter(job => belongsToClient(job.clientId)),
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
      review.clientVisible !== false && (belongsToClient(review.clientId) || (review.propertyId
        ? propertyIds.has(review.propertyId)
        : propertyNames.has(review.propertyName))),
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
};

type StoredPortalNavigation = {
  hubs?: Partial<PortalHubNavigation>;
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
  dataReady = true,
  initialScreen = 'dashboard',
  onCreateClient,
  onNavigate,
  onSelectWorkspace,
  onSignOut,
  onStartSetup,
  role = 'admin',
  user,
  workspaces,
}: PortalAppProps & { onStartSetup: () => void }) {
  const { config, error: workspaceError, retry: retryWorkspace } = useWorkspace();
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
      (data?.clients ?? (currentUserId?.startsWith('preview-') ? demoClients : [])).map((client) => {
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
    [activeClientMembers, currentUserId, data?.clients],
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
  const [location, visit] = usePortalLocation(initialAllowedScreen, allowedScreens[effectiveRole], visibleWorkspaceId);
  const activeScreen = location.screen;
  const [openedReviewId, setOpenedReviewId] = useState<string | undefined>();
  const [openedReviewVersionId, setOpenedReviewVersionId] = useState<string | undefined>();
  const [openedCalendarEventId, setOpenedCalendarEventId] = useState<string | undefined>();
  const [openedMarketingContentId, setOpenedMarketingContentId] = useState<string | undefined>();
  const [adminHubTarget, setAdminHubTarget] = useState<PortalHubNavigation & { revision: number }>({
    sales: storedNavigation.hubs?.sales === 'caller' ? 'caller' : 'leads',
    dashboard: storedNavigation.hubs?.dashboard ?? 'overview',
    revision: 0,
  });
  useEffect(() => {
    window.localStorage.setItem(
      navigationStorageKey,
      JSON.stringify({
        hubs: {
          sales: adminHubTarget.sales,
          dashboard: adminHubTarget.dashboard,
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
  const projectPreview = useProjectPreview(!hasLiveIdentity && effectiveRole === 'admin');
  const reviewPreview = useReviewPreview(!hasLiveIdentity, effectiveRole);
  const reviewActions = hasLiveIdentity ? actions : reviewPreview.actions;
  const projectActions: PortalActionHandlers | undefined = actions && !hasLiveIdentity && effectiveRole === 'admin' ? { ...actions, ...projectPreview.actions, ...reviewPreview.actions } : actions;
  const shellData = useMemo(
    () =>
      workspaceData ?? {
        calendarEvents: demoEvents,
        clients: demoClients,
        gear: demoGear,
        payments: demoPayments,
        properties: demoProperties,
        reviews: reviewPreview.reviews ?? demoReviews,
        tasks: demoTasks,
        ...projectPreview.data,
        jobs: !hasLiveIdentity ? projectPreview.data.jobs ?? previewJobs : undefined,
      },
    [workspaceData, projectPreview.data, reviewPreview.reviews, hasLiveIdentity],
  );
  const searchItems = useMemo<PortalSearchItem[]>(() => {
    const searchableTasks = effectiveRole === 'team_member'
      ? (shellData.tasks ?? []).filter(
          (task) => Boolean(workspaceUserId) && task.assigneeUserId === workspaceUserId,
        )
      : shellData.tasks ?? [];
    const pageNavigation = effectiveRole === 'admin' ? [...workspacePages(config).map(item => ({...item, labelRo: item.label})), {key: 'modules' as const, label: 'Customize workspace', icon: 'settings' as const, labelRo: 'Customize workspace'}] : portalNavigationForRole(effectiveRole);
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
        targetId: client.id,
        title: client.name,
      })),
      ...(shellData.jobs ?? []).map(project => ({ detail: shellData.clients?.find(client => client.id === project.clientId)?.name ?? 'Internal agency work', icon: 'folder' as const, id: `project-${project.id}`, screen: 'projects' as const, targetId: project.id, title: project.name })),
      ...(shellData.properties ?? []).map((property) => ({
        detail: `${property.clientName} · ${property.location}`,
        icon: 'building' as const,
        id: `property-${property.id}`,
        screen: 'projects' as const,
        targetId: property.id,
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
    ].filter((item) => allowedScreens[effectiveRole].includes(item.screen) && (effectiveRole !== 'admin' || (item.screen !== 'projects' || config.enabled.includes('clients')) && (!modules.some(m => m.id === item.screen) || config.enabled.some(id => id === item.screen))));
  }, [authenticatedUser.locale, effectiveRole, shellData, workspaceUserId, config]);

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
            taskId: notification.entityType === 'task' ? notification.entityId ?? undefined : undefined,
            reviewId: notification.kind === 'review' && typeof notification.metadata.mediaAssetId === 'string' ? notification.metadata.mediaAssetId : undefined,
            versionId: typeof notification.metadata.versionId === 'string' ? notification.metadata.versionId : undefined,
            timeLabel: notificationTimeLabel(notification.createdAt),
            title: notification.title,
          }))
        : [...projectPreview.notifications, ...previewNotifications];

      return source.filter((notification) =>
        allowedScreens[effectiveRole].includes(notification.screen),
      );
    },
    [
      effectiveRole,
      hasLiveIdentity,
      notificationQuery.data,
      previewNotifications,
      projectPreview.notifications,
      selectedClientMember,
      selectedTeamMember,
    ],
  );

  const navigate = (screen: PortalScreenKey) => {
    if (screen !== 'reviews') setOpenedReviewId(undefined);
    if (effectiveRole === 'admin' && screen === 'analytics') screen = 'marketing';
    if (effectiveRole === 'admin') {
      const nestedTargets: Partial<Record<PortalScreenKey, {
        parent: PortalScreenKey;
        section: string;
      }>> = {
        properties: { parent: 'clients', section: 'clients' },
      };
      const nested = nestedTargets[screen];
      if (nested) {
        setAdminHubTarget((current) => ({
          ...current,
          [nested.parent]: nested.section,
          revision: current.revision + 1,
        }));
        visit({ screen: nested.parent });
        onNavigate?.(nested.parent);
        return;
      }
    }
    if (!allowedScreens[effectiveRole].includes(screen)) return;
    visit(screen === activeScreen ? location : { screen });
    onNavigate?.(screen);
  };

  const openTask = (taskId: string) => visit({ screen: 'tasks', taskId });
  const openClient = (clientId: string) => visit({ screen: 'clients', clientId });
  const openTaskView = (taskView: TaskView) => visit({ screen: 'tasks', taskView, taskAssignee: 'all', taskQuery: '' });
  const changeTaskLocation = (changes: Partial<PortalLocation>, replace = false) => visit({ ...location, ...changes }, replace);

  const screen = (() => {
    switch (visibleScreen) {
      case 'projects': {
        const engagement = shellData.jobs?.find(item => item.id === location.projectId);
        if (engagement) return <EngagementWorkspace agencyId={agencyId ?? undefined} key={engagement.id} project={engagement} data={shellData} actions={projectActions} currentUserId={workspaceUserId} location={location} onLocationChange={changes => visit({ ...location, ...changes })} onBack={() => visit({ screen: 'projects' })} onOpenClient={openClient}/>;
        const project = shellData.properties?.find(item => item.id === location.projectId);
        const clientId = project?.clientId ?? (!location.projectId ? location.clientId : undefined);
        if (clientId && shellData.clients?.some(client => client.id === clientId)) return (
          <AdminClientsHubScreen onOpenProject={projectId => visit({ screen: 'projects', projectId })} onManageProjects={() => visit({ screen: 'projects' })} actions={actions} currentUserId={workspaceUserId} data={shellData}
            key={`project-${project?.id ?? clientId}`}
            selectedClientId={clientId}
            projectLocation={{ ...location, clientId }}
            onProjectLocationChange={changes => visit({ ...location, clientId, ...changes })}
            onClientSelectionChange={id => visit(id ? { screen: 'projects', clientId: id } : { screen: 'projects' })}
            onCreateClient={onCreateClient} onOpenTask={openTask}/>
        );
        return <ProjectsScreen data={shellData} actions={projectActions} status={location.projectStatus}
          onStatusChange={projectStatus => visit({ screen: 'projects', projectStatus })}
          onOpenProject={project => visit({ screen: 'projects', clientId: project.clientId, projectId: project.id })}
          onOpenProperty={property => visit({ screen: 'projects', clientId: property.clientId, projectId: property.id })}/>;
      }
      case 'clients':
        if (effectiveRole === 'admin') {
          return (
            <AdminClientsHubScreen
              onOpenProject={projectId => visit({ screen: 'projects', projectId })}
              onManageProjects={() => visit({ screen: 'projects' })}
              actions={actions}
              currentUserId={workspaceUserId}
              data={shellData}
              key={`clients-${adminHubTarget.revision}`}
              selectedClientId={location.clientId ?? null}
              onClientSelectionChange={clientId => visit({ screen: 'clients', clientId: clientId ?? undefined })}
              onCreateClient={onCreateClient}
              onOpenProductionCalendar={(eventId) => {
                setOpenedCalendarEventId(eventId);
                navigate('calendar');
              }}
              onOpenReview={(reviewId) => {
                setOpenedReviewVersionId(undefined); setOpenedReviewId(reviewId);
                navigate('reviews');
              }}
              onOpenTask={openTask}
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
            onOpenTask={openTask}
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
              setOpenedReviewVersionId(undefined); setOpenedReviewId(reviewId);
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
              setOpenedReviewVersionId(undefined); setOpenedReviewId(reviewId);
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
        return <ReviewsScreen initialReviewId={openedReviewId} initialVersionId={openedReviewVersionId} currentUserId={hasLiveIdentity ? workspaceUserId : reviewPreview.currentUserId}
          jobs={shellData.jobs} properties={shellData.properties} reviews={shellData.reviews}
          onArchive={effectiveRole !== 'client' ? reviewActions?.archiveDeliverable : undefined}
          onComment={reviewActions?.reviewComment} onDecision={reviewActions?.reviewDecision} onResolve={reviewActions?.resolveReviewComment}
          onUploadVersion={effectiveRole !== 'client' ? reviewActions?.uploadReviewVersion : undefined}
          onUpload={effectiveRole !== 'client' ? reviewActions?.uploadDeliverable : undefined}
          onUpdate={effectiveRole !== 'client' ? reviewActions?.updateDeliverable : undefined} role={effectiveRole}/>;
      case 'tasks':
        return (
          <TasksScreen
            jobs={shellData.projectFoundationReady !== false ? shellData.jobs : undefined}
            projectSections={shellData.projectSections}
            archivedTasks={shellData.archivedTasks}
            clients={shellData.clients}
            currentUserId={workspaceUserId}
            location={location}
            onLocationChange={changeTaskLocation}
            onOpenClient={effectiveRole === 'admin' ? openClient : undefined}
            members={shellData.agencyMembers}
            onArchiveTask={effectiveRole !== 'client' ? projectActions?.archiveTask : undefined}
            onCreateTask={effectiveRole !== 'client' ? projectActions?.createTask : undefined}
            onDeleteAttachment={effectiveRole === 'admin' ? actions?.deleteTaskAttachment : undefined}
            onRestoreTask={effectiveRole !== 'client' ? projectActions?.restoreTask : undefined}
            onUpdateTask={effectiveRole !== 'client' ? projectActions?.updateTask : undefined}
            properties={shellData.properties}
            role={effectiveRole}
            tasks={shellData.tasks}
          />
        );
      case 'calendar':
        return (
          <>
            <CalendarScreen
              clients={shellData.clients}
              currentUserId={workspaceUserId}
              events={shellData.calendarEvents}
              gear={workspaceData?.gear}
              marketingContent={workspaceData?.marketingContent}
              members={shellData.agencyMembers}
              notes={workspaceData?.notes}
              initialEventId={openedCalendarEventId}
              onInitialEventOpened={() => setOpenedCalendarEventId(undefined)}
              onArchiveEvent={effectiveRole === 'admin' ? projectActions?.archiveEvent : undefined}
              onCreateEvent={projectActions?.createEvent}
              onCreateNote={actions?.createNote}
              onUpdateEvent={effectiveRole === 'admin' ? projectActions?.updateEvent : undefined}
              onSaveMarketingContent={effectiveRole === 'admin' ? actions?.upsertMarketingContent : undefined}
              onEditMarketingContent={effectiveRole === 'admin' ? setOpenedMarketingContentId : undefined}
              properties={shellData.properties}
              role={effectiveRole}
            />
            {effectiveRole === 'admin' ? (
              <MarketingItemEditor
                content={workspaceData?.marketingContent}
                initialContentId={openedMarketingContentId}
                members={shellData.agencyMembers}
                onArchive={actions?.archiveMarketingContent}
                onSave={actions?.upsertMarketingContent}
                onInitialContentOpened={() => setOpenedMarketingContentId(undefined)}
              />
            ) : null}
          </>
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
        return <DocumentsWorkspace key={visibleWorkspaceId} agencyId={agencyId ?? undefined} userId={workspaceUserId} role={effectiveRole} clientId={effectiveClientAccountId ?? undefined} jobs={shellData.jobs ?? []} properties={shellData.properties} pageId={location.pageId} onSelectPage={pageId=>visit({...location,pageId})} library={{
          folders:workspaceData?.companyDocumentFolders, documents:workspaceData?.companyDocuments,
          leadLists:[...new Set((workspaceData?.leads ?? []).map(lead=>lead.sourceList.trim()).filter(Boolean))],
          members:workspaceData?.agencyMembers,locale:resolvedUser.locale??'en',
          onArchiveDocument:actions?.archiveCompanyDocument,onDeleteFolder:actions?.deleteCompanyDocumentFolder,
          onMoveDocumentToFolder:actions?.moveCompanyDocumentToFolder,onSaveDocument:actions?.upsertCompanyDocument,onSaveFolder:actions?.upsertCompanyDocumentFolder,
        }}/>;
      case 'marketing':
        return effectiveRole === 'admin' ? (
          <MarketingScreen
            accounts={workspaceData?.instagramAccounts}
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
        return effectiveRole === 'admin' ? <ModulesScreen onStartSetup={onStartSetup} /> : null;
      case 'dashboard':
      default:
        return effectiveRole === 'admin' ? (
          <StudioHome data={workspaceData} onNavigate={navigate} onOpenTask={openTask} onOpenTaskView={openTaskView} onOpenClient={openClient} onOpenCalendarEvent={eventId => { setOpenedCalendarEventId(eventId); navigate('calendar'); }} userName={resolvedUser.name} />
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
              setOpenedReviewVersionId(undefined); setOpenedReviewId(reviewId);
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
        onOpenTaskNotification={taskId => visit({ screen: 'tasks', taskId })}
        onOpenReviewNotification={(reviewId,versionId) => { setOpenedReviewId(reviewId); setOpenedReviewVersionId(versionId); navigate('reviews'); }}
        onNavigateProjectStatus={projectStatus => visit({ screen: 'projects', projectStatus })}
        activeProjectStatus={visibleScreen === 'projects' ? location.projectStatus : undefined}
        onSelectWorkspace={onSelectWorkspace}
        onSearchSelect={(item) => {
          if (!item.targetId) return;
          if (item.screen === 'tasks') { openTask(item.targetId); return true; }
          if (item.screen === 'projects') {
            const project = shellData.jobs?.find(project => project.id === item.targetId) ?? shellData.properties?.find(property => property.id === item.targetId);
            if (project) visit({ screen: 'projects', projectId: project.id, clientId: project.clientId });
            return true;
          }
          if (item.screen === 'clients' || item.screen === 'properties') { openClient(item.targetId); return true; }
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
        organizationName={config.name}
        workspaces={workspaces?.map(workspace => workspace.agencyId === agencyId ? { ...workspace, name: config.name } : workspace)}
      >
        <div
          className="rm-page-transition"
          key={`${effectiveRole}-${visibleWorkspaceId}-${visibleScreen}`}
        >
          {workspaceError && <p role="alert">{workspaceError.message} <button type="button" onClick={retryWorkspace}>Try again</button></p>}
          {visibleScreen === 'dashboard' && effectiveRole === 'admin' ? <WorkspaceGettingStarted data={workspaceData} ready={dataReady} onNavigate={navigate} /> : null}
          {visibleScreen === 'dashboard' && role !== 'admin' ? <WorkspaceWelcome role={role} scope={`${agencyId}:${currentUserId}`} /> : null}
          {screen}
        </div>
      </PortalShell>
    </ToastProvider>
  );
}

export function PortalApp(props: PortalAppProps) {
  const scope = `${props.agencyId ?? 'preview'}:${props.currentUserId ?? props.role ?? 'admin'}`;
  const legacyScope = `${props.organizationName ?? 'studio'}:${props.currentUserId ?? props.role ?? 'admin'}`;
  return <WorkspaceProvider key={scope} scope={scope} legacyScope={legacyScope} agencyId={props.agencyId}
    currentUserId={props.currentUserId} organizationName={props.organizationName} role={props.role}>
    <WorkspaceEntry {...props} />
  </WorkspaceProvider>;
}

function WorkspaceEntry(props: PortalAppProps) {
  const { agency, loading, error, retry } = useWorkspace();
  const [setupOpen, setSetupOpen] = useState(false);
  const requested = Boolean(props.onboardingRequested && props.role === 'admin');
  const unavailable = requested && !props.agencyId;
  if ((requested || setupOpen) && (loading || error || unavailable)) return <main className="aw-setup"><div className="aw-setup__status">
    <h1>Getting your workspace ready.</h1><p role={error || unavailable ? 'alert' : 'status'}>{error?.message ?? (unavailable ? 'Your agency membership is not available yet. Please try again.' : 'Loading your saved setup…')}</p>
    {(error || unavailable) && <button type="button" onClick={unavailable ? () => window.location.reload() : retry}>Try again</button>}
    {props.onSignOut && <button type="button" onClick={props.onSignOut}>Sign out</button>}
  </div></main>;
  if (setupOpen || shouldOnboardAgency(agency, props.currentUserId, props.role ?? 'admin', requested)) {
    return <WorkspaceOnboarding onSignOut={props.onSignOut} onCancel={setupOpen ? () => setSetupOpen(false) : undefined} onComplete={() => {
      const url = new URL(window.location.href);
      url.searchParams.set('screen', 'dashboard');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      setSetupOpen(false);
    }} />;
  }
  return <PortalAppInner {...props} onStartSetup={() => setSetupOpen(true)} />;
}
export default PortalApp;
