import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { Icon, type IconName } from './Icon';
import type { PortalScreenKey, PortalUser } from './PortalShell';
import { Avatar, Button, Modal, StatusPill } from './ui';

export interface PortalSearchItem {
  detail: string;
  icon: IconName;
  id: string;
  screen: PortalScreenKey;
  targetId?: string;
  title: string;
}

export interface PortalNotification {
  body: string;
  id: string;
  read: boolean;
  screen: PortalScreenKey;
  timeLabel: string;
  title: string;
}

interface WorkspaceSearchProps {
  items: PortalSearchItem[];
  onClose: () => void;
  onSelect: (item: PortalSearchItem) => void;
  open: boolean;
}

export function WorkspaceSearch({
  items,
  onClose,
  onSelect,
  open,
}: WorkspaceSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return items.slice(0, 10);
    return items
      .filter((item) =>
        `${item.title} ${item.detail}`.toLowerCase().includes(normalized),
      )
      .slice(0, 12);
  }, [deferredQuery, items]);

  useLayoutEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <Modal
      className="aw-clean-dialog aw-search-dialog"
      description="Jump to a client, property, review, event, or workspace page."
      onClose={() => {
        setQuery('');
        onClose();
      }}
      open={open}
      title="Search Realty Media"
    >
      <div className="rm-command">
        <label className="rm-command__input">
          <Icon name="search" size={19} />
          <span className="rm-visually-hidden">Search the workspace</span>
          <input
            autoFocus
            data-modal-autofocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a client, file, property…"
            ref={inputRef}
            type="search"
            value={query}
          />
          <kbd>ESC</kbd>
        </label>
        <div className="rm-command__results">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setQuery('');
                onSelect(item);
              }}
              type="button"
            >
              <span className="rm-command__icon">
                <Icon name={item.icon} size={17} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <Icon name="arrow-right" size={16} />
            </button>
          ))}
          {!results.length ? (
            <div className="rm-command__empty">
              <Icon name="search" size={22} />
              <strong>No matching workspace items</strong>
              <span>Try a client name, property, review, or page name.</span>
            </div>
          ) : null}
        </div>
        <footer className="rm-command__footer">
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>⌘K</kbd> Search anywhere</span>
        </footer>
      </div>
    </Modal>
  );
}

interface NotificationCenterProps {
  notifications: PortalNotification[];
  onClose: () => void;
  onClear: () => void;
  onDelete?: (notificationId: string) => Promise<void> | void;
  onMarkAllRead: () => void;
  onSelect: (notification: PortalNotification) => void;
  open: boolean;
}

