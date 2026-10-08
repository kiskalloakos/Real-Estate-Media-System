import { upcomingEvents } from '@/lib/upcoming-events';
import { chronologicalFulfillment, fulfillmentCompletion, simplifiedFulfillmentStatus } from '@/lib/monthly-fulfillment';
import { useMemo, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';

import {
  Avatar,
  Button,
  Card,
  Icon,
  IconButton,
  KpiCard,
  Modal,
  RichTextEditor,
  StatusPill,
  useToast,
} from '@/components/web';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import { clearLocalDraft, readLocalDraft, useLocalDraft } from '@/hooks/use-local-draft';
import { beginInstagramConnection } from '@/lib/instagram-service';
import { monthlyScheduleFromPackage, servicePackageTemplates } from '@/lib/service-package-templates';

import { demoClients } from './demoData';
import { ClientMembersPanel } from './ClientMembersPanel';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import { prefillAgreementFromPdf } from './pdf-prefill';
import { formatRon } from './shared';
import type {
  AgencyMemberSummary,
  AgreementSummary,
  ClientMemberSummary,
  ClientSummary,
  CalendarEvent,
  CreateCalendarEventInput,
  CreateClientInput,
  CreateJobInput,
  CreateClientPropertyInput,
  CreateClientMemberInput,
  CreatePropertyInput,
  CreateTaskInput,
  InstagramAccountSummary,
  JobSummary,
  PropertySummary,
  ReviewItem,
  TaskSummary,
  UploadDeliverableInput,
  UpdateClientInput,
  UpdateContractDeliverableStatusInput,
  UpdateClientTeamInput,
  UpdateClientMemberAccessInput,
  UpdatePropertyInput,
} from './types';

export interface ClientsScreenProps {
  accounts?: InstagramAccountSummary[];
  agreements?: AgreementSummary[];
  agencyMembers?: AgencyMemberSummary[];
  calendarEvents?: CalendarEvent[];
  clientMembers?: ClientMemberSummary[];
  clients?: ClientSummary[];
  currentUserId?: string;
  jobs?: JobSummary[];
  onCreateClient?: (client: CreateClientInput) => void | Promise<void>;
  onCreateClientMember?: (input: CreateClientMemberInput) => Promise<void>;
  onCreateEvent?: (input: CreateCalendarEventInput) => Promise<void>;
  onCreateJob?: (input: CreateJobInput) => Promise<void>;
  onCreateProperty?: (input: CreatePropertyInput) => Promise<void>;
  onCreateTask?: (input: CreateTaskInput) => Promise<void>;
  onOpenTask?: (taskId: string) => void;
  onOpenReview?: (reviewId: string) => void;
  onOpenProductionCalendar?: (eventId: string) => void;
  onUploadDeliverable?: (input: UploadDeliverableInput) => Promise<void>;
  onArchiveClient?: (clientId: string) => Promise<void>;
  onArchiveDeliverable?: (reviewId: string) => Promise<void>;
  onArchiveProperty?: (propertyId: string) => Promise<void>;
  onDeleteContractDocument?: (input: { documentId: string; storagePath?: string }) => Promise<void>;
  onUpdateClient?: (input: UpdateClientInput) => Promise<void>;
  onUpdateContractDeliverableStatus?: (input: UpdateContractDeliverableStatusInput) => Promise<void>;
  onUpdateClientTeam?: (input: UpdateClientTeamInput) => Promise<void>;
  onUpdateClientMember?: (input: UpdateClientMemberAccessInput) => Promise<void>;
  onOpenWorkspace?: (client: ClientSummary) => void;
  onUpdateProperty?: (input: UpdatePropertyInput) => Promise<void>;
  properties?: PropertySummary[];
  reviews?: ReviewItem[];
  tasks?: TaskSummary[];
}

type ClientContentForm = Omit<UploadDeliverableInput, 'contentHtml' | 'file' | 'kind'> & {
  contentHtml: string;
  file: File | null;
  kind: 'video' | 'script';
};
type ClientContentDraft = Omit<ClientContentForm, 'file'>;

const createEmptyProperty = (): CreateClientPropertyInput => ({
  description: '',
  location: '',
  name: '',
});

const createEmptyClient = (): CreateClientInput => ({
  companyName: '',
  contactName: '',
  contractDocuments: [],
  contractMonths: '',
  contractStartsOn: '',
  deliverablePropertyIds: {},
  createLogin: true,
  email: '',
  location: '',
  monthlyDeliverables: '',
  monthlyPrice: '',
  profilePhoto: null,
  properties: [createEmptyProperty()],
  packageTemplateId: '',
  requirePasswordReset: true,
  temporaryPassword: '',
  totalContractValue: '',
  workflowTasks: [],
});

function agreementMonthLabels(startsOn: string, months: string) {
  const start = new Date(`${startsOn}T12:00:00`);
  const count = Number(months);
  if (Number.isNaN(start.valueOf()) || !Number.isInteger(count) || count < 1) return [];
  return Array.from({ length: Math.min(count, 60) }, (_, index) => {
    const date = new Date(start);
    date.setMonth(date.getMonth() + index);
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
  });
}

function monthlyDeliverableSchedule(value: string, startsOn: string, months: string) {
  const saved = new Map(
    value
      .split(/\r?\n/)
      .map((line) => line.match(/^([^:]+):\s*(.+)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1].trim().toLowerCase(), match[2].trim()]),
  );
  return agreementMonthLabels(startsOn, months).map((label) => ({
    label,
    value: saved.get(label.toLowerCase()) ?? '',
  }));
}

function writeMonthlyDeliverableSchedule(
  rows: { label: string; value: string }[],
) {
  return rows
    .map((row) => `${row.label}: ${row.value.trim()}`)
    .filter((row) => !row.endsWith(':'))
    .join('\n');
}

function plainTextFromHtml(html = '') {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const element = document.createElement('div');
  element.innerHTML = html;
  return element.textContent?.trim() ?? '';
}

function agreementScheduleFromSummary(summary?: string) {
  if (!summary) return { monthlyDeliverables: '', deliverablePropertyIds: {} };
  try {
    const parsed = JSON.parse(summary) as { monthlyDeliverables?: unknown; deliverablePropertyIds?: unknown };
    return {
      monthlyDeliverables: typeof parsed.monthlyDeliverables === 'string' ? parsed.monthlyDeliverables : '',
      deliverablePropertyIds: parsed.deliverablePropertyIds && typeof parsed.deliverablePropertyIds === 'object' && !Array.isArray(parsed.deliverablePropertyIds)
        ? parsed.deliverablePropertyIds as Record<string, string>
        : {},
    };
  } catch {
    return { monthlyDeliverables: '', deliverablePropertyIds: {} };
  }
}

