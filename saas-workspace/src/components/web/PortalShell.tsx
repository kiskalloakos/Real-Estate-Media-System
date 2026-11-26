import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { type SidebarMode } from '@/workspace/modules';
import { agencyModuleIds, mobileNavigation, workspacePages } from '@/workspace/navigation';
import './WorkspaceNavigation.css';
import { useWorkspace } from '@/workspace/WorkspaceProvider';



import { AgencyAvatar } from '@/workspace/AgencyAvatar';
import { useToast } from './feedback';
import { Avatar, IconButton, Modal, cx } from './ui';
import { Icon, type IconName } from './Icon';
import {
  NotificationCenter,
  ProfileDialog,
  WorkspaceSearch,
  type PortalNotification,
  type PortalSearchItem,
} from './PortalOverlays';

export type PortalRole = 'admin' | 'team_member' | 'client';

export type PortalScreenKey =
  | 'agency'
  | 'modules'
  | 'dashboard'
  | 'documents'
  | 'sops'
  | 'clients'
  | 'projects'
  | 'sales'
  | 'team'
  | 'members'
  | 'properties'
  | 'analytics'
  | 'reviews'
  | 'tasks'
  | 'scripting'
  | 'calendar'
  | 'billing'
  | 'gear'
  | 'finances'
  | 'marketing'
  | 'notes';

export interface PortalUser {
  avatarUrl?: string;
  email?: string;
  name: string;
  locale?: 'en' | 'ro';
  phone?: string;
}

export interface NavigationItem {
  icon: IconName;
  key: PortalScreenKey;
  label: string;
  labelRo?: string;
  roles: PortalRole[];
}

const navigation: NavigationItem[] = [
  { icon: 'grid', key: 'dashboard', label: 'Dashboard', labelRo: 'Panou', roles: ['admin', 'team_member', 'client'] },
  { icon: 'file', key: 'documents', label: 'Documents', labelRo: 'Documente', roles: ['admin', 'team_member', 'client'] },
  { icon: 'file', key: 'sops', label: 'SOPs', labelRo: 'Proceduri', roles: ['team_member'] },
  { icon: 'users', key: 'clients', label: 'Clients', labelRo: 'Clienți', roles: ['admin'] },
  { icon: 'trend-up', key: 'sales', label: 'Sales', labelRo: 'Vânzări', roles: ['admin'] },
  { icon: 'briefcase', key: 'team', label: 'Team', labelRo: 'Echipă', roles: ['admin'] },
  { icon: 'trend-up', key: 'analytics', label: 'Analytics', labelRo: 'Analize', roles: ['client'] },
  { icon: 'play', key: 'reviews', label: 'Reviews', labelRo: 'Revizuiri', roles: ['client', 'team_member'] },
  { icon: 'list-check', key: 'tasks', label: 'Tasks', labelRo: 'Sarcini', roles: ['admin', 'team_member'] },
  { icon: 'file', key: 'scripting', label: 'Scripting', labelRo: 'Scripturi', roles: ['admin'] },
  {
    icon: 'calendar',
    key: 'calendar',
    label: 'Calendar',
    labelRo: 'Calendar',
    roles: ['admin', 'team_member', 'client'],
  },
  { icon: 'receipt', key: 'billing', label: 'Deal', labelRo: 'Acord', roles: ['client'] },
  { icon: 'camera', key: 'gear', label: 'Gear', labelRo: 'Echipamente', roles: ['admin'] },
  { icon: 'sparkles', key: 'marketing', label: 'Marketing', labelRo: 'Marketing', roles: ['admin'] },
  { icon: 'wallet', key: 'finances', label: 'Finances', labelRo: 'Finanțe', roles: ['admin'] },
];

/** The search palette and sidebar intentionally share this source of truth. */
export function portalNavigationForRole(role: PortalRole): NavigationItem[] {
  return navigation.filter((item) => item.roles.includes(role));
}

const sectionForScreen = (screen: PortalScreenKey) =>
  ['projects', 'reviews', 'scripting'].includes(screen) ? 'projects' as const
    : screen === 'agency' || agencyModuleIds.some(id => id === screen) ? 'agency' as const : null;

