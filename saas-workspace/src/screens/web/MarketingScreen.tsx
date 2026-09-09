import { useEffect, useState, type FormEvent } from 'react';

import {
  Button,
  Modal,
  ScriptReader,
  type ScriptReaderData,
  useToast,
} from '@/components/web';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import { clearLocalDraft, useLocalDraft } from '@/hooks/use-local-draft';

import { InstagramAnalyticsScreen } from './InstagramAnalyticsScreen';
import { CalendarScreen } from './CalendarScreen';
import { ScreenTabs } from './shared';
import type {
  AgencyMemberSummary,
  InstagramAccountSummary,
  MarketingContentStatus,
  MarketingContentSummary,
  TikTokAccountSummary,
  UpsertMarketingContentInput,
} from './types';

type MarketingTab = 'calendar' | 'analytics';

export interface MarketingScreenProps {
  accounts?: InstagramAccountSummary[];
  content?: MarketingContentSummary[];
  initialTab?: MarketingTab;
  initialContentId?: string;
  locale?: 'en' | 'ro';
  members?: AgencyMemberSummary[];
  tiktokAccounts?: TikTokAccountSummary[];
  onArchive?: (contentId: string) => Promise<void>;
  onSave?: (input: UpsertMarketingContentInput) => Promise<void>;
  onInitialContentOpened?: () => void;
  onTabChange?: (tab: MarketingTab) => void;
}

const statuses: { label: string; value: MarketingContentStatus }[] = [
  { label: 'Idea', value: 'idea' },
  { label: 'Draft', value: 'draft' },
  { label: 'Ready', value: 'ready' },
  { label: 'Published', value: 'published' },
];

function localInputDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.valueOf() - offset).toISOString().slice(0, 16);
}

function schedulePart(value: string | undefined, part: 'date' | 'time') {
  const fallback = part === 'date' ? '' : '09:00';
  if (!value) return fallback;
  return part === 'date' ? value.slice(0, 10) : value.slice(11, 16) || fallback;
}

function scheduleValue(date: string, time: string) {
  return date ? `${date}T${time || '09:00'}` : '';
}

