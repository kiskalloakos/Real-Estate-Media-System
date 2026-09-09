import { useMemo, useState, type FormEvent } from 'react';

import {
  Avatar,
  Button,
  Icon,
  IconButton,
  Modal,
  StatusPill,
} from '@/components/web';

import type {
  ClientMemberSummary,
  CreateClientMemberInput,
  UpdateClientMemberAccessInput,
} from './types';

type ClientMembersPanelProps = {
  canManage: boolean;
  canManageOwners: boolean;
  clientAccountId: string;
  clientName: string;
  currentUserId?: string;
  members: ClientMemberSummary[];
  onCreate?: (input: CreateClientMemberInput) => Promise<void>;
  onUpdate?: (input: UpdateClientMemberAccessInput) => Promise<void>;
};

const emptyForm: Omit<CreateClientMemberInput, 'clientAccountId'> = {
  email: '',
  fullName: '',
  role: 'member',
  temporaryPassword: '',
};

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
  return Array.from(
    { length: 14 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

export function ClientMembersPanel({
  canManage,
  canManageOwners,
  clientAccountId,
  clientName,
  currentUserId,
  members,
  onCreate,
  onUpdate,
}: ClientMembersPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] =
    useState<Omit<CreateClientMemberInput, 'clientAccountId'>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const visibleMembers = useMemo(
    () =>
      members
        .filter((member) => member.clientAccountId === clientAccountId)
        .sort((left, right) => {
          if (left.role !== right.role) return left.role === 'owner' ? -1 : 1;
          return left.name.localeCompare(right.name);
        }),
    [clientAccountId, members],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreate) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await onCreate({
        clientAccountId,
        email: form.email,
        fullName: form.fullName,
        role: canManageOwners ? form.role : 'member',
        temporaryPassword: form.temporaryPassword,
      });
      setForm(emptyForm);
      setFormOpen(false);
      setMessage(`${form.fullName.trim()} can now sign in to ${clientName}.`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The member could not be added.',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleAccess = async (member: ClientMemberSummary) => {
    if (!onUpdate) return;
    setError('');
    setMessage('');
    setBusyId(member.id);
    try {
      const status = member.status === 'active' ? 'suspended' : 'active';
      await onUpdate({
        membershipId: member.id,
        role: member.role,
        status,
      });
      setMessage(
        `${member.name} is now ${status === 'active' ? 'active' : 'suspended'}.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Client access could not be updated.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rm-client-instagram-panel rm-access-panel">
      <header className="rm-access-panel__header">
        <div>
          <h2>Client logins</h2>
        </div>
        {canManage && onCreate ? (
          <Button icon="plus" onClick={() => setFormOpen(true)}>
            Add login
          </Button>
        ) : null}
      </header>

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

      <div className="rm-member-list">
        {visibleMembers.map((member) => {
          const isSelf = member.userId === currentUserId;
          const canChange =
            canManage &&
            !isSelf &&
            (canManageOwners || member.role !== 'owner') &&
            Boolean(onUpdate);
          return (
            <article className="rm-member-row" key={member.id}>
              <Avatar name={member.name} size="md" src={member.avatarUrl} />
              <div className="rm-member-row__identity">
                <strong>{member.name}</strong>
                <span>{member.email}</span>
              </div>
              <div className="rm-member-row__badges">
                <StatusPill tone={member.role === 'owner' ? 'ink' : 'neutral'}>
                  {member.role === 'owner' ? 'Owner' : 'Member'}
                </StatusPill>
                <StatusPill
                  dot
                  tone={member.status === 'active' ? 'success' : 'warning'}
                >
                  {member.status === 'active' ? 'Active' : 'Suspended'}
                </StatusPill>
              </div>
              {canChange ? (
                <Button
                  disabled={busyId === member.id}
                  onClick={() => void toggleAccess(member)}
                  variant="ghost"
                >
                  {busyId === member.id
                    ? 'Saving…'
                    : member.status === 'active'
                      ? 'Suspend'
                      : 'Restore'}
                </Button>
              ) : (
                <span className="rm-member-row__locked">
                  {isSelf ? 'You' : member.role === 'owner' ? 'Protected' : ''}
                </span>
              )}
            </article>
          );
        })}
        {!visibleMembers.length ? (
          <div className="rm-access-empty">
            <Icon name="users" size={24} />
            <strong>No portal login yet</strong>
            <span>Add access whenever this client needs to sign in.</span>
          </div>
        ) : null}
      </div>

      <Modal
        description={`Create a secure login limited to ${clientName}.`}
        onClose={() => !saving && setFormOpen(false)}
        open={formOpen}
        title="Add client login"
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
            {canManageOwners ? (
              <label className="rm-field">
                <span>Access level</span>
                <select
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as 'owner' | 'member',
                    }))
                  }
                  value={form.role}
                >
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
            ) : null}
            <label className="rm-field">
              <span>Provisioning password</span>
              <div className="rm-input-with-action rm-client-login-password">
                <input
                  autoComplete="new-password"
                  minLength={10}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      temporaryPassword: event.target.value,
                    }))
                  }
                  required
                  spellCheck={false}
                  type="text"
                  value={form.temporaryPassword}
                />
                <Button
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      temporaryPassword: generateTemporaryPassword(),
                    }))
                  }
                  variant="secondary"
                >
                  Generate
                </Button>
              </div>
            </label>
          </div>
          <p className="rm-form-note">
            The member receives a secure email to choose their own password. The
            generated credential is used only to provision the account.
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
              {saving ? 'Adding…' : 'Add login'}
            </Button>
          </footer>
        </form>
      </Modal>
    </section>
  );
}
