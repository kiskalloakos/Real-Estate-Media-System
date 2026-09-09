import { useDeferredValue, useMemo, useState, type FormEvent } from 'react';
import { readSheet } from 'read-excel-file/browser';

import {
  Button,
  Card,
  Icon,
  Modal,
  useToast,
} from '@/components/web';
import { leadsCsv } from '@/lib/leads-csv';
import { ScreenTabs } from './shared';

import type {
  LeadImportInput,
  LeadStatus,
  LeadSummary,
  UpsertLeadInput,
} from './types';

export interface LeadsScreenProps {
  leads?: LeadSummary[];
  onDeleteList?: (leadIds: string[]) => Promise<void>;
  onImport?: (input: LeadImportInput[]) => Promise<void>;
  onUpsert?: (input: UpsertLeadInput) => Promise<void>;
}

const statusOptions: { label: string; value: LeadStatus }[] = [
  { label: 'Lead', value: 'pending' },
  { label: 'Follow Up', value: 'follow_up' },
  { label: 'Declined', value: 'lost' },
  { label: 'Onboarding / Client', value: 'won' },
];

function safeLeadStatus(status: LeadStatus): LeadStatus {
  return statusOptions.some((option) => option.value === status) ? status : 'pending';
}

type LeadList = 'all' | 'airbnb' | 'contractor' | 'developer' | 'realtor';

const leadLists: { key: Exclude<LeadList, 'all'>; label: string }[] = [
  { key: 'airbnb', label: 'Airbnb' },
  { key: 'contractor', label: 'Contractors' },
  { key: 'developer', label: 'Developers' },
  { key: 'realtor', label: 'Realtors' },
];

function leadListFor(sourceList: string): Exclude<LeadList, 'all'> | null {
  const normalized = sourceList.trim().toLowerCase();
  if (normalized.includes('airbnb')) return 'airbnb';
  if (normalized.includes('contractor')) return 'contractor';
  if (normalized.includes('developer')) return 'developer';
  if (normalized.includes('realtor') || normalized.includes('real estate agent')) return 'realtor';
  return null;
}

function leadListLabel(list: Exclude<LeadList, 'all'>) {
  return leadLists.find((item) => item.key === list)?.label ?? list;
}

function exportListLabel(list: LeadList) {
  return list === 'all' ? 'All leads' : leadListLabel(list);
}