export function MarketingScreen({
  accounts = [],
  content = [],
  initialContentId,
  initialTab = 'calendar',
  locale = 'en',
  members = [],
  onArchive,
  onSave,
  onInitialContentOpened,
  onTabChange,
  tiktokAccounts = [],
}: MarketingScreenProps) {
  const isRo = locale === 'ro';
  const { notify } = useToast();
  const [storedTab, setTab] = useBrowserPersistedState<MarketingTab | 'scripts'>(
    'rm:marketing-state:tab',
    initialTab,
  );
  const tab: MarketingTab = storedTab === 'analytics' ? 'analytics' : 'calendar';
  const [editing, setEditing] = useState<UpsertMarketingContentInput | null>(null);
  const [scriptReaderOpen, setScriptReaderOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const marketingDraftKey = 'rm:draft:marketing';
  const activeMembers = members.filter((member) => member.status === 'active');
  const scriptReaderData: ScriptReaderData | null = editing ? {
    assignees: (editing.assigneeUserIds ?? []).map((userId) => activeMembers.find((member) => member.userId === userId)?.name).filter((name): name is string => Boolean(name)),
    caption: editing.caption,
    platform: editing.platform,
    schedule: editing.plannedFor ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: editing.allDay ? undefined : 'short' }).format(new Date(editing.plannedFor)) : undefined,
    script: editing.body,
    status: editing.status,
    title: editing.title || 'Untitled script',
  } : null;
  useLocalDraft(marketingDraftKey, editing, Boolean(editing && !editing.contentId), (draft) => Boolean(draft?.title.trim() || draft?.body.trim() || draft?.caption.trim()));

  useEffect(() => {
    if (storedTab === 'scripts') setTab('calendar');
  }, [setTab, storedTab]);

  const editItem = (item: MarketingContentSummary) => setEditing({
    assigneeUserIds: item.assigneeUserIds ?? [],
    body: item.body,
    caption: item.caption,
    contentId: item.id,
    contentType: item.contentType,
    allDay: Boolean(item.allDay),
    plannedFor: localInputDate(item.plannedFor),
    plannedUntil: localInputDate(item.plannedUntil ?? item.plannedFor),
    platform: item.platform,
    status: item.status,
    title: item.title,
  });

  useEffect(() => {
    if (!initialContentId) return;
    const item = content.find((entry) => entry.id === initialContentId);
    if (!item) return;
    const timeoutId = window.setTimeout(() => {
      setTab('calendar');
      setEditing({
        assigneeUserIds: item.assigneeUserIds ?? [],
        body: item.body,
        caption: item.caption,
        contentId: item.id,
        contentType: item.contentType,
        allDay: Boolean(item.allDay),
        plannedFor: localInputDate(item.plannedFor),
        plannedUntil: localInputDate(item.plannedUntil ?? item.plannedFor),
        platform: item.platform,
        status: item.status,
        title: item.title,
      });
      onInitialContentOpened?.();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [content, initialContentId, onInitialContentOpened, setTab]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !onSave) return;
    setSaving(true);
    try {
      await onSave(editing);
      clearLocalDraft(marketingDraftKey);
      notify(editing.contentId ? 'Marketing item updated.' : 'Marketing item added.');
      setEditing(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the marketing item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rm-page rm-marketing">
      <div className="rm-hub-tabs-toolbar">
        <div className="rm-hub-tabs-wrap">
          <ScreenTabs
            active={tab}
            items={[
              { count: content.length, key: 'calendar', label: isRo ? 'Calendar conținut' : 'Content calendar' },
              {
                count: accounts.filter((account) => account.clientId === null).length,
                key: 'analytics',
                label: isRo ? 'Analize' : 'Analytics',
              },
            ]}
            label="Marketing sections"
            onChange={(nextTab) => {
              setTab(nextTab);
              onTabChange?.(nextTab);
            }}
          />
        </div>
      </div>

      {tab === 'analytics' ? (
        <InstagramAnalyticsScreen
          accounts={accounts}
          role="admin"
          scope="agency"
          tiktokAccounts={tiktokAccounts}
        />
      ) : tab === 'calendar' ? (
        <CalendarScreen
          currentUserId="marketing"
          embedded
          events={[]}
          forceCalendarFilter="marketing"
          marketingContent={content}
          members={members}
          onEditMarketingContent={(contentId) => {
            const item = content.find((entry) => entry.id === contentId);
            if (item) editItem(item);
          }}
          onSaveMarketingContent={onSave}
          role="admin"
        />
      ) : null}

      <Modal
        description="This is internal content planning only. It does not publish to social platforms."
        onClose={() => {
          if (!editing || !editing.contentId && (editing.title.trim() || editing.body.trim() || editing.caption.trim()) && !window.confirm('Close this marketing item? Your draft will remain saved.')) return;
          setEditing(null);
        }}
        open={Boolean(editing)}
        title={editing?.contentId ? 'Edit marketing item' : 'New marketing item'}
        wide
      >
        {editing ? (
          <form className="rm-form-grid" onSubmit={submit}>
            <label className="rm-field rm-form-grid__wide">
              <span>Title</span>
              <input autoFocus onChange={(event) => setEditing((current) => current ? { ...current, title: event.target.value } : current)} required value={editing.title} />
            </label>
            <label className="rm-field">
              <span>Platform</span>
              <select onChange={(event) => setEditing((current) => current ? { ...current, platform: event.target.value } : current)} value={editing.platform}>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>TikTok</option>
                <option>YouTube</option>
                <option>Website</option>
                <option>Multi-platform</option>
              </select>
            </label>
            <label className="rm-field">
              <span>Type</span>
              <select onChange={(event) => setEditing((current) => current ? { ...current, contentType: event.target.value } : current)} value={editing.contentType}>
                <option>Post</option>
                <option>Reel</option>
                <option>Story</option>
                <option>Video</option>
                <option>Script</option>
              </select>
            </label>
            <label className="rm-field">
              <span>Status</span>
              <select onChange={(event) => setEditing((current) => current ? { ...current, status: event.target.value as MarketingContentStatus } : current)} value={editing.status}>
                {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <div className="rm-form-grid rm-form-grid--two rm-form-grid__wide">
              <label className="rm-field">
                <span>Start date</span>
                <input
                  onChange={(event) => setEditing((current) => current ? ({
                    ...current,
                    plannedFor: scheduleValue(event.target.value, schedulePart(current.plannedFor, 'time')),
                  }) : current)}
                  type="date"
                  value={schedulePart(editing.plannedFor, 'date')}
                />
              </label>
              <label className="rm-field">
                <span>End date</span>
                <input
                  min={schedulePart(editing.plannedFor, 'date')}
                  onChange={(event) => setEditing((current) => current ? ({
                    ...current,
                    plannedUntil: scheduleValue(event.target.value, schedulePart(current.plannedUntil, 'time')),
                  }) : current)}
                  type="date"
                  value={schedulePart(editing.plannedUntil ?? editing.plannedFor, 'date')}
                />
              </label>
            </div>
            <label className="rm-checkbox rm-calendar-all-day-toggle rm-form-grid__wide">
              <input
                checked={Boolean(editing.allDay)}
                onChange={(event) => setEditing((current) => current ? ({
                  ...current,
                  allDay: event.target.checked,
                  plannedFor: scheduleValue(schedulePart(current.plannedFor, 'date'), event.target.checked ? '00:00' : schedulePart(current.plannedFor, 'time')),
                  plannedUntil: scheduleValue(schedulePart(current.plannedUntil ?? current.plannedFor, 'date'), event.target.checked ? '23:59' : schedulePart(current.plannedUntil, 'time')),
                }) : current)}
                type="checkbox"
              />
              <span>All day</span>
            </label>
            {!editing.allDay ? (
              <div className="rm-form-grid rm-form-grid--two rm-form-grid__wide">
                <label className="rm-field">
                  <span>Starts</span>
                  <input
                    onChange={(event) => setEditing((current) => current ? ({
                      ...current,
                      plannedFor: scheduleValue(schedulePart(current.plannedFor, 'date'), event.target.value),
                    }) : current)}
                    type="time"
                    value={schedulePart(editing.plannedFor, 'time')}
                  />
                </label>
                <label className="rm-field">
                  <span>Ends</span>
                  <input
                    onChange={(event) => setEditing((current) => current ? ({
                      ...current,
                      plannedUntil: scheduleValue(schedulePart(current.plannedUntil ?? current.plannedFor, 'date'), event.target.value),
                    }) : current)}
                    type="time"
                    value={schedulePart(editing.plannedUntil ?? editing.plannedFor, 'time')}
                  />
                </label>
              </div>
            ) : null}
            <div className="rm-field rm-form-grid__wide">
              <span>Assigned to</span>
              <div className="rm-event-assignee-picker">
                {activeMembers.map((member) => {
                  const checked = editing.assigneeUserIds?.includes(member.userId) ?? false;
                  return (
                    <label className="rm-event-assignee-option" key={member.userId}>
                      <input
                        checked={checked}
                        onChange={() => setEditing((current) => current ? ({
                          ...current,
                          assigneeUserIds: checked
                            ? (current.assigneeUserIds ?? []).filter((userId) => userId !== member.userId)
                            : [...(current.assigneeUserIds ?? []), member.userId],
                        }) : current)}
                        type="checkbox"
                      />
                      <span>{member.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="rm-field rm-form-grid__wide">
              <span>Caption</span>
              <textarea
                onChange={(event) => setEditing((current) => current ? { ...current, caption: event.target.value } : current)}
                placeholder="Write the public-facing caption, including hashtags and calls to action."
                rows={4}
                value={editing.caption}
              />
            </label>
            <label className="rm-field rm-form-grid__wide">
              <span>Content script</span>
              <textarea
                onChange={(event) => setEditing((current) => current ? { ...current, body: event.target.value } : current)}
                placeholder="Write the hook, scenes, voiceover, and production notes."
                rows={9}
                value={editing.body}
              />
            </label>
            <div className="rm-script-reader-trigger rm-form-grid__wide">
              <span>Need more room to review the script with the assigned talent?</span>
              <Button disabled={!editing.body.trim()} icon="arrow-up-right" onClick={() => setScriptReaderOpen(true)} variant="secondary">Open script reader</Button>
            </div>
            <footer className="rm-dialog-actions rm-dialog-actions--split rm-form-grid__wide">
              <div>
                {editing.contentId && onArchive ? (
                  <Button
                    disabled={saving}
                    onClick={() => {
                      if (!window.confirm(`Delete ${editing.title}?`)) return;
                      setSaving(true);
                      void onArchive(editing.contentId as string)
                        .then(() => {
                          notify('Marketing item deleted.');
                          setEditing(null);
                        })
                        .catch((error) => {
                          notify(error instanceof Error ? error.message : 'Could not delete the marketing item.', 'error');
                        })
                        .finally(() => setSaving(false));
                    }}
                    variant="danger"
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
              <div>
                <Button disabled={saving} onClick={() => {
                  if (!editing.contentId && (editing.title.trim() || editing.body.trim() || editing.caption.trim()) && !window.confirm('Close this marketing item? Your draft will remain saved.')) return;
                  setEditing(null);
                }} variant="secondary">Cancel</Button>
                <Button disabled={saving || !editing.title.trim()} type="submit">{saving ? 'Saving…' : 'Save item'}</Button>
              </div>
            </footer>
          </form>
        ) : null}
      </Modal>
      <ScriptReader
        data={scriptReaderData}
        onClose={() => setScriptReaderOpen(false)}
        open={scriptReaderOpen}
      />
    </div>
  );
}