function scheduleFromAgreementSummary(summary?: string) {
  return agreementScheduleFromSummary(summary).monthlyDeliverables;
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
  return Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

interface ClientWorkspacePageProps {
  accounts: InstagramAccountSummary[];
  agreement?: AgreementSummary;
  agencyMembers: AgencyMemberSummary[];
  calendarEvents: CalendarEvent[];
  client: ClientSummary;
  clientMembers: ClientMemberSummary[];
  connectingInstagram: boolean;
  currentUserId?: string;
  onBack: () => void;
  onConnectInstagram: (client: ClientSummary) => Promise<void>;
  onCreateClientMember?: (input: CreateClientMemberInput) => Promise<void>;
  onCreateEvent?: (input: CreateCalendarEventInput) => Promise<void>;
  onCreateJob?: (input: CreateJobInput) => Promise<void>;
  onCreateProperty?: (input: CreatePropertyInput) => Promise<void>;
  onCreateTask?: (input: CreateTaskInput) => Promise<void>;
  onOpenTask?: (taskId: string) => void;
  onArchiveProperty?: (propertyId: string) => Promise<void>;
  onDeleteContractDocument?: (input: { documentId: string; storagePath?: string }) => Promise<void>;
  onEditClient: (client: ClientSummary) => void;
  onOpenReview?: (reviewId: string) => void;
  onOpenProductionCalendar?: (eventId: string) => void;
  onUpdateClientMember?: (input: UpdateClientMemberAccessInput) => Promise<void>;
  onUpdateContractDeliverableStatus?: (input: UpdateContractDeliverableStatusInput) => Promise<void>;
  onUpdateClientTeam?: (input: UpdateClientTeamInput) => Promise<void>;
  onUpdateProperty?: (input: UpdatePropertyInput) => Promise<void>;
  onUploadDeliverable?: (input: UploadDeliverableInput) => Promise<void>;
  jobs: JobSummary[];
  properties: PropertySummary[];
  reviews: ReviewItem[];
  tasks: TaskSummary[];
}

function ClientWorkspacePage({
  accounts,
  agreement,
  agencyMembers,
  calendarEvents,
  client,
  clientMembers,
  connectingInstagram,
  currentUserId,
  onBack,
  onConnectInstagram,
  onCreateClientMember,
  onCreateEvent,
  onCreateJob,
  onCreateProperty,
  onCreateTask,
  onOpenTask,
  onArchiveProperty,
  onDeleteContractDocument,
  onEditClient,
  onOpenReview,
  onOpenProductionCalendar,
  onUpdateClientMember,
  onUpdateContractDeliverableStatus,
  onUpdateClientTeam,
  onUpdateProperty,
  onUploadDeliverable,
  jobs,
  properties,
  reviews,
  tasks,
}: ClientWorkspacePageProps) {
  const { notify } = useToast();
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [editProperty, setEditProperty] = useState<PropertySummary | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState<UpdatePropertyInput | null>(null);
  const [propertyArchiveTarget, setPropertyArchiveTarget] = useState<PropertySummary | null>(null);
  const [contractDocumentTarget, setContractDocumentTarget] = useState<NonNullable<AgreementSummary['documents']>[number] | null>(null);
  const [contentOpen, setContentOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [jobForm, setJobForm] = useState<CreateJobInput>({ brief: '', clientId: client.id, dueOn: '', kind: 'content_campaign', name: '', startsOn: '' });
  const [taskOpen, setTaskOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamDraft, setTeamDraft] = useState(client.assignedTeam ?? []);
  const [teamMemberId, setTeamMemberId] = useState('');
  const [teamRole, setTeamRole] = useState('');
  const [savingWorkspaceItem, setSavingWorkspaceItem] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [propertyForm, setPropertyForm] = useState<CreatePropertyInput>({
    clientId: client.id,
    coverImage: null,
    description: '',
    scriptingBrief: '',
    location: client.location,
    name: '',
    status: 'onboarding',
  });
  const [contentForm, setContentForm] = useState<ClientContentForm>({
    contentHtml: '',
    file: null,
    kind: 'video',
    propertyId: '',
    title: '',
  });
  const [eventForm, setEventForm] = useState<CreateCalendarEventInput>({
    assigneeUserIds: [],
    clientId: client.id,
    date: new Date().toISOString().slice(0, 10),
    description: '',
    end: '',
    endDate: new Date().toISOString().slice(0, 10),
    location: client.location,
    propertyId: properties[0]?.id,
    start: '09:00',
    title: '',
    type: 'shoot',
    visibility: 'client',
    workScope: 'client',
  });
  const [taskForm, setTaskForm] = useState<CreateTaskInput>({
    assigneeUserId: undefined,
    clientId: client.id,
    description: '',
    dueDate: '',
    dueTime: '17:00',
    priority: 'normal',
    propertyId: properties[0]?.id,
    title: '',
    visibility: 'team',
  });
  const clientPropertyIds = new Set(properties.map((property) => property.id));
  const agreementSchedule = agreementScheduleFromSummary(agreement?.summary);
  const agreementPropertyNames = new Map(properties.map((property) => [property.id, property.name]));
  const clientReviews = reviews.filter(
    (review) =>
      (review.propertyId && clientPropertyIds.has(review.propertyId)) ||
      review.clientName === client.name,
  );
  const clientEvents = upcomingEvents(calendarEvents
    .filter(
      (event) =>
        event.clientId === client.id ||
        (event.propertyId && clientPropertyIds.has(event.propertyId)),
    )
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date)));
  const clientAccounts = accounts.filter((account) => account.clientId === client.id);
  const clientTasks = tasks
    .filter(
      (task) =>
        task.clientId === client.id ||
        (task.propertyId && clientPropertyIds.has(task.propertyId)),
    )
    .slice()
    .sort((left, right) => (left.dueAt ?? '').localeCompare(right.dueAt ?? ''));
  const contractFulfillment = chronologicalFulfillment(agreement?.deliverables);
  const [fulfillmentOverrides, setFulfillmentOverrides] = useState<Record<string, UpdateContractDeliverableStatusInput['status']>>({});
  const [savingFulfillmentId, setSavingFulfillmentId] = useState<string | null>(null);
  const fulfillmentStatus = (deliverable: NonNullable<AgreementSummary['deliverables']>[number]) =>
    simplifiedFulfillmentStatus(fulfillmentOverrides[deliverable.id] ?? deliverable.status);
  const fulfillmentQuantity = (status?: UpdateContractDeliverableStatusInput['status']) =>
    contractFulfillment.reduce(
      (total, deliverable) => total + (status && fulfillmentStatus(deliverable) !== status ? 0 : deliverable.quantity),
      0,
    );
  const fulfillmentProgress = fulfillmentCompletion(contractFulfillment.map(item => ({ ...item, status: fulfillmentStatus(item) })));
  const setFulfillmentStatus = async (
    deliverableId: string,
    status: UpdateContractDeliverableStatusInput['status'],
  ) => {
    if (!onUpdateContractDeliverableStatus || savingFulfillmentId) return;
    setSavingFulfillmentId(deliverableId);
    setFulfillmentOverrides((current) => ({ ...current, [deliverableId]: status }));
    try {
      await onUpdateContractDeliverableStatus({ deliverableId, status });
      notify('Fulfillment updated.');
    } catch (error) {
      setFulfillmentOverrides((current) => {
        const next = { ...current };
        delete next[deliverableId];
        return next;
      });
      notify(error instanceof Error ? error.message : 'Could not update fulfillment.', 'error');
    } finally {
      setSavingFulfillmentId(null);
    }
  };
  const assignedTeam = (client.assignedTeam ?? []).flatMap((assignment) => {
    const member = agencyMembers.find((candidate) => candidate.userId === assignment.userId);
    return member ? [{ ...assignment, member }] : [];
  });
  const contentDraftKey = `rm:draft:client-content:${client.id}`;
  const contentDraft = useMemo<ClientContentDraft>(() => ({
    contentHtml: contentForm.contentHtml,
    kind: contentForm.kind,
    propertyId: contentForm.propertyId,
    title: contentForm.title,
  }), [
    contentForm.contentHtml,
    contentForm.kind,
    contentForm.propertyId,
    contentForm.title,
  ]);
  useLocalDraft(
    contentDraftKey,
    contentDraft,
    contentOpen,
    (draft) => Boolean(draft.title.trim() || plainTextFromHtml(draft.contentHtml)),
  );

  const createPropertyForClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateProperty) return;
    setSavingWorkspaceItem(true);
    setWorkspaceError('');
    try {
      await onCreateProperty(propertyForm);
      setPropertyOpen(false);
      setPropertyForm({
        clientId: client.id,
        coverImage: null,
        description: '',
        scriptingBrief: '',
        location: client.location,
        name: '',
        status: 'onboarding',
      });
      notify(`${propertyForm.name} was added to ${client.name}.`);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Could not add the property.',
      );
    } finally {
      setSavingWorkspaceItem(false);
    }
  };

  const openPropertyEditor = (property: PropertySummary) => {
    setWorkspaceError('');
    setEditProperty(property);
    setEditPropertyForm({
      coverImage: null,
      description: property.description,
      scriptingBrief: property.scriptingBrief,
      location: property.location === 'Location pending' ? '' : property.location,
      name: property.name,
      propertyId: property.id,
      status: property.workspaceStatus,
    });
  };

  const updateClientProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onUpdateProperty || !editPropertyForm) return;
    setSavingWorkspaceItem(true);
    setWorkspaceError('');
    try {
      await onUpdateProperty(editPropertyForm);
      setEditProperty(null);
      setEditPropertyForm(null);
      notify(`${editPropertyForm.name} was updated.`);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Could not update the property.',
      );
    } finally {
      setSavingWorkspaceItem(false);
    }
  };

  const archiveClientProperty = async () => {
    if (!propertyArchiveTarget || !onArchiveProperty) return;
    setSavingWorkspaceItem(true);
    setWorkspaceError('');
    try {
      await onArchiveProperty(propertyArchiveTarget.id);
      setEditProperty(null);
      setEditPropertyForm(null);
      setPropertyArchiveTarget(null);
      notify(`${propertyArchiveTarget.name} was deleted.`);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Could not delete the property.',
      );
    } finally {
      setSavingWorkspaceItem(false);
    }
  };

  const removeContractDocument = async () => {
    if (!contractDocumentTarget || !onDeleteContractDocument) return;
    if ((agreement?.documents?.length ?? 0) <= 1) {
      setContractDocumentTarget(null);
      notify('A client agreement needs at least one contract document. Upload a replacement before removing this one.', 'error');
      return;
    }
    setSavingWorkspaceItem(true);
    try {
      await onDeleteContractDocument({
        documentId: contractDocumentTarget.id,
        storagePath: contractDocumentTarget.storagePath,
      });
      setContractDocumentTarget(null);
      notify('Contract document deleted.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete the contract document.', 'error');
    } finally {
      setSavingWorkspaceItem(false);
    }
  };

  const uploadClientContent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onUploadDeliverable) return;
    if (!contentForm.propertyId) {
      setWorkspaceError('Choose the property this content was recorded for.');
      return;
    }
    if (contentForm.kind === 'script' && !plainTextFromHtml(contentForm.contentHtml)) {
      setWorkspaceError('Write the script before saving content.');
      return;
    }
    if (contentForm.kind === 'video' && !contentForm.file) {
      setWorkspaceError('Choose a video file before uploading content.');
      return;
    }
    setSavingWorkspaceItem(true);
    setWorkspaceError('');
    try {
      await onUploadDeliverable({
        contentHtml: contentForm.kind === 'script' ? contentForm.contentHtml : undefined,
        file: contentForm.kind === 'video' ? contentForm.file : null,
        kind: contentForm.kind,
        propertyId: contentForm.propertyId,
        title: contentForm.title,
      });
      setContentOpen(false);
      setContentForm({
        contentHtml: '',
        file: null,
        kind: 'video',
        propertyId: '',
        title: '',
      });
      clearLocalDraft(contentDraftKey);
      notify('Content uploaded to this client workspace.');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Could not upload the content.',
      );
    } finally {
      setSavingWorkspaceItem(false);
    }
  };

  const openContentCreator = () => {
    const draft = readLocalDraft<ClientContentDraft>(contentDraftKey);
    setWorkspaceError('');
    setContentForm({
      contentHtml: draft?.contentHtml ?? '',
      file: null,
      kind: draft?.kind === 'script' ? 'script' : 'video',
      propertyId: draft?.propertyId ?? '',
      title: draft?.title ?? '',
    });
    setContentOpen(true);
  };

  const closeContentCreator = () => {
    const hasScriptDraft = contentForm.kind === 'script'
      && Boolean(contentForm.title.trim() || plainTextFromHtml(contentForm.contentHtml));
    if (hasScriptDraft && !window.confirm('Close this script? Your draft will remain saved.')) return;
    setContentOpen(false);
  };

  const createClientEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateEvent) return;
    setSavingWorkspaceItem(true);
    setWorkspaceError('');
    try {
      await onCreateEvent(eventForm);
      setEventOpen(false);
      setEventForm((current) => ({ ...current, assigneeUserIds: [], description: '', title: '' }));
      notify('Production event added to this client.');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Could not add the event.',
      );
    } finally {
      setSavingWorkspaceItem(false);
    }
  };

  const createClientTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateTask) return;
    setSavingWorkspaceItem(true);
    setWorkspaceError('');
    try {
      await onCreateTask(taskForm);
      setTaskOpen(false);
      setTaskForm((current) => ({ ...current, description: '', title: '' }));
      notify('Task added to this client.');
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Could not add the task.',
      );
    } finally {
      setSavingWorkspaceItem(false);
    }
  };

  const addTeamDraftMember = () => {
    if (!teamMemberId || !teamRole.trim()) return;
    setTeamDraft((current) => [
      ...current.filter((assignment) => assignment.userId !== teamMemberId),
      { role: teamRole.trim(), userId: teamMemberId },
    ]);
    setTeamMemberId('');
    setTeamRole('');
  };

  const saveClientTeam = async () => {
    if (!onUpdateClientTeam) return;
    setSavingWorkspaceItem(true);
    setWorkspaceError('');
    try {
      await onUpdateClientTeam({ assignments: teamDraft, clientId: client.id });
      setTeamOpen(false);
      notify(`The ${client.name} team was updated.`);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Could not update the client team.',
      );
    } finally {
      setSavingWorkspaceItem(false);
    }
  };

  return (
    <div className="rm-client-workspace aw-client-detail">
      <header className="rm-client-workspace__header">
        <Button icon="chevron-left" onClick={onBack} variant="secondary">
          All clients
        </Button>
        <div className="rm-client-workspace__identity">
          <Avatar name={client.contactName} size="lg" src={client.avatarUrl} />
          <div>
            <h1>{client.name}</h1>
          </div>
        </div>
        <div className="rm-client-workspace__header-actions">
          <Button onClick={() => onEditClient(client)} variant="secondary">
            Edit client
          </Button>
        </div>
      </header>

      <section className="rm-client-workspace__metrics">
        <article>
          <span>Monthly agreement</span>
          <strong>{formatRon(client.monthlyPrice)}</strong>
        </article>
        <article>
          <span>Properties</span>
          <strong>{properties.length}</strong>
        </article>
        <article>
          <span>Open reviews</span>
          <strong>
            {clientReviews.filter((review) => review.status !== 'approved').length}
          </strong>
        </article>
        <article>
          <span>Upcoming production</span>
          <strong>{clientEvents.length}</strong>
        </article>
      </section>


      <section className="rm-client-workspace__section">
        <header>
          <div>
            <h2>Properties</h2>
          </div>
          <Button icon="plus" onClick={() => { setWorkspaceError(''); setPropertyOpen(true); }}>
            Add property
          </Button>
        </header>
        <div className="rm-client-workspace__property-grid">
          {properties.map((property) => (
            <button
              aria-label={`Edit ${property.name}`}
              className="rm-client-property-card"
              key={property.id}
              onClick={() => openPropertyEditor(property)}
              type="button"
            >
              {property.coverUrl ? (
                <span
                  aria-hidden="true"
                  className="rm-client-property-card__image"
                  style={{ backgroundImage: `url(${property.coverUrl})` } as CSSProperties}
                />
              ) : (
                <span aria-hidden="true" className="rm-client-property-card__image rm-client-property-card__image--empty">
                  <Icon name="building" size={30} />
                </span>
              )}
              <span className="rm-client-property-card__content">
                <strong>{property.name}</strong>
                <small>{property.location}</small>
                <span>{property.description || 'No description yet.'}</span>
              </span>
            </button>
          ))}
          {!properties.length ? (
            <div className="rm-client-workspace__empty">
              <Icon name="building" size={25} />
              <strong>No properties yet</strong>
              <p>Add this client’s first property to start production.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rm-client-workspace__section">
        <header><div><h2>Campaigns & jobs</h2><p>Work that can span a property or stand on its own.</p></div><Button icon="plus" onClick={() => { setJobForm({ brief: '', clientId: client.id, dueOn: '', kind: 'content_campaign', name: '', startsOn: '' }); setJobOpen(true); }}>New job</Button></header>
        {jobs.length ? <div className="rm-client-workspace__list">{jobs.map((job) => <div className="rm-client-workspace__calendar-link" key={job.id}><span className="rm-client-workspace__list-icon"><Icon name="briefcase" size={17}/></span><div><strong>{job.name}</strong><small>{job.kind.replaceAll('_', ' ')} · {job.status.replaceAll('_', ' ')}</small></div>{job.dueOn ? <span>{job.dueOn}</span> : null}</div>)}</div> : <div className="rm-client-workspace__empty rm-client-workspace__empty--small"><strong>No jobs planned yet</strong><p>Add a property launch or a client campaign to coordinate production.</p></div>}
      </section>

      <Modal onClose={() => setJobOpen(false)} open={jobOpen} title="New job or campaign">
        <form className="rm-profile-form" onSubmit={(event) => { event.preventDefault(); if (!onCreateJob || !jobForm.name.trim()) return; setSavingWorkspaceItem(true); setWorkspaceError(''); void onCreateJob(jobForm).then(() => { setJobOpen(false); notify('Job created.'); }).catch((error) => setWorkspaceError(error instanceof Error ? error.message : 'Could not create the job.')).finally(() => setSavingWorkspaceItem(false)); }}>
          <label className="rm-field"><span>Name</span><input autoFocus onChange={(event) => setJobForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. September personal brand campaign" required value={jobForm.name} /></label>
          <label className="rm-field"><span>Type</span><select onChange={(event) => setJobForm((current) => ({ ...current, kind: event.target.value as CreateJobInput['kind'] }))} value={jobForm.kind}><option value="content_campaign">Content campaign</option><option value="recurring_content">Recurring content</option><option value="property_launch">Property launch</option><option value="internal">Internal</option></select></label>
          <label className="rm-field"><span>Property (optional)</span><select onChange={(event) => setJobForm((current) => ({ ...current, propertyId: event.target.value || undefined }))} value={jobForm.propertyId ?? ''}><option value="">No property — campaign only</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label className="rm-field"><span>Brief</span><textarea onChange={(event) => setJobForm((current) => ({ ...current, brief: event.target.value }))} rows={3} value={jobForm.brief} /></label>
          <footer className="rm-dialog-actions"><Button disabled={savingWorkspaceItem} onClick={() => setJobOpen(false)} variant="secondary">Cancel</Button><Button disabled={savingWorkspaceItem || !jobForm.name.trim()} type="submit">{savingWorkspaceItem ? 'Creating…' : 'Create job'}</Button></footer>
        </form>
      </Modal>

      <div className="rm-client-workspace__columns">
      <section className="rm-client-workspace__section rm-fulfillment">
        <header>
          <div>
            <p className="rm-fulfillment__eyebrow">FULL CONTRACT</p>
            <h2>Fulfillment</h2>
            <p>Deliverables across the full agreement.</p>
          </div>
          <Button onClick={() => onEditClient(client)}>Edit scope</Button>
        </header>
        {contractFulfillment.length ? (
          <>
            <div className="rm-fulfillment__metrics">
              <div><span>In production</span><strong>{fulfillmentQuantity('in_progress')}</strong></div>
              <div><span>Delivered</span><strong>{fulfillmentQuantity('delivered')}</strong></div>
              <div><span>Completion</span><strong>{fulfillmentProgress.percentage}%</strong></div>
            </div>
            <div className="rm-fulfillment__list">
              {contractFulfillment.map((deliverable) => {
                const status = fulfillmentStatus(deliverable);
                const period = deliverable.name.split(':')[0]?.trim() ?? '';
                const propertyId = agreementSchedule.deliverablePropertyIds[period];
                const propertyName = propertyId ? agreementPropertyNames.get(propertyId) : undefined;
                return (
                  <div className={`rm-fulfillment__item is-${status}`} key={deliverable.id}>
                    <div className="aw-fulfillment-identity">{status === 'delivered' ? <Icon name="check" size={16}/> : <Icon name="minus" size={16}/>}<div><strong>{deliverable.name}</strong><small>{deliverable.quantity} contracted item{deliverable.quantity === 1 ? '' : 's'}{propertyName ? ` · ${propertyName}` : ''}</small></div></div>
                    <div className="aw-fulfillment-controls aw-fulfillment-select">
                    <select
                      aria-label={`Update ${deliverable.name} fulfillment status`}
                      disabled={!onUpdateContractDeliverableStatus || savingFulfillmentId === deliverable.id}
                      onChange={(event) => void setFulfillmentStatus(deliverable.id, event.target.value as UpdateContractDeliverableStatusInput['status'])}
                      value={status}
                    >
                      <option value="planned">Planned</option>
                      <option value="in_progress">In production</option>
                      <option value="delivered">Delivered</option>
                    </select>
                    <Icon name="chevron-down" size={15}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rm-client-workspace__empty rm-client-workspace__empty--small">
            <strong>No contracted deliverables</strong>
            <p>Add deliverables to the agreement to track fulfillment.</p>
          </div>
        )}
      </section>

        <section className="rm-client-workspace__section">
          <header><div><h2>Contract documents</h2></div><Button onClick={() => onEditClient(client)}>Add document</Button></header>
          {agreement?.documents?.length ? (
            <div className="rm-client-deliverables-list">
              {agreement.documents.map((document) => <div className="rm-client-document-row" key={document.id}>
                {document.url ? <a className="aw-contract-document-link" href={document.url} rel="noreferrer" target="_blank"><Icon name="folder" size={18}/><span>{document.name}</span><Icon name="arrow-up-right" size={15}/></a> : <span className="aw-contract-document-link"><Icon name="folder" size={18}/><span>{document.name}</span></span>}
                <IconButton icon="x" label={`Delete ${document.name}`} onClick={() => setContractDocumentTarget(document)} size="sm" />
              </div>)}
            </div>
          ) : <div className="rm-client-workspace__empty"><strong>No contract documents attached yet</strong></div>}
        </section>
      </div>

      <div className="rm-client-workspace__columns">
        <section className="rm-client-workspace__section">
          <header>
            <div>
              <h2>Content</h2>
            </div>
            <Button
              disabled={!properties.length}
              icon="plus"
              onClick={openContentCreator}
            >
              Add content
            </Button>
          </header>
          <div className="rm-client-workspace__list">
            {clientReviews.map((review) => (
              <button
                aria-label={`Open ${review.title} in the review room`}
                className="rm-client-workspace__content-link"
                key={review.id}
                onClick={() => onOpenReview?.(review.id)}
                type="button"
              >
                <span className="rm-client-workspace__list-icon">
                  <Icon name="play" size={18} />
                </span>
                <div>
                  <strong>{review.title}</strong>
                  <small>{review.propertyName} · {review.version}</small>
                </div>
              </button>
            ))}
            {!clientReviews.length ? (
              <div className="rm-client-workspace__empty rm-client-workspace__empty--small">
                <Icon name="play" size={22} />
                <strong>No content yet</strong>
                <p>Upload a script or production file for this client.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rm-client-workspace__section">
          <header>
            <div>
              <h2>Production calendar</h2>
            </div>
            <Button icon="plus" onClick={() => { setWorkspaceError(''); setEventOpen(true); }}>
              Add event
            </Button>
          </header>
          <div className="rm-client-workspace__list">
            {clientEvents.slice(0, 8).map((event) => (
              <button
                aria-label={`Open ${event.title} in the production calendar`}
                className="rm-client-workspace__calendar-link"
                key={event.id}
                onClick={() => onOpenProductionCalendar?.(event.id)}
                type="button"
              >
                <span className="rm-client-workspace__event-date">
                  <strong>{new Date(`${event.date}T12:00:00`).getDate()}</strong>
                  <small>
                    {new Date(`${event.date}T12:00:00`).toLocaleDateString('en', {
                      month: 'short',
                    })}
                  </small>
                </span>
                <div>
                  <strong>{event.title}</strong>
                  <small>
                    {event.allDay ? 'All day' : `${event.start}${event.end ? `–${event.end}` : ''}`} · {event.propertyName}
                  </small>
                </div>
                <StatusPill tone="accent">{event.type}</StatusPill>
              </button>
            ))}
            {!clientEvents.length ? (
              <div className="rm-client-workspace__empty rm-client-workspace__empty--small">
                <Icon name="calendar" size={22} />
                <strong>No upcoming production</strong>
                <p>No future shoots or deadlines are scheduled.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="rm-client-workspace__columns">
        <section className="rm-client-workspace__section">
          <header>
            <div>
              <h2>Assigned team</h2>
            </div>
            <Button
              onClick={() => {
                setWorkspaceError('');
                setTeamDraft(client.assignedTeam ?? []);
                setTeamOpen(true);
              }}
            >
              Manage team
            </Button>
          </header>
          <div className="rm-client-workspace__people">
            {assignedTeam.map(({ member, role }) => (
              <article key={member.userId}>
                <Avatar name={member.name} size="md" src={member.avatarUrl} />
                <div>
                  <strong>{member.name}</strong>
                  <small>{role}</small>
                </div>
                {member.status !== 'active' ? <span className="aw-team-state">{member.status}</span> : null}
              </article>
            ))}
            {!assignedTeam.length ? (
              <div className="rm-client-workspace__empty rm-client-workspace__empty--small">
                <Icon name="users" size={22} />
                <strong>No Realty Media team assigned</strong>
                <p>Add the account lead, editor, talent, or anyone else working on this client.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rm-client-workspace__section">
          <header>
            <div>
              <h2>Tasks</h2>
            </div>
            <Button
              icon="plus"
              onClick={() => {
                setWorkspaceError('');
                setTaskForm((current) => ({
                  ...current,
                  assigneeUserId: assignedTeam[0]?.userId,
                  clientId: client.id,
                  propertyId: current.propertyId || properties[0]?.id,
                }));
                setTaskOpen(true);
              }}
            >
              Add task
            </Button>
          </header>
          <div className="rm-client-workspace__list">
            {clientTasks.slice(0, 8).map((task) => (
              <button
                aria-label={`Open ${task.title} in the task list`}
                className="rm-client-workspace__calendar-link"
                key={task.id}
                onClick={() => onOpenTask?.(task.id)}
                type="button"
              >
                <span className="rm-client-workspace__event-date">
                  {task.dueAt ? (
                    <>
                      <strong>{new Date(task.dueAt).getDate()}</strong>
                      <small>
                        {new Date(task.dueAt).toLocaleDateString('en', { month: 'short' })}
                      </small>
                    </>
                  ) : <Icon name="list-check" size={18} />}
                </span>
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    {task.assigneeName} · {task.propertyName}
                    {task.dueAt ? ` · ${new Date(task.dueAt).toLocaleDateString('en-GB')}` : ''}
                  </small>
                </div>
                <StatusPill tone={task.status === 'done' ? 'success' : 'neutral'}>
                  {task.status.replaceAll('_', ' ')}
                </StatusPill>
              </button>
            ))}
            {!clientTasks.length ? (
              <div className="rm-client-workspace__empty rm-client-workspace__empty--small">
                <Icon name="list-check" size={22} />
                <strong>No client tasks</strong>
                <p>Create the first task and assign it to the responsible person.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <Card className="rm-client-instagram-panel" tone="bright">
        <div className="rm-client-instagram-panel__heading">
          <div>
            <h2>Instagram</h2>
          </div>
          <Button
            disabled={connectingInstagram}
            icon="plus"
            onClick={() => void onConnectInstagram(client)}
          >
            {connectingInstagram ? 'Opening Facebook…' : 'Connect Instagram'}
          </Button>
        </div>
        <div className="rm-client-instagram-panel__accounts">
          {clientAccounts.map((account) => (
            <div key={account.id}>
              <Avatar name={account.displayName} size="sm" src={account.profilePictureUrl} />
              <span>
                <strong>@{account.username}</strong>
                <small>{account.displayName}</small>
              </span>
              <StatusPill dot tone={account.status === 'active' ? 'success' : 'warning'}>
                {account.status === 'active' ? 'Connected' : account.status.replaceAll('_', ' ')}
              </StatusPill>
            </div>
          ))}
          {!clientAccounts.length ? (
            <p className="rm-client-instagram-panel__empty">
              No Instagram account is connected for this client yet.
            </p>
          ) : null}
        </div>
      </Card>

      <ClientMembersPanel
        canManage
        canManageOwners
        clientAccountId={client.id}
        clientName={client.name}
        currentUserId={currentUserId}
        members={clientMembers}
        onCreate={onCreateClientMember}
        onUpdate={onUpdateClientMember}
      />

      <Modal
        onClose={() => setPropertyOpen(false)}
        open={propertyOpen}
        title="Add property"
      >
        <form className="rm-action-form" onSubmit={createPropertyForClient}>
          {workspaceError ? <div className="rm-feedback rm-feedback--error">{workspaceError}</div> : null}
          <label className="rm-upload-tile">
            <input
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={(event) =>
                setPropertyForm((current) => ({
                  ...current,
                  coverImage: event.target.files?.[0] ?? null,
                }))
              }
              type="file"
            />
            <span className="rm-upload-tile__icon"><Icon name="image" size={21} /></span>
            <strong>{propertyForm.coverImage?.name ?? 'Choose property image'}</strong>
            <small>JPEG, PNG, WebP, or HEIC</small>
          </label>
          <label className="rm-field">
            <span>Property name</span>
            <input onChange={(event) => setPropertyForm((current) => ({ ...current, name: event.target.value }))} required value={propertyForm.name} />
          </label>
          <label className="rm-field">
            <span>Location</span>
            <input onChange={(event) => setPropertyForm((current) => ({ ...current, location: event.target.value }))} value={propertyForm.location} />
          </label>
          <label className="rm-field">
            <span>Description</span>
            <textarea onChange={(event) => setPropertyForm((current) => ({ ...current, description: event.target.value }))} rows={4} value={propertyForm.description} />
          </label>
          <label className="rm-field">
            <span>Cabana scripting brief</span>
            <textarea
              onChange={(event) => setPropertyForm((current) => ({ ...current, scriptingBrief: event.target.value }))}
              placeholder="Add all factual details for future scripts: amenities, capacity, rooms, activities, views, access, booking rules, discounts, and must-mention facts."
              rows={7}
              value={propertyForm.scriptingBrief}
            />
          </label>
          <label className="rm-field">
            <span>Status</span>
            <select onChange={(event) => setPropertyForm((current) => ({ ...current, status: event.target.value as CreatePropertyInput['status'] }))} value={propertyForm.status}>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </label>
          <footer className="rm-dialog-actions">
            <Button onClick={() => setPropertyOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={savingWorkspaceItem || !propertyForm.name.trim()} type="submit">{savingWorkspaceItem ? 'Adding…' : 'Add property'}</Button>
          </footer>
        </form>
      </Modal>

      <Modal
        onClose={() => {
          if (!savingWorkspaceItem) {
            setEditProperty(null);
            setEditPropertyForm(null);
          }
        }}
        open={Boolean(editProperty && editPropertyForm)}
        title={`Edit ${editProperty?.name ?? 'property'}`}
      >
        {editPropertyForm ? (
          <form className="rm-action-form" onSubmit={updateClientProperty}>
            {workspaceError ? <div className="rm-feedback rm-feedback--error">{workspaceError}</div> : null}
            <label className="rm-upload-tile">
              <input
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={(event) =>
                  setEditPropertyForm((current) =>
                    current
                      ? { ...current, coverImage: event.target.files?.[0] ?? null }
                      : current,
                  )
                }
                type="file"
              />
              <span className="rm-upload-tile__icon"><Icon name="image" size={21} /></span>
              <strong>{editPropertyForm.coverImage?.name ?? 'Keep current image'}</strong>
              <small>Choose a file only when you want to replace it.</small>
            </label>
            <label className="rm-field">
              <span>Property name</span>
              <input
                onChange={(event) =>
                  setEditPropertyForm((current) =>
                    current ? { ...current, name: event.target.value } : current,
                  )
                }
                required
                value={editPropertyForm.name}
              />
            </label>
            <label className="rm-field">
              <span>Location</span>
              <input
                onChange={(event) =>
                  setEditPropertyForm((current) =>
                    current ? { ...current, location: event.target.value } : current,
                  )
                }
                value={editPropertyForm.location}
              />
            </label>
            <label className="rm-field">
              <span>Description</span>
              <textarea
                onChange={(event) =>
                  setEditPropertyForm((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
                rows={4}
                value={editPropertyForm.description}
              />
            </label>
            <label className="rm-field">
              <span>Cabana scripting brief</span>
              <textarea
                onChange={(event) => setEditPropertyForm((current) => current ? ({ ...current, scriptingBrief: event.target.value }) : current)}
                placeholder="Amenities, capacity, rooms, activities, views, access, booking rules, discounts, and must-mention facts."
                rows={8}
                value={editPropertyForm.scriptingBrief}
              />
            </label>
            <footer className="rm-dialog-actions">
              <Button
                disabled={savingWorkspaceItem || !onArchiveProperty}
                onClick={() => setPropertyArchiveTarget(editProperty)}
                type="button"
                variant="danger"
              >
                Delete property
              </Button>
              <Button
                disabled={savingWorkspaceItem}
                onClick={() => {
                  setEditProperty(null);
                  setEditPropertyForm(null);
                }}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button disabled={savingWorkspaceItem || !editPropertyForm.name.trim()} type="submit">
                {savingWorkspaceItem ? 'Saving…' : 'Save property'}
              </Button>
            </footer>
          </form>
        ) : null}
      </Modal>

      <ArchiveConfirmModal
        busy={savingWorkspaceItem}
        label="property"
        onClose={() => setPropertyArchiveTarget(null)}
        onConfirm={() => void archiveClientProperty()}
        open={Boolean(propertyArchiveTarget)}
      />
      <ArchiveConfirmModal
        busy={savingWorkspaceItem}
        label="contract document"
        onClose={() => setContractDocumentTarget(null)}
        onConfirm={() => void removeContractDocument()}
        open={Boolean(contractDocumentTarget)}
      />

      <Modal
        onClose={closeContentCreator}
        open={contentOpen}
        title="Add content"
        wide={contentForm.kind === 'script'}
      >
        <form className="rm-action-form" onSubmit={uploadClientContent}>
          {workspaceError ? <div className="rm-feedback rm-feedback--error">{workspaceError}</div> : null}
          <label className="rm-field">
            <span>Recorded for property</span>
            <select onChange={(event) => setContentForm((current) => ({ ...current, propertyId: event.target.value }))} required value={contentForm.propertyId}>
              <option disabled value="">Choose a property</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
          </label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Title</span>
              <input onChange={(event) => setContentForm((current) => ({ ...current, title: event.target.value }))} required value={contentForm.title} />
            </label>
            <label className="rm-field">
              <span>Type</span>
              <select
                onChange={(event) => setContentForm((current) => ({
                  ...current,
                  file: event.target.value === 'script' ? null : current.file,
                  kind: event.target.value as ClientContentForm['kind'],
                }))}
                value={contentForm.kind}
              >
                <option value="video">Video</option>
                <option value="script">Script</option>
              </select>
            </label>
          </div>
          {contentForm.kind === 'script' ? (
            <RichTextEditor
              label="Script"
              onChange={(contentHtml) =>
                setContentForm((current) => ({ ...current, contentHtml }))}
              placeholder="Write the hook, beats, voiceover, dialogue, and production notes…"
              resetKey={`${client.id}:script`}
              value={contentForm.contentHtml}
            />
          ) : (
            <label className="rm-upload-tile">
              <input accept="video/*" onChange={(event) => setContentForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} required type="file" />
              <span className="rm-upload-tile__icon"><Icon name="upload" size={21} /></span>
              <strong>{contentForm.file?.name ?? 'Choose a content file'}</strong>
              <small>Video files only</small>
            </label>
          )}
          <footer className="rm-dialog-actions">
            <Button onClick={closeContentCreator} variant="secondary">Cancel</Button>
            <Button
              disabled={
                savingWorkspaceItem
                || !contentForm.propertyId
                || !contentForm.title.trim()
                || (contentForm.kind === 'video' && !contentForm.file)
                || (contentForm.kind === 'script' && !plainTextFromHtml(contentForm.contentHtml))
              }
              type="submit"
            >
              {savingWorkspaceItem ? 'Saving…' : contentForm.kind === 'script' ? 'Save script' : 'Upload content'}
            </Button>
          </footer>
        </form>
      </Modal>

      <Modal
        onClose={() => setEventOpen(false)}
        open={eventOpen}
        title="Add production event"
      >
        <form className="rm-action-form" onSubmit={createClientEvent}>
          {workspaceError ? <div className="rm-feedback rm-feedback--error">{workspaceError}</div> : null}
          <label className="rm-field">
            <span>Event title</span>
            <input onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} required value={eventForm.title} />
          </label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Property</span>
              <select onChange={(event) => setEventForm((current) => ({ ...current, propertyId: event.target.value || undefined }))} value={eventForm.propertyId ?? ''}>
                <option value="">Client-wide</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
              </select>
            </label>
          </div>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field"><span>Start date</span><input onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))} required type="date" value={eventForm.date} /></label>
            <label className="rm-field"><span>End date</span><input min={eventForm.date} onChange={(event) => setEventForm((current) => ({ ...current, endDate: event.target.value }))} required type="date" value={eventForm.endDate || eventForm.date} /></label>
          </div>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field"><span>Starts</span><input onChange={(event) => setEventForm((current) => ({ ...current, start: event.target.value }))} required type="time" value={eventForm.start} /></label>
            <label className="rm-field"><span>Ends</span><input onChange={(event) => setEventForm((current) => ({ ...current, end: event.target.value }))} type="time" value={eventForm.end} /></label>
          </div>
          <label className="rm-field"><span>Location</span><input onChange={(event) => setEventForm((current) => ({ ...current, location: event.target.value }))} value={eventForm.location} /></label>
          <div className="rm-field">
            <span>Assigned to</span>
            <div className="rm-event-assignee-picker">
              {assignedTeam.map(({ member, role }) => {
                const checked = eventForm.assigneeUserIds?.includes(member.userId) ?? false;
                return <label className="rm-event-assignee-option" key={member.userId}>
                  <input
                    checked={checked}
                    onChange={() => setEventForm((current) => ({
                      ...current,
                      assigneeUserIds: current.assigneeUserIds?.includes(member.userId)
                        ? current.assigneeUserIds.filter((id) => id !== member.userId)
                        : [...(current.assigneeUserIds ?? []), member.userId],
                    }))}
                    type="checkbox"
                  />
                  <span>{member.name} · {role}</span>
                </label>;
              })}
            </div>
          </div>
          <label className="rm-field"><span>Notes</span><textarea onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={eventForm.description} /></label>
          <label className="rm-field">
            <span>Work classification</span>
            <select onChange={(event) => setEventForm((current) => ({ ...current, workScope: event.target.value as CreateCalendarEventInput['workScope'] }))} value={eventForm.workScope}>
              <option value="client">Client work</option>
              <option value="internal">Internal work</option>
              <option value="other">Other / unavailable</option>
            </select>
          </label>
          <label className="rm-field">
            <span>Visibility</span>
            <select onChange={(event) => setEventForm((current) => ({ ...current, visibility: event.target.value as CreateCalendarEventInput['visibility'] }))} value={eventForm.visibility}>
              <option value="client">Client</option>
              <option value="team">Team</option>
              <option value="admin_only">Founders</option>
            </select>
          </label>
          <footer className="rm-dialog-actions">
            <Button onClick={() => setEventOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={savingWorkspaceItem || !eventForm.title.trim()} type="submit">{savingWorkspaceItem ? 'Scheduling…' : 'Add event'}</Button>
          </footer>
        </form>
      </Modal>

      <Modal
        onClose={() => setTaskOpen(false)}
        open={taskOpen}
        title="Add client task"
      >
        <form className="rm-action-form" onSubmit={createClientTask}>
          {workspaceError ? <div className="rm-feedback rm-feedback--error">{workspaceError}</div> : null}
          <label className="rm-field">
            <span>Task title</span>
            <input
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, title: event.target.value }))
              }
              required
              value={taskForm.title}
            />
          </label>
          <label className="rm-field">
            <span>Description</span>
            <textarea
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
              value={taskForm.description}
            />
          </label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Assigned person</span>
              <select
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    assigneeUserId: event.target.value || undefined,
                  }))
                }
                value={taskForm.assigneeUserId ?? ''}
              >
                <option value="">Unassigned</option>
                {assignedTeam.map(({ member, role }) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} · {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="rm-field">
              <span>Property</span>
              <select
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    propertyId: event.target.value || undefined,
                  }))
                }
                value={taskForm.propertyId ?? ''}
              >
                <option value="">Client-wide</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="rm-form-grid rm-form-grid--three">
            <label className="rm-field">
              <span>Due date</span>
              <input
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                }
                type="date"
                value={taskForm.dueDate}
              />
            </label>
            <label className="rm-field">
              <span>Due time</span>
              <input
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, dueTime: event.target.value }))
                }
                type="time"
                value={taskForm.dueTime}
              />
            </label>
            <label className="rm-field">
              <span>Priority</span>
              <select
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    priority: event.target.value as CreateTaskInput['priority'],
                  }))
                }
                value={taskForm.priority}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <label className="rm-field">
            <span>Visibility</span>
            <select
              onChange={(event) =>
                setTaskForm((current) => ({
                  ...current,
                  visibility: event.target.value as CreateTaskInput['visibility'],
                }))
              }
              value={taskForm.visibility}
            >
              <option value="team">Team</option>
              <option value="client">Client</option>
              <option value="admin_only">Founders</option>
            </select>
          </label>
          <footer className="rm-dialog-actions">
            <Button onClick={() => setTaskOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={savingWorkspaceItem || !taskForm.title.trim()} type="submit">
              {savingWorkspaceItem ? 'Creating…' : 'Create task'}
            </Button>
          </footer>
        </form>
      </Modal>

      <Modal
        onClose={() => setTeamOpen(false)}
        open={teamOpen}
        title="Manage assigned team"
      >
        <div className="rm-action-form">
          {workspaceError ? <div className="rm-feedback rm-feedback--error">{workspaceError}</div> : null}
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Team member</span>
              <select onChange={(event) => setTeamMemberId(event.target.value)} value={teamMemberId}>
                <option value="">Choose person</option>
                {agencyMembers
                  .filter(
                    (member) =>
                      member.status === 'active' &&
                      !teamDraft.some((assignment) => assignment.userId === member.userId),
                  )
                  .map((member) => (
                    <option key={member.userId} value={member.userId}>{member.name}</option>
                  ))}
              </select>
            </label>
            <label className="rm-field">
              <span>Role for this client</span>
              <input
                onChange={(event) => setTeamRole(event.target.value)}
                placeholder="e.g. Editor, talent, account lead"
                value={teamRole}
              />
            </label>
          </div>
          <Button
            disabled={!teamMemberId || !teamRole.trim()}
            icon="plus"
            onClick={addTeamDraftMember}
            variant="secondary"
          >
            Add to client
          </Button>
          <div className="rm-client-team-draft">
            {teamDraft.map((assignment) => {
              const member = agencyMembers.find(
                (candidate) => candidate.userId === assignment.userId,
              );
              if (!member) return null;
              return (
                <article key={assignment.userId}>
                  <Avatar name={member.name} size="sm" src={member.avatarUrl} />
                  <div>
                    <strong>{member.name}</strong>
                    <span>{assignment.role}</span>
                  </div>
                  <IconButton
                    icon="x"
                    label={`Remove ${member.name}`}
                    onClick={() =>
                      setTeamDraft((current) =>
                        current.filter((item) => item.userId !== assignment.userId),
                      )
                    }
                    size="sm"
                  />
                </article>
              );
            })}
          </div>
          <footer className="rm-dialog-actions">
            <Button disabled={savingWorkspaceItem} onClick={() => setTeamOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button disabled={savingWorkspaceItem} onClick={() => void saveClientTeam()}>
              {savingWorkspaceItem ? 'Saving…' : 'Save assigned team'}
            </Button>
          </footer>
        </div>
      </Modal>
    </div>
  );
}

export function ClientsScreen({
  accounts = [],
  agreements = [],
  agencyMembers = [],
  calendarEvents = [],
  clientMembers = [],
  clients = demoClients,
  currentUserId,
  jobs = [],
  onCreateClient,
  onCreateClientMember,
  onCreateEvent,
  onCreateJob,
  onCreateProperty,
  onCreateTask,
  onOpenTask,
  onOpenReview,
  onOpenProductionCalendar,
  onUploadDeliverable,
  onArchiveClient,
  onArchiveProperty,
  onDeleteContractDocument,
  onUpdateClient,
  onUpdateContractDeliverableStatus,
  onUpdateClientTeam,
  onUpdateClientMember,
  onOpenWorkspace,
  onUpdateProperty,
  properties = [],
  reviews = [],
  tasks = [],
}: ClientsScreenProps) {
  const { notify } = useToast();
  const [addedClients, setAddedClients] = useState<ClientSummary[]>([]);
  const clientStateKey = `rm:clients-state:${currentUserId ?? 'preview'}`;
  const [query, setQuery] = useBrowserPersistedState(`${clientStateKey}:query`, '');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreateClientInput>(createEmptyClient);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [agreementPrefillNotice, setAgreementPrefillNotice] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const clientSelectionStorageKey = `rm:selected-client:${currentUserId ?? 'preview'}`;
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : window.localStorage.getItem(clientSelectionStorageKey),
  );
  const [editClient, setEditClient] = useState<ClientSummary | null>(null);
  const [editForm, setEditForm] = useState<UpdateClientInput | null>(null);
  const [editError, setEditError] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<ClientSummary | null>(null);
  const [connectingInstagramClientId, setConnectingInstagramClientId] =
    useState<string | null>(null);

  const localClients = useMemo(
    () => [
      ...addedClients.filter(
        (added) =>
          !clients.some(
            (client) =>
              client.email.trim().toLowerCase() === added.email.trim().toLowerCase(),
          ),
      ),
      ...clients,
    ],
    [addedClients, clients],
  );

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return localClients.filter((client) => {
      const matchesQuery =
        !normalizedQuery ||
        [client.name, client.contactName, client.email, client.location]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesQuery;
    });
  }, [localClients, query]);

  const setField = <Key extends keyof CreateClientInput>(
    key: Key,
    value: CreateClientInput[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const applyPackageTemplate = (templateId: string) => {
    const template = servicePackageTemplates.find((candidate) => candidate.id === templateId);
    setForm((current) => {
      if (!template) return { ...current, packageTemplateId: '', workflowTasks: [] };
      const totalContractValue = template.monthlyPrice * template.contractMonths;
      return {
        ...current,
        contractMonths: String(template.contractMonths),
        monthlyDeliverables: monthlyScheduleFromPackage(template, current.contractStartsOn),
        monthlyPrice: String(template.monthlyPrice),
        packageTemplateId: template.id,
        totalContractValue: String(totalContractValue),
        workflowTasks: template.kickoffTasks,
      };
    });
  };

  const readCreateAgreementPdf = async (files: File[]) => {
    setField('contractDocuments', files);
    const contractPdf = files.find((file) => file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf');
    if (!contractPdf) return;
    setAgreementPrefillNotice('Reading the contract PDF…');
    try {
      const values = await prefillAgreementFromPdf(contractPdf);
      setForm((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(values).filter(([, value]) => Boolean(value))),
      }));
      setAgreementPrefillNotice(
        Object.keys(values).length
          ? 'Agreement fields were filled from the readable PDF. Please review before saving.'
          : 'The PDF was readable, but no agreement amounts, dates, or deliverables were confidently found.',
      );
    } catch (error) {
      setAgreementPrefillNotice(error instanceof Error ? error.message : 'Could not read this contract PDF.');
    }
  };

  const readEditAgreementPdf = async (files: File[]) => {
    setEditForm((current) => current ? ({ ...current, contractDocuments: files }) : current);
    const contractPdf = files.find((file) => file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf');
    if (!contractPdf) return;
    setEditError('Reading the contract PDF…');
    try {
      const values = await prefillAgreementFromPdf(contractPdf);
      setEditForm((current) => current ? ({
        ...current,
        ...Object.fromEntries(Object.entries(values).filter(([, value]) => Boolean(value))),
      }) : current);
      setEditError(
        Object.keys(values).length
          ? 'Agreement fields were filled from the readable PDF. Please review before saving.'
          : 'The PDF was readable, but no agreement amounts, dates, or deliverables were confidently found.',
      );
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Could not read this contract PDF.');
    }
  };

  const setPropertyField = <Key extends keyof CreateClientPropertyInput>(
    index: number,
    key: Key,
    value: CreateClientPropertyInput[Key],
  ) => {
    setForm((current) => ({
      ...current,
      properties: current.properties.map((property, propertyIndex) =>
        propertyIndex === index ? { ...property, [key]: value } : property,
      ),
    }));
  };

  const addPropertyToForm = () => {
    setForm((current) => ({
      ...current,
      properties: [...current.properties, createEmptyProperty()],
    }));
  };

  const removePropertyFromForm = (index: number) => {
    setForm((current) => ({
      ...current,
      properties: current.properties.filter((_, propertyIndex) => propertyIndex !== index),
    }));
  };

  const closeForm = () => {
    if (saving) return;
    setFormError('');
    setFormOpen(false);
  };

  const openForm = () => {
    setForm(createEmptyClient());
    setFormError('');
    setAgreementPrefillNotice('');
    setSuccessMessage('');
    setFormOpen(true);
  };

  const submitClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const missing = [
      ...(form.createLogin
        ? [
            ['email address', form.email],
            ['temporary password', form.temporaryPassword],
          ]
        : []),
      ['client name', form.companyName],
      ['contact name', form.contactName],
      ['location', form.location],
      ['property', form.properties.find((property) => property.name.trim())?.name],
      ['monthly price', form.monthlyPrice],
      ['total contract value', form.totalContractValue],
      ['agreement start date', form.contractStartsOn],
      ['contract length', form.contractMonths],
      ['monthly deliverables', form.monthlyDeliverables],
    ].find(([, value]) => !String(value).trim());
    if (missing) {
      setFormError(`Complete the ${missing[0]} field before creating the client.`);
      return;
    }
    if (form.createLogin && form.temporaryPassword.length < 10) {
      setFormError('The temporary password must contain at least 10 characters.');
      return;
    }
    setSaving(true);
    try {
      await onCreateClient?.(form);
      const createdClient: ClientSummary = {
        contactName: form.contactName,
        email: form.email,
        id: `preview-${Date.now()}`,
        location: form.location,
        monthlyDeliverables: 0,
        monthlyPrice: Number.parseFloat(form.monthlyPrice) || 0,
        name: form.companyName,
        propertiesCount: form.properties.filter((property) => property.name.trim()).length,
        status: 'onboarding',
        totalContractValue: Number.parseFloat(form.totalContractValue) || 0,
      };
      setAddedClients((current) => [createdClient, ...current]);
      setForm(createEmptyClient());
      setFormOpen(false);
      setSuccessMessage(
        form.createLogin
          ? `${createdClient.name} was created and their portal login is ready.`
          : `${createdClient.name} was created. Add portal access whenever they need it.`,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The client could not be created. Check the details and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const connectClientInstagram = async (client: ClientSummary) => {
    setConnectingInstagramClientId(client.id);
    try {
      const url = await beginInstagramConnection({
        clientAccountId: client.id,
        scope: 'client',
      });
      window.location.assign(url);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Could not start Facebook Login.',
        'error',
      );
      setConnectingInstagramClientId(null);
    }
  };
  const monthlyRevenue = localClients.reduce((sum, client) => sum + client.monthlyPrice, 0);

  const openClient = (client: ClientSummary) => {
    setSelectedClientId(client.id);
    window.localStorage.setItem(clientSelectionStorageKey, client.id);
  };
  const closeClient = () => {
    setSelectedClientId(null);
    window.localStorage.removeItem(clientSelectionStorageKey);
  };
  const activeSelectedClient = selectedClientId
    ? localClients.find((client) => client.id === selectedClientId) ?? null
    : null;
  const selectedProperties = activeSelectedClient
    ? properties.filter((property) => property.clientId === activeSelectedClient.id)
    : [];
  const selectedPropertyIds = new Set(
    selectedProperties.map((property) => property.id),
  );
  const selectedReviews = activeSelectedClient
    ? reviews.filter(
        (review) =>
          (review.propertyId && selectedPropertyIds.has(review.propertyId)) ||
          review.clientName === activeSelectedClient.name,
      )
    : [];
  const selectedEvents = activeSelectedClient
    ? calendarEvents.filter(
        (event) =>
          event.clientId === activeSelectedClient.id ||
          (event.propertyId && selectedPropertyIds.has(event.propertyId)),
      )
    : [];
  const selectedJobs = activeSelectedClient
    ? jobs.filter((job) => job.clientId === activeSelectedClient.id)
    : [];

  const openEdit = (client: ClientSummary) => {
    const agreement = agreements.find((item) => item.clientId === client.id);
    setEditError('');
    setEditClient(client);
    setEditForm({
      clientId: client.id,
      companyName: client.name,
      contractDocuments: [],
      contractMonths: agreement?.startsOn && agreement?.endsOn
        ? String(Math.max(1, (new Date(`${agreement.endsOn}T12:00:00`).getFullYear() - new Date(`${agreement.startsOn}T12:00:00`).getFullYear()) * 12 + new Date(`${agreement.endsOn}T12:00:00`).getMonth() - new Date(`${agreement.startsOn}T12:00:00`).getMonth() + 1))
        : '',
      contractStartsOn: agreement?.startsOn ?? '',
      contactName: client.contactName,
      email: client.email,
      location: client.location,
      monthlyDeliverables: scheduleFromAgreementSummary(agreement?.summary),
      deliverablePropertyIds: agreementScheduleFromSummary(agreement?.summary).deliverablePropertyIds,
      monthlyPrice: String(client.monthlyPrice || 0),
      profilePhoto: null,
      totalContractValue: String(client.totalContractValue || 0),
    });
  };

  const saveClient = async () => {
    if (!editForm || !onUpdateClient) return;
    setSaving(true);
    setEditError('');
    try {
      await onUpdateClient(editForm);
      setEditClient(null);
      setEditForm(null);
      setSuccessMessage(`${editForm.companyName} was updated.`);
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : 'Could not update the client.');
    } finally {
      setSaving(false);
    }
  };

  const archiveClient = async () => {
    if (!archiveTarget || !onArchiveClient) return;
    setSaving(true);
    try {
      await onArchiveClient(archiveTarget.id);
      setSuccessMessage(`${archiveTarget.name} and its connected workspace records were deleted.`);
      setArchiveTarget(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not delete the client.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Keep the selected client in state while an overlay is open. The form itself
  // is rendered alongside the clients page below, then this branch resumes as
  // soon as the overlay is closed or saved.
  if (activeSelectedClient && !editForm && !archiveTarget) {
    return (
      <ClientWorkspacePage
        accounts={accounts}
        agreement={agreements.find((item) => item.clientId === activeSelectedClient.id)}
        agencyMembers={agencyMembers}
        calendarEvents={selectedEvents}
        jobs={selectedJobs}
        client={activeSelectedClient}
        clientMembers={clientMembers}
        connectingInstagram={connectingInstagramClientId === activeSelectedClient.id}
        currentUserId={currentUserId}
        onBack={closeClient}
        onConnectInstagram={connectClientInstagram}
        onCreateClientMember={onCreateClientMember}
        onCreateEvent={onCreateEvent}
        onCreateJob={onCreateJob}
        onCreateProperty={onCreateProperty}
        onCreateTask={onCreateTask}
        onOpenTask={onOpenTask}
        onArchiveProperty={onArchiveProperty}
        onDeleteContractDocument={onDeleteContractDocument}
        onEditClient={openEdit}
        onOpenReview={onOpenReview}
        onOpenProductionCalendar={onOpenProductionCalendar}
        onUpdateClientMember={onUpdateClientMember}
        onUpdateContractDeliverableStatus={onUpdateContractDeliverableStatus}
        onUpdateClientTeam={onUpdateClientTeam}
        onUpdateProperty={onUpdateProperty}
        onUploadDeliverable={onUploadDeliverable}
        properties={selectedProperties}
        reviews={selectedReviews}
        tasks={tasks}
      />
    );
  }

  return (
    <div className="rm-page rm-clients-page">
      <header className="rm-clients-page__header rm-clients-page__header--actions">
        <Button icon="plus" onClick={openForm}>
          Create client
        </Button>
      </header>

      <section aria-label="Client overview" className="rm-kpi-grid rm-kpi-grid--three">
        <KpiCard icon="users" label="Clients" value={String(localClients.length)} />
        <KpiCard icon="wallet" label="Monthly client value" value={formatRon(monthlyRevenue)} />
        <KpiCard icon="wallet" label="Contract value" value={formatRon(localClients.reduce((sum, client) => sum + client.totalContractValue, 0))} />
      </section>

      {successMessage ? (
        <div className="rm-feedback rm-feedback--success" role="status">
          <Icon name="check" size={17} />
          <span>{successMessage}</span>
          <IconButton icon="x" label="Dismiss confirmation" onClick={() => setSuccessMessage('')} size="sm" />
        </div>
      ) : null}

      <Card className="rm-table-card" tone="bright">
        <div className="rm-table-card__toolbar">
          <label className="rm-inline-search">
            <Icon name="search" size={17} />
            <span className="rm-visually-hidden">Search clients</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients…"
              type="search"
              value={query}
            />
          </label>
        </div>

        <div className="rm-client-directory-wrap">
          <div aria-label="Clients" className="rm-client-directory" role="table">
            <div className="rm-client-directory__header" role="row">
              <span role="columnheader">Client</span>
              <span role="columnheader">Properties</span>
              <span role="columnheader">Agreement</span>
              <span role="columnheader">Next shoot</span>
              <span role="columnheader">Workspace</span>
            </div>
            <div role="rowgroup">
              {filteredClients.map((client) => (
                <div
                  className="rm-client-directory__row"
                  key={client.id}
                  onClick={() => openClient(client)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openClient(client);
                    }
                  }}
                  role="row"
                  tabIndex={0}
                >
                  <span className="rm-client-directory__identity" role="cell">
                    <span className="rm-table-person">
                      <Avatar name={client.contactName} size="md" src={client.avatarUrl} />
                      <span className="rm-client-directory__identity-copy">
                        <strong>{client.name}</strong>
                        <small>{client.contactName} · {client.location}</small>
                      </span>
                    </span>
                  </span>
                  <span role="cell" data-label="Properties"><strong>{client.propertiesCount}</strong></span>
                  <span role="cell" data-label="Agreement">
                    <strong>{formatRon(client.totalContractValue)}</strong>
                    <small className="rm-table-sub">Total value</small>
                  </span>
                  <span role="cell" data-label="Next shoot">{client.nextShoot ?? 'Not scheduled'}</span>
                  <span role="cell">
                    {onOpenWorkspace ? (
                      <Button
                        aria-label={`Open ${client.name}'s workspace`}
                        icon="arrow-right"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenWorkspace(client);
                        }}
                        variant="secondary"
                      >
                        Open workspace
                      </Button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Modal
        onClose={closeForm}
        open={formOpen}
        title="Create a client"
        wide
      >
        <form aria-busy={saving} className="rm-client-form" noValidate onSubmit={submitClient}>
          {formError ? (
            <div className="rm-feedback rm-feedback--error" role="alert">
              <Icon name="x" size={17} />
              <span>{formError}</span>
            </div>
          ) : null}
          <fieldset>
            <legend>
              <span>01</span>
              Account access
            </legend>
            <label className="rm-checkbox-field">
              <input
                checked={form.createLogin}
                onChange={(event) => setField('createLogin', event.target.checked)}
                type="checkbox"
              />
              <span className="rm-checkbox-field__control">
                <Icon name="check" size={13} />
              </span>
              <span>
                <strong>Create a portal login now</strong>
                <small>You can add client access later from the client workspace.</small>
              </span>
            </label>
            {form.createLogin ? (
              <>
            <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Email address</span>
                <input
                  autoComplete="email"
                  onChange={(event) => setField('email', event.target.value)}
                  placeholder="owner@company.ro"
                  required
                  type="email"
                  value={form.email}
                />
              </label>
              <label className="rm-field">
                <span>Provisioning password</span>
                <div className="rm-client-password-control">
                  <input
                    autoComplete="new-password"
                    minLength={10}
                    onChange={(event) => setField('temporaryPassword', event.target.value)}
                    placeholder="At least 10 characters"
                    required
                    type="text"
                    value={form.temporaryPassword}
                  />
                  <Button
                    onClick={() => setField('temporaryPassword', generateTemporaryPassword())}
                    variant="secondary"
                  >
                    Generate
                  </Button>
                </div>
              </label>
            </div>
            <label className="rm-checkbox-field">
              <input
                checked={form.requirePasswordReset}
                onChange={(event) => setField('requirePasswordReset', event.target.checked)}
                type="checkbox"
              />
              <span className="rm-checkbox-field__control">
                <Icon name="check" size={13} />
              </span>
              <span>
                <strong>Require password reset on first login</strong>
              </span>
            </label>
              </>
            ) : null}
          </fieldset>

          <fieldset>
            <legend>
              <span>02</span>
              Service package
            </legend>
            <label className="rm-field">
              <span>Start from a package</span>
              <select onChange={(event) => applyPackageTemplate(event.target.value)} value={form.packageTemplateId ?? ''}>
                <option value="">Custom agreement</option>
                {servicePackageTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              {form.packageTemplateId ? <small className="rm-form-hint">This package creates its monthly fulfillment plan and {form.workflowTasks?.length ?? 0} kickoff tasks when you create the client.</small> : null}
            </label>
          </fieldset>

          <fieldset>
            <legend>
              <span>03</span>
              Client profile
            </legend>
            <div className="rm-profile-upload-grid">
              <label className="rm-upload-tile rm-upload-tile--portrait">
                <input
                  accept="image/*"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setField('profilePhoto', event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
                <span className="rm-upload-tile__icon"><Icon name="image" size={21} /></span>
                <strong>{form.profilePhoto?.name ?? 'Profile photo'}</strong>
                <small>JPG or PNG · square works best</small>
              </label>
              <div className="rm-form-grid rm-form-grid--two">
                <label className="rm-field">
                  <span>Client / company name</span>
                  <input
                    onChange={(event) => setField('companyName', event.target.value)}
                    placeholder="e.g. Cabana The One"
                    required
                    value={form.companyName}
                  />
                </label>
                <label className="rm-field">
                  <span>Owner or contact name</span>
                  <input
                    autoComplete="name"
                    onChange={(event) => setField('contactName', event.target.value)}
                    placeholder="Full name"
                    required
                    value={form.contactName}
                  />
                </label>
                <label className="rm-field rm-field--wide">
                  <span>Location</span>
                  <input
                    onChange={(event) => setField('location', event.target.value)}
                    placeholder="City, county or property area"
                    required
                    value={form.location}
                  />
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>
              <span>04</span>
              Property
              <small>Add every property covered by this client.</small>
            </legend>
            <div className="rm-client-property-list">
              {form.properties.map((property, index) => (
                <section className="rm-client-property-form" key={`property-${index}`}>
                  <div className="rm-client-property-form__header">
                    <strong>Property {index + 1}</strong>
                    {form.properties.length > 1 ? (
                      <Button
                        onClick={() => removePropertyFromForm(index)}
                        type="button"
                        variant="secondary"
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <div className="rm-form-grid rm-form-grid--two">
                    <label className="rm-field">
                      <span>Property name</span>
                      <input
                        onChange={(event) => setPropertyField(index, 'name', event.target.value)}
                        placeholder="e.g. Mountain View Apuseni"
                        required={index === 0}
                        value={property.name}
                      />
                    </label>
                    <label className="rm-field">
                      <span>Property location</span>
                      <input
                        onChange={(event) => setPropertyField(index, 'location', event.target.value)}
                        placeholder={form.location || 'Uses the client location if empty'}
                        value={property.location}
                      />
                    </label>
                    <label className="rm-field rm-field--wide">
                      <span>Property description</span>
                      <textarea
                        onChange={(event) => setPropertyField(index, 'description', event.target.value)}
                        placeholder="A short internal and client-facing description of the property…"
                        rows={3}
                        value={property.description}
                      />
                    </label>
                  </div>
                </section>
              ))}
            </div>
            <Button icon="plus" onClick={addPropertyToForm} type="button" variant="secondary">
              Add another property
            </Button>
          </fieldset>

          <fieldset>
            <legend>
              <span>05</span>
              Agreement
            </legend>
            <div className="rm-form-grid rm-form-grid--three">
              <label className="rm-field">
                <span>Monthly price (RON)</span>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setField('monthlyPrice', event.target.value)}
                  placeholder="7,200"
                  required
                  type="number"
                  value={form.monthlyPrice}
                />
              </label>
              <label className="rm-field">
                <span>Total contract value (RON)</span>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setField('totalContractValue', event.target.value)}
                  placeholder="86,400"
                  required
                  type="number"
                  value={form.totalContractValue}
                />
              </label>
              <label className="rm-field">
                <span>Agreement starts</span>
                <input
                  onChange={(event) => {
                    const startsOn = event.target.value;
                    setForm((current) => {
                      const template = servicePackageTemplates.find((candidate) => candidate.id === current.packageTemplateId);
                      return {
                        ...current,
                        contractStartsOn: startsOn,
                        monthlyDeliverables: template
                          ? monthlyScheduleFromPackage(template, startsOn)
                          : current.monthlyDeliverables,
                      };
                    });
                  }}
                  required
                  type="date"
                  value={form.contractStartsOn}
                />
              </label>
              <label className="rm-field">
                <span>Contract length (months)</span>
                <input
                  min="1"
                  onChange={(event) => setField('contractMonths', event.target.value)}
                  required
                  type="number"
                  value={form.contractMonths}
                />
              </label>
              <div className="rm-agreement-schedule rm-field--wide">
                <span>Monthly deliverables</span>
                {monthlyDeliverableSchedule(form.monthlyDeliverables, form.contractStartsOn, form.contractMonths).length ? (
                  <div className="rm-agreement-schedule__rows">
                    {monthlyDeliverableSchedule(form.monthlyDeliverables, form.contractStartsOn, form.contractMonths).map((row, index, rows) => (
                      <label className="rm-field" key={row.label}>
                        <span>{row.label}</span>
                        <input
                          onChange={(event) => {
                            const nextRows = rows.map((current, rowIndex) => rowIndex === index ? { ...current, value: event.target.value } : current);
                            setField('monthlyDeliverables', writeMonthlyDeliverableSchedule(nextRows));
                          }}
                          placeholder="e.g. 18 videos, 1 shoot"
                          required
                          value={row.value}
                        />
                      </label>
                    ))}
                  </div>
                ) : <small>Set the agreement start and length to add deliverables month by month.</small>}
              </div>
              <label className="rm-upload-tile rm-field--wide">
                <input
                  accept=".pdf,.doc,.docx,image/*"
                  multiple
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    void readCreateAgreementPdf(Array.from(event.target.files ?? []))
                  }
                  type="file"
                />
                <span className="rm-upload-tile__icon"><Icon name="paperclip" size={21} /></span>
                <strong>
                  {form.contractDocuments.length
                    ? `${form.contractDocuments.length} contract file${form.contractDocuments.length === 1 ? '' : 's'} selected`
                    : 'Attach contract document(s)'}
                </strong>
                <small>PDF, Word or scanned image · multiple files allowed</small>
              </label>
              {agreementPrefillNotice ? <p className="rm-form-hint">{agreementPrefillNotice}</p> : null}
            </div>
          </fieldset>

          <footer className="rm-form-footer">
            <div>
              <Button disabled={saving} onClick={closeForm} variant="secondary">
                Cancel
              </Button>
              <Button disabled={saving} icon="plus" type="submit">
                {saving ? 'Creating…' : 'Create client'}
              </Button>
            </div>
          </footer>
        </form>
      </Modal>

      <Modal
        onClose={() => {
          if (!saving) {
            setEditClient(null);
            setEditForm(null);
          }
        }}
        open={Boolean(editClient && editForm)}
        title={`Edit ${editClient?.name ?? 'client'}`}
      >
        {editForm ? (
          <div aria-busy={saving} className="rm-action-form">
            {editError ? <div className="rm-feedback rm-feedback--error" role="alert">{editError}</div> : null}
            <fieldset>
              <legend><span>01</span> Client profile</legend>
              <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-upload-tile rm-field--wide">
                <input
                  accept="image/*"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setEditForm((current) => current ? ({ ...current, profilePhoto: event.target.files?.[0] ?? null }) : current)}
                  type="file"
                />
                <span className="rm-upload-tile__icon"><Icon name="image" size={21} /></span>
                <strong>{editForm.profilePhoto?.name ?? 'Replace profile photo'}</strong>
                <small>JPG or PNG · square works best</small>
              </label>
              <label className="rm-field">
                <span>Client / company name</span>
                <input
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, companyName: event.target.value }) : current)}
                  required
                  value={editForm.companyName}
                />
              </label>
              <label className="rm-field">
                <span>Owner or contact</span>
                <input
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, contactName: event.target.value }) : current)}
                  required
                  value={editForm.contactName}
                />
              </label>
              <label className="rm-field">
                <span>Contact email</span>
                <input
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, email: event.target.value }) : current)}
                  type="email"
                  value={editForm.email}
                />
                <small>This updates the client record, not an existing member&apos;s login email.</small>
              </label>
              <label className="rm-field">
                <span>Location</span>
                <input
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, location: event.target.value }) : current)}
                  value={editForm.location}
                />
              </label>
              </div>
            </fieldset>
            <fieldset>
              <legend><span>02</span> Agreement</legend>
              <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Monthly agreement (RON)</span>
                <input
                  min="0"
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, monthlyPrice: event.target.value }) : current)}
                  step="0.01"
                  type="number"
                  value={editForm.monthlyPrice}
                />
              </label>
              <label className="rm-field">
                <span>Total agreement value (RON)</span>
                <input
                  min="0"
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, totalContractValue: event.target.value }) : current)}
                  step="0.01"
                  type="number"
                  value={editForm.totalContractValue}
                />
              </label>
              <label className="rm-field">
                <span>Agreement starts</span>
                <input
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, contractStartsOn: event.target.value }) : current)}
                  type="date"
                  value={editForm.contractStartsOn}
                />
              </label>
              <label className="rm-field">
                <span>Contract length (months)</span>
                <input
                  min="1"
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, contractMonths: event.target.value }) : current)}
                  type="number"
                  value={editForm.contractMonths}
                />
              </label>
              <div className="rm-agreement-schedule rm-field--wide">
                <span>Monthly deliverables</span>
                {monthlyDeliverableSchedule(editForm.monthlyDeliverables, editForm.contractStartsOn, editForm.contractMonths).length ? (
                  <div className="rm-agreement-schedule__rows">
                    {monthlyDeliverableSchedule(editForm.monthlyDeliverables, editForm.contractStartsOn, editForm.contractMonths).map((row, index, rows) => (
                      <label className="rm-field" key={row.label}>
                        <span>{row.label}</span>
                        <input
                          onChange={(event) => {
                            const nextRows = rows.map((current, rowIndex) => rowIndex === index ? { ...current, value: event.target.value } : current);
                            setEditForm((current) => current ? ({ ...current, monthlyDeliverables: writeMonthlyDeliverableSchedule(nextRows) }) : current);
                          }}
                          placeholder="e.g. 18 videos, 1 shoot"
                          value={row.value}
                        />
                        <select
                          aria-label={`${row.label} property`}
                          onChange={(event) => setEditForm((current) => current ? ({
                            ...current,
                            deliverablePropertyIds: { ...current.deliverablePropertyIds, [row.label]: event.target.value },
                          }) : current)}
                          value={editForm.deliverablePropertyIds[row.label] ?? ''}
                        >
                          <option value="">Client-wide</option>
                          {properties.filter((property) => property.clientId === editClient?.id).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                ) : <small>Set the agreement start and length to add deliverables month by month.</small>}
              </div>
              <label className="rm-upload-tile rm-field--wide">
                <input
                  accept=".pdf,.doc,.docx,image/*"
                  multiple
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    void readEditAgreementPdf(Array.from(event.target.files ?? []))
                  }
                  type="file"
                />
                <span className="rm-upload-tile__icon"><Icon name="paperclip" size={21} /></span>
                <strong>{editForm.contractDocuments.length ? `${editForm.contractDocuments.length} contract file${editForm.contractDocuments.length === 1 ? '' : 's'} selected` : 'Add contract document(s)'}</strong>
                <small>PDF, Word or scanned image</small>
              </label>
              </div>
            </fieldset>
            <footer className="rm-dialog-actions rm-dialog-actions--split">
              <Button
                disabled={saving}
                onClick={() => {
                  setEditClient(null);
                  setEditForm(null);
                  setArchiveTarget(editClient);
                }}
                variant="danger"
              >
                Delete client
              </Button>
              <div>
                <Button disabled={saving} onClick={() => { setEditClient(null); setEditForm(null); }} variant="secondary">Cancel</Button>
                <Button disabled={saving || !editForm.companyName.trim() || !editForm.contactName.trim()} onClick={() => void saveClient()}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </footer>
          </div>
        ) : null}
      </Modal>

      <ArchiveConfirmModal
        busy={saving}
        label="client"
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void archiveClient()}
        open={Boolean(archiveTarget)}
      />
    </div>
  );
}
