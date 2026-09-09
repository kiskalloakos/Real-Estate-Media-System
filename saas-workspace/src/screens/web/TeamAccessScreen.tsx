import { useMemo, useState, type FormEvent } from 'react';

import {
  Avatar,
  Button,
  Card,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  StatusPill,
} from '@/components/web';

import type {
  AgencyMemberSummary,
  CreateTeamMemberInput,
  PropertySummary,
  PropertyTeamAssignmentSummary,
  UpdatePropertyAssignmentsInput,
  UpdateTeamMemberAccessInput,
} from './types';

type TeamAccessScreenProps = {
  assignments?: PropertyTeamAssignmentSummary[];
  currentUserId?: string;
  members?: AgencyMemberSummary[];
  onCreate?: (input: CreateTeamMemberInput) => Promise<void>;
  onSendPasswordReset?: (email: string) => Promise<void>;
  onUpdateAssignments?: (
    input: UpdatePropertyAssignmentsInput,
  ) => Promise<void>;
  onUpdate?: (input: UpdateTeamMemberAccessInput) => Promise<void>;
  properties?: PropertySummary[];
  onOpenWorkspace?: (member: AgencyMemberSummary) => void;
};

const emptyForm: CreateTeamMemberInput = {
  avatarFile: null,
  email: '',
  fullName: '',
  phone: '',
  title: '',
};

type TeamMemberEditForm = Omit<UpdateTeamMemberAccessInput, 'membershipId' | 'status'>;