export function NotificationCenter({
  notifications,
  onClose,
  onClear,
  onDelete,
  onMarkAllRead,
  onSelect,
  open,
}: NotificationCenterProps) {
  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <Modal
      className="rm-notification-modal"
      onClose={onClose}
      open={open}
      title="Notifications"
    >
      <div className="rm-notification-center">
        {notifications.length ? (
          <div className="rm-notification-center__toolbar">
            {unreadCount ? <StatusPill tone="accent">{`${unreadCount} unread`}</StatusPill> : <span />}
            <div>
              {unreadCount ? <Button onClick={onMarkAllRead} variant="ghost">Mark all as read</Button> : null}
              <Button onClick={onClear} variant="ghost">Clear</Button>
            </div>
          </div>
        ) : null}
        <div className="rm-notification-list">
          {notifications.map((notification) => {
            return (
              <div className="rm-notification-list__row" key={notification.id}>
                <button
                  className={notification.read ? 'is-read' : undefined}
                  onClick={() => onSelect(notification)}
                  type="button"
                >
                  <span className="rm-notification-list__dot" />
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{notification.body}</small>
                    <time>{notification.timeLabel}</time>
                  </span>
                  <Icon name="chevron-right" size={16} />
                </button>
                {onDelete ? (
                  <span
                    aria-label={`Delete ${notification.title}`}
                    className="rm-notification-list__delete"
                    onClick={() => void onDelete(notification.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void onDelete(notification.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <Icon name="x" size={16} />
                  </span>
                ) : null}
              </div>
            );
          })}
          {!notifications.length ? (
            <div className="rm-command__empty">
              <Icon name="check" size={22} />
              <strong>No notifications yet</strong>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

interface ProfileDialogProps {
  onClose: () => void;
  onSignOut?: () => void;
  onSave: (input: {
    avatarFile: File | null;
    fullName: string;
    locale: 'en' | 'ro';
    phone: string;
  }) => Promise<void>;
  open: boolean;
  user: PortalUser;
}

export function ProfileDialog({
  onClose,
  onSignOut,
  onSave,
  open,
  user,
}: ProfileDialogProps) {
  const isRo = user.locale === 'ro';
  const [fullName, setFullName] = useState(user.name);
  const [locale, setLocale] = useState<'en' | 'ro'>(user.locale ?? 'en');
  const [phone, setPhone] = useState(user.phone || '+40 ');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const previewUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : user.avatarUrl),
    [avatarFile, user.avatarUrl],
  );

  useEffect(() => {
    return () => {
      if (avatarFile && previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [avatarFile, previewUrl]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ avatarFile, fullName, locale, phone });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      className="aw-clean-dialog aw-profile-dialog"
      description={isRo ? 'Actualizează identitatea afișată în spațiul Realty Media.' : 'Update the identity shown throughout the Realty Media workspace.'}
      onClose={onClose}
      open={open}
      title={isRo ? 'Profilul tău' : 'Your profile'}
    >
      <form className="rm-profile-form" onSubmit={submit}>
        {error ? <div className="rm-feedback rm-feedback--error" role="alert">{error}</div> : null}
        <div className="rm-profile-form__identity">
          <Avatar name={fullName || user.name} size="xl" src={previewUrl} />
          <label className="rm-button rm-button--secondary">
            <Icon name="upload" size={16} />
            <span>{isRo ? 'Alege fotografia' : 'Choose photo'}</span>
            <input
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="rm-visually-hidden"
              onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        </div>
        <label className="rm-field">
          <span>{isRo ? 'Nume complet' : 'Full name'}</span>
          <input
            autoComplete="name"
            onChange={(event) => setFullName(event.target.value)}
            required
            value={fullName}
          />
        </label>
        <fieldset className="rm-language-field">
          <legend>{isRo ? 'Limba interfeței' : 'Interface language'}</legend>
          <div aria-label={isRo ? 'Limba interfeței' : 'Interface language'} className="rm-language-switch">
            {(['en', 'ro'] as const).map((value) => (
              <Button
                aria-pressed={locale === value}
                className="rm-language-switch__option"
                key={value}
                onClick={() => setLocale(value)}
                type="button"
                variant={locale === value ? 'blue' : 'white'}
              >
                {value.toUpperCase()}
              </Button>
            ))}
          </div>
          <small>{isRo ? 'Interfața își schimbă limba după salvare.' : 'The interface changes language after saving.'}</small>
        </fieldset>
        <label className="rm-field">
          <span>{isRo ? 'Adresă de e-mail' : 'Email address'}</span>
          <input disabled type="email" value={user.email ?? ''} />
          <small>{isRo ? 'Pentru a schimba adresa de e-mail, contactează-ne la soma@realtymedia.ro' : 'To change your email, contact soma@realtymedia.ro'}</small>
        </label>
        <label className="rm-field">
          <span>{isRo ? 'Număr de telefon' : 'Phone number'}</span>
          <input
            autoComplete="tel"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+40 7…"
            type="tel"
            value={phone}
          />
        </label>
        <footer className="rm-profile-actions">
          <Button
            className="rm-profile-actions__signout"
            disabled={saving}
            onClick={onSignOut}
            type="button"
            variant="secondary"
          >
            {isRo ? 'Deconectare' : 'Sign out'}
          </Button>
          <div>
            <Button disabled={saving} onClick={onClose} variant="secondary">{isRo ? 'Anulează' : 'Cancel'}</Button>
            <Button disabled={saving || !fullName.trim()} type="submit">
              {saving ? (isRo ? 'Se salvează…' : 'Saving…') : (isRo ? 'Salvează profilul' : 'Save profile')}
            </Button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
