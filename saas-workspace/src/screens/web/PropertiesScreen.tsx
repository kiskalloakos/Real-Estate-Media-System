import { useMemo, useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  Icon,
  KpiCard,
  Modal,
  PageHeader,
  ProgressBar,
  SectionHeader,
  StatusPill,
  useToast,
  type PortalRole,
} from '@/components/web';

import { demoProperties } from './demoData';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import { PropertyCard } from './shared';
import type {
  ClientSummary,
  CreatePropertyInput,
  PropertySummary,
  UpdatePropertyInput,
} from './types';

export interface PropertiesScreenProps {
  clients?: ClientSummary[];
  onArchiveProperty?: (propertyId: string) => Promise<void>;
  onCreateProperty?: (input: CreatePropertyInput) => Promise<void>;
  onUpdateProperty?: (input: UpdatePropertyInput) => Promise<void>;
  properties?: PropertySummary[];
  role: PortalRole;
}

const emptyForm: CreatePropertyInput = {
  clientId: '',
  description: '',
  scriptingBrief: '',
  location: '',
  name: '',
  status: 'onboarding',
};

export function PropertiesScreen({
  clients = [],
  onArchiveProperty,
  onCreateProperty,
  onUpdateProperty,
  properties,
  role,
}: PropertiesScreenProps) {
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<CreatePropertyInput>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertySummary | null>(null);
  const [editProperty, setEditProperty] = useState<PropertySummary | null>(null);
  const [editForm, setEditForm] = useState<UpdatePropertyInput | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PropertySummary | null>(null);
  const isPreview = properties === undefined;
  const sourceProperties =
    properties ??
    (role === 'client'
      ? demoProperties.filter((property) => property.clientId === 'client-cabana')
      : demoProperties);
  const visibleProperties = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return sourceProperties.filter((property) => {
      const queryMatch =
        !normalizedQuery ||
        [property.name, property.clientName, property.location]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      return queryMatch;
    });
  }, [query, sourceProperties]);
  const averageCompletion = sourceProperties.length
    ? Math.round(sourceProperties.reduce((sum, property) => sum + property.completion, 0) / sourceProperties.length)
    : 0;

  const openForm = () => {
    setForm({ ...emptyForm, clientId: clients[0]?.id ?? '' });
    setFormError('');
    setFormOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateProperty) return;
    setSaving(true);
    setFormError('');
    try {
      await onCreateProperty(form);
      setFormOpen(false);
      notify(`${form.name} was added to the property workspace.`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not create the property.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (property: PropertySummary) => {
    setSelectedProperty(null);
    setFormError('');
    setEditProperty(property);
    setEditForm({
      description: property.description,
      scriptingBrief: property.scriptingBrief,
      location: property.location === 'Location pending' ? '' : property.location,
      name: property.name,
      propertyId: property.id,
      status: property.workspaceStatus,
    });
  };

  const saveProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm || !onUpdateProperty) return;
    setSaving(true);
    setFormError('');
    try {
      await onUpdateProperty(editForm);
      setEditProperty(null);
      setEditForm(null);
      notify(`${editForm.name} was updated.`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not update the property.');
    } finally {
      setSaving(false);
    }
  };

  const archiveProperty = async () => {
    if (!archiveTarget || !onArchiveProperty) return;
    setSaving(true);
    try {
      await onArchiveProperty(archiveTarget.id);
      notify(`${archiveTarget.name} was deleted.`);
      setArchiveTarget(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not delete the property.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rm-page">
      <PageHeader
        actions={
          role === 'admin' ? (
            <Button icon="plus" onClick={openForm}>Add property</Button>
          ) : undefined
        }
        description={
          role === 'client'
            ? 'Campaign progress, content and social results for every property you own.'
            : role === 'team_member'
              ? 'The properties assigned to your production queue.'
              : 'Every client property, campaign milestone and performance signal.'
        }
        eyebrow={role === 'client' ? 'Your portfolio' : 'Production library'}
        title="Properties"
      />

      <section aria-label="Property overview" className="rm-kpi-grid rm-kpi-grid--three">
        <KpiCard
          detail={sourceProperties.length ? 'Currently visible in this workspace' : 'Add the first client property'}
          icon="building"
          label={role === 'client' ? 'Your properties' : 'Tracked properties'}
          tone="dark"
          value={String(sourceProperties.length)}
        />
        <KpiCard
          detail={isPreview ? 'Instagram performance' : 'Connected Instagram performance'}
          icon="trend-up"
          label="Combined reach"
          trend={isPreview ? '18.7%' : undefined}
          value={isPreview ? '1.26m' : '—'}
        />
        <KpiCard
          detail={sourceProperties.length ? 'Across the complete property portfolio' : 'No property progress recorded'}
          icon="trend-up"
          label="Average progress"
          value={`${averageCompletion}%`}
        />
      </section>

      <Card className="rm-collection-toolbar" tone="transparent">
        <label className="rm-inline-search rm-inline-search--dark">
          <Icon name="search" size={17} />
          <span className="rm-visually-hidden">Search properties</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search properties…"
            type="search"
            value={query}
          />
        </label>
      </Card>

      {visibleProperties.length ? (
        <div className="rm-property-grid">
          {visibleProperties.map((property) => (
            <PropertyCard
              key={property.id}
              onOpen={setSelectedProperty}
              property={property}
              showClient={role !== 'client'}
            />
          ))}
        </div>
      ) : (
        <Card className="rm-empty-collection" tone="bright">
          <Icon name="building" size={28} />
          <h2>{sourceProperties.length ? 'No properties match this view.' : 'No properties yet.'}</h2>
          <p>
            {sourceProperties.length
              ? 'Clear the search to see every property.'
              : role === 'admin'
                ? 'Add a property and connect it to one of your clients.'
                : 'Properties will appear once Realty Media adds them.'}
          </p>
          {sourceProperties.length ? (
            <Button onClick={() => setQuery('')} variant="secondary">
              Clear search
            </Button>
          ) : role === 'admin' ? (
            <Button onClick={openForm}>Add the first property</Button>
          ) : null}
        </Card>
      )}

      {sourceProperties.length ? (
        <section className="rm-property-list-section">
          <SectionHeader
            description="A lighter operational view for quick scanning."
            kicker="Pipeline"
            title="Next milestones"
          />
          <Card className="rm-compact-milestones" tone="bright">
            {sourceProperties.slice(0, 4).map((property) => (
              <button key={property.id} onClick={() => setSelectedProperty(property)} type="button">
                <img alt="" src={property.coverUrl} />
                <span>
                  <strong>{property.name}</strong>
                  <small>{property.nextMilestone}</small>
                </span>
                <span className="rm-milestone-progress">
                  <strong>{property.completion}%</strong>
                  <small>complete</small>
                </span>
                <Icon name="chevron-right" size={17} />
              </button>
            ))}
          </Card>
        </section>
      ) : null}

      <Modal
        description="Connect the property to a client and seed its production workspace."
        onClose={() => setFormOpen(false)}
        open={formOpen}
        title="Add a property"
      >
        <form className="rm-action-form" onSubmit={submit}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          {!clients.length ? (
            <div className="rm-feedback rm-feedback--warning">
              Create a client before adding their first property.
            </div>
          ) : null}
          <label className="rm-field">
            <span>Client</span>
            <select
              disabled={!clients.length}
              onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
              required
              value={form.clientId}
            >
              <option value="">Choose a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="rm-field">
            <span>Property name</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Mountain View Apuseni"
              required
              value={form.name}
            />
          </label>
          <label className="rm-field">
            <span>Location</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="City, county, or area"
              value={form.location}
            />
          </label>
          <label className="rm-field">
            <span>Property brief</span>
            <textarea
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="What should the production team know?"
              rows={4}
              value={form.description}
            />
          </label>
          <label className="rm-field">
            <span>Cabana scripting brief</span>
            <textarea
              onChange={(event) => setForm((current) => ({ ...current, scriptingBrief: event.target.value }))}
              placeholder="Add every factual detail the scriptwriter can use: amenities, capacity, rooms, guest activities, views, access, nearby places, booking rules, discounts, and anything that must or must not be said."
              rows={7}
              value={form.scriptingBrief}
            />
          </label>
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => setFormOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={saving || !clients.length || !form.clientId || !form.name.trim()} type="submit">
              {saving ? 'Adding…' : 'Add property'}
            </Button>
          </footer>
        </form>
      </Modal>

      <Modal
        description={selectedProperty ? `${selectedProperty.clientName} · ${selectedProperty.location}` : undefined}
        onClose={() => setSelectedProperty(null)}
        open={Boolean(selectedProperty)}
        title={selectedProperty?.name ?? 'Property'}
      >
        {selectedProperty ? (
          <div className="rm-property-detail">
            <img alt={`${selectedProperty.name} exterior`} src={selectedProperty.coverUrl} />
            <div className="rm-property-detail__headline">
              <strong>{selectedProperty.completion}% complete</strong>
            </div>
            <ProgressBar label="Campaign progress" value={selectedProperty.completion} />
            <dl className="rm-detail-list">
              <div><dt>Client</dt><dd>{selectedProperty.clientName}</dd></div>
              <div>
                <dt>Assigned team</dt>
                <dd>
                  {selectedProperty.assignedTeamNames.length
                    ? selectedProperty.assignedTeamNames.join(', ')
                    : 'No team member assigned'}
                </dd>
              </div>
              <div><dt>Next milestone</dt><dd>{selectedProperty.nextMilestone}</dd></div>
              <div><dt>Views</dt><dd>{selectedProperty.analytics.views}</dd></div>
              <div><dt>Follower growth</dt><dd>{selectedProperty.analytics.followers}</dd></div>
              <div><dt>Engagement</dt><dd>{selectedProperty.analytics.engagement}</dd></div>
            </dl>
            <StatusPill tone="neutral">
              Social reporting will populate when the FameScale connection is approved.
            </StatusPill>
            {role === 'admin' ? (
              <footer className="rm-dialog-actions">
                <Button onClick={() => openEdit(selectedProperty)} variant="secondary">Edit property</Button>
                <Button onClick={() => setSelectedProperty(null)}>Done</Button>
              </footer>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        description={editProperty ? `${editProperty.clientName} · Changes sync to web and iOS.` : undefined}
        onClose={() => {
          if (!saving) {
            setEditProperty(null);
            setEditForm(null);
          }
        }}
        open={Boolean(editProperty && editForm)}
        title={`Edit ${editProperty?.name ?? 'property'}`}
      >
        {editForm ? (
          <form className="rm-action-form" onSubmit={saveProperty}>
            {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
            <label className="rm-field">
              <span>Property name</span>
              <input
                onChange={(event) => setEditForm((current) => current ? ({ ...current, name: event.target.value }) : current)}
                required
                value={editForm.name}
              />
            </label>
            <label className="rm-field">
              <span>Location</span>
              <input
                onChange={(event) => setEditForm((current) => current ? ({ ...current, location: event.target.value }) : current)}
                value={editForm.location}
              />
            </label>
            <label className="rm-field">
              <span>Property brief</span>
              <textarea
                onChange={(event) => setEditForm((current) => current ? ({ ...current, description: event.target.value }) : current)}
                rows={5}
                value={editForm.description}
              />
            </label>
            <label className="rm-field">
              <span>Cabana scripting brief</span>
              <textarea
                onChange={(event) => setEditForm((current) => current ? ({ ...current, scriptingBrief: event.target.value }) : current)}
                placeholder="Amenities, capacity, guest activities, views, access, nearby places, booking rules, discounts, and must-use facts."
                rows={8}
                value={editForm.scriptingBrief}
              />
            </label>
            <footer className="rm-dialog-actions rm-dialog-actions--split">
              <Button
                disabled={saving}
                onClick={() => {
                  setEditProperty(null);
                  setEditForm(null);
                  setArchiveTarget(editProperty);
                }}
                variant="danger"
              >
                Delete property
              </Button>
              <div>
                <Button disabled={saving} onClick={() => { setEditProperty(null); setEditForm(null); }} variant="secondary">Cancel</Button>
                <Button disabled={saving || !editForm.name.trim()} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </footer>
          </form>
        ) : null}
      </Modal>

      <ArchiveConfirmModal
        busy={saving}
        label="property"
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void archiveProperty()}
        open={Boolean(archiveTarget)}
      />
    </div>
  );
}
