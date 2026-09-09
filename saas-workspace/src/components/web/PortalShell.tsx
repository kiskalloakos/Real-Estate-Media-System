import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { modules, type SidebarMode } from '@/workspace/modules';
import { useWorkspace } from '@/workspace/WorkspaceProvider';



import realtyMark from '../../../assets/images/realty-media-mark-black.png';
import { useToast } from './feedback';
import { Avatar, IconButton, cx } from './ui';
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
  | 'modules'
  | 'dashboard'
  | 'documents'
  | 'sops'
  | 'clients'
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
  { icon: 'file', key: 'documents', label: 'Documents', labelRo: 'Documente', roles: ['admin'] },
  { icon: 'file', key: 'sops', label: 'SOPs', labelRo: 'Proceduri', roles: ['team_member'] },
  { icon: 'users', key: 'clients', label: 'Clients', labelRo: 'Clienți', roles: ['admin'] },
  { icon: 'trend-up', key: 'sales', label: 'Sales', labelRo: 'Vânzări', roles: ['admin'] },
  { icon: 'briefcase', key: 'team', label: 'Team', labelRo: 'Echipă', roles: ['admin'] },
  { icon: 'trend-up', key: 'analytics', label: 'Analytics', labelRo: 'Analize', roles: ['client'] },
  { icon: 'play', key: 'reviews', label: 'Reviews', labelRo: 'Revizuiri', roles: ['client'] },
  { icon: 'list-check', key: 'tasks', label: 'Tasks', labelRo: 'Sarcini', roles: ['admin', 'team_member'] },
  { icon: 'file', key: 'scripting', label: 'Scripting', labelRo: 'Scripturi', roles: ['admin'] },
  {
    icon: 'calendar',
    key: 'calendar',
    label: 'Calendar',
    labelRo: 'Calendar',
    roles: ['admin', 'team_member'],
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

export interface PortalShellProps {
  activeScreen: PortalScreenKey;
  children: ReactNode;
  notificationCount?: number;
  onClearNotifications?: () => Promise<void> | void;
  onMarkAllNotificationsRead?: () => Promise<void> | void;
  onDeleteNotification?: (notificationId: string) => Promise<void> | void;
  onNavigate: (screen: PortalScreenKey) => void;
  onSelectWorkspace?: (agencyId: string) => void;
  onReadNotification?: (notificationId: string) => Promise<void> | void;
  onSearchSelect?: (item: PortalSearchItem) => void;
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
  workspaces?: Array<{ agencyId: string; name: string }>;
  isAdminViewingWorkspace?: boolean;
  onReturnToOwnerWorkspace?: () => void;
}

export function PortalShell({
  activeScreen,
  children,
  onMarkAllNotificationsRead,
  onClearNotifications,
  onDeleteNotification,
  onNavigate,
  onSelectWorkspace,
  onReadNotification,
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
  const { config, save } = useWorkspace();
  const [sidebarControlOpen, setSidebarControlOpen] = useState(false);
  const isRo = user.locale === 'ro';
  const { notify } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
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
    () => role === 'admin' ? [
      { key: 'dashboard' as const, label: 'Overview', icon: 'grid' as const },
      ...config.order.filter(id => config.enabled.includes(id)).map(id => { const m = modules.find(m => m.id === id)!; return { key: m.id, label: m.label, icon: m.icon }; }),
    ] : portalNavigationForRole(role),
    [role, config],
  );
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

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousFocus = document.activeElement as HTMLElement | null;
    const sidebar = document.querySelector<HTMLElement>('.aw-sidebar');
    const focusable = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input') ?? []);
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    const scrollContainer = document.querySelector<HTMLElement>('.aw-frame');
    const previousOverflow = scrollContainer?.style.overflow ?? document.body.style.overflow;
    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (scrollContainer) {
        scrollContainer.style.overflow = previousOverflow;
      } else {
        document.body.style.overflow = previousOverflow;
      }
      document.removeEventListener('keydown', trap);
      previousFocus?.focus();
    };
  }, [mobileOpen]);

  const navigate = (screen: PortalScreenKey) => {
    setMobileOpen(false);
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
    navigate(notification.screen);
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

      <button
        aria-label="Close navigation"
        className={cx('aw-sidebar-scrim', mobileOpen && 'is-visible')}
        onClick={() => setMobileOpen(false)}
        type="button"
      />

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
          <div className="aw-breadcrumb"><span>{organizationName ?? 'Workspace'}</span><Icon name="chevron-right" size={14}/><strong>{activeScreen === 'modules' ? 'Customize' : visibleNavigation.find(item => item.key === activeScreen)?.label ?? activeScreen}</strong></div>
          <IconButton
            className="aw-topbar__menu"
            icon="menu"
            label="Open navigation"
            onClick={() => setMobileOpen(true)}
          />
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
        aria-modal={mobileOpen ? 'true' : undefined}
        className={cx('aw-sidebar', mobileOpen && 'is-mobile-open', sidebarControlOpen && 'has-control-open')}
        role={mobileOpen ? 'dialog' : undefined}
      >
        <div className="aw-sidebar__mobile-header">
          <span className="aw-sidebar__mobile-title">{isRo ? 'Meniu' : 'Menu'}</span>
          <IconButton
            className="aw-sidebar__mobile-close"
            icon="x"
            label="Close navigation"
            onClick={() => setMobileOpen(false)}
            size="sm"
          />
        </div>

        <div className="aw-studio-brand"><img className="aw-original-mark" src={realtyMark} alt="Realty Media"/><div><strong title={config.name}>{config.name}</strong><small>AGENCY WORKSPACE</small></div></div>
        <div className="aw-workspace-label"><span className="aw-workspace-avatar">{config.name.slice(0,1).toUpperCase()}</span><div><strong>{config.name}</strong><small>{role === 'admin' ? 'Agency workspace' : role === 'client' ? 'Client portal' : 'Team workspace'}</small></div></div>
        <div className="aw-nav-caption">WORKSPACE</div>
        <nav className="aw-nav">
          <ul>
            {visibleNavigation.map((item) => {
              const active = activeScreen === item.key;
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
          {role === 'admin' ? <button aria-label="Customize workspace" title="Customize workspace" className={cx('aw-customize', activeScreen === 'modules' && 'is-active')} onClick={() => navigate('modules')}><Icon name="settings" size={18}/><span>Customize workspace</span></button> : null}
        </div>
        <div className="aw-sidebar-control" onPointerEnter={() => setSidebarControlOpen(true)} onPointerLeave={() => setSidebarControlOpen(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSidebarControlOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setSidebarControlOpen(false); } }}>
          <button type="button" className="aw-sidebar-control-trigger" aria-label="Sidebar control" title="Sidebar control" aria-expanded={sidebarControlOpen} aria-controls="aw-sidebar-options" onClick={() => setSidebarControlOpen(true)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setSidebarControlOpen(true); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('#aw-sidebar-options button')?.focus()); } }}><Icon name="menu" size={18}/><span>Sidebar control</span></button>
          {sidebarControlOpen ? <div className="aw-sidebar-popover" id="aw-sidebar-options" role="group" aria-label="Sidebar mode"><strong>Sidebar control</strong>{([{id:'expanded',label:'Expanded'},{id:'collapsed',label:'Collapsed'},{id:'hover',label:'Expand on hover'}] as {id:SidebarMode;label:string}[]).map(option => <button type="button" key={option.id} aria-pressed={config.sidebarMode === option.id} onClick={() => { save({...config,sidebarMode:option.id}); setSidebarControlOpen(false); }}><span aria-hidden="true">{config.sidebarMode === option.id ? '●' : ''}</span>{option.label}</button>)}</div> : null}
        </div>
      </aside>

      <div className="aw-frame">
        <main className="aw-main" id="aw-main-content" tabIndex={-1}>
          <div className="aw-main__inner">{children}</div>
        </main>
      </div>

      <WorkspaceSearch
        items={searchItems}
        onClose={() => setSearchOpen(false)}
        onSelect={(item) => {
          setSearchOpen(false);
          onSearchSelect?.(item);
          navigate(item.screen);
        }}
        open={searchOpen}
      />
      <NotificationCenter
        notifications={visibleNotifications}
        onClear={() => {
          if (onClearNotifications) {
            void onClearNotifications();
          } else {
            setPreviewClearedIds(new Set(visibleNotifications.map((notification) => notification.id)));
          }
        }}
        onDelete={onDeleteNotification}
        onClose={() => setNotificationOpen(false)}
        onMarkAllRead={() => {
          if (onMarkAllNotificationsRead) {
            void onMarkAllNotificationsRead();
          } else {
            setPreviewReadIds(
              new Set(visibleNotifications.map((notification) => notification.id)),
            );
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
