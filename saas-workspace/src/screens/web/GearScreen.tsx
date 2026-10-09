import { useMemo, useState, type FormEvent } from 'react';

import {
  Icon,
  Avatar,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  useToast,
} from '@/components/web';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';

import { demoEvents, demoGear } from './demoData';
import type {
  AgencyMemberSummary,
  CalendarEvent,
  CreateGearInput,
  GearHistoryItem,
  GearItem,
  PropertySummary,
  TransferGearInput,
  UpdateGearInput,
} from './types';

export interface GearScreenProps {
  currentUserId?: string;
  events?: CalendarEvent[];
  gear?: GearItem[];
  /** Retained for the shared portal data contract; custody history is no longer shown in this screen. */
  history?: GearHistoryItem[];
  onAddGear?: (input: CreateGearInput) => Promise<void>;
  onTransferGear?: (input: TransferGearInput) => Promise<void>;
  onUpdateGear?: (input: UpdateGearInput) => Promise<void>;
  properties?: PropertySummary[];
  members?: AgencyMemberSummary[];
}

type GearListKey = GearItem['status'];
type GearOrderState = Partial<Record<GearListKey, string[]>>;
type GearDropTarget = {
  edge: 'before' | 'after';
  gearId: string;
};

const gearLists: { key: GearListKey; label: string }[] = [
  { key: 'available', label: 'Available' },
  { key: 'on_site', label: 'On site' },
  { key: 'maintenance', label: 'Service' },
];

const emptyGearForm: CreateGearInput = {
  assetTag: '',
  category: 'camera',
  location: 'Realty Media studio',
  name: '',
  notes: '',
  serial: '',
};

const emptyTransferForm: TransferGearInput = {
  custodianUserId: undefined,
  gearId: '',
  location: '',
  note: '',
  status: 'available',
};

const gearEventDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function gearEventOptionLabel(event: CalendarEvent) {
  const date = gearEventDateFormatter.format(new Date(`${event.date}T12:00:00`));
  const dateAndTime = event.allDay ? date : `${date} · ${event.start}`;
  return `${dateAndTime} · ${event.title} · ${event.propertyName}`;
}