export function TeamAccessScreen({
  assignments = [],
  currentUserId,
  members = [],
  onCreate,
  onSendPasswordReset,
  onUpdate,
  onUpdateAssignments,
  onOpenWorkspace,
  properties = [],
}: TeamAccessScreenProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [assignmentMember, setAssignmentMember] =
    useState<AgencyMemberSummary | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [editingMember, setEditingMember] = useState<AgencyMemberSummary | null>(null);
  const [editForm, setEditForm] = useState<TeamMemberEditForm | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const sortedMembers = useMemo(
    () =>
      [...members].sort((left, right) => {
        if (left.role !== right.role) return left.role === 'admin' ? -1 : 1;
        return left.name.localeCompare(right.name);
      }),
    [members],
  );
  const openAssignments = (member: AgencyMemberSummary) => {
    setAssignmentMember(member);
    setSelectedPropertyIds(
      assignments
        .filter((assignment) => assignment.userId === member.userId)
        .map((assignment) => assignment.propertyId),
    );
    setError('');
  };

  const openMemberEditor = (member: AgencyMemberSummary) => {
    if (member.role !== 'team_member') return;
    setEditingMember(member);
    setEditForm({
      avatarFile: null,
      email: member.email,
      fullName: member.name,
      phone: member.phone ?? '',
      title: member.title ?? '',
    });
    setError('');
  };

  const toggleProperty = (propertyId: string) => {
    setSelectedPropertyIds((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId],
    );
  };

  const saveAssignments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignmentMember || !onUpdateAssignments) return;
    setSavingAssignments(true);
    setError('');
    setMessage('');
    try {
      await onUpdateAssignments({
        propertyIds: selectedPropertyIds,
        userId: assignmentMember.userId,
      });
      setAssignmentMember(null);
      setMessage(
        `${assignmentMember.name} now has ${selectedPropertyIds.length} property assignment${selectedPropertyIds.length === 1 ? '' : 's'}.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Property assignments could not be updated.',
      );
    } finally {
      setSavingAssignments(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreate) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await onCreate(form);
      setForm(emptyForm);
      setFormOpen(false);
      setMessage(`${form.fullName.trim()} was added and received a password setup email.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Team access could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!editingMember || !editForm || !onSendPasswordReset) return;
    setSendingPasswordReset(true);
    setError('');
    setMessage('');
    try {
      await onSendPasswordReset(editForm.email);
      setEditingMember(null);
      setEditForm(null);
      setMessage(`Password setup email sent to ${editForm.email.trim().toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Password reset email could not be sent.');
    } finally {
      setSendingPasswordReset(false);
    }
  };

  const saveMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMember || !editForm || !onUpdate) return;
    setSavingMember(true);
    setError('');
    setMessage('');
    try {
      await onUpdate({
        ...editForm,
        membershipId: editingMember.id,
        status: editingMember.status === 'suspended' ? 'suspended' : 'active',
      });
      setEditingMember(null);
      setEditForm(null);
      setMessage(`${editForm.fullName.trim()} was updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Team member could not be updated.');
    } finally {
      setSavingMember(false);
    }
  };

  return (
    <div className="rm-page">
      <PageHeader
        actions={
          <Button icon="plus" onClick={() => setFormOpen(true)}>
            Add team member
          </Button>
        }
        title="Team"
      />

      {message ? (
        <div className="rm-feedback rm-feedback--success" role="status">
          <Icon name="check" size={17} />
          <span>{message}</span>
          <IconButton icon="x" label="Dismiss" onClick={() => setMessage('')} size="sm" />
        </div>
      ) : null}
      {error ? (
        <div className="rm-feedback rm-feedback--error" role="alert">
          <Icon name="x" size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      <Card className="rm-table-card" tone="bright">
        <div className="rm-table-card__toolbar rm-access-toolbar">
          <div>
            <p className="rm-eyebrow">Directory</p>
            <h2>Staff</h2>
          </div>
          <StatusPill tone="ink">{members.length} accounts</StatusPill>
        </div>
        <div className="rm-table-wrap">
          <table className="rm-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Workspace role</th>
                <th>Phone</th>
                <th>Production title</th>
                <th>Assigned properties</th>
                <th><span className="rm-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((member) => {
                const protectedOwner = member.role === 'admin';
                const memberAssignments = assignments.filter(
                  (assignment) => assignment.userId === member.userId,
                );
                return (
                  <tr
                    className={`rm-team-directory__row${protectedOwner ? '' : ' is-editable'}`}
                    key={member.id}
                    onClick={protectedOwner ? undefined : () => openMemberEditor(member)}
                    onKeyDown={protectedOwner ? undefined : (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openMemberEditor(member);
                      }
                    }}
                    role={protectedOwner ? undefined : 'button'}
                    tabIndex={protectedOwner ? undefined : 0}
                  >
                    <td>
                      <div className="rm-table-person">
                        <Avatar name={member.name} size="md" src={member.avatarUrl} />
                        <span>
                          <strong>{member.name}</strong>
                          <small>{member.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusPill tone={protectedOwner ? 'ink' : 'neutral'}>
                        {protectedOwner ? 'Owner' : 'Team member'}
                      </StatusPill>
                    </td>
                    <td>{member.phone || '—'}</td>
                    <td>{member.title ?? (protectedOwner ? 'Administrator' : 'Team')}</td>
                    <td>
                      {protectedOwner ? (
                        <span className="rm-member-row__locked">All properties</span>
                      ) : (
                        <div className="rm-assignment-cell">
                          <span>
                            {memberAssignments.length}{' '}
                            {memberAssignments.length === 1 ? 'property' : 'properties'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      {!protectedOwner && onOpenWorkspace ? (
                        <Button
                          aria-label={`Open ${member.name}'s workspace`}
                          icon="arrow-right"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenWorkspace(member);
                          }}
                          variant="secondary"
                        >
                          Open workspace
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        onClose={() => !saving && setFormOpen(false)}
        open={formOpen}
        title="Add team member"
      >
        <form className="rm-action-form" onSubmit={submit}>
          {error ? (
            <div className="rm-feedback rm-feedback--error" role="alert">
              <Icon name="x" size={17} />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Full name</span>
              <input
                autoComplete="name"
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
                }
                required
                value={form.fullName}
              />
            </label>
            <label className="rm-field">
              <span>Email</span>
              <input
                autoComplete="email"
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                required
                type="email"
                value={form.email}
              />
            </label>
            <label className="rm-field">
              <span>Production title</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Editor, talent, producer…"
                value={form.title}
              />
            </label>
            <label className="rm-field">
              <span>Phone</span>
              <input
                autoComplete="tel"
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                type="tel"
                value={form.phone}
              />
            </label>
            <label className="rm-task-upload rm-team-avatar-upload">
              <span className="rm-task-upload__label">Profile photo</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="rm-task-upload__input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    avatarFile: event.target.files?.[0] ?? null,
                  }))
                }
                type="file"
              />
              <span className="rm-task-upload__control">
                <span className="rm-task-upload__button">Choose photo</span>
                <span className="rm-task-upload__hint">{form.avatarFile?.name ?? 'No photo chosen'}</span>
              </span>
            </label>
          </div>
          <p className="rm-form-note">
            We’ll email this person a secure link to choose their password. One email can have one login and one primary workspace role.
          </p>
          <footer className="rm-dialog-actions">
            <Button
              disabled={saving}
              onClick={() => setFormOpen(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={saving} icon="plus" type="submit">
              {saving ? 'Creating…' : 'Create access'}
            </Button>
          </footer>
        </form>
      </Modal>

      <Modal
        onClose={() => !savingMember && !sendingPasswordReset && setEditingMember(null)}
        open={Boolean(editingMember && editForm)}
        title="Edit team member"
      >
        {editingMember && editForm ? (
          <form className="rm-action-form" onSubmit={saveMember}>
            {error ? (
              <div className="rm-feedback rm-feedback--error" role="alert">
                <Icon name="x" size={17} />
                <span>{error}</span>
              </div>
            ) : null}
            <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Full name</span>
                <input
                  autoComplete="name"
                  onChange={(event) => setEditForm((current) => current ? { ...current, fullName: event.target.value } : current)}
                  required
                  value={editForm.fullName}
                />
              </label>
              <label className="rm-field">
                <span>Email</span>
                <input
                  autoComplete="email"
                  onChange={(event) => setEditForm((current) => current ? { ...current, email: event.target.value } : current)}
                  required
                  type="email"
                  value={editForm.email}
                />
              </label>
              <label className="rm-field">
                <span>Phone</span>
                <input
                  autoComplete="tel"
                  onChange={(event) => setEditForm((current) => current ? { ...current, phone: event.target.value } : current)}
                  type="tel"
                  value={editForm.phone}
                />
              </label>
              <label className="rm-field">
                <span>Production title</span>
                <input
                  onChange={(event) => setEditForm((current) => current ? { ...current, title: event.target.value } : current)}
                  value={editForm.title}
                />
              </label>
              <label className="rm-task-upload rm-team-avatar-upload">
                <span className="rm-task-upload__label">Profile photo</span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="rm-task-upload__input"
                  onChange={(event) => setEditForm((current) => current ? {
                    ...current,
                    avatarFile: event.target.files?.[0] ?? null,
                  } : current)}
                  type="file"
                />
                <span className="rm-task-upload__control">
                  <span className="rm-task-upload__button">Choose photo</span>
                  <span className="rm-task-upload__hint">{editForm.avatarFile?.name ?? 'No photo chosen'}</span>
                </span>
              </label>
            </div>
            {onSendPasswordReset ? (
              <div className="rm-account-security-action">
                <div>
                  <strong>Password access</strong>
                  <span>Send a secure link and require a new password before portal access.</span>
                </div>
                <Button
                  disabled={savingMember || sendingPasswordReset}
                  icon="key"
                  onClick={() => void sendPasswordReset()}
                  variant="secondary"
                >
                  {sendingPasswordReset ? 'Sending…' : 'Send password reset'}
                </Button>
              </div>
            ) : null}
            <footer className="rm-dialog-actions">
              <Button disabled={savingMember || sendingPasswordReset} onClick={() => setEditingMember(null)} variant="secondary">
                Cancel
              </Button>
              {onUpdateAssignments ? (
                <Button disabled={savingMember || sendingPasswordReset} onClick={() => {
                  setEditingMember(null);
                  openAssignments(editingMember);
                }} variant="secondary">
                  Assign properties
                </Button>
              ) : null}
              <Button disabled={savingMember || sendingPasswordReset} type="submit">
                {savingMember ? 'Saving…' : 'Save changes'}
              </Button>
            </footer>
          </form>
        ) : null}
      </Modal>

      <Modal
        onClose={() => !savingAssignments && setAssignmentMember(null)}
        open={Boolean(assignmentMember)}
        title="Assign properties"
      >
        <form className="rm-action-form" onSubmit={saveAssignments}>
          {error ? (
            <div className="rm-feedback rm-feedback--error" role="alert">
              <Icon name="x" size={17} />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="rm-assignment-picker__toolbar">
            <div>
              <strong>
                {selectedPropertyIds.length} of {properties.length} selected
              </strong>
              <span>Access updates immediately after saving.</span>
            </div>
            {properties.length ? (
              <Button
                onClick={() =>
                  setSelectedPropertyIds(
                    selectedPropertyIds.length === properties.length
                      ? []
                      : properties.map((property) => property.id),
                  )
                }
                variant="ghost"
              >
                {selectedPropertyIds.length === properties.length
                  ? 'Clear all'
                  : 'Select all'}
              </Button>
            ) : null}
          </div>
          {properties.length ? (
            <div className="rm-assignment-picker">
              {properties.map((property) => (
                <label className="rm-assignment-option" key={property.id}>
                  <input
                    checked={selectedPropertyIds.includes(property.id)}
                    onChange={() => toggleProperty(property.id)}
                    type="checkbox"
                  />
                  <span className="rm-checkbox-field__control">
                    <Icon name="check" size={13} />
                  </span>
                  <span>
                    <strong>{property.name}</strong>
                    <small>
                      {property.clientName} · {property.location}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="rm-feedback rm-feedback--warning">
              Add a property before assigning production access.
            </div>
          )}
          <p className="rm-form-note">
            Removing every selection revokes this team member’s property access
            without suspending their login.
          </p>
          <footer className="rm-dialog-actions">
            <Button
              disabled={savingAssignments}
              onClick={() => setAssignmentMember(null)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={savingAssignments || !properties.length}
              type="submit"
            >
              {savingAssignments ? 'Saving…' : 'Save assignments'}
            </Button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
