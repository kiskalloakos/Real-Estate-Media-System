import { useDeferredValue, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';

import { Button, Card, Icon, Modal, useToast } from '@/components/web';

import { LeadsScreen } from './LeadsScreen';
import { ScreenTabs } from './shared';
import type {
  LeadStatus,
  PortalActionHandlers,
  PortalData,
  UpsertLeadInput,
} from './types';

type SalesTab = 'leads' | 'caller';

const callerStatuses: { label: string; value: LeadStatus }[] = [
  { label: 'Lead', value: 'pending' },
  { label: 'Follow Up', value: 'follow_up' },
  { label: 'Declined', value: 'lost' },
  { label: 'Onboarding / Client', value: 'won' },
];

function safeCallerStatus(status: LeadStatus): LeadStatus {
  return callerStatuses.some((option) => option.value === status) ? status : 'pending';
}

function externalUrl(value: string) {
  if (!value.trim()) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function documentTextWithLineBreaks(contentHtml = '') {
  const withBreaks = contentHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:div|h2|p)>/gi, '\n');
  if (typeof document === 'undefined') return withBreaks.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const element = document.createElement('div');
  element.innerHTML = withBreaks;
  return (element.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

function highlightMatch(value: string, query: string): ReactNode {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return value;
  const index = value.toLowerCase().indexOf(normalizedQuery);
  if (index < 0) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark>{value.slice(index, index + normalizedQuery.length)}</mark>
      {value.slice(index + normalizedQuery.length)}
    </>
  );
}

export interface SalesScreenProps {
  actions?: PortalActionHandlers;
  data?: PortalData;
  initialTab?: SalesTab;
  onOpenDocuments?: () => void;
  onTabChange?: (tab: SalesTab) => void;
}

export function SalesScreen({ actions, data, initialTab = 'leads', onOpenDocuments, onTabChange }: SalesScreenProps) {
  const { notify } = useToast();
  const [tab, setTab] = useState<SalesTab>(initialTab);
  const [callerIndex, setCallerIndex] = useState(0);
  const [callerList, setCallerList] = useState('all');
  const [callerStatus, setCallerStatus] = useState<'all' | LeadStatus>('all');
  const [callerNoteDrafts, setCallerNoteDrafts] = useState<Record<string, string>>({});
  const [callerQuery, setCallerQuery] = useState('');
  const deferredCallerQuery = useDeferredValue(callerQuery);
  const [editingLead, setEditingLead] = useState<UpsertLeadInput | null>(null);
  const [saving, setSaving] = useState(false);
  const allCallerLeads = useMemo(
    () => [...(data?.leads ?? [])]
      .sort((a, b) => a.researchName.localeCompare(b.researchName, undefined, { sensitivity: 'base' })),
    [data?.leads],
  );
  const callerLists = useMemo(() => {
    const counts = new Map<string, number>();
    allCallerLeads.forEach((lead) => {
      const list = lead.sourceList?.trim();
      if (!list) return;
      counts.set(list, (counts.get(list) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(([label, count]) => ({ count, label }));
  }, [allCallerLeads]);
  const callerLeads = useMemo(
    () => allCallerLeads.filter((lead) => {
      if (callerList !== 'all' && lead.sourceList?.trim() !== callerList) return false;
      return callerStatus === 'all' || safeCallerStatus(lead.status) === callerStatus;
    }),
    [allCallerLeads, callerList, callerStatus],
  );
  const activeCallerIndex = Math.min(callerIndex, Math.max(callerLeads.length - 1, 0));
  const activeLead = callerLeads[activeCallerIndex];
  const activeCallerNotes = activeLead
    ? callerNoteDrafts[activeLead.id] ?? activeLead.notes
    : '';
  const searchedCallerLeads = useMemo(() => {
    const query = deferredCallerQuery.trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, '');
    return callerLeads
      .map((lead, index) => ({ index, lead }))
      .filter(({ lead }) => {
        if (!query) return true;
        const nameMatches = lead.researchName.toLowerCase().includes(query);
        const phoneMatches = queryDigits.length > 1 &&
          lead.phoneNumber.replace(/\D/g, '').includes(queryDigits);
        return nameMatches || phoneMatches;
      });
  }, [callerLeads, deferredCallerQuery]);
  const changeTab = (next: SalesTab) => {
    setTab(next);
    onTabChange?.(next);
  };
  const updateCallerStatus = async (status: LeadStatus) => {
    if (!activeLead || !actions?.upsertLead) return;
    setSaving(true);
    try {
      await actions.upsertLead({ ...activeLead, leadId: activeLead.id, status });
      notify(`${activeLead.researchName} moved to ${callerStatuses.find((item) => item.value === status)?.label}.`);
      setCallerIndex((index) => (index + 1) % Math.max(callerLeads.length, 1));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update this lead.', 'error');
    } finally {
      setSaving(false);
    }
  };
  const saveCallerNotes = async () => {
    if (!activeLead || !actions?.upsertLead || activeCallerNotes === activeLead.notes) return;
    setSaving(true);
    try {
      await actions.upsertLead({ ...activeLead, leadId: activeLead.id, notes: activeCallerNotes });
      setCallerNoteDrafts((current) => {
        const next = { ...current };
        delete next[activeLead.id];
        return next;
      });
      notify('Lead notes saved.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save lead notes.', 'error');
    } finally {
      setSaving(false);
    }
  };
  const submitLeadEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingLead || !actions?.upsertLead) return;
    setSaving(true);
    try {
      await actions.upsertLead(editingLead);
      notify('Lead updated.');
      setEditingLead(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update this lead.', 'error');
    } finally {
      setSaving(false);
    }
  };
  const callerScript = (data?.companyDocuments ?? []).find(
    (document) => document.kind === 'sales'
      && document.salesDocumentType === 'script'
      && document.callerList === callerList,
  );
  const openDocuments = () => onOpenDocuments?.();
  const handleScriptCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openDocuments();
  };

  return (
    <div className="rm-page rm-hub-page rm-sales-page">
      <div className="rm-hub-tabs-wrap">
        <ScreenTabs
          active={tab}
          items={[
            { count: data?.leads?.length ?? 0, key: 'leads', label: 'Leads' },
            { count: callerLeads.length, key: 'caller', label: 'Caller' },
          ]}
          label="Sales sections"
          onChange={changeTab}
        />
      </div>
      {tab === 'leads' ? <LeadsScreen leads={data?.leads} onDeleteList={actions?.deleteLeadList} onImport={actions?.importLeads} onUpsert={actions?.upsertLead} /> : null}
      {tab === 'caller' ? (
        activeLead ? (
          <div className="rm-caller-workspace">
            <div className="rm-caller-list-picker" aria-label="Lead list to call">
              <button aria-pressed={callerList === 'all'} className={callerList === 'all' ? 'is-selected' : undefined} onClick={() => { setCallerList('all'); setCallerIndex(0); }} type="button">
                All leads <strong>{allCallerLeads.length}</strong>
              </button>
              {callerLists.map((list) => (
                <button aria-pressed={callerList === list.label} className={callerList === list.label ? 'is-selected' : undefined} key={list.label} onClick={() => { setCallerList(list.label); setCallerIndex(0); }} type="button">
                  {list.label} <strong>{list.count}</strong>
                </button>
              ))}
              <label className="rm-field rm-field--compact rm-caller-status-filter">
                <span className="rm-visually-hidden">Filter calling status</span>
                <select onChange={(event) => { setCallerStatus(event.target.value as typeof callerStatus); setCallerIndex(0); }} value={callerStatus}>
                  <option value="all">All statuses</option>
                  {callerStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <div className="rm-caller-workspace__stage">
              <Card className="rm-caller-card" tone="bright">
                <span className="rm-caller-card__eyebrow">Calling lead {activeCallerIndex + 1} of {callerLeads.length}</span>
                <h1>{activeLead.researchName}</h1>
                <a className="rm-caller-card__phone" href={`tel:${activeLead.phoneNumber.replace(/[^+\d]/g, '')}`}>
                  {activeLead.phoneNumber || 'No phone number saved'}
                </a>
                <p>{[activeLead.location, activeLead.county].filter(Boolean).join(' · ') || 'No location details saved.'}</p>
                <div className="rm-caller-card__socials" aria-label="Lead links and social media">
                  {[
                    ['Website', activeLead.website],
                    ['Instagram', activeLead.instagram],
                    ['Facebook', activeLead.facebook],
                    ['TikTok', activeLead.tiktok],
                    ['Listing', activeLead.listingLink],
                  ].map(([label, value]) => {
                    const href = externalUrl(value);
                    return href ? <a href={href} key={label} rel="noreferrer" target="_blank">{label}</a> : <span key={label}>{label}<small>Not available</small></span>;
                  })}
                </div>
                <label className="rm-field rm-caller-card__notes">
                  <span>Notes</span>
                  <textarea
                    disabled={saving}
                    onChange={(event) => setCallerNoteDrafts((current) => ({
                      ...current,
                      [activeLead.id]: event.target.value,
                    }))}
                    onBlur={() => void saveCallerNotes()}
                    placeholder="Add notes for the next conversation…"
                    rows={4}
                    value={activeCallerNotes}
                  />
                </label>
                <div className="rm-caller-card__actions">
                  <label className="rm-field rm-field--compact">
                    <span>Set status</span>
                    <select disabled={saving} onChange={(event) => void updateCallerStatus(event.target.value as LeadStatus)} value={safeCallerStatus(activeLead.status)}>
                      {callerStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <Button
                    disabled={saving}
                    icon="dots"
                    onClick={() => setEditingLead({ ...activeLead, leadId: activeLead.id })}
                    variant="secondary"
                  >
                    Edit lead
                  </Button>
                  <div className="rm-caller-card__navigation">
                    <Button
                      disabled={callerLeads.length < 2}
                      icon="chevron-left"
                      onClick={() => setCallerIndex((index) => (index - 1 + callerLeads.length) % callerLeads.length)}
                      variant="secondary"
                    >
                      Previous
                    </Button>
                    <Button disabled={callerLeads.length < 2} iconAfter="arrow-right" onClick={() => setCallerIndex((index) => (index + 1) % callerLeads.length)}>Next</Button>
                  </div>
                </div>
              </Card>
              <aside className="rm-caller-script" aria-label="Script for this calling list">
                {callerScript ? (
                  <Card aria-label={`Edit ${callerScript.title} in Documents`} className="rm-caller-script__card" onClick={openDocuments} onKeyDown={handleScriptCardKeyDown} role="button" tabIndex={0} tone="bright">
                    <h2>{callerScript.title}</h2>
                    <div className="rm-caller-script__content">{documentTextWithLineBreaks(callerScript.contentHtml)}</div>
                  </Card>
                ) : (
                  <Card aria-label="Open Documents to create a caller script" className="rm-caller-script__empty" onClick={openDocuments} onKeyDown={handleScriptCardKeyDown} role="button" tabIndex={0} tone="bright"><strong>No script assigned</strong><p>Create a Script in Documents → Sales and assign it to {callerList === 'all' ? 'All leads' : callerList}.</p></Card>
                )}
              </aside>
            </div>
            <section className="rm-caller-queue" aria-label={`${callerList === 'all' ? 'All leads' : callerList} calling list`}>
              <header>
                <span>{callerList === 'all' ? 'All leads' : callerList} list</span>
                <label className="rm-inline-search rm-inline-search--dark rm-caller-search">
                  <span className="rm-visually-hidden">Search caller leads by name or phone number</span>
                  <input
                    onChange={(event) => setCallerQuery(event.target.value)}
                    placeholder="Search name or phone…"
                    type="search"
                    value={callerQuery}
                  />
                </label>
              </header>
              <div className="rm-caller-queue__items">
                {searchedCallerLeads.map(({ lead, index }) => (
                  <button
                    aria-current={index === activeCallerIndex ? 'true' : undefined}
                    className={[
                      index === activeCallerIndex ? 'is-selected' : '',
                      deferredCallerQuery.trim() ? 'is-search-match' : '',
                    ].filter(Boolean).join(' ')}
                    key={lead.id}
                    onClick={() => setCallerIndex(index)}
                    type="button"
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{highlightMatch(lead.researchName, deferredCallerQuery)}</strong>
                    <small>{highlightMatch(lead.phoneNumber || 'No phone number', deferredCallerQuery)}</small>
                  </button>
                ))}
                {!searchedCallerLeads.length ? (
                  <p className="rm-caller-queue__empty">No lead matches “{callerQuery.trim()}”.</p>
                ) : null}
              </div>
            </section>
          </div>
        ) : (
          <Card className="rm-document-empty" tone="transparent"><Icon name="users" size={26} /><h2>No leads ready to call</h2><p>Add or import leads to start the calling queue.</p></Card>
        )
      ) : null}
      <Modal onClose={() => setEditingLead(null)} open={Boolean(editingLead)} title="Edit lead" wide>
        {editingLead ? (
          <form className="rm-form-grid" onSubmit={submitLeadEdit}>
            {[
              ['researchName', 'Name'],
              ['location', 'Location'],
              ['county', 'County'],
              ['phoneNumber', 'Phone number'],
              ['sourceList', 'Lead list'],
              ['website', 'Website'],
              ['instagram', 'Instagram'],
              ['facebook', 'Facebook'],
              ['tiktok', 'TikTok'],
              ['listingLink', 'Listing link'],
            ].map(([field, label]) => (
              <label className="rm-field" key={field}>
                <span>{label}</span>
                <input
                  onChange={(event) => setEditingLead((current) => current ? { ...current, [field]: event.target.value } : current)}
                  required={field === 'researchName'}
                  value={String(editingLead[field as keyof UpsertLeadInput] ?? '')}
                />
              </label>
            ))}
            <label className="rm-field">
              <span>Status</span>
              <select
                onChange={(event) => setEditingLead((current) => current ? { ...current, status: event.target.value as LeadStatus } : current)}
                value={safeCallerStatus(editingLead.status)}
              >
                {callerStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="rm-field rm-form-grid__wide">
              <span>Notes</span>
              <textarea
                onChange={(event) => setEditingLead((current) => current ? { ...current, notes: event.target.value } : current)}
                rows={5}
                value={editingLead.notes}
              />
            </label>
            <footer className="rm-dialog-actions rm-form-grid__wide">
              <Button disabled={saving} onClick={() => setEditingLead(null)} variant="secondary">Cancel</Button>
              <Button disabled={saving || !editingLead.researchName.trim()} type="submit">{saving ? 'Saving…' : 'Save lead'}</Button>
            </footer>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