export interface PortalShellProps {
  activeScreen: PortalScreenKey;
  recordPath?: { name: string; section?: string; onBack: () => void; onOverview: () => void };
  children: ReactNode;
  notificationCount?: number;
  onClearNotifications?: () => Promise<void> | void;
  onMarkAllNotificationsRead?: () => Promise<void> | void;
  onDeleteNotification?: (notificationId: string) => Promise<void> | void;
  onNavigate: (screen: PortalScreenKey) => void;
  onSelectWorkspace?: (agencyId: string) => void;
  onReadNotification?: (notificationId: string) => Promise<void> | void;
  onOpenTaskNotification?: (taskId: string) => void;
  onOpenReviewNotification?: (reviewId: string, versionId?: string) => void;
  onSearchSelect?: (item: PortalSearchItem) => boolean | void;
  onSignOut?: () => void;
  onUpdateProfile?: (input: {
    avatarFile: File | null;
    fullName: string;
    locale: 'en' | 'ro';
    phone: string;
  }) => Promise<void>;
  organizationName?: string;
  notifications?: PortalNotification[];
  role: PortalRole;
  searchItems?: PortalSearchItem[];
  user: PortalUser;
  workspaces?: { agencyId: string; name: string }[];
  isAdminViewingWorkspace?: boolean;
  onReturnToOwnerWorkspace?: () => void;
}