export function GearScreen({
  currentUserId,
  events,
  gear,
  onAddGear,
  onTransferGear,
  onUpdateGear,
  members = [],
  properties = [],
}: GearScreenProps) {
  const { notify } = useToast();
  const sourceGear = gear ?? demoGear;
  const sourceEvents = events ?? demoEvents;
  const memberAvatarByUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member.avatarUrl])),
    [members],
  );
  const gearEligibleEvents = sourceEvents.filter((event) => (
    Boolean(event.propertyId)
    || properties.some((property) => property.name === event.propertyName)
  ));
  const stateKey = `rm:gear-state:${currentUserId ?? 'admin'}`;
  const [gearOrder, setGearOrder] = useBrowserPersistedState<GearOrderState>(`${stateKey}:order`, {});
  const [addOpen, setAddOpen] = useState(false);
  const [editGear, setEditGear] = useState<GearItem | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [gearForm, setGearForm] = useState<CreateGearInput>(emptyGearForm);
  const [editForm, setEditForm] = useState<UpdateGearInput | null>(null);
  const [transferForm, setTransferForm] = useState<TransferGearInput>(emptyTransferForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [draggedGearId, setDraggedGearId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<GearDropTarget | null>(null);
  const [optimisticGear, setOptimisticGear] = useState<Record<string, Partial<GearItem>>>({});
  const boardGear = useMemo<GearItem[]>(
    () => sourceGear.map((item) => {
      const nextItem = { ...item, ...optimisticGear[item.id] };
      // Keep legacy assigned items visible after the assigned state was retired.
      return nextItem.status === 'with_team'
        ? {
          ...nextItem,
          assignedTo: undefined,
          assignedToUserId: undefined,
          location: 'Realty Media studio',
          status: 'available' as const,
        }
        : nextItem;
    }),
    [optimisticGear, sourceGear],
  );

  const openTransfer = (gearId?: string, status?: GearListKey) => {
    const selectedId = gearId ?? sourceGear[0]?.id ?? '';
    const selected = sourceGear.find((item) => item.id === selectedId);
    const nextStatus = status ?? (selected?.status === 'with_team' ? 'available' : selected?.status) ?? 'available';
    setTransferForm({
      ...emptyTransferForm,
      eventId: nextStatus === 'on_site' ? selected?.calendarEventId : undefined,
      gearId: selectedId,
      location: nextStatus === 'available'
        ? 'Realty Media studio'
        : nextStatus === 'maintenance'
          ? 'Service'
          : selected?.location ?? '',
      status: nextStatus,
    });
    setFormError('');
    setTransferOpen(true);
  };

  const orderedGear = (items: GearItem[], list: GearListKey) => {
    const savedOrder = gearOrder[list] ?? [];
    const savedIndex = new Map(savedOrder.map((gearId, index) => [gearId, index]));
    return [...items].sort((left, right) => {
      const leftIndex = savedIndex.get(left.id);
      const rightIndex = savedIndex.get(right.id);
      if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
      if (leftIndex !== undefined) return -1;
      if (rightIndex !== undefined) return 1;
      return left.name.localeCompare(right.name);
    });
  };

  const saveGearPosition = (
    item: GearItem,
    destination: GearListKey,
    targetGearId?: string,
    edge: GearDropTarget['edge'] = 'before',
  ) => {
    setGearOrder((current) => {
      const destinationIds = orderedGear(
        boardGear.filter((gearItem) => gearItem.id !== item.id && gearItem.status === destination),
        destination,
      ).map((gearItem) => gearItem.id);
      const targetIndex = targetGearId ? destinationIds.indexOf(targetGearId) : -1;
      const insertAt = targetIndex === -1 ? 0 : targetIndex + (edge === 'after' ? 1 : 0);
      destinationIds.splice(insertAt, 0, item.id);
      return {
        available: (current.available ?? []).filter((gearId) => gearId !== item.id),
        maintenance: (current.maintenance ?? []).filter((gearId) => gearId !== item.id),
        on_site: (current.on_site ?? []).filter((gearId) => gearId !== item.id),
        with_team: (current.with_team ?? []).filter((gearId) => gearId !== item.id),
        [destination]: destinationIds,
      };
    });
  };

  const applyTransfer = async (input: TransferGearInput) => {
    const previous = optimisticGear[input.gearId];
    const nextOptimistic: Partial<GearItem> = {
      assignedTo: undefined,
      assignedToUserId: undefined,
      calendarEventId: input.status === 'on_site' ? input.eventId : undefined,
      calendarEventTitle: input.status === 'on_site'
        ? sourceEvents.find((item) => item.id === input.eventId)?.title
        : undefined,
      location: input.location || (input.status === 'available' ? 'Realty Media studio' : 'Location pending'),
      status: input.status,
    };
    setOptimisticGear((current) => ({ ...current, [input.gearId]: nextOptimistic }));
    try {
      await onTransferGear?.(input);
      if (onTransferGear) {
        setOptimisticGear((current) => {
          const next = { ...current };
          delete next[input.gearId];
          return next;
        });
      }
      notify(`${sourceGear.find((item) => item.id === input.gearId)?.name ?? 'Gear'} moved to ${gearLists.find((list) => list.key === input.status)?.label}.`);
    } catch (caught) {
      setOptimisticGear((current) => {
        const next = { ...current };
        if (previous) next[input.gearId] = previous;
        else delete next[input.gearId];
        return next;
      });
      throw caught;
    }
  };

  const moveGear = async (
    item: GearItem,
    destination: GearListKey,
    targetGearId?: string,
    edge: GearDropTarget['edge'] = 'before',
  ) => {
    if (item.status === destination) {
      saveGearPosition(item, destination, targetGearId, edge);
      return;
    }
    if (destination === 'on_site') {
      openTransfer(item.id, destination);
      return;
    }
    saveGearPosition({ ...item, status: destination }, destination, targetGearId, edge);
    try {
      await applyTransfer({
        gearId: item.id,
      location: destination === 'available' ? 'Realty Media studio' : 'Service',
        note: 'Moved from the gear board.',
        status: destination,
      });
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not move the gear item.', 'error');
    }
  };

  const openEdit = (item: GearItem) => {
    setEditGear(item);
    setEditForm({
      assetTag: item.assetTag,
      category: item.category,
      gearId: item.id,
      name: item.name,
      notes: item.notes,
    });
    setFormError('');
  };

  const submitGear = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onAddGear) return;
    setSaving(true);
    setFormError('');
    try {
      await onAddGear(gearForm);
      setAddOpen(false);
      setGearForm(emptyGearForm);
      notify('Gear item added to inventory.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not add the gear item.');
    } finally {
      setSaving(false);
    }
  };

  const submitTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const item = boardGear.find((gearItem) => gearItem.id === transferForm.gearId);
      if (item) saveGearPosition({ ...item, status: transferForm.status }, transferForm.status);
      await applyTransfer(transferForm);
      setTransferOpen(false);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not transfer the gear.');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onUpdateGear || !editForm) return;
    setSaving(true);
    setFormError('');
    try {
      await onUpdateGear(editForm);
      setEditGear(null);
      setEditForm(null);
      notify('Gear item updated.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not update the gear item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rm-page">
      <PageHeader
        actions={
          <>
            <Button
              disabled={!sourceGear.length}
              icon="arrow-right"
              onClick={() => openTransfer()}
              variant="secondary"
            >
              Transfer gear
            </Button>
            <Button icon="plus" onClick={() => { setFormError(''); setAddOpen(true); }}>Add item</Button>
          </>
        }
        description="Drag gear between columns to update its status. On-site moves will ask for the property event."
        eyebrow="Admin workspace"
        title="Gear inventory"
      />

      {boardGear.length ? (
        <div className="rm-task-list-grid rm-gear-board">
          {gearLists.map((list) => {
            const listGear = orderedGear(
              boardGear.filter((item) => item.status === list.key),
              list.key,
            );
            return (
              <Card
                className="rm-task-list-card rm-gear-board__column"
                key={list.key}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTarget(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const item = boardGear.find((gearItem) => gearItem.id === event.dataTransfer.getData('text/gear-id'));
                  setDropTarget(null);
                  setDraggedGearId(null);
                  if (item) void moveGear(item, list.key);
                }}
                tone="bright"
              >
                <header className="rm-task-list-card__header">
                  <h2>{list.label}</h2>
                  <div><strong>{listGear.length}</strong></div>
                </header>
                <div className="rm-task-list-card__list">
                  {listGear.map((item) => (
                    <article
                      aria-grabbed={draggedGearId === item.id}
                      className={[
                        'rm-task-item',
                        'rm-task-item--compact',
                        'rm-task-item--normal',
                        'rm-gear-board__item',
                        draggedGearId === item.id ? 'is-dragging' : '',
                        dropTarget?.gearId === item.id ? `is-drop-${dropTarget.edge}` : '',
                      ].filter(Boolean).join(' ')}
                      draggable
                      key={item.id}
                      onDragEnd={() => {
                        setDraggedGearId(null);
                        setDropTarget(null);
                      }}
                      onDragOver={(event) => {
                        if (draggedGearId === item.id) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const bounds = event.currentTarget.getBoundingClientRect();
                        setDropTarget({
                          edge: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
                          gearId: item.id,
                        });
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/gear-id', item.id);
                        setDraggedGearId(item.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const movingItem = boardGear.find((gearItem) => gearItem.id === event.dataTransfer.getData('text/gear-id'));
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const edge = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                        setDropTarget(null);
                        setDraggedGearId(null);
                        if (movingItem) void moveGear(movingItem, list.key, item.id, edge);
                      }}
                      title="Drag to move. Click to edit."
                    >
                      <button
                        className="rm-task-item__open"
                        onClick={() => openEdit(item)}
                        type="button"
                      >
                        <Avatar
                          name={item.assignedTo || item.location || 'Realty Media'}
                          size="sm"
                          src={item.assignedToUserId ? memberAvatarByUserId.get(item.assignedToUserId) : undefined}
                        />
                        <span className="rm-task-item__row-content">
                          <strong>{item.name}</strong>
                          <small>{item.assignedTo || item.calendarEventTitle || item.location} · {item.category}</small>
                        </span>
                      </button>
                    </article>
                  ))}
                  {!listGear.length ? <div className="rm-task-list-card__empty">Drop gear here</div> : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rm-empty-collection" tone="bright">
          <EmptyState
            action={<Button onClick={() => setAddOpen(true)}>Add the first item</Button>}
            description="Add cameras, lenses, audio, lighting, drones, and support gear."
            icon="camera"
            title="No gear tracked yet"
          />
        </Card>
      )}

      <Modal
        description="Create a uniquely tagged item in Realty Media inventory."
        onClose={() => setAddOpen(false)}
        open={addOpen}
        title="Add gear item"
      >
        <form className="rm-action-form" onSubmit={submitGear}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field">
            <span>Item name</span>
            <input onChange={(event) => setGearForm((current) => ({ ...current, name: event.target.value }))} placeholder="Sony FX3" required value={gearForm.name} />
          </label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Asset tag</span>
              <input onChange={(event) => setGearForm((current) => ({ ...current, assetTag: event.target.value }))} placeholder="RM-CAM-001" required value={gearForm.assetTag} />
            </label>
            <label className="rm-field">
              <span>Category</span>
              <select onChange={(event) => setGearForm((current) => ({ ...current, category: event.target.value as GearItem['category'] }))} value={gearForm.category}>
                {(['camera', 'lens', 'audio', 'drone', 'lighting', 'support'] as const).map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
          </div>
          <label className="rm-field">
            <span>Notes</span>
            <textarea onChange={(event) => setGearForm((current) => ({ ...current, notes: event.target.value }))} rows={3} value={gearForm.notes} />
          </label>
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => setAddOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={saving || !gearForm.name.trim() || !gearForm.assetTag.trim()} type="submit">{saving ? 'Adding…' : 'Add item'}</Button>
          </footer>
        </form>
      </Modal>

      <Modal
        description="Update the inventory details for this item. Use Transfer gear for assignment and location changes."
        onClose={() => { setEditGear(null); setEditForm(null); }}
        open={Boolean(editGear && editForm)}
        title={editGear ? `Edit ${editGear.name}` : 'Edit gear item'}
      >
        {editForm ? (
          <form className="rm-action-form" onSubmit={submitEdit}>
            {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
            <label className="rm-field">
              <span>Item name</span>
              <input onChange={(event) => setEditForm((current) => current ? ({ ...current, name: event.target.value }) : current)} required value={editForm.name} />
            </label>
            <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Asset tag</span>
                <input onChange={(event) => setEditForm((current) => current ? ({ ...current, assetTag: event.target.value }) : current)} required value={editForm.assetTag} />
              </label>
              <label className="rm-field">
                <span>Category</span>
                <select onChange={(event) => setEditForm((current) => current ? ({ ...current, category: event.target.value as GearItem['category'] }) : current)} value={editForm.category}>
                  {(['camera', 'lens', 'audio', 'drone', 'lighting', 'support'] as const).map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
            </div>
            <label className="rm-field">
              <span>Notes</span>
              <textarea onChange={(event) => setEditForm((current) => current ? ({ ...current, notes: event.target.value }) : current)} rows={3} value={editForm.notes} />
            </label>
            <footer className="rm-dialog-actions">
              <Button disabled={saving} onClick={() => { setEditGear(null); setEditForm(null); }} variant="secondary">Cancel</Button>
              <Button disabled={saving || !onUpdateGear || !editForm.name.trim() || !editForm.assetTag.trim()} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
            </footer>
          </form>
        ) : null}
      </Modal>

      <Modal
        className="aw-form-dialog aw-gear-transfer-modal"
        description="Move an item back to the studio, onto a property, or into service."
        onClose={() => setTransferOpen(false)}
        open={transferOpen}
        title="Transfer gear"
      >
        <form className="rm-action-form" onSubmit={submitTransfer}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field">
            <span>Gear item</span>
            <div className="aw-select-control"><select onChange={(event) => setTransferForm((current) => ({ ...current, gearId: event.target.value }))} required value={transferForm.gearId}>
              {sourceGear.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.serial}</option>)}
            </select><Icon name="chevron-down" size={18} /></div>
          </label>
          <label className="rm-field">
            <span>New status</span>
            <div className="aw-select-control"><select
              onChange={(event) => setTransferForm((current) => ({
                ...current,
                eventId: undefined,
                propertyId: undefined,
                status: event.target.value as TransferGearInput['status'],
              }))}
              value={transferForm.status}
            >
              <option value="available">Returned / available</option>
              <option value="on_site">Placed on site</option>
              <option value="maintenance">Sent to service</option>
            </select><Icon name="chevron-down" size={18} /></div>
          </label>
          {transferForm.status === 'on_site' ? (
            <label className="rm-field">
              <span>Calendar event</span>
              <div className="aw-select-control"><select
                onChange={(event) => {
                  const calendarEvent = sourceEvents.find((item) => item.id === event.target.value);
                  const property = properties.find((item) => (
                    item.id === calendarEvent?.propertyId
                    || item.name === calendarEvent?.propertyName
                  ));
                  setTransferForm((current) => ({
                    ...current,
                    eventId: calendarEvent?.id,
                    location: calendarEvent?.location || property?.location || current.location,
                    propertyId: property?.id,
                  }));
                }}
                required
                value={transferForm.eventId ?? ''}
              >
                <option value="">Choose a scheduled property event</option>
                {gearEligibleEvents.map((item) => <option key={item.id} value={item.id}>{gearEventOptionLabel(item)}</option>)}
              </select><Icon name="chevron-down" size={18} /></div>
            </label>
          ) : null}
          <label className="rm-field">
            <span>Location</span>
            <input onChange={(event) => setTransferForm((current) => ({ ...current, location: event.target.value }))} placeholder="Studio, property, or service centre" value={transferForm.location} />
          </label>
          <label className="rm-field">
            <span>Custody note</span>
            <textarea onChange={(event) => setTransferForm((current) => ({ ...current, note: event.target.value }))} rows={3} value={transferForm.note} />
          </label>
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => setTransferOpen(false)} variant="secondary">Cancel</Button>
            <Button
              disabled={
                saving
                || !transferForm.gearId
                || (transferForm.status === 'on_site' && (!transferForm.propertyId || !transferForm.eventId))
              }
              type="submit"
            >
              {saving ? 'Transferring…' : 'Confirm transfer'}
            </Button>
          </footer>
        </form>
      </Modal>

    </div>
  );
}