function downloadLeadsCsv(leads: LeadSummary[], list: LeadList) {
  const file = new Blob([leadsCsv(leads)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const scope = exportListLabel(list).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  link.download = `realty-media-leads-${scope}-${date}.csv`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const emptyLead: UpsertLeadInput = {
  county: '',
  facebook: '',
  instagram: '',
  listingLink: '',
  location: '',
  notes: '',
  phoneNumber: '',
  researchName: '',
  sourceList: '',
  status: 'pending',
  tiktok: '',
  website: '',
};

function normalizedHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const fieldAliases: Record<keyof LeadImportInput, string[]> = {
  county: ['county'],
  facebook: ['facebook'],
  instagram: ['instagram'],
  listingLink: ['listing link', 'listing', 'airbnb link'],
  location: ['location'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks', 'remark', 'observations', 'observation'],
  phoneNumber: ['phone number', 'phone', 'telephone'],
  researchName: ['research name of owner', 'name', 'owner', 'lead name'],
  sourceList: ['source list', 'source'],
  status: ['status'],
  tiktok: ['tiktok', 'tik tok'],
  website: ['website', 'site'],
};

function leadStatus(value: unknown): LeadStatus {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const importedStatus: Record<string, LeadStatus> = {
    lead: 'pending',
    pending: 'pending',
    follow_up: 'follow_up',
    followup: 'follow_up',
    declined: 'lost',
    lost: 'lost',
    onboarding_client: 'won',
    onboarding: 'won',
    client: 'won',
    won: 'won',
  };
  if (importedStatus[normalized]) return importedStatus[normalized];
  return statusOptions.some((option) => option.value === normalized)
    ? normalized as LeadStatus
    : 'pending';
}

function rowsToLeads(input: unknown): LeadImportInput[] {
  if (!Array.isArray(input)) {
    throw new Error('The selected file does not contain a readable spreadsheet.');
  }

  const rows = input.filter((row): row is unknown[] => Array.isArray(row));
  if (!rows.length) {
    throw new Error('The selected spreadsheet does not contain any rows.');
  }

  const [header = [], ...body] = rows;
  const headers = header.map(normalizedHeader);
  const indexFor = (field: keyof LeadImportInput) =>
    headers.findIndex((headerName) => fieldAliases[field].includes(headerName));
  const indexes = Object.fromEntries(
    (Object.keys(fieldAliases) as (keyof LeadImportInput)[]).map((field) => [
      field,
      indexFor(field),
    ]),
  ) as Record<keyof LeadImportInput, number>;

  if (indexes.researchName < 0) {
    throw new Error('The spreadsheet needs a “Research Name of OWNER” or “Name” column.');
  }

  const read = (row: unknown[], field: keyof LeadImportInput) => {
    const index = indexes[field];
    return index < 0 ? '' : String(row[index] ?? '').trim();
  };

  return body
    .map((row) => ({
      county: read(row, 'county'),
      facebook: read(row, 'facebook'),
      instagram: read(row, 'instagram'),
      listingLink: read(row, 'listingLink'),
      location: read(row, 'location'),
      notes: read(row, 'notes'),
      phoneNumber: read(row, 'phoneNumber'),
      researchName: read(row, 'researchName'),
      sourceList: read(row, 'sourceList'),
      status: leadStatus(read(row, 'status')),
      tiktok: read(row, 'tiktok'),
      website: read(row, 'website'),
    }))
    .filter((lead) => lead.researchName)
    .sort((a, b) => a.researchName.localeCompare(b.researchName, undefined, { sensitivity: 'base' }));
}

function csvDelimiter(source: string) {
  const sample = source
    .split(/\r?\n/)
    .find((line) => line.trim()) ?? '';
  const candidates = [',', ';', '\t'];
  const counts = candidates.map((candidate) => {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < sample.length; index += 1) {
      if (sample[index] === '"') quoted = !quoted;
      else if (!quoted && sample[index] === candidate) count += 1;
    }
    return count;
  });
  const highest = Math.max(...counts);
  return highest > 0 ? candidates[counts.indexOf(highest)] : ',';
}

function csvRows(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  const delimiter = csvDelimiter(source);

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function LeadsScreen({
  leads = [],
  onDeleteList,
  onImport,
  onUpsert,
}: LeadsScreenProps) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<'all' | LeadStatus>('all');
  const [leadList, setLeadList] = useState<LeadList>('all');
  const [exportList, setExportList] = useState<LeadList>('all');
  const [importList, setImportList] = useState<Exclude<LeadList, 'all'> | ''>('');
  const [editing, setEditing] = useState<UpsertLeadInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<LeadImportInput[]>([]);
  const [importName, setImportName] = useState('');
  const [deletedLeadIds, setDeletedLeadIds] = useState<Set<string>>(() => new Set());
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const availableLeads = useMemo(
    () => leads.filter((lead) => !deletedLeadIds.has(lead.id)),
    [deletedLeadIds, leads],
  );

  const visibleLeads = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return availableLeads.filter((lead) => {
      if (leadList !== 'all' && leadListFor(lead.sourceList) !== leadList) return false;
      if (status !== 'all' && safeLeadStatus(lead.status) !== status) return false;
      if (!normalized) return true;
      return [
        lead.researchName,
        lead.county,
        lead.location,
        lead.phoneNumber,
        lead.notes,
        lead.sourceList,
      ].some((value) => value.toLowerCase().includes(normalized));
    }).sort((a, b) => a.researchName.localeCompare(b.researchName, undefined, { sensitivity: 'base' }));
  }, [availableLeads, deferredQuery, leadList, status]);

  const exportLeads = useMemo(
    () => availableLeads
      .filter((lead) => exportList === 'all' || leadListFor(lead.sourceList) === exportList)
      .sort((a, b) => a.researchName.localeCompare(b.researchName, undefined, { sensitivity: 'base' })),
    [availableLeads, exportList],
  );

  const parseFile = async (file: File) => {
    setImportName(file.name);
    setImportPreview([]);
    const extension = file.name.split('.').pop()?.toLowerCase();
    const rows = extension === 'csv'
      ? csvRows(await file.text())
      : await readSheet(file);
    const parsed = rowsToLeads(rows);
    if (!parsed.length) throw new Error('No leads were found in this file.');
    setImportPreview(parsed);
  };

  const importRows = async () => {
    if (!onImport || !importPreview.length || !importList) return;
    setImporting(true);
    try {
      await onImport(importPreview.map((lead) => ({
        ...lead,
        sourceList: leadListLabel(importList),
      })));
      notify(`${importPreview.length} leads imported.`);
      setImportPreview([]);
      setImportName('');
      setImportList('');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import the leads.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !onUpsert) return;
    setSaving(true);
    try {
      await onUpsert(editing);
      notify(editing.leadId ? 'Lead updated.' : 'Lead added.');
      setEditing(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the lead.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (lead: LeadSummary, nextStatus: LeadStatus) => {
    if (!onUpsert) return;
    try {
      await onUpsert({ ...lead, leadId: lead.id, status: nextStatus });
      notify(`${lead.researchName} moved to ${statusOptions.find((item) => item.value === nextStatus)?.label}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the lead.', 'error');
    }
  };

  const selectedAvailableLeadIds = [...selectedLeadIds]
    .filter((leadId) => availableLeads.some((lead) => lead.id === leadId));
  const visibleLeadIds = visibleLeads.map((lead) => lead.id);
  const allVisibleSelected = visibleLeadIds.length > 0
    && visibleLeadIds.every((leadId) => selectedLeadIds.has(leadId));
  const someVisibleSelected = visibleLeadIds.some((leadId) => selectedLeadIds.has(leadId));

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleLeadIds.forEach((leadId) => next.delete(leadId));
      else visibleLeadIds.forEach((leadId) => next.add(leadId));
      return next;
    });
  };

  const deleteSelectedLeads = async () => {
    if (!onDeleteList || !selectedAvailableLeadIds.length) return;
    const leadIds = selectedAvailableLeadIds;
    setBulkDeleting(true);
    try {
      setDeletedLeadIds((current) => new Set([...current, ...leadIds]));
      await onDeleteList(leadIds);
      setSelectedLeadIds(new Set());
      setBulkDeleteOpen(false);
      notify(`${leadIds.length} ${leadIds.length === 1 ? 'lead' : 'leads'} deleted.`);
    } catch (error) {
      setDeletedLeadIds((current) => {
        const next = new Set(current);
        leadIds.forEach((id) => next.delete(id));
        return next;
      });
      notify(error instanceof Error ? error.message : 'Could not delete the selected leads.', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="rm-subpage rm-leads-page">
      <div className="rm-hub-toolbar">
        <div>
          <h2>Leads</h2>
        </div>
        <div className="rm-hub-toolbar__actions">
          <label className="rm-field rm-field--compact rm-lead-export-list">
            <span className="rm-visually-hidden">Choose leads to export</span>
            <select onChange={(event) => setExportList(event.target.value as LeadList)} value={exportList}>
              <option value="all">All leads ({availableLeads.length})</option>
              {leadLists.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label} ({availableLeads.filter((lead) => leadListFor(lead.sourceList) === item.key).length})
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={!exportLeads.length}
            icon="download"
            onClick={() => {
              downloadLeadsCsv(exportLeads, exportList);
              notify(`${exportLeads.length} ${exportListLabel(exportList).toLowerCase()} exported.`);
            }}
            variant="secondary"
          >
            Export CSV
          </Button>
          <label className="rm-button rm-button--secondary">
            <Icon name="upload" size={17} />
            <span>Import CSV / XLSX</span>
            <input
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="rm-visually-hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void parseFile(file).catch((error) =>
                    notify(error instanceof Error ? error.message : 'Could not read the file.', 'error'),
                  );
                }
                event.target.value = '';
              }}
              type="file"
            />
          </label>
          <Button
            icon="plus"
            onClick={() => setEditing({
              ...emptyLead,
              sourceList: leadList === 'all'
                ? leadListLabel(importList || 'airbnb')
                : leadListLabel(leadList),
            })}
          >
            Add lead
          </Button>
        </div>
      </div>

      {importPreview.length ? (
        <Card className="rm-import-banner" tone="dark">
          <div>
            <strong>{importName}</strong>
            <span>{importPreview.length} valid leads are ready to import. Choose which list they belong to.</span>
          </div>
          <div>
            <label className="rm-field rm-field--compact rm-lead-import-list">
              <span className="rm-visually-hidden">Lead list</span>
              <select onChange={(event) => setImportList(event.target.value as typeof importList)} value={importList}>
                <option value="">Choose lead list</option>
                {leadLists.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
            <Button disabled={importing} onClick={() => setImportPreview([])} variant="ghost">
              Cancel
            </Button>
            <Button disabled={importing || !importList} onClick={() => void importRows()}>
              {importing ? 'Importing…' : `Import ${importPreview.length}`}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="rm-leads-list-tabs">
        <ScreenTabs
          active={leadList}
          items={[
            { count: availableLeads.length, key: 'all', label: 'All leads' },
            ...leadLists.map((item) => ({
              count: availableLeads.filter((lead) => leadListFor(lead.sourceList) === item.key).length,
              key: item.key,
              label: item.label,
            })),
          ]}
          label="Lead lists"
          onChange={(nextList) => {
            setLeadList(nextList);
            setExportList(nextList);
          }}
        />
      </div>

      <Card className="rm-table-card rm-leads-table-card" tone="bright">
        <div className="rm-table-card__toolbar">
          <label className="rm-inline-search">
            <Icon name="search" size={17} />
            <span className="rm-visually-hidden">Search leads</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search leads…"
              type="search"
              value={query}
            />
          </label>
          <div className="rm-leads-table-actions">
            <label className="rm-field rm-field--compact">
              <span className="rm-visually-hidden">Filter lead status</span>
              <select onChange={(event) => setStatus(event.target.value as typeof status)} value={status}>
                <option value="all">All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {onDeleteList ? (
              <Button
                disabled={!selectedAvailableLeadIds.length}
                onClick={() => setBulkDeleteOpen(true)}
                variant="danger"
              >
                Delete selected{selectedAvailableLeadIds.length ? ` (${selectedAvailableLeadIds.length})` : ''}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="rm-table-wrap">
          <table className="rm-table rm-leads-table">
            <colgroup>
              <col className="rm-leads-table__select" />
              <col className="rm-leads-table__name" />
              <col className="rm-leads-table__location" />
              <col className="rm-leads-table__phone" />
              <col span={5} className="rm-leads-table__link" />
              <col className="rm-leads-table__notes" />
              <col className="rm-leads-table__status" />
            </colgroup>
            <thead>
              <tr>
                <th className="rm-leads-table__select-cell">
                  <input
                    aria-label={allVisibleSelected ? 'Deselect all visible leads' : 'Select all visible leads'}
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelection}
                    ref={(input) => {
                      if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected;
                    }}
                    type="checkbox"
                  />
                </th>
                <th>Name</th>
                <th>Location</th>
                <th>Phone number</th>
                <th>Website</th>
                <th>Instagram</th>
                <th>Facebook</th>
                <th>TikTok</th>
                <th>Listing link</th>
                <th>Notes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((lead) => (
                <tr
                  className={selectedLeadIds.has(lead.id) ? 'is-selected' : undefined}
                  key={lead.id}
                  onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest('a, button, input, label, select')) {
                      return;
                    }
                    setEditing({ ...lead, leadId: lead.id });
                  }}
                >
                  <td className="rm-leads-table__select-cell">
                    <input
                      aria-label={`Select ${lead.researchName}`}
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={() => toggleLeadSelection(lead.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="rm-leads-table__name-cell">
                    <strong>{lead.researchName}</strong>
                  </td>
                  <td>{lead.location || '—'}</td>
                  <td>{lead.phoneNumber || '—'}</td>
                  <td>{lead.website ? <a href={lead.website} rel="noreferrer" target="_blank">Website</a> : '—'}</td>
                  <td>{lead.instagram ? <a href={lead.instagram} rel="noreferrer" target="_blank">Instagram</a> : '—'}</td>
                  <td>{lead.facebook ? <a href={lead.facebook} rel="noreferrer" target="_blank">Facebook</a> : '—'}</td>
                  <td>{lead.tiktok ? <a href={lead.tiktok} rel="noreferrer" target="_blank">TikTok</a> : '—'}</td>
                  <td>{lead.listingLink ? <a href={lead.listingLink} rel="noreferrer" target="_blank">Listing</a> : '—'}</td>
                  <td className="rm-lead-notes-cell" title={lead.notes || undefined}>{lead.notes || '—'}</td>
                  <td>
                    <select
                      aria-label={`Status for ${lead.researchName}`}
                      className="rm-lead-status-select"
                      onChange={(event) => void updateStatus(lead, event.target.value as LeadStatus)}
                      value={safeLeadStatus(lead.status)}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleLeads.length ? (
            <div className="rm-table-empty">
              <Icon name="users" size={22} />
              <strong>No leads here yet</strong>
              <span>Import the attached research sheet or add the first lead manually.</span>
            </div>
          ) : null}
        </div>
      </Card>

      <Modal
        onClose={() => setEditing(null)}
        open={Boolean(editing)}
        title={editing?.leadId ? 'Edit lead' : 'Add lead'}
        wide
      >
        {editing ? (
          <form className="rm-form-grid" onSubmit={submitLead}>
            {[
              ['researchName', 'Name'],
              ['location', 'Location'],
              ['phoneNumber', 'Phone number'],
              ['website', 'Website'],
              ['instagram', 'Instagram'],
              ['facebook', 'Facebook'],
              ['tiktok', 'TikTok'],
              ['listingLink', 'Listing link'],
            ].map(([field, label]) => (
              <label className="rm-field" key={field}>
                <span>{label}</span>
                <input
                  onChange={(event) => setEditing((current) => current ? { ...current, [field]: event.target.value } : current)}
                  required={field === 'researchName'}
                  value={String(editing[field as keyof UpsertLeadInput] ?? '')}
                />
              </label>
            ))}
            <label className="rm-field">
              <span>Lead list</span>
              <select
                onChange={(event) => setEditing((current) => current ? { ...current, sourceList: leadListLabel(event.target.value as Exclude<LeadList, 'all'>) } : current)}
                value={leadListFor(editing.sourceList) ?? 'airbnb'}
              >
                {leadLists.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
            <label className="rm-field">
              <span>Status</span>
              <select
                onChange={(event) => setEditing((current) => current ? { ...current, status: event.target.value as LeadStatus } : current)}
                value={safeLeadStatus(editing.status)}
              >
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="rm-field rm-form-grid__wide">
              <span>Notes</span>
              <textarea
                onChange={(event) => setEditing((current) => current ? { ...current, notes: event.target.value } : current)}
                placeholder="Call notes, context, follow-ups, or anything useful for the next conversation…"
                rows={5}
                value={editing.notes}
              />
            </label>
            <footer className="rm-dialog-actions rm-form-grid__wide">
              <Button disabled={saving} onClick={() => setEditing(null)} variant="secondary">Cancel</Button>
              <Button disabled={saving || !editing.researchName.trim()} type="submit">{saving ? 'Saving…' : 'Save lead'}</Button>
            </footer>
          </form>
        ) : null}
      </Modal>

      <Modal
        onClose={bulkDeleting ? () => undefined : () => setBulkDeleteOpen(false)}
        open={bulkDeleteOpen}
        title={`Delete ${selectedAvailableLeadIds.length} selected ${selectedAvailableLeadIds.length === 1 ? 'lead' : 'leads'}?`}
      >
        <div className="rm-delete-list-dialog">
          <p>
            This will permanently delete the selected {selectedAvailableLeadIds.length}{' '}
            {selectedAvailableLeadIds.length === 1 ? 'lead' : 'leads'}.
          </p>
          <footer className="rm-dialog-actions">
            <Button disabled={bulkDeleting} onClick={() => setBulkDeleteOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={bulkDeleting || !selectedAvailableLeadIds.length}
              onClick={() => void deleteSelectedLeads()}
              variant="danger"
            >
              {bulkDeleting ? 'Deleting…' : 'Delete selected'}
            </Button>
          </footer>
        </div>
      </Modal>
    </div>
  );
}