export function PortalShell({
  activeScreen,
  recordPath,
  children,
  onMarkAllNotificationsRead,
  onClearNotifications,
  onDeleteNotification,
  onNavigate,
  onSelectWorkspace,
  onReadNotification,
  onOpenTaskNotification,
  onOpenReviewNotification,
  onSearchSelect,
  onSignOut,
  onUpdateProfile,
  notifications = [],
  organizationName,
  role,
  searchItems = [],
  user,
  workspaces = [],
  isAdminViewingWorkspace = false,
  onReturnToOwnerWorkspace,
}: PortalShellProps) {
  const { config, save, logoUrl } = useWorkspace();
  const [sidebarControlOpen, setSidebarControlOpen] = useState(false);
  const isRo = user.locale === 'ro';
  const { notify } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [previewReadIds, setPreviewReadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [previewClearedIds, setPreviewClearedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const activeWorkspace = workspaces.find((workspace) => workspace.name === organizationName) ?? workspaces[0];
  const visibleNavigation = useMemo(
    () => role === 'admin' ? workspacePages(config) : portalNavigationForRole(role),
    [role, config],
  );
  const mainNavigation = role === 'admin'
    ? ['dashboard', 'projects', 'clients', 'tasks', 'calendar', 'agency'].flatMap(key => visibleNavigation.filter(item => item.key === key))
    : visibleNavigation;
  const phoneNavigation = mobileNavigation(visibleNavigation, role);
  const phoneSection = role === 'admin' ? sectionForScreen(activeScreen) ?? activeScreen : activeScreen;
  const moreActive = !phoneNavigation.some(item => item.key === phoneSection);
  const pageTitle = activeScreen === 'modules' ? (isRo ? 'Setări' : 'Settings') : activeScreen === 'notes' ? (isRo ? 'Notițe' : 'Notes') : visibleNavigation.find(item => item.key === activeScreen)?.label ?? activeScreen;
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((notification) => !previewClearedIds.has(notification.id)).map((notification) => ({
        ...notification,
        read:
          notification.read ||
          (!onReadNotification && previewReadIds.has(notification.id)),
      })),
    [notifications, onReadNotification, previewClearedIds, previewReadIds],
  );
  const unreadCount = visibleNotifications.filter((item) => !item.read).length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);


  const navigate = (screen: PortalScreenKey) => {
    setMobileMenuOpen(false);
    onNavigate(screen);
  };

  const selectNotification = (notification: PortalNotification) => {
    if (!notification.read) {
      if (onReadNotification) {
        void onReadNotification(notification.id);
      } else {
        setPreviewReadIds(
          (current) => new Set([...current, notification.id]),
        );
      }
    }
    setNotificationOpen(false);
    if (notification.taskId && onOpenTaskNotification) {
      setMobileMenuOpen(false);
      onOpenTaskNotification(notification.taskId);
    } else if (notification.reviewId && onOpenReviewNotification) {
      setMobileMenuOpen(false);
      onOpenReviewNotification(notification.reviewId, notification.versionId);
    } else navigate(notification.screen);
  };

  const saveProfile = async (input: {
    avatarFile: File | null;
    fullName: string;
    locale: 'en' | 'ro';
    phone: string;
  }) => {
    if (!onUpdateProfile) throw new Error('Profile editing is unavailable in this workspace.');
    await onUpdateProfile(input);
    notify(isRo ? 'Profilul a fost actualizat.' : 'Your profile has been updated.');
  };

  return (
    <div className={`aw-shell aw-sidebar-mode-${config.sidebarMode}`}>
      <a className="rm-skip-link" href="#aw-main-content">
        {isRo ? 'Sari la conținut' : 'Skip to content'}
      </a>

      <header className="aw-topbar">
        <div className="aw-topbar__left">
          {workspaces.length > 1 && activeWorkspace ? (
            <div className="aw-workspace-switcher">
              <button aria-expanded={workspaceMenuOpen} className="aw-workspace-switcher__trigger" onClick={() => setWorkspaceMenuOpen((open) => !open)} type="button">
                <span>{activeWorkspace.name}</span><Icon name="chevron-down" size={15}/>
              </button>
              {workspaceMenuOpen ? <div className="aw-workspace-switcher__menu" role="menu">
                {workspaces.map((workspace) => <button aria-checked={workspace.agencyId === activeWorkspace.agencyId} key={workspace.agencyId} onClick={() => { onSelectWorkspace?.(workspace.agencyId); setWorkspaceMenuOpen(false); }} role="menuitemradio" type="button"><span>{workspace.name}</span>{workspace.agencyId === activeWorkspace.agencyId ? <Icon name="check" size={15}/> : null}</button>)}
              </div> : null}
            </div>
          ) : null}
          {recordPath ? (
            <nav className="aw-record-path" aria-label="Workspace location">
              <button aria-label={pageTitle} className="aw-record-path__parent" type="button" onClick={recordPath.onBack}>
                <Icon name="chevron-left" size={16} /><span>{pageTitle}</span>
              </button>
              <div className="aw-record-path__location">
                {recordPath.section ? (
                  <button className="aw-record-path__name" title={recordPath.name} type="button" onClick={recordPath.onOverview}>{recordPath.name}</button>
                ) : <strong className="aw-record-path__name" title={recordPath.name} aria-current="page">{recordPath.name}</strong>}
                {recordPath.section && <span className="aw-record-path__section" aria-current="page"><Icon name="chevron-right" size={14} />{recordPath.section}</span>}
              </div>
            </nav>
          ) : <>
            <div className="aw-breadcrumb"><span>{organizationName ?? 'Workspace'}</span><Icon name="chevron-right" size={14}/><strong>{pageTitle}</strong></div>
            <div className="aw-mobile-brand"><AgencyAvatar name={config.name} logoUrl={logoUrl}/><span><small>{config.name}</small><strong>{pageTitle}</strong></span></div>
          </>}
        </div>

        <button
          aria-label={isRo ? 'Deschide căutarea' : 'Open workspace search'}
          className="aw-search"
          onClick={() => setSearchOpen(true)}
          type="button"
        >
          <Icon name="search" size={18} />
          <span className="aw-search__hint">Search anything…</span><kbd>⌘ K</kbd>
        </button>

        <div className="aw-topbar__right">
          <IconButton
            className={cx('rm-notification-button', unreadCount === 0 && 'is-empty')}
            icon="bell"
            label={`${unreadCount} unread notifications`}
            onClick={() => setNotificationOpen(true)}
          />
          <button
            aria-label="Open profile settings"
            className="aw-topbar__profile"
            disabled={!onUpdateProfile}
            onClick={() => setProfileOpen(true)}
            type="button"
          >
            <Avatar name={user.name} size="sm" src={user.avatarUrl} />
          </button>
        </div>
      </header>

      {isAdminViewingWorkspace && onReturnToOwnerWorkspace ? (
        <button
          aria-label="Return to owner workspace"
          className="aw-workspace-return"
          onClick={onReturnToOwnerWorkspace}
          type="button"
        >
          <Icon name="chevron-left" size={17} />
          <span>{isRo ? 'Înapoi la spațiul tău' : 'Back to owner workspace'}</span>
        </button>
      ) : null}

      <aside
        aria-label="Primary navigation"
        className={cx('aw-sidebar', sidebarControlOpen && 'has-control-open')}
      >
        <div className="aw-studio-brand"><AgencyAvatar name={config.name} logoUrl={logoUrl} /><div><strong title={config.name}>{config.name}</strong></div></div>
        <div className="aw-nav-caption">WORKSPACE</div>
        <nav className="aw-nav">
          <ul>
            {mainNavigation.map((item) => {
              const active = activeScreen === item.key || (role === 'admin' && sectionForScreen(activeScreen) === item.key);
              return (
                <li key={item.key}>
                  <button
                    aria-label={item.label}
                    title={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={cx('aw-nav__item', active && 'is-active')}
                    onClick={() => navigate(item.key)}
                    type="button"
                  >
                    <span className="aw-nav__icon">
                      <Icon name={item.icon} size={19} />
                    </span>
                    <span className="aw-nav__text">
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="aw-sidebar-bottom">
          {role === 'admin' ? <button aria-current={activeScreen === "modules" ? "page" : undefined} aria-label="Customize workspace" title="Customize workspace" className={cx('aw-customize', activeScreen === 'modules' && 'is-active')} onClick={() => navigate('modules')}><Icon name="settings" size={18}/><span>Customize workspace</span></button> : null}
        </div>
        <div className="aw-sidebar-control" onPointerEnter={() => setSidebarControlOpen(true)} onPointerLeave={() => setSidebarControlOpen(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSidebarControlOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setSidebarControlOpen(false); } }}>
          <button type="button" className="aw-sidebar-control-trigger" aria-label="Sidebar control" title="Sidebar control" aria-expanded={sidebarControlOpen} aria-controls="aw-sidebar-options" onClick={() => setSidebarControlOpen(true)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setSidebarControlOpen(true); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('#aw-sidebar-options button')?.focus()); } }}><Icon name="menu" size={18}/><span>Sidebar control</span></button>
          {sidebarControlOpen ? <div className="aw-sidebar-popover" id="aw-sidebar-options" role="group" aria-label="Sidebar mode"><strong>Sidebar control</strong>{([{id:'expanded',label:'Expanded'},{id:'collapsed',label:'Collapsed'},{id:'hover',label:'Expand on hover'}] as {id:SidebarMode;label:string}[]).map(option => <button type="button" key={option.id} aria-pressed={config.sidebarMode === option.id} onClick={() => { save({...config,sidebarMode:option.id}); setSidebarControlOpen(false); }}><span aria-hidden="true">{config.sidebarMode === option.id ? '●' : ''}</span>{option.label}</button>)}</div> : null}
        </div>
      </aside>

      <div className="aw-frame">
        <main className={cx('aw-main', activeScreen !== 'tasks' && activeScreen !== 'dashboard' && 'aw-refined')} data-workspace-screen={activeScreen} id="aw-main-content" tabIndex={-1}>
          <div className="aw-main__inner" id="aw-feature-content">{children}</div>
        </main>
      </div>

      <nav aria-label={isRo ? 'Navigare principală' : 'Phone navigation'} className="aw-bottom-nav" style={{ gridTemplateColumns: `repeat(${phoneNavigation.length + 1},minmax(0,1fr))` }}>
        {phoneNavigation.map(item => <button aria-current={!mobileMenuOpen && phoneSection === item.key ? 'page' : undefined} key={item.key} onClick={() => navigate(item.key)} type="button"><Icon name={item.icon} size={22}/><span>{item.key === 'dashboard' ? (isRo ? 'Acasă' : 'Home') : item.label}</span></button>)}
        <button aria-current={!mobileMenuOpen && moreActive ? 'page' : undefined} aria-expanded={mobileMenuOpen} aria-haspopup="dialog" onClick={() => setMobileMenuOpen(true)} type="button"><Icon name="menu" size={22}/><span>{isRo ? 'Mai mult' : 'More'}</span></button>
      </nav>

      <Modal className="aw-mobile-menu-modal" onClose={() => setMobileMenuOpen(false)} open={mobileMenuOpen} title={isRo ? 'Mai mult' : 'More'}>
        <nav aria-label={isRo ? 'Mai multe pagini' : 'More pages'} className="aw-mobile-menu-links">
          {mainNavigation.filter(item => !phoneNavigation.some(phone => phone.key === item.key)).map(item => <button aria-current={phoneSection === item.key ? 'page' : undefined} key={item.key} onClick={() => navigate(item.key)} type="button"><Icon name={item.icon} size={22}/><span>{item.label}</span><Icon name="chevron-right" size={18}/></button>)}
          {role === 'admin' ? <button aria-current={activeScreen === 'modules' ? 'page' : undefined} onClick={() => navigate('modules')} type="button"><Icon name="settings" size={22}/><span>{isRo ? 'Setări' : 'Workspace settings'}</span><Icon name="chevron-right" size={18}/></button> : null}
        </nav>
        <div className="aw-mobile-account"><Avatar name={user.name} src={user.avatarUrl}/><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
        <div className="aw-mobile-account-actions">
          {onUpdateProfile ? <button onClick={() => { setMobileMenuOpen(false); setProfileOpen(true); }} type="button"><Icon name="users" size={19}/>{isRo ? 'Profilul meu' : 'My profile'}</button> : null}
          {workspaces.length > 1 ? <label>{isRo ? 'Spațiu de lucru' : 'Workspace'}<select aria-label="Switch workspace" value={activeWorkspace?.agencyId ?? ''} onChange={event => { onSelectWorkspace?.(event.target.value); setMobileMenuOpen(false); }}>{workspaces.map(workspace => <option value={workspace.agencyId} key={workspace.agencyId}>{workspace.name}</option>)}</select></label> : null}
          {onSignOut ? <button onClick={() => { setMobileMenuOpen(false); onSignOut(); }} type="button"><Icon name="arrow-right" size={19}/>{isRo ? 'Deconectare' : 'Sign out'}</button> : null}
        </div>
      </Modal>

      <WorkspaceSearch
        items={searchItems}
        onClose={() => setSearchOpen(false)}
        onSelect={(item) => {
          setSearchOpen(false);
          if (onSearchSelect?.(item) !== true) navigate(item.screen);
        }}
        open={searchOpen}
      />
      <NotificationCenter
        notifications={visibleNotifications}
        onClear={() => {
          if (onClearNotifications) {
            return onClearNotifications();
          } else {
            setPreviewClearedIds((previous) => new Set([...previous, ...visibleNotifications.map((notification) => notification.id)]));
          }
        }}
        onDelete={onDeleteNotification ?? ((id) => setPreviewClearedIds((previous) => new Set([...previous, id])))}
        onClose={() => setNotificationOpen(false)}
        onMarkAllRead={() => {
          if (onMarkAllNotificationsRead) {
            return onMarkAllNotificationsRead();
          } else {
            setPreviewReadIds((previous) => new Set([...previous, ...visibleNotifications.map((notification) => notification.id)]));
          }
        }}
        onSelect={selectNotification}
        open={notificationOpen}
      />
      {profileOpen ? (
        <ProfileDialog
          onClose={() => setProfileOpen(false)}
          onSave={saveProfile}
          onSignOut={onSignOut}
          open
          user={user}
        />
      ) : null}
    </div>
  );
}
